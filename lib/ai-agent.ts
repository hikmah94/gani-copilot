import { env } from "cloudflare:workers";
import { executeTool, TOOLS, validateToolResult, type ToolCallRecord } from "@/lib/ai-tools";

export type AgentResult = { answer: string; provider: string; model: string; toolCalls: ToolCallRecord[] };

const MAX_ROUNDS = 4;

function safeParseArgs(raw: string): Record<string, unknown> {
  try { const parsed=JSON.parse(raw) as unknown;return parsed!==null&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{}; } catch { return {}; }
}

async function runCloudflareRound(messages: ChatCompletionMessageParam[], allowTools: boolean, tools:ChatCompletionTool[], requireTool=false): Promise<ChatCompletionResponseMessage> {
  const result = await env.AI.run(env.AI_MODEL || "@cf/openai/gpt-oss-20b", {
    messages,
    ...(allowTools && tools.length ? { tools, tool_choice: requireTool ? "required" as const : "auto" as const } : {}),
    max_tokens: 700,
    temperature: 0.2,
  }) as ChatCompletionsOutput;
  const choice = result.choices?.[0]?.message;
  if (!choice) throw new Error("Workers AI returned an empty response");
  return choice;
}

type OllamaToolCall = { id: string; function: { name: string; arguments: string } };

async function runOllamaRound(messages: ChatCompletionMessageParam[], allowTools: boolean, tools:ChatCompletionTool[]): Promise<{ content: string | null; tool_calls?: OllamaToolCall[] }> {
  const configuredUrl = String(env.OLLAMA_BASE_URL);
  if (!configuredUrl) throw new Error("Ollama is not configured on this deployment");
  const baseUrl = configuredUrl.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: env.OLLAMA_MODEL || "gpt-oss:20b", stream: false, messages, ...(allowTools && tools.length ? { tools } : {}) }),
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  const data = await response.json() as { message?: { content?: string; tool_calls?: { function: { name: string; arguments: string | Record<string, unknown> } }[] } };
  if (!data.message) throw new Error("Ollama returned an empty response");
  return {
    content: data.message.content ?? null,
    tool_calls: data.message.tool_calls?.map((tc, i) => ({
      id: `ollama-${i}`,
      function: { name: tc.function.name, arguments: typeof tc.function.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function.arguments) },
    })),
  };
}

export async function runToolCallingChat(systemPrompt: string, message: string, provider: "cloudflare" | "ollama", allowedTools?:string[]): Promise<AgentResult> {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: provider === "cloudflare" ? [{ type: "text", text: systemPrompt }] : systemPrompt },
    { role: "user", content: provider === "cloudflare" ? [{ type: "text", text: message }] : message },
  ];
  const toolCalls: ToolCallRecord[] = [];
  const modelName = provider === "ollama" ? (env.OLLAMA_MODEL || "gpt-oss:20b") : (env.AI_MODEL || "@cf/openai/gpt-oss-20b");
  const tools=allowedTools?TOOLS.filter(tool=>tool.type==="function"&&allowedTools.includes(tool.function.name)):TOOLS;
  const permittedToolNames=new Set(tools.flatMap(tool=>tool.type==="function"?[tool.function.name]:[]));

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const allowTools = round < MAX_ROUNDS - 1;
    if (provider === "ollama") {
      const response = await runOllamaRound(messages, allowTools, tools);
      if (!response.tool_calls?.length) return { answer: response.content?.trim() || "I could not generate an answer.", provider, model: modelName, toolCalls };
      messages.push({ role: "assistant", content: response.content ?? "", tool_calls: response.tool_calls.map((tc) => ({ id: tc.id, type: "function" as const, function: tc.function })) } as ChatCompletionMessageParam);
      for (const call of response.tool_calls) {
        const args = safeParseArgs(call.function.arguments);
        const result = permittedToolNames.has(call.function.name)?validateToolResult(call.function.name,await executeTool(call.function.name,args)):{error:"Tool call denied."};
        toolCalls.push({ name: call.function.name, args, result });
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    } else {
      const choice = await runCloudflareRound(messages, allowTools, tools, round===0);
      if (!choice.tool_calls?.length) return { answer: choice.content?.trim() || "I could not generate an answer.", provider, model: modelName, toolCalls };
      messages.push({ role: "assistant", content: choice.content ?? "", tool_calls: choice.tool_calls } as ChatCompletionMessageParam);
      for (const call of choice.tool_calls) {
        if (call.type !== "function") continue;
        const args = safeParseArgs(call.function.arguments);
        const result = permittedToolNames.has(call.function.name)?validateToolResult(call.function.name,await executeTool(call.function.name,args)):{error:"Tool call denied."};
        toolCalls.push({ name: call.function.name, args, result });
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
  }
  messages.push({role:"user",content:provider==="cloudflare"?[{type:"text",text:"Using only the tool results already returned, provide the final citizen-friendly answer now. Do not request another tool. If the records are empty, say that plainly."}]:"Using only the tool results already returned, provide the final citizen-friendly answer now. Do not request another tool. If the records are empty, say that plainly."});
  if(provider==="ollama"){const final=await runOllamaRound(messages,false,[]);return {answer:final.content?.trim()||"The available records were insufficient to answer this question.",provider,model:modelName,toolCalls};}
  const final=await runCloudflareRound(messages,false,[]);return {answer:final.content?.trim()||"The available records were insufficient to answer this question.",provider,model:modelName,toolCalls};
}

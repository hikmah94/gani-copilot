import { env } from "cloudflare:workers";

export type ModelResult = {
  response?: string;
  output_text?: string;
  choices?: Array<{ message?: { content?: string }; text?: string }>;
  output?: Array<{ content?: Array<{ text?: string }> }>;
};

export function extractAnswer(result: ModelResult): string | undefined {
  if (result.response?.trim()) return result.response.trim();
  if (result.output_text?.trim()) return result.output_text.trim();
  const choiceAnswer = result.choices?.map((choice) => choice.message?.content?.trim() || choice.text?.trim()).filter((text): text is string => Boolean(text)).join("\n\n");
  if (choiceAnswer) return choiceAnswer;
  const answer = result.output?.flatMap((item) => item.content ?? []).map((content) => content.text?.trim()).filter((text): text is string => Boolean(text)).join("\n\n");
  return answer || undefined;
}

async function runOllama(systemPrompt: string, message: string): Promise<string> {
  const configuredUrl = String(env.OLLAMA_BASE_URL);
  if (!configuredUrl) throw new Error("Ollama is not configured on this deployment");
  const baseUrl = configuredUrl.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: env.OLLAMA_MODEL || "gpt-oss:20b", stream: false, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: message }] }),
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  const result = await response.json() as { message?: { content?: string } };
  if (!result.message?.content) throw new Error("Ollama returned an empty response");
  return result.message.content;
}

export async function runAiModel(systemPrompt: string, message: string, provider: "cloudflare" | "ollama"): Promise<{ answer: string; provider: string; model: string }> {
  if (provider === "ollama") {
    const answer = await runOllama(systemPrompt, message);
    return { answer, provider: "ollama", model: env.OLLAMA_MODEL || "gpt-oss:20b" };
  }
  // gpt-oss spends part of max_tokens on hidden reasoning; a low effort and a larger cap keep
  // long, table-heavy document passages from leaving no visible answer. Retry once if it still does.
  let answer: string | undefined;
  for (let attempt = 0; attempt < 2 && !answer; attempt++) {
    const result = await env.AI.run(env.AI_MODEL || "@cf/openai/gpt-oss-20b", {
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: message }],
      max_tokens: 1600,
      reasoning_effort: "low",
      temperature: 0.2,
    }) as ModelResult;
    answer = extractAnswer(result);
  }
  if (!answer) throw new Error("Workers AI returned an empty response");
  return { answer, provider: "cloudflare", model: env.AI_MODEL || "@cf/openai/gpt-oss-20b" };
}

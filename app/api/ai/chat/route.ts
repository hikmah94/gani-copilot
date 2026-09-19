import { env } from "cloudflare:workers";
import { getAgentByName } from "agents";
import { budgets } from "@/lib/data";
import { runToolCallingChat } from "@/lib/ai-agent";
import { toolResultsToEvidence, type ToolCallRecord } from "@/lib/ai-tools";
import { recordAiUsage } from "@/lib/ai-telemetry";
import { hashIp } from "@/lib/ip-hash";
import { checkRateLimit } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";
import { routeIntent } from "@/lib/intent-router";
import { searchDocumentPassages } from "@/lib/repo-analytics";
import { extractEntities } from "@/lib/entity-extractor";
import { confidenceFromEvidence, type EvidenceItem } from "@/lib/evidence";
import type { GaniConversationAgent } from "@/worker/gani-conversation-agent";
import type { CivicIntent, RoutedIntent } from "@/lib/intent-router";

type ChatRequest = {
  message?: string;
  provider?: "cloudflare" | "ollama";
  conversationId?: string;
  stream?: boolean;
};
type StageReporter = (message: string) => void | Promise<void>;
type AiResponse = {
  answer: string;
  summary: string;
  facts: Array<{ title: string; detail: string }>;
  calculations: Array<{
    operation: string;
    inputs: Record<string, unknown>;
    result: unknown;
  }>;
  projects: Array<{
    id?: string;
    title: string;
    approved_amount?: number;
    sector?: string;
    mda?: string;
    location?: string;
    href?: string;
  }>;
  sources: EvidenceItem[];
  confidence: string;
  limitations: string[];
  suggested_followups: string[];
};

const conversationIdPattern = /^[A-Za-z0-9_-]{8,100}$/;
function routeForIntent(intent: CivicIntent): RoutedIntent["route"] {
  if (intent === "document_query") return "vectorize";
  if (intent === "hybrid_query" || intent === "follow_up")
    return "d1+vectorize";
  if (intent === "explanation") return "ai_context";
  if (intent === "unsupported") return "none";
  return "d1";
}

const budgetSeries = budgets.map((b) => `${b.year}: ${b.display}`).join(", ");

const systemPrompt = `You are GANI, a politically neutral public-accountability copilot for Niger State, Nigeria.

You have access to tools that query the live government-records database (projects, MDAs, sectors, and indexed budget documents). Use them whenever a question needs real data — never invent projects, allocations, figures or sources, and never add illustrative examples, project names or descriptions that are not literally present in the tool results. If a tool returns only an aggregate total with no project list, discuss the total only — do not speculate about what it might contain. If a tool returns no matching records, say so plainly rather than guessing.

The state's original approved-budget totals by year (for whole-year series questions) are: ${budgetSeries}. Use the controlled tools for all record access: search_projects and get_project for projects; aggregate_budget for sum/count/average/minimum/maximum; rank_projects or rank_mdas for rankings; get_sector_summary and get_location_summary for summaries; compare_allocations for comparisons; search_documents, retrieve_document_chunks, retrieve_evidence and get_document_page for source records; explain_term for definitions. Some questions need more than one tool — call as many as are relevant before answering.

Distinguish clearly between original approved appropriations (legal authority to spend) and actual releases or spending, which are separate and often unavailable. Keep the final answer in plain text, under 180 words, and note when a figure is nominal (not inflation-adjusted). Never return HTML, Markdown tables, headings, or presentation markup; the frontend controls presentation.

For "why" questions comparing figures (e.g. why one sector receives more than another), first report the numbers, then use search_documents to look for an indexed passage that actually explains the policy rationale. If no such passage is found, say plainly that the records show the difference but no indexed document explains the underlying policy reasoning — do not speculate about plausible-sounding causes (disease burden, past emergencies, political priorities, etc.) that are not backed by a retrieved document.`;

async function logAi(summary: string, status: "success" | "error") {
  try {
    await env.DB.prepare(
      "INSERT INTO admin_logs (id,event_type,actor,summary,status) VALUES (?1,'ai_request','public',?2,?3)",
    )
      .bind(crypto.randomUUID(), summary, status)
      .run();
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "ai_log_error",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
  }
}

function plainText(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\|?\s*:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)+\s*\|?\s*$/gm, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/`([^\`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/^\s*\|(.+)\|\s*$/gm, (_, cells: string) =>
      cells
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(" · "),
    )
    .trim();
}

function suggestedFollowups(
  intent: CivicIntent,
  entities: Record<string, unknown>,
) {
  const location =
    typeof entities.location === "string" ? entities.location : null;
  const sector = typeof entities.sector === "string" ? entities.sector : null;
  if (
    intent === "project_search" ||
    intent === "project_lookup" ||
    intent === "ranking"
  )
    return [
      sector ? `Only show ${sector} projects.` : "Only show health projects.",
      "Which has the highest allocation?",
      !sector
        ? "Compare with education."
        : sector.toLowerCase() !== "education"
          ? `Compare ${sector} with education.`
          : "Compare with health.",
      "Show the evidence.",
      location
        ? `What other projects are near ${location}?`
        : "What other projects are nearby?",
    ];
  if (intent === "document_query" || intent === "hybrid_query")
    return [
      "Which document pages support this answer?",
      "Explain this in simpler language.",
      "Are there related project records?",
    ];
  return [
    "Compare this with another sector.",
    "Show the supporting public records.",
    "What are the largest related projects?",
  ];
}

function structureResponse(
  answer: string,
  evidence: EvidenceItem[],
  toolCalls: ToolCallRecord[],
  intent: CivicIntent,
  entities: Record<string, unknown>,
  limitations: string[] = [],
): AiResponse {
  const clean = plainText(answer);
  const calculationTools = new Set([
    "aggregate_budget",
    "compare_allocations",
    "calculate_budget_share",
    "rank_projects",
    "rank_mdas",
    "rank_locations",
  ]);
  const projectRows = toolCalls.flatMap((call) => {
    const result = call.result as Record<string, unknown>;
    if (
      call.name === "get_project" &&
      result.project &&
      typeof result.project === "object"
    )
      return [result.project as Record<string, unknown>];
    return Array.isArray(result.projects)
      ? (result.projects as Record<string, unknown>[])
      : [];
  });
  const projects = projectRows
    .map((row) => ({
      id: typeof row.id === "string" ? row.id : undefined,
      title: String(row.title ?? "Untitled project"),
      approved_amount:
        typeof row.approved_amount === "number"
          ? row.approved_amount
          : undefined,
      sector: typeof row.sector_name === "string" ? row.sector_name : undefined,
      mda: typeof row.mda_name === "string" ? row.mda_name : undefined,
      location:
        typeof row.location_name === "string" ? row.location_name : undefined,
      href: typeof row.id === "string" ? `/projects/${row.id}` : undefined,
    }))
    .filter(
      (project, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.id === project.id && candidate.title === project.title,
        ) === index,
    )
    .slice(0, 10);
  const searchResult = toolCalls.find((call) => call.name === "search_projects")
    ?.result as Record<string, unknown> | undefined;
  const searchFact =
    typeof searchResult?.total === "number"
      ? { title: "Projects found", detail: String(searchResult.total) }
      : null;
  return {
    answer: clean,
    summary: (clean.split(/(?<=[.!?])\s+/)[0] || clean).slice(0, 320),
    facts: [
      ...(searchFact ? [searchFact] : []),
      ...evidence
        .slice(0, 10)
        .map((item) => ({ title: item.title, detail: item.detail })),
    ],
    calculations: toolCalls
      .filter((call) => calculationTools.has(call.name))
      .map((call) => ({
        operation: call.name,
        inputs: call.args,
        result: call.result,
      })),
    projects,
    sources: evidence,
    confidence: confidenceFromEvidence(evidence),
    limitations: limitations.length
      ? limitations
      : evidence.length
        ? []
        : ["No matching source record was found for this answer."],
    suggested_followups: suggestedFollowups(intent, entities),
  };
}

async function buildChatResponse(
  body: ChatRequest,
  message: string,
  provider: "cloudflare" | "ollama",
  started: number,
  report: StageReporter = () => {},
): Promise<AiResponse> {
  await report("Understanding your question...");
  const initialRouted = routeIntent(message);
  const explicitEntities = await extractEntities(message, initialRouted.intent);
  const conversationId =
    body.conversationId && conversationIdPattern.test(body.conversationId)
      ? body.conversationId
      : crypto.randomUUID();
  const agent = await getAgentByName<Env, GaniConversationAgent>(
    env.GANI_CONVERSATION,
    conversationId,
  );
  const contextual = await agent.resolveContext(
    conversationId,
    explicitEntities,
    initialRouted.intent,
  );
  const routed: RoutedIntent =
    contextual.effectiveIntent === initialRouted.intent
      ? initialRouted
      : {
          intent: contextual.effectiveIntent,
          route: routeForIntent(contextual.effectiveIntent),
          confidence: initialRouted.confidence,
        };
  const entities = contextual.entities;
  await env.DB.prepare(
    "INSERT INTO ai_intent_logs (id,intent,route_used,confidence) VALUES (?1,?2,?3,?4)",
  )
    .bind(crypto.randomUUID(), routed.intent, routed.route, routed.confidence)
    .run();
  if (routed.intent === "unsupported")
    return structureResponse(
      "I can help with Niger State budgets, projects, public records, civic-finance calculations, and evidence-backed explanations. I can’t answer that request from the approved civic information available to me.",
      [],
      [],
      routed.intent,
      entities,
      ["This request is outside GANI’s approved civic-information scope."],
    );
  void trackEvent("question_asked", { provider });
  const d1Tools = [
    "get_budget_records",
    "search_projects",
    "get_project",
    "aggregate_budget",
    "compare_allocations",
    "rank_projects",
    "rank_mdas",
    "rank_locations",
    "calculate_budget_share",
    "get_sector_summary",
    "get_location_summary",
    "retrieve_evidence",
  ];
  const documentTools = [
    "search_documents",
    "retrieve_document_chunks",
    "retrieve_evidence",
    "get_document_page",
  ];
  const allowed =
    routed.intent === "project_lookup"
      ? ["get_project", "retrieve_evidence"]
      : routed.intent === "project_search"
        ? ["search_projects", "rank_projects", "retrieve_evidence"]
        : routed.route === "vectorize"
          ? []
          : routed.route === "d1"
            ? d1Tools
            : routed.route === "d1+vectorize"
              ? [...d1Tools, ...documentTools]
              : routed.route === "ai_context"
                ? ["explain_term"]
                : [];
  if (routed.route === "d1" || routed.route === "d1+vectorize")
    await report("Checking budget records...");
  if (routed.route === "vectorize" || routed.route === "d1+vectorize")
    await report("Retrieving evidence...");
  const routedPassages =
    routed.route === "vectorize" || routed.route === "d1+vectorize"
      ? await searchDocumentPassages(message)
      : [];
  const passageContext = routedPassages.length
    ? `\n\nVECTORIZE RETRIEVAL (quote or paraphrase only what is present):\n${routedPassages.map((p) => `[${p.documentTitle}, page ${p.page}] ${p.snippet}`).join("\n")}`
    : "";
  const routeInstruction = `\n\nINTENT ROUTER: ${routed.intent}. Required evidence route: ${routed.route}. EXTRACTED ENTITIES: ${JSON.stringify(entities)}. Pass normalized entities to matching tool arguments. For search tools map lga/location to location, minimum_amount to minAllocation, maximum_amount to maxAllocation, and expenditure_type to expenditureType. For analytical tools map sector to sector or sector_id as specified, lga/location to location_id, mda to mda_id, and expenditure_type to expenditure_type. Use rank_projects for biggest projects, rank_locations for LGA rankings, rank_mdas with measure project_count for ministries with the most projects, calculate_budget_share for percentages, and compare_allocations for sector comparisons. Never calculate authoritative financial ratios yourself. ${routed.route === "d1" ? "Call at least one available D1 tool before answering." : routed.route === "vectorize" ? "Use the Vectorize retrieval supplied below." : routed.route === "d1+vectorize" ? "Use a structured D1 tool together with the supplied Vectorize passages." : "Use only approved civic terminology context."}`;
  const result = await runToolCallingChat(
    systemPrompt + routeInstruction + passageContext,
    message,
    provider,
    allowed,
  );
  if (routed.route !== "vectorize" && routed.route !== "d1+vectorize")
    await report("Retrieving evidence...");
  const evidence = [
    ...routedPassages.map((p) => ({
      key: `routed-${p.documentId}-${p.page}`,
      title: p.documentTitle,
      detail: `${p.page ? `Page ${p.page} · ` : ""}${p.snippet}`,
      sourceType: "official-document" as const,
      href: `/documents/${p.documentId}`,
      verification: "verified",
      documentTitle: p.documentTitle,
      issuingAuthority: p.issuingAuthority ?? undefined,
      year: p.year ?? undefined,
      documentType: p.documentType ?? undefined,
      page: p.page,
      passage: p.snippet,
      sourceUrl: p.sourceUrl ?? undefined,
      indexedAt: p.indexedAt ?? undefined,
    })),
    ...toolResultsToEvidence(result.toolCalls),
  ].filter(
    (item, index, all) =>
      all.findIndex((candidate) => candidate.key === item.key) === index,
  );
  if (result.toolCalls.length && !evidence.length)
    void trackEvent("no_evidence_found", { question: message.slice(0, 100) });

  await logAi(
    `Completed request with ${result.model} (${result.toolCalls.length} tool call(s): ${result.toolCalls.map((t) => t.name).join(", ") || "none"})`,
    "success",
  );
  await recordAiUsage({
    provider: result.provider,
    model: result.model,
    queryType: "general",
    status: "success",
    latencyMs: Date.now() - started,
    inputChars: message.length,
    outputChars: result.answer.length,
    evidenceCount: evidence.length,
  });
  void trackEvent("question_completed", {
    provider,
    toolsUsed: result.toolCalls.map((t) => t.name).join(","),
  });
  return structureResponse(
    result.answer,
    evidence,
    result.toolCalls,
    routed.intent,
    entities,
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "AI is temporarily unavailable.";
}

export async function POST(request: Request) {
  const started = Date.now();
  const ipHash = await hashIp(request);
  const limit = await checkRateLimit("ai_chat", ipHash, 20, 60);
  if (!limit.allowed)
    return Response.json(
      { error: "Too many requests. Please wait a moment before asking again." },
      { status: 429 },
    );
  const body = (await request.json()) as ChatRequest;
  const message = body.message?.trim();
  if (!message || message.length > 1000)
    return Response.json(
      { error: "Enter a question of 1–1,000 characters." },
      { status: 400 },
    );
  const provider = body.provider === "ollama" ? "ollama" : "cloudflare";

  if (body.stream) {
    const { readable, writable } = new TransformStream<
      Uint8Array,
      Uint8Array
    >();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const send = (event: Record<string, unknown>) =>
      writer.write(encoder.encode(`${JSON.stringify(event)}\n`));
    void (async () => {
      try {
        const data = await buildChatResponse(
          body,
          message,
          provider,
          started,
          (status) => send({ type: "status", message: status }),
        );
        for (const delta of data.answer.match(/\S+\s*/g) ?? [data.answer])
          await send({ type: "answer_delta", delta });
        const { answer: _, ...metadata } = data;
        await send({ type: "complete", data: metadata });
      } catch (error) {
        const detail = errorMessage(error);
        console.error(
          JSON.stringify({ event: "ai_chat_stream_error", message: detail }),
        );
        await logAi(detail, "error");
        await recordAiUsage({
          provider: "cloudflare",
          model: env.AI_MODEL || "@cf/openai/gpt-oss-20b",
          queryType: "general",
          status: "error",
          latencyMs: Date.now() - started,
          errorMessage: detail,
        });
        await send({ type: "error", error: detail });
      } finally {
        await writer.close();
      }
    })();
    return new Response(readable, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "x-content-type-options": "nosniff",
      },
    });
  }

  try {
    return Response.json(
      await buildChatResponse(body, message, provider, started),
    );
  } catch (error) {
    const detail = errorMessage(error);
    console.error(JSON.stringify({ event: "ai_chat_error", message: detail }));
    await logAi(detail, "error");
    await recordAiUsage({
      provider: "cloudflare",
      model: env.AI_MODEL || "@cf/openai/gpt-oss-20b",
      queryType: "general",
      status: "error",
      latencyMs: Date.now() - started,
      errorMessage: detail,
    });
    void trackEvent("ai_error", { route: "chat" });
    return Response.json({ error: detail }, { status: 503 });
  }
}

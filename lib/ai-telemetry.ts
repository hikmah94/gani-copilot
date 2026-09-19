import { env } from "cloudflare:workers";

export type AiUsageInput = {
  provider: string;
  model: string;
  queryType?: "general" | "document";
  documentId?: string | null;
  status: "success" | "error";
  latencyMs?: number;
  inputChars?: number;
  outputChars?: number;
  evidenceCount?: number;
  errorMessage?: string;
};

export async function recordAiUsage(input: AiUsageInput) {
  try {
    await env.DB.prepare(
      "INSERT INTO ai_usage_events (id,provider,model,query_type,document_id,status,latency_ms,input_chars,output_chars,evidence_count,error_message) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)"
    ).bind(
      crypto.randomUUID(),
      input.provider,
      input.model,
      input.queryType || "general",
      input.documentId || null,
      input.status,
      input.latencyMs ?? null,
      input.inputChars ?? null,
      input.outputChars ?? null,
      input.evidenceCount ?? 0,
      input.errorMessage || null
    ).run();
  } catch (error) {
    console.error(JSON.stringify({ event: "ai_telemetry_error", message: error instanceof Error ? error.message : "unknown" }));
  }
}

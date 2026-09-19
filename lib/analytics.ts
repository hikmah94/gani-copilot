import { env } from "cloudflare:workers";

export type AnalyticsEventType =
  | "question_asked" | "question_completed" | "evidence_opened" | "project_viewed"
  | "document_viewed" | "filter_applied" | "search_performed"
  | "community_report_submitted" | "no_evidence_found" | "ai_error";

export async function trackEvent(eventType: AnalyticsEventType, properties?: Record<string, unknown>, sessionId?: string) {
  try {
    await env.DB.prepare("INSERT INTO analytics_events (id,event_type,properties,session_id) VALUES (?1,?2,?3,?4)")
      .bind(crypto.randomUUID(), eventType, properties ? JSON.stringify(properties).slice(0, 2000) : null, sessionId || null).run();
  } catch (error) {
    console.error(JSON.stringify({ event: "analytics_error", message: error instanceof Error ? error.message : "unknown" }));
  }
}

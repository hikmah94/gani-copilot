const ALLOWED_CLIENT_EVENTS = new Set(["evidence_opened", "filter_applied"]);

export function track(eventType: string, properties?: Record<string, unknown>) {
  if (!ALLOWED_CLIENT_EVENTS.has(eventType)) return;
  try {
    const payload = JSON.stringify({ eventType, properties });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/event", new Blob([payload], { type: "application/json" }));
    } else {
      void fetch("/api/analytics/event", { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
    }
  } catch {
    // best-effort only, never block the UI
  }
}

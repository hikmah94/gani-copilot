import { env } from "cloudflare:workers";
import { hashIp } from "@/lib/ip-hash";
import { checkRateLimit } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";

const REPORT_STATUSES = ["Completed", "Ongoing", "Not Started", "Cannot Confirm"];
const MIN_FILL_SECONDS = 3;

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = String(Reflect.get(env, "TURNSTILE_SECRET_KEY") || "");
  if (!secret) return true; // Turnstile not configured on this deployment yet — honeypot/timing checks still apply.
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    const result = await response.json() as { success?: boolean };
    return Boolean(result.success);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const ipHash = await hashIp(request);
  const limit = await checkRateLimit("feedback", ipHash, 5, 3600);
  if (!limit.allowed) return Response.json({ error: "Too many submissions from this network. Please try again later." }, { status: 429 });

  const form = await request.formData();
  const projectId = String(form.get("projectId") || "").trim();
  const reportStatus = String(form.get("reportStatus") || "");
  const observation = String(form.get("observation") || "").trim().slice(0, 2000);
  const honeypot = String(form.get("website") || "");
  const renderedAt = Number(form.get("renderedAt") || 0);
  const turnstileToken = String(form.get("turnstileToken") || "");
  const photo = form.get("photo");

  if (honeypot) return Response.json({ error: "Submission rejected." }, { status: 400 });
  if (!renderedAt || (Date.now() - renderedAt) / 1000 < MIN_FILL_SECONDS) return Response.json({ error: "Please take a moment before submitting." }, { status: 400 });
  if (!projectId || !REPORT_STATUSES.includes(reportStatus)) return Response.json({ error: "A project and a valid status are required." }, { status: 400 });

  const siteKey = env.TURNSTILE_SITE_KEY;
  if (siteKey && !(await verifyTurnstile(turnstileToken, request.headers.get("cf-connecting-ip") || ""))) {
    return Response.json({ error: "Verification failed. Please try again." }, { status: 400 });
  }

  const project = await env.DB.prepare("SELECT id FROM projects WHERE id=?1").bind(projectId).first<{ id: string }>();
  if (!project) return Response.json({ error: "That project could not be found." }, { status: 404 });

  const id = crypto.randomUUID();
  let evidenceKey: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 8 * 1024 * 1024) return Response.json({ error: "Photo must be 8 MB or smaller." }, { status: 400 });
    evidenceKey = `community/${projectId}/${id}-${photo.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    await env.DOCUMENTS.put(evidenceKey, photo.stream(), { httpMetadata: { contentType: photo.type || "application/octet-stream" } });
  }

  await env.DB.prepare(
    "INSERT INTO community_reports (id,project_id,report_status,observation,evidence_r2_key,anonymous_identifier) VALUES (?1,?2,?3,?4,?5,?6)"
  ).bind(id, projectId, reportStatus, observation || null, evidenceKey, ipHash).run();

  await trackEvent("community_report_submitted", { projectId, reportStatus });
  return Response.json({ ok: true, id });
}

import { env } from "cloudflare:workers";
import { isAdmin } from "@/lib/admin-auth";

type ManageBody = { action?: string; resource?: string; id?: string; values?: Record<string, string | number | null> };
const definitions = {
  sectors: { fields: ["name", "slug", "description"] },
  mdas: { fields: ["name", "type", "sector_id"] },
  locations: { fields: ["name", "type", "senatorial_zone", "state"] },
  budgets: { fields: ["budget_year", "title", "total_budget", "capital_expenditure", "recurrent_expenditure", "status"] },
  entity_aliases: { fields: ["alias", "entity_type", "canonical_value", "canonical_id", "active"] },
} as const;

async function log(summary: string, status = "success") {
  await env.DB.prepare("INSERT INTO admin_logs (id,event_type,actor,summary,status) VALUES (?1,'admin_change','administrator',?2,?3)").bind(crypto.randomUUID(), summary, status).run();
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as ManageBody;
  const definition = body.resource && definitions[body.resource as keyof typeof definitions];
  if (!body.resource || !definition || !body.values) return Response.json({ error: "Invalid resource." }, { status: 400 });
  const fields = definition.fields.filter((field) => Object.hasOwn(body.values!, field));
  if (!fields.length) return Response.json({ error: "No valid fields." }, { status: 400 });
  const id = body.id || crypto.randomUUID();
  const values = fields.map((field) => body.values![field] ?? null);
  if (body.action === "update" && body.id) {
    const assignments = fields.map((field, index) => `${field}=?${index + 1}`).join(",");
    await env.DB.prepare(`UPDATE ${body.resource} SET ${assignments} WHERE id=?${fields.length + 1}`).bind(...values, id).run();
  } else {
    const extras = body.resource === "budgets" ? { government_id: "niger-state" } : {};
    const allValues = { id, ...extras, ...Object.fromEntries(fields.map((field, index) => [field, values[index]])) };
    const columns = Object.keys(allValues);
    await env.DB.prepare(`INSERT INTO ${body.resource} (${columns.join(",")}) VALUES (${columns.map((_, index) => `?${index + 1}`).join(",")})`).bind(...Object.values(allValues)).run();
  }
  await log(`${body.action === "update" ? "Updated" : "Created"} ${body.resource} record ${id}`);
  return Response.json({ ok: true, id });
}

export async function PATCH(request: Request) {
  if (!(await isAdmin(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { reportId?: string; moderationStatus?: string; verificationStatus?: string };
  if (!body.reportId || !["pending", "approved", "rejected"].includes(body.moderationStatus || "")) return Response.json({ error: "Invalid review." }, { status: 400 });
  await env.DB.prepare("UPDATE community_reports SET moderation_status=?1, verification_status=?2 WHERE id=?3").bind(body.moderationStatus, body.verificationStatus || "unverified", body.reportId).run();
  await log(`Reviewed community report ${body.reportId}`);
  return Response.json({ ok: true });
}

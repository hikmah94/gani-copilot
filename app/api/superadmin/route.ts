import { env } from "cloudflare:workers";
import { getAdminSession, hashPassword } from "@/lib/admin-auth";

async function authorize(request: Request) {
  const session = await getAdminSession(request);
  return session?.role === "super_administrator" ? session : null;
}

async function audit(actor: string, summary: string, status = "success") {
  await env.DB.prepare("INSERT INTO admin_logs (id,event_type,actor,summary,status) VALUES (?1,'super_admin',?2,?3,?4)").bind(crypto.randomUUID(), actor, summary, status).run();
}

export async function GET(request: Request) {
  const session = await authorize(request);
  if (!session) return Response.json({ error: "Super administrator access required." }, { status: 403 });
  const [administrators, configuration, sources, flags, approvals, auditLogs] = await env.DB.batch([
    env.DB.prepare("SELECT id,email,display_name,role,status,created_at,last_login_at FROM administrators ORDER BY created_at DESC"),
    env.DB.prepare("SELECT * FROM system_configuration ORDER BY category,config_key"),
    env.DB.prepare("SELECT * FROM data_sources ORDER BY created_at DESC"),
    env.DB.prepare("SELECT * FROM feature_flags ORDER BY label"),
    env.DB.prepare("SELECT * FROM destructive_operation_requests ORDER BY created_at DESC LIMIT 100"),
    env.DB.prepare("SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 100"),
  ]);
  return Response.json({ administrators:administrators.results, configuration:configuration.results, sources:sources.results, flags:flags.results, approvals:approvals.results, auditLogs:auditLogs.results });
}

export async function POST(request: Request) {
  const session = await authorize(request);
  if (!session) return Response.json({ error: "Super administrator access required." }, { status: 403 });
  const body = await request.json() as { action?:string; values?:Record<string,string|number|boolean> };
  const values = body.values || {};
  if (body.action === "create_administrator") {
    const email=String(values.email||"").trim().toLowerCase(), password=String(values.password||""), name=String(values.display_name||"").trim();
    const role=values.role === "super_administrator" ? "super_administrator" : "administrator";
    if (!email.includes("@") || password.length < 12 || !name) return Response.json({error:"Name, valid email, and a password of at least 12 characters are required."},{status:400});
    const credentials=await hashPassword(password);
    await env.DB.prepare("INSERT INTO administrators (id,email,display_name,role,password_hash,password_salt) VALUES (?1,?2,?3,?4,?5,?6)").bind(crypto.randomUUID(),email,name,role,credentials.hash,credentials.salt).run();
    await audit(session.email,`Created ${role} account for ${email}`);
  } else if (body.action === "save_configuration") {
    const key=String(values.config_key||"").trim(), value=String(values.config_value??""), category=String(values.category||"system");
    if (!key) return Response.json({error:"Configuration key is required."},{status:400});
    await env.DB.prepare("INSERT INTO system_configuration (config_key,config_value,category,description,updated_by) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(config_key) DO UPDATE SET config_value=excluded.config_value,category=excluded.category,description=excluded.description,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(key,value,category,String(values.description||""),session.email).run();
    await audit(session.email,`Updated configuration ${key}`);
  } else if (body.action === "create_source") {
    const name=String(values.name||"").trim(), url=String(values.source_url||"").trim();
    if (!name || !URL.canParse(url)) return Response.json({error:"A source name and valid URL are required."},{status:400});
    await env.DB.prepare("INSERT INTO data_sources (id,name,source_url,source_type,trust_level,enabled) VALUES (?1,?2,?3,?4,?5,1)").bind(crypto.randomUUID(),name,url,String(values.source_type||"official_portal"),String(values.trust_level||"review_required")).run();
    await audit(session.email,`Added data source ${name}`);
  } else if (body.action === "request_operation") {
    const type=String(values.operation_type||""), target=String(values.target_id||""), reason=String(values.reason||"");
    if (!type || !target || reason.length < 10) return Response.json({error:"Operation, target, and a clear reason are required."},{status:400});
    await env.DB.prepare("INSERT INTO destructive_operation_requests (id,operation_type,target_type,target_id,reason,requested_by) VALUES (?1,?2,?3,?4,?5,?6)").bind(crypto.randomUUID(),type,String(values.target_type||"record"),target,reason,session.email).run();
    await audit(session.email,`Requested destructive operation ${type} on ${target}`);
  } else return Response.json({error:"Unsupported operation."},{status:400});
  return Response.json({ok:true});
}

export async function PATCH(request: Request) {
  const session = await authorize(request);
  if (!session) return Response.json({ error: "Super administrator access required." }, { status: 403 });
  const body = await request.json() as { action?:string; id?:string; key?:string; enabled?:boolean; status?:string };
  if (body.action === "administrator_status" && body.id && ["active","suspended"].includes(body.status||"")) {
    await env.DB.prepare("UPDATE administrators SET status=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2").bind(body.status,body.id).run();
    await audit(session.email,`${body.status === "active" ? "Activated" : "Suspended"} administrator ${body.id}`);
  } else if (body.action === "feature_flag" && body.key) {
    await env.DB.prepare("UPDATE feature_flags SET enabled=?1,updated_by=?2,updated_at=CURRENT_TIMESTAMP WHERE flag_key=?3").bind(body.enabled?1:0,session.email,body.key).run();
    await audit(session.email,`${body.enabled ? "Enabled" : "Disabled"} feature ${body.key}`);
  } else if (body.action === "source_status" && body.id) {
    await env.DB.prepare("UPDATE data_sources SET enabled=?1 WHERE id=?2").bind(body.enabled?1:0,body.id).run();
    await audit(session.email,`${body.enabled ? "Enabled" : "Disabled"} data source ${body.id}`);
  } else if (body.action === "review_operation" && body.id && ["approved","rejected"].includes(body.status||"")) {
    await env.DB.prepare("UPDATE destructive_operation_requests SET status=?1,reviewed_by=?2,reviewed_at=CURRENT_TIMESTAMP WHERE id=?3 AND status='pending'").bind(body.status,session.email,body.id).run();
    await audit(session.email,`${body.status} destructive operation ${body.id}`);
  } else return Response.json({error:"Invalid update."},{status:400});
  return Response.json({ok:true});
}

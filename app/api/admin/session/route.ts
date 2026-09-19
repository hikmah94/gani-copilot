import { env } from "cloudflare:workers";
import { adminCookie, createAdminSession, getAdminSession, passwordMatches, verifyPassword } from "@/lib/admin-auth";
import { hashIp } from "@/lib/ip-hash";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  return Response.json({ authenticated: Boolean(session), user: session && { email: session.email, role: session.role } });
}

export async function POST(request: Request) {
  const ipHash = await hashIp(request);
  const limit = await checkRateLimit("admin_login", ipHash, 8, 60);
  if (!limit.allowed) return Response.json({ error: "Too many sign-in attempts. Please wait a moment and try again." }, { status: 429 });

  const body = await request.json() as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || !body.password) return Response.json({ error: "Invalid administrator credentials." }, { status: 401 });
  let role: "administrator" | "super_administrator" | null = null;
  if (email === env.ADMIN_EMAIL.toLowerCase() && await passwordMatches(body.password)) role = "super_administrator";
  else {
    const admin = await env.DB.prepare("SELECT email,role,password_hash,password_salt FROM administrators WHERE email=?1 AND status='active'").bind(email).first<{ email:string; role:"administrator"|"super_administrator"; password_hash:string; password_salt:string }>();
    if (admin && await verifyPassword(body.password, admin.password_hash, admin.password_salt)) {
      role = admin.role;
      await env.DB.prepare("UPDATE administrators SET last_login_at=CURRENT_TIMESTAMP WHERE email=?1").bind(email).run();
    }
  }
  if (!role) {
    await env.DB.prepare("INSERT INTO admin_logs (id,event_type,actor,summary,status,ip_hash) VALUES (?1,'authentication',?2,'Sign-in attempt rejected','error',?3)").bind(crypto.randomUUID(), email, ipHash).run();
    return Response.json({ error: "Invalid administrator credentials." }, { status: 401 });
  }
  const session = await createAdminSession(email, role);
  await env.DB.prepare("INSERT INTO admin_logs (id,event_type,actor,summary,status,ip_hash) VALUES (?1,'authentication',?2,'Administrator signed in','success',?3)").bind(crypto.randomUUID(), email, ipHash).run();
  return Response.json({ authenticated: true, user: { email, role } }, { headers: { "set-cookie": adminCookie(session) } });
}

export async function DELETE() {
  return Response.json({ authenticated: false }, { headers: { "set-cookie": adminCookie("", 0) } });
}

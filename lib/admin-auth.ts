import { env } from "cloudflare:workers";

const COOKIE = "gani_admin";
const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
}

async function sessionKey() {
  return crypto.subtle.importKey("raw", encoder.encode(String(Reflect.get(env, "ADMIN_SESSION_SECRET"))), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function sign(value: string) {
  const key = await sessionKey();
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export type AdminSession = { email: string; role: "administrator" | "super_administrator"; exp: number };

export async function createAdminSession(email: string, role: AdminSession["role"]) {
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({ email, role, exp: Date.now() + 8 * 60 * 60 * 1000 })));
  return `${payload}.${await sign(payload)}`;
}

export async function getAdminSession(request: Request): Promise<AdminSession | null> {
  const token = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !(await crypto.subtle.verify("HMAC", await sessionKey(), base64UrlToBytes(signature), encoder.encode(payload)))) return null;
  try {
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as AdminSession;
    return decoded.email && ["administrator", "super_administrator"].includes(decoded.role) && decoded.exp > Date.now() ? decoded : null;
  } catch { return null; }
}

export async function isAdmin(request: Request) { return Boolean(await getAdminSession(request)); }
export async function isSuperAdmin(request: Request) { return (await getAdminSession(request))?.role === "super_administrator"; }

export async function passwordMatches(candidate: string) {
  const key = await sessionKey();
  const expected = await crypto.subtle.sign("HMAC", key, encoder.encode(String(Reflect.get(env, "ADMIN_PASSWORD"))));
  return crypto.subtle.verify("HMAC", key, expected, encoder.encode(candidate));
}

export async function hashPassword(password: string, salt = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(18)))) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 210000 }, key, 256);
  return { hash: bytesToBase64Url(new Uint8Array(hash)), salt };
}

export async function verifyPassword(password: string, expectedHash: string, salt: string) {
  const calculated = await hashPassword(password, salt);
  const key = await sessionKey();
  const expected = await crypto.subtle.sign("HMAC", key, encoder.encode(expectedHash));
  return crypto.subtle.verify("HMAC", key, expected, encoder.encode(calculated.hash));
}

export const adminCookie = (value: string, maxAge = 28800) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

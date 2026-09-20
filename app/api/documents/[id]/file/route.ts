import { env } from "cloudflare:workers";
import { allowedPdfSourceUrl } from "@/lib/document-file";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await env.DB.prepare("SELECT r2_key,original_url,title FROM documents WHERE id=?1").bind(id).first<{ r2_key: string | null; original_url: string | null; title: string }>();
  if (!doc) return new Response("Not found", { status: 404 });
  const filename = `${doc.title.replace(/[^a-zA-Z0-9 ._-]/g, "")}.pdf`;
  const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";

  if (doc.r2_key) {
    const object = await env.DOCUMENTS.get(doc.r2_key, { range: request.headers });
    if (object) {
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("content-type", object.httpMetadata?.contentType || "application/pdf");
      headers.set("content-disposition", `${disposition}; filename="${filename}"`);
      headers.set("cache-control", "private, max-age=3600");
      headers.set("accept-ranges", "bytes");
      headers.set("etag", object.httpEtag);
      const range = request.headers.has("range") ? (object.range as { offset?: number; length?: number; suffix?: number } | undefined) : undefined;
      if (range) {
        const length = range.suffix !== undefined ? Math.min(range.suffix, object.size) : (range.length ?? object.size - (range.offset ?? 0));
        const start = range.suffix !== undefined ? object.size - length : (range.offset ?? 0);
        headers.set("content-range", `bytes ${start}-${start + length - 1}/${object.size}`);
        headers.set("content-length", String(length));
      } else headers.set("content-length", String(object.size));
      return new Response(object.body, { status: range ? 206 : 200, headers });
    }
  }

  const source = allowedPdfSourceUrl(doc.original_url);
  if (!source) return new Response("A viewable PDF is not attached to this record.", { status: 404 });
  const upstreamHeaders = new Headers({ accept: "application/pdf" });
  const range = request.headers.get("range");
  if (range) upstreamHeaders.set("range", range);
  const upstream = await fetch(source, { headers: upstreamHeaders, redirect: "manual" });
  if (!upstream.ok || !upstream.body) return new Response("The source document is temporarily unavailable.", { status: 502 });
  const contentType = upstream.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/pdf")) return new Response("This source is not a PDF document.", { status: 415 });
  const headers = new Headers({
    "content-type": "application/pdf",
    "content-disposition": `${disposition}; filename="${filename}"`,
    "cache-control": "private, max-age=1800",
    "accept-ranges": upstream.headers.get("accept-ranges") || "bytes",
  });
  for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

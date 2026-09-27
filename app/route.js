import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Eski server.mjs, "/" isteğini public/index.html'e eşliyordu.
// public/index.html değişmedi (windows/ders-akisi.mjs build-windows.mjs ile hâlâ bu dosyadan üretiliyor);
// burada aynı davranışı Next.js route handler'ı olarak koruyoruz.
export const dynamic = "force-dynamic";

async function serveIndex() {
  const html = await readFile(join(process.cwd(), "public", "index.html"), "utf8");
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET() {
  return serveIndex();
}

export async function HEAD() {
  const response = await serveIndex();
  return new Response(null, { status: response.status, headers: response.headers });
}

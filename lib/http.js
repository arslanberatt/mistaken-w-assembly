// Route handler'lar için ortak JSON yanıt ve gövde okuma yardımcıları.
// Eski server.mjs'teki respondJson/readJsonRequest davranışını (2MB gövde sınırı) korur.

export function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function readJsonRequest(request, limit = 2_000_000) {
  const raw = await request.text();
  if (raw.length > limit) throw new Error("İstek gövdesi çok büyük.");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

// Origin, bu sunucunun kendi origin'iyle (host + port) eşleşiyor mu?
// Yalnızca yerel makineden (tarayıcıdan aynı origin) gelen isteklere izin verir.
export function isLocalOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const hostname = originUrl.hostname;
    const isLoopback = hostname === "localhost" || hostname === "127.0.0.1";
    return isLoopback && originUrl.port === request.nextUrl.port;
  } catch {
    return false;
  }
}

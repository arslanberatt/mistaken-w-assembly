import { json } from "../../../lib/http.js";
import { getApiKey } from "../../../lib/api-keys.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = await getApiKey("assemblyai");
  if (!apiKey) {
    return json({ error: "AssemblyAI anahtarı kayıtlı değil. Sol menüdeki API sekmesinden anahtarını gir." }, 500);
  }

  try {
    const tokenResponse = await fetch("https://streaming.assemblyai.com/v3/token?expires_in_seconds=600", {
      headers: { Authorization: apiKey }
    });
    const result = await tokenResponse.json();
    if (!tokenResponse.ok || !result.token) {
      return json({ error: result?.error || "Canlı mikrofon bağlantısı için token alınamadı." }, tokenResponse.status || 500);
    }
    return json({ token: result.token });
  } catch (error) {
    console.error(error);
    return json({ error: "AssemblyAI bağlantısı kurulamadı." }, 500);
  }
}

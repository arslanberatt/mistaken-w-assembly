import { isLocalOrigin, json, readJsonRequest } from "../../../lib/http.js";
import { apiKeyStatus, setApiKeys } from "../../../lib/api-keys.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(await apiKeyStatus());
}

export async function POST(request) {
  if (!isLocalOrigin(request)) {
    return json({ error: "API anahtarları yalnızca yerel uygulamadan kaydedilebilir." }, 403);
  }
  try {
    const body = await readJsonRequest(request);
    const updates = {};
    for (const name of ["assemblyai", "anthropic"]) {
      if (typeof body[name] === "string") updates[name] = body[name];
    }
    if (!Object.keys(updates).length) {
      throw new Error("Kaydedilecek API anahtarı gönderilmedi.");
    }
    await setApiKeys(updates);
    return json(await apiKeyStatus());
  } catch (error) {
    return json({ error: error.message || "API anahtarı kaydedilemedi." }, 400);
  }
}

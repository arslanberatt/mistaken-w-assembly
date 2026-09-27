import { isLocalOrigin, json, readJsonRequest } from "../../../lib/http.js";
import { apiKeyStatus, getCliProvider, setApiKeys, setCliProvider } from "../../../lib/api-keys.js";

export const dynamic = "force-dynamic";

async function fullStatus() {
  return { ...(await apiKeyStatus()), provider: await getCliProvider() };
}

export async function GET() {
  return json(await fullStatus());
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
    let didSomething = false;
    if (Object.keys(updates).length) {
      await setApiKeys(updates);
      didSomething = true;
    }
    if (typeof body.provider === "string") {
      await setCliProvider(body.provider);
      didSomething = true;
    }
    if (!didSomething) {
      throw new Error("Kaydedilecek API anahtarı gönderilmedi.");
    }
    return json(await fullStatus());
  } catch (error) {
    return json({ error: error.message || "API anahtarı kaydedilemedi." }, 400);
  }
}

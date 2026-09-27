import { isLocalOrigin, json, readJsonRequest } from "../../../lib/http.js";
import { appendVocabularyEntry, readVocabulary } from "../../../lib/obsidian.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({ markdown: await readVocabulary() });
}

export async function POST(request) {
  if (!isLocalOrigin(request)) {
    return json({ error: "Kelime yalnızca yerel uygulamadan kaydedilebilir." }, 403);
  }
  try {
    const body = await readJsonRequest(request);
    const result = await appendVocabularyEntry(body);
    return json(result, result.saved ? 201 : 200);
  } catch (error) {
    return json({ error: error.message || "Kelime kaydedilemedi." }, 400);
  }
}

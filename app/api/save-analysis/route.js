import { json, readJsonRequest } from "../../../lib/http.js";
import { saveErrorAnalysis } from "../../../lib/obsidian.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await readJsonRequest(request);
    const savedAs = await saveErrorAnalysis(body);
    return json({ savedAs }, 201);
  } catch (error) {
    console.error(error);
    return json({ error: error.message || "Analiz kaydedilemedi." }, 400);
  }
}

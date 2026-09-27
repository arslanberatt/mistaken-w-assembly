import { json, readJsonRequest } from "../../../lib/http.js";
import { saveLessonMarkdown } from "../../../lib/obsidian.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { markdown } = await readJsonRequest(request);
    const savedAs = await saveLessonMarkdown(markdown);
    return json({ savedAs }, 201);
  } catch (error) {
    console.error(error);
    return json({ error: error.message || "Obsidian notu kaydedilemedi." }, 400);
  }
}

import { json } from "../../../lib/http.js";
import { lessonsForDate } from "../../../lib/obsidian.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const date = request.nextUrl.searchParams.get("date") || "";
  try {
    return json({ date, lessons: await lessonsForDate(date) });
  } catch (error) {
    return json({ error: error.message || "Dersler okunamadı." }, 400);
  }
}

import { json } from "../../../lib/http.js";
import { availableLessonDates } from "../../../lib/obsidian.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({ dates: await availableLessonDates() });
}

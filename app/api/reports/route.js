import { json } from "../../../lib/http.js";
import { listReports, readReport } from "../../../lib/obsidian.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const file = request.nextUrl.searchParams.get("file");
  try {
    return json(file ? await readReport(file) : { reports: await listReports() });
  } catch (error) {
    return json({ error: error.message || "Raporlar okunamadı." }, 400);
  }
}

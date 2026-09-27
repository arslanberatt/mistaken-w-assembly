import { json, readJsonRequest } from "../../../lib/http.js";
import { analyzeLesson } from "../../../lib/claude-insights.js";
import { saveInsightToVault, vaultPath } from "../../../lib/obsidian.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const input = await readJsonRequest(request);
    const analysis = await analyzeLesson(input, vaultPath());
    let savedAs = "";
    let saveError = "";
    try {
      savedAs = await saveInsightToVault({
        report: analysis.report,
        analysisDate: input.analysisDate,
        lessons: input.lessonCount,
        costUsd: analysis.costUsd,
        model: analysis.model
      });
    } catch (error) {
      saveError = error.message || "Rapor Obsidian'a kaydedilemedi.";
    }
    return json({ ...analysis, savedAs, saveError });
  } catch (error) {
    console.error("Claude insights:", error.message);
    const detail = error.code === "ENOENT" ? "Claude CLI bulunamadı. Terminal'de claude komutunun çalıştığını kontrol et." : error.message;
    return json({ error: detail }, 500);
  }
}

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export function vaultPath() {
  return process.env.OBSIDIAN_VAULT_PATH || "/Users/berat/english";
}

export function markdownText(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

export function frontmatterValue(markdown, key) {
  const match = markdown.match(new RegExp(`^${key}:\\s*["']?([^\\r\\n"']+)`, "m"));
  return match?.[1]?.trim() || "";
}

export function parseTranscriptMessages(markdown) {
  const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const messages = [];
  let current = null;
  const finish = () => {
    if (current?.text.trim()) messages.push({ ...current, text: current.text.trim() });
    current = null;
  };
  for (const line of body.split(/\r?\n/)) {
    const speakerLine = line.match(/^>\s*\[![^\]]+\]\s*(.*?)\s*·\s*(\d{1,2}:\d{2})\s*$/);
    if (speakerLine) {
      finish();
      current = { speaker: speakerLine[1].trim(), time: speakerLine[2], text: "" };
    } else if (current && line.startsWith(">")) {
      current.text += `${current.text ? "\n" : ""}${line.replace(/^>\s?/, "")}`;
    } else if (current && line.trim()) finish();
  }
  finish();
  return messages;
}

async function readLessonFiles() {
  const root = join(vaultPath(), "Lessons");
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const paths = entries.filter(entry => entry.isFile() && entry.name.endsWith(".md")).map(entry => join(root, entry.name));
  for (const folder of entries.filter(entry => entry.isDirectory() && /^\d{4}-\d{2}$/.test(entry.name))) {
    const children = await readdir(join(root, folder.name), { withFileTypes: true }).catch(() => []);
    paths.push(...children.filter(entry => entry.isFile() && entry.name.endsWith(".md")).map(entry => join(root, folder.name, entry.name)));
  }
  return paths;
}

export async function lessonsForDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Tarih YYYY-MM-DD biçiminde olmalı.");
  const paths = await readLessonFiles();
  const lessons = [];
  for (const path of paths) {
    const markdown = await readFile(path, "utf8").catch(() => "");
    const lessonDate = frontmatterValue(markdown, "date") || path.split("/").pop().slice(0, 10);
    if (lessonDate !== date) continue;
    const messages = parseTranscriptMessages(markdown);
    lessons.push({
      file: path.replace(`${vaultPath()}/`, ""),
      date: lessonDate,
      start: frontmatterValue(markdown, "start"),
      end: frontmatterValue(markdown, "end"),
      lessonType: frontmatterValue(markdown, "lesson_type"),
      partner: frontmatterValue(markdown, "partner"),
      messages,
      speakers: [...new Set(messages.map(item => item.speaker))],
      words: messages.reduce((sum, item) => sum + (item.text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length, 0)
    });
  }
  return lessons.sort((a, b) => `${a.start} ${a.file}`.localeCompare(`${b.start} ${b.file}`));
}

export async function availableLessonDates() {
  const paths = await readLessonFiles();
  const dates = new Set();
  for (const path of paths) {
    const markdown = await readFile(path, "utf8").catch(() => "");
    const date = frontmatterValue(markdown, "date") || path.split("/").pop().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) dates.add(date);
  }
  return [...dates].sort().reverse();
}

export async function saveLessonMarkdown(markdown) {
  if (typeof markdown !== "string" || !markdown.trim()) throw new Error("Kaydedilecek transkript bulunamadı.");
  const lessonsDirectory = join(vaultPath(), "Lessons");
  await mkdir(lessonsDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `${timestamp} — Live lesson transcript.md`;
  await writeFile(join(lessonsDirectory, fileName), markdown, "utf8");
  return `Lessons/${fileName}`;
}

export async function readVocabulary() {
  return readFile(join(vaultPath(), "Vocabulary.md"), "utf8").catch(() => "# Kelime Kasası\n");
}

export async function appendVocabularyEntry({ word, meaning = "", example = "", alternatives = [] }) {
  const cleanWord = markdownText(word);
  if (!cleanWord || cleanWord.length > 120) throw new Error("Kelime/ifade 1–120 karakter olmalı.");
  const path = join(vaultPath(), "Vocabulary.md");
  const existing = await readFile(path, "utf8").catch(() => "# Kelime Kasası\n\nDerslerden ve kendi eklediklerimden topladığım kelimeler.\n");
  const escaped = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`^- \\*\\*${escaped}\\*\\*`, "im").test(existing)) {
    return { saved: false, duplicate: true, message: "Bu kelime zaten kelime kasasında." };
  }
  const choices = Array.isArray(alternatives) ? alternatives.map(markdownText).filter(Boolean).slice(0, 5) : [];
  const entry = `\n\n- **${cleanWord}**${meaning ? ` — ${markdownText(meaning)}` : ""}${example ? `\n  - Örnek: ${markdownText(example)}` : ""}${choices.length ? `\n  - Alternatifler: ${choices.join(", ")}` : ""}`;
  await writeFile(path, `${existing.trimEnd()}${entry}\n`, "utf8");
  return { saved: true, file: "Vocabulary.md" };
}

export async function saveInsightToVault({ report, analysisDate, lessons, costUsd, model }) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(analysisDate || "") ? analysisDate : new Date().toISOString().slice(0, 10);
  const monthDirectory = join(vaultPath(), "Reports", date.slice(0, 7));
  await mkdir(monthDirectory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `${date} ${stamp.slice(11, 19).replaceAll("-", ".")} — Sonnet Öğrenme Raporu.md`;
  const mistakeRows = (report.topMistakes || []).map(item => `| ${item.rank}. ${markdownText(item.category)} | ${Number(item.count) || 0} | %${Number(item.share) || 0} | ${markdownText(item.whyItRepeats)} |`).join("\n");
  const feedbackRows = (report.feedback || []).filter(item => item.speaker === "Ben").map(item => `| ${markdownText(item.original)} | ${markdownText(item.correction)} | ${markdownText(item.category)} | ${markdownText(item.reason)} |`).join("\n");
  const reportText = `---\ntype: sonnet-lesson-insight\ndate: ${date}\nmodel: ${model || "claude-sonnet-5"}\nlessons: ${Number(lessons) || 1}\n---\n\n# ${markdownText(report.title) || "Sonnet öğrenme raporu"} — ${date}\n\n## Özet\n\n${markdownText(report.recap?.summary)}\n\n## En sık yaptığım hatalar\n\n| Sıra / konu | Adet | Hata payı | Neden tekrarlanıyor |\n| --- | ---: | ---: | --- |\n${mistakeRows || "| Yeterli doğrulanmış hata yok | 0 | %0 | — |"}\n\n## Ham sözüm → daha doğru ifade\n\n| Ham ifade | Düzeltme | Konu | Açıklama |\n| --- | --- | --- | --- |\n${feedbackRows || "| Bu analizde doğrulanmış düzeltme yok | — | — | — |"}\n\n## Çalışma odağı\n\n${(report.studyPlan || []).map((item, index) => `${index + 1}. **${markdownText(item.topic)}** — ${markdownText(item.instruction)}\n   - Örnek: ${markdownText(item.example)}`).join("\n") || "Çalışma odağı önerilmedi."}\n\n## Kelimeler ve doğal alternatifler\n\n${(report.vocabulary || []).map(item => `- **${markdownText(item.word)}** — ${markdownText(item.meaning)}. Örnek: ${markdownText(item.example)}. Alternatifler: ${(item.alternatives || []).map(markdownText).join(", ")}`).join("\n") || "Bu analizde kelime eklenmedi."}\n\n## İlerleme\n\n- Güvenilir Ben kelimesi: ${Number(report.progress?.reliableWords) || 0}\n- Onaylı hata: ${Number(report.progress?.confirmedErrors) || 0}\n- 100 kelimede hata: ${Number(report.progress?.errorsPer100Words) || 0}\n- Trend: ${markdownText(report.progress?.trendNote)}\n- Analiz edilen ders sayısı: ${Number(lessons) || 1}\n- Model: ${model || "claude-sonnet-5"}\n- Claude CLI'nin bildirdiği maliyet: ${costUsd == null ? "bildirilmedi" : `$${Number(costUsd).toFixed(4)}`}\n`;
  await writeFile(join(monthDirectory, fileName), reportText, "utf8");

  const link = `[[Reports/${date.slice(0, 7)}/${fileName.replace(/\.md$/, "")}]]`;
  const progressPath = join(vaultPath(), "English Progress.md");
  const progress = await readFile(progressPath, "utf8").catch(() => "# English Progress\n");
  const progressEntry = `\n\n## Sonnet analizi — ${date} (${Number(lessons) || 1} ders)\n\n${link} · ${Number(report.progress?.confirmedErrors) || 0} onaylı hata · ${Number(report.progress?.errorsPer100Words) || 0} hata/100 kelime`;
  await writeFile(progressPath, `${progress.trimEnd()}${progressEntry}\n`, "utf8");

  const libraryPath = join(vaultPath(), "Error Library.md");
  const library = await readFile(libraryPath, "utf8").catch(() => "# Error Library\n");
  const personalCorrections = (report.feedback || []).filter(item => item.speaker === "Ben");
  const libraryEntry = `\n\n## Sonnet analizi — ${date}\n\n${personalCorrections.map(item => `- **${markdownText(item.category)}** — ~~${markdownText(item.original)}~~ → **${markdownText(item.correction)}** (${markdownText(item.reason)})`).join("\n") || "- Doğrulanmış hata yok."}\n\nRapor: ${link}`;
  await writeFile(libraryPath, `${library.trimEnd()}${libraryEntry}\n`, "utf8");
  return `Reports/${date.slice(0, 7)}/${fileName}`;
}

export async function saveErrorAnalysis({ analysis, speaking }) {
  const reports = Array.isArray(analysis?.speakerReports) ? analysis.speakerReports : [];
  const personal = reports.find(report => report?.speaker === "Ben");
  if (!personal) throw new Error("Ben için analiz raporu bulunamadı.");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const date = timestamp.slice(0, 10);
  const reportsDirectory = join(vaultPath(), "Reports");
  await mkdir(reportsDirectory, { recursive: true });
  const categories = Array.isArray(personal.categories) ? personal.categories : [];
  const corrections = Array.isArray(personal.corrections) ? personal.corrections : [];
  const speakingRows = (Array.isArray(speaking) ? speaking : [])
    .map(item => `| ${markdownText(item.speaker)} | ${Number(item.words) || 0} | %${Number(item.share) || 0} |`)
    .join("\n");
  const categoryRows = categories
    .map(item => `| ${markdownText(item.name || item.category)} | ${Number(item.count) || 0} | %${Number(item.share) || 0} |`)
    .join("\n");
  const correctionRows = corrections.length
    ? corrections.map(item => `| ${markdownText(item.original || item.raw)} | ${markdownText(item.correction || item.fixed)} | ${markdownText(item.reason)} | ${markdownText(item.category)} |`).join("\n")
    : "| Yeterli onaylı hata yok | — | — | — |";
  const reportMarkdown = `---\ntype: lesson-error-report\ndate: ${date}\n---\n\n# Ders hata raporu — ${date}\n\n## Konuşma dağılımı\n\n| Konuşmacı | Kelime | Pay |\n| --- | ---: | ---: |\n${speakingRows || "| Veri yok | 0 | %0 |"}\n\n## Ben — hata öncelikleri\n\nGüvenilir kelime: ${Number(personal.reliableWords) || "ölçülmedi"}  \nOnaylı hata: ${Number(personal.confirmedErrors) || 0}  \nHata / 100 kelime: ${Number(personal.errorRatePer100Words) || "ölçülmedi"}\n\n| Konu | Hata | Pay |\n| --- | ---: | ---: |\n${categoryRows || "| Yeterli onaylı hata yok | 0 | %0 |"}\n\n## Ben — ham ifade ve düzeltme\n\n| Ham ifade | Düzeltme | Neden | Konu |\n| --- | --- | --- | --- |\n${correctionRows}\n\n## Diğer konuşmacılar\n\n${reports.filter(report => report !== personal).map(report => `- ${markdownText(report.speaker)}: ${Number(report.confirmedErrors) || 0} onaylı hata`).join("\n") || "Diğer konuşmacı analizi yok."}\n`;
  const reportName = `${timestamp} — Error report.md`;
  await writeFile(join(reportsDirectory, reportName), reportMarkdown, "utf8");

  const progressPath = join(vaultPath(), "English Progress.md");
  const previousProgress = await readFile(progressPath, "utf8").catch(() => "# English Progress\n");
  const topCategories = categories.slice().sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0)).slice(0, 3)
    .map(item => `${markdownText(item.name || item.category)} %${Number(item.share) || 0}`).join(" · ") || "yeterli veri yok";
  const progressEntry = `\n\n## ${timestamp} otomatik ders kaydı\n\n| Tarih | Güvenilir Ben kelimesi | Onaylı hata | Hata / 100 kelime | En baskın konular |\n| --- | ---: | ---: | ---: | --- |\n| ${date} | ${Number(personal.reliableWords) || "ölçülmedi"} | ${Number(personal.confirmedErrors) || 0} | ${Number(personal.errorRatePer100Words) || "ölçülmedi"} | ${topCategories} |\n\nRapor: [[Reports/${reportName.replace(/\.md$/, "")}]]`;
  await writeFile(progressPath, `${previousProgress.trimEnd()}${progressEntry}\n`, "utf8");

  const libraryPath = join(vaultPath(), "Error Library.md");
  const previousLibrary = await readFile(libraryPath, "utf8").catch(() => "# Error Library\n\nTekrarlayan kişisel hata ve düzeltmeler.\n");
  const libraryEntry = `\n\n## ${timestamp}\n\n${corrections.map(item => `- **${markdownText(item.category)}** — ~~${markdownText(item.original || item.raw)}~~ → ${markdownText(item.correction || item.fixed)}${item.reason ? ` (${markdownText(item.reason)})` : ""}`).join("\n") || "- Onaylı düzeltme yok."}`;
  await writeFile(libraryPath, `${previousLibrary.trimEnd()}${libraryEntry}\n`, "utf8");

  return `Reports/${reportName}`;
}

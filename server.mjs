import { createServer } from "node:http";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { analyzeLesson } from "./claude-insights.mjs";
import { getClaudeAuthStatus, startClaudeLogin, logoutClaude } from "./claude-auth.mjs";

const port = Number(process.env.PORT) || 4173;
const publicDirectory = join(process.cwd(), "public");
const obsidianVaultDirectory = process.env.OBSIDIAN_VAULT_PATH || "/Users/berat/english";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml"
};

function respondJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function isLocalOrigin(request) {
  return [`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(request.headers.origin);
}

async function createAssemblyToken(response) {
  if (!process.env.ASSEMBLYAI_API_KEY) {
    respondJson(response, 500, { error: "ASSEMBLYAI_API_KEY bulunamadı. Uygulamayı yeniden açıp AssemblyAI anahtarını gir." });
    return;
  }

  try {
    const tokenResponse = await fetch("https://streaming.assemblyai.com/v3/token?expires_in_seconds=600", {
      headers: { Authorization: process.env.ASSEMBLYAI_API_KEY }
    });
    const result = await tokenResponse.json();
    if (!tokenResponse.ok || !result.token) {
      respondJson(response, tokenResponse.status || 500, { error: result?.error || "Canlı mikrofon bağlantısı için token alınamadı." });
      return;
    }
    respondJson(response, 200, { token: result.token });
  } catch (error) {
    console.error(error);
    respondJson(response, 500, { error: "AssemblyAI bağlantısı kurulamadı." });
  }
}

async function saveLesson(request, response) {
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 2_000_000) throw new Error("Ders notu çok büyük.");
      chunks.push(chunk);
    }
    const { markdown } = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (typeof markdown !== "string" || !markdown.trim()) throw new Error("Kaydedilecek transkript bulunamadı.");
    const lessonsDirectory = join(obsidianVaultDirectory, "Lessons");
    await mkdir(lessonsDirectory, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fileName = `${timestamp} — Live lesson transcript.md`;
    await writeFile(join(lessonsDirectory, fileName), markdown, "utf8");
    respondJson(response, 201, { savedAs: `Lessons/${fileName}` });
  } catch (error) {
    console.error(error);
    respondJson(response, 400, { error: error.message || "Obsidian notu kaydedilemedi." });
  }
}

function markdownText(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

function frontmatterValue(markdown, key) {
  const match = markdown.match(new RegExp(`^${key}:\\s*["']?([^\\r\\n"']+)`, "m"));
  return match?.[1]?.trim() || "";
}

function parseTranscriptMessages(markdown) {
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
  const root = join(obsidianVaultDirectory, "Lessons");
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const paths = entries.filter(entry => entry.isFile() && entry.name.endsWith(".md")).map(entry => join(root, entry.name));
  for (const folder of entries.filter(entry => entry.isDirectory() && /^\d{4}-\d{2}$/.test(entry.name))) {
    const children = await readdir(join(root, folder.name), { withFileTypes: true }).catch(() => []);
    paths.push(...children.filter(entry => entry.isFile() && entry.name.endsWith(".md")).map(entry => join(root, folder.name, entry.name)));
  }
  return paths;
}

async function lessonsForDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Tarih YYYY-MM-DD biçiminde olmalı.");
  const paths = await readLessonFiles();
  const lessons = [];
  for (const path of paths) {
    const markdown = await readFile(path, "utf8").catch(() => "");
    const lessonDate = frontmatterValue(markdown, "date") || path.split("/").pop().slice(0, 10);
    if (lessonDate !== date) continue;
    const messages = parseTranscriptMessages(markdown);
    lessons.push({
      file: path.replace(`${obsidianVaultDirectory}/`, ""),
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

async function availableLessonDates() {
  const paths = await readLessonFiles();
  const dates = new Set();
  for (const path of paths) {
    const markdown = await readFile(path, "utf8").catch(() => "");
    const date = frontmatterValue(markdown, "date") || path.split("/").pop().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) dates.add(date);
  }
  return [...dates].sort().reverse();
}

async function saveInsightToVault({ report, analysisDate, lessons, costUsd, model }) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(analysisDate || "") ? analysisDate : new Date().toISOString().slice(0, 10);
  const monthDirectory = join(obsidianVaultDirectory, "Reports", date.slice(0, 7));
  await mkdir(monthDirectory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `${date} ${stamp.slice(11, 19).replaceAll("-", ".")} — Sonnet Öğrenme Raporu.md`;
  const mistakeRows = (report.topMistakes || []).map(item => `| ${item.rank}. ${markdownText(item.category)} | ${Number(item.count) || 0} | %${Number(item.share) || 0} | ${markdownText(item.whyItRepeats)} |`).join("\n");
  const feedbackRows = (report.feedback || []).filter(item => item.speaker === "Ben").map(item => `| ${markdownText(item.original)} | ${markdownText(item.correction)} | ${markdownText(item.category)} | ${markdownText(item.reason)} |`).join("\n");
  const reportText = `---\ntype: sonnet-lesson-insight\ndate: ${date}\nmodel: ${model || "claude-sonnet-5"}\nlessons: ${Number(lessons) || 1}\n---\n\n# ${markdownText(report.title) || "Sonnet öğrenme raporu"} — ${date}\n\n## Özet\n\n${markdownText(report.recap?.summary)}\n\n## En sık yaptığım hatalar\n\n| Sıra / konu | Adet | Hata payı | Neden tekrarlanıyor |\n| --- | ---: | ---: | --- |\n${mistakeRows || "| Yeterli doğrulanmış hata yok | 0 | %0 | — |"}\n\n## Ham sözüm → daha doğru ifade\n\n| Ham ifade | Düzeltme | Konu | Açıklama |\n| --- | --- | --- | --- |\n${feedbackRows || "| Bu analizde doğrulanmış düzeltme yok | — | — | — |"}\n\n## Çalışma odağı\n\n${(report.studyPlan || []).map((item, index) => `${index + 1}. **${markdownText(item.topic)}** — ${markdownText(item.instruction)}\n   - Örnek: ${markdownText(item.example)}`).join("\n") || "Çalışma odağı önerilmedi."}\n\n## Kelimeler ve doğal alternatifler\n\n${(report.vocabulary || []).map(item => `- **${markdownText(item.word)}** — ${markdownText(item.meaning)}. Örnek: ${markdownText(item.example)}. Alternatifler: ${(item.alternatives || []).map(markdownText).join(", ")}`).join("\n") || "Bu analizde kelime eklenmedi."}\n\n## İlerleme\n\n- Güvenilir Ben kelimesi: ${Number(report.progress?.reliableWords) || 0}\n- Onaylı hata: ${Number(report.progress?.confirmedErrors) || 0}\n- 100 kelimede hata: ${Number(report.progress?.errorsPer100Words) || 0}\n- Trend: ${markdownText(report.progress?.trendNote)}\n- Analiz edilen ders sayısı: ${Number(lessons) || 1}\n- Model: ${model || "claude-sonnet-5"}\n- Claude CLI'nin bildirdiği maliyet: ${costUsd == null ? "bildirilmedi" : `$${Number(costUsd).toFixed(4)}`}\n`;
  await writeFile(join(monthDirectory, fileName), reportText, "utf8");

  const link = `[[Reports/${date.slice(0, 7)}/${fileName.replace(/\.md$/, "")}]]`;
  const progressPath = join(obsidianVaultDirectory, "English Progress.md");
  const progress = await readFile(progressPath, "utf8").catch(() => "# English Progress\n");
  const progressEntry = `\n\n## Sonnet analizi — ${date} (${Number(lessons) || 1} ders)\n\n${link} · ${Number(report.progress?.confirmedErrors) || 0} onaylı hata · ${Number(report.progress?.errorsPer100Words) || 0} hata/100 kelime`;
  await writeFile(progressPath, `${progress.trimEnd()}${progressEntry}\n`, "utf8");

  const libraryPath = join(obsidianVaultDirectory, "Error Library.md");
  const library = await readFile(libraryPath, "utf8").catch(() => "# Error Library\n");
  const personalCorrections = (report.feedback || []).filter(item => item.speaker === "Ben");
  const libraryEntry = `\n\n## Sonnet analizi — ${date}\n\n${personalCorrections.map(item => `- **${markdownText(item.category)}** — ~~${markdownText(item.original)}~~ → **${markdownText(item.correction)}** (${markdownText(item.reason)})`).join("\n") || "- Doğrulanmış hata yok."}\n\nRapor: ${link}`;
  await writeFile(libraryPath, `${library.trimEnd()}${libraryEntry}\n`, "utf8");
  return `Reports/${date.slice(0, 7)}/${fileName}`;
}

async function readJsonRequest(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2_000_000) throw new Error("Analiz verisi çok büyük.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function saveAnalysis(request, response) {
  try {
    const { analysis, transcript, speaking } = await readJsonRequest(request);
    const reports = Array.isArray(analysis?.speakerReports) ? analysis.speakerReports : [];
    const personal = reports.find(report => report?.speaker === "Ben");
    if (!personal) throw new Error("Ben için analiz raporu bulunamadı.");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const date = timestamp.slice(0, 10);
    const reportsDirectory = join(obsidianVaultDirectory, "Reports");
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

    const progressPath = join(obsidianVaultDirectory, "English Progress.md");
    const previousProgress = await readFile(progressPath, "utf8").catch(() => "# English Progress\n");
    const topCategories = categories.slice().sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0)).slice(0, 3)
      .map(item => `${markdownText(item.name || item.category)} %${Number(item.share) || 0}`).join(" · ") || "yeterli veri yok";
    const progressEntry = `\n\n## ${timestamp} otomatik ders kaydı\n\n| Tarih | Güvenilir Ben kelimesi | Onaylı hata | Hata / 100 kelime | En baskın konular |\n| --- | ---: | ---: | ---: | --- |\n| ${date} | ${Number(personal.reliableWords) || "ölçülmedi"} | ${Number(personal.confirmedErrors) || 0} | ${Number(personal.errorRatePer100Words) || "ölçülmedi"} | ${topCategories} |\n\nRapor: [[Reports/${reportName.replace(/\.md$/, "")}]]`;
    await writeFile(progressPath, `${previousProgress.trimEnd()}${progressEntry}\n`, "utf8");

    const libraryPath = join(obsidianVaultDirectory, "Error Library.md");
    const previousLibrary = await readFile(libraryPath, "utf8").catch(() => "# Error Library\n\nTekrarlayan kişisel hata ve düzeltmeler.\n");
    const libraryEntry = `\n\n## ${timestamp}\n\n${corrections.map(item => `- **${markdownText(item.category)}** — ~~${markdownText(item.original || item.raw)}~~ → ${markdownText(item.correction || item.fixed)}${item.reason ? ` (${markdownText(item.reason)})` : ""}`).join("\n") || "- Onaylı düzeltme yok."}`;
    await writeFile(libraryPath, `${previousLibrary.trimEnd()}${libraryEntry}\n`, "utf8");

    respondJson(response, 201, { savedAs: `Reports/${reportName}` });
  } catch (error) {
    console.error(error);
    respondJson(response, 400, { error: error.message || "Analiz kaydedilemedi." });
  }
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/api/assembly-token") {
    await createAssemblyToken(response);
    return;
  }

  if (request.method === "GET" && request.url === "/api/config") {
    respondJson(response, 200, { vaultPath: obsidianVaultDirectory });
    return;
  }

  if (request.method === "GET" && request.url === "/api/lesson-dates") {
    respondJson(response, 200, { dates: await availableLessonDates() });
    return;
  }

  if (request.method === "GET" && new URL(request.url, `http://localhost:${port}`).pathname === "/api/lessons") {
    try {
      const date = new URL(request.url, `http://localhost:${port}`).searchParams.get("date") || "";
      respondJson(response, 200, { date, lessons: await lessonsForDate(date) });
    } catch (error) {
      respondJson(response, 400, { error: error.message || "Dersler okunamadı." });
    }
    return;
  }

  if (request.method === "GET" && request.url === "/api/vocabulary") {
    const vocabulary = await readFile(join(obsidianVaultDirectory, "Vocabulary.md"), "utf8").catch(() => "# Kelime Kasası\n");
    respondJson(response, 200, { markdown: vocabulary });
    return;
  }

  if (request.method === "POST" && request.url === "/api/vocabulary") {
    if (!isLocalOrigin(request)) {
      respondJson(response, 403, { error: "Kelime yalnızca yerel uygulamadan kaydedilebilir." });
      return;
    }
    try {
      const { word, meaning = "", example = "", alternatives = [] } = await readJsonRequest(request);
      const cleanWord = markdownText(word);
      if (!cleanWord || cleanWord.length > 120) throw new Error("Kelime/ifade 1–120 karakter olmalı.");
      const path = join(obsidianVaultDirectory, "Vocabulary.md");
      const existing = await readFile(path, "utf8").catch(() => "# Kelime Kasası\n\nDerslerden ve kendi eklediklerimden topladığım kelimeler.\n");
      const escaped = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`^- \\*\\*${escaped}\\*\\*`, "im").test(existing)) {
        respondJson(response, 200, { saved: false, duplicate: true, message: "Bu kelime zaten kelime kasasında." });
        return;
      }
      const choices = Array.isArray(alternatives) ? alternatives.map(markdownText).filter(Boolean).slice(0, 5) : [];
      const entry = `\n\n- **${cleanWord}**${meaning ? ` — ${markdownText(meaning)}` : ""}${example ? `\n  - Örnek: ${markdownText(example)}` : ""}${choices.length ? `\n  - Alternatifler: ${choices.join(", ")}` : ""}`;
      await writeFile(path, `${existing.trimEnd()}${entry}\n`, "utf8");
      respondJson(response, 201, { saved: true, file: "Vocabulary.md" });
    } catch (error) {
      respondJson(response, 400, { error: error.message || "Kelime kaydedilemedi." });
    }
    return;
  }

  if (request.method === "GET" && request.url === "/api/claude-auth") {
    respondJson(response, 200, await getClaudeAuthStatus());
    return;
  }

  if (request.method === "POST" && request.url === "/api/claude-auth/login") {
    if (!isLocalOrigin(request)) {
      respondJson(response, 403, { error: "Giriş yalnızca yerel uygulamadan başlatılabilir." });
      return;
    }
    respondJson(response, 200, await startClaudeLogin());
    return;
  }

  if (request.method === "POST" && request.url === "/api/claude-auth/logout") {
    if (!isLocalOrigin(request)) {
      respondJson(response, 403, { error: "Çıkış yalnızca yerel uygulamadan yapılabilir." });
      return;
    }
    try {
      respondJson(response, 200, await logoutClaude());
    } catch (error) {
      respondJson(response, 500, { error: error.message || "Claude hesabından çıkış yapılamadı." });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/save-lesson") {
    await saveLesson(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/api/save-analysis") {
    await saveAnalysis(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/api/insights") {
    try {
      const input = await readJsonRequest(request);
      const analysis = await analyzeLesson(input, obsidianVaultDirectory);
      let savedAs = "";
      let saveError = "";
      try {
        savedAs = await saveInsightToVault({ report: analysis.report, analysisDate: input.analysisDate, lessons: input.lessonCount, costUsd: analysis.costUsd, model: analysis.model });
      } catch (error) {
        saveError = error.message || "Rapor Obsidian'a kaydedilemedi.";
      }
      respondJson(response, 200, { ...analysis, savedAs, saveError });
    } catch (error) {
      console.error("Claude insights:", error.message);
      const detail = error.code === "ENOENT" ? "Claude CLI bulunamadı. Terminal’de claude komutunun çalıştığını kontrol et." : error.message;
      respondJson(response, 500, { error: detail });
    }
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405);
    response.end();
    return;
  }

  const pathname = new URL(request.url, `http://localhost:${port}`).pathname;
  const requestedFile = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = normalize(join(publicDirectory, requestedFile));
  if (filePath !== publicDirectory && !filePath.startsWith(`${publicDirectory}/`)) {
    response.writeHead(403);
    response.end();
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    response.end(request.method === "HEAD" ? undefined : file);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bulunamadı");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Uygulama hazır: http://localhost:${port}`);
});

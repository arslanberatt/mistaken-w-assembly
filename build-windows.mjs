// public/index.html değişince Windows dosyasını yeniden üretmek için: node build-windows.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";

const html = await readFile(new URL("./public/index.html", import.meta.url), "utf8");

const app = `// Ders Akışı — Windows için tek dosyalık uygulama.
// Çalıştırmak için: node ders-akisi.mjs   (veya baslat.bat dosyasına çift tıkla)
// Bu dosya build-windows.mjs ile üretildi; elle düzenleme yerine public/index.html'i değiştirip yeniden üret.
import { createServer } from "node:http";
import { exec } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const port = Number(process.env.PORT) || 4173;
const vaultPath = process.env.OBSIDIAN_VAULT_PATH || join(homedir(), "english");
const html = ${JSON.stringify(html)};

function askHidden(question) {
  return new Promise(resolve => {
    const input = process.stdin;
    process.stdout.write(question);
    if (!input.isTTY) {
      let data = "";
      input.setEncoding("utf8");
      input.on("data", chunk => { data += chunk; if (data.includes("\\n")) { input.pause(); resolve(data.split(/\\r?\\n/)[0].trim()); } });
      return;
    }
    let value = "";
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    const onData = chunk => {
      for (const char of chunk) {
        if (char === "\\r" || char === "\\n") {
          input.setRawMode(false); input.pause(); input.off("data", onData);
          process.stdout.write("\\n");
          resolve(value.trim());
          return;
        }
        if (char === "\\u0003") { process.stdout.write("\\n"); process.exit(0); }
        if (char === "\\u0008" || char === "\\u007f") { if (value) { value = value.slice(0, -1); process.stdout.write("\\b \\b"); } continue; }
        value += char;
        process.stdout.write("*");
      }
    };
    input.on("data", onData);
  });
}

function respondJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

let apiKey = process.env.ASSEMBLYAI_API_KEY || "";
if (!apiKey) {
  console.log("AssemblyAI anahtarın yalnızca bu açık pencerede kullanılır; dosyaya kaydedilmez.");
  apiKey = await askHidden("AssemblyAI API anahtarını yapıştır ve Enter'a bas: ");
}
if (!apiKey) { console.error("Anahtar girilmedi, kapatılıyor."); process.exit(1); }

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (request.method === "GET" && pathname === "/api/assembly-token") {
    try {
      const tokenResponse = await fetch("https://streaming.assemblyai.com/v3/token?expires_in_seconds=600", { headers: { Authorization: apiKey } });
      const result = await tokenResponse.json();
      if (!tokenResponse.ok || !result.token) return respondJson(response, tokenResponse.status || 500, { error: result?.error || "Canlı bağlantı için token alınamadı. Anahtarı kontrol et." });
      return respondJson(response, 200, { token: result.token });
    } catch (error) {
      console.error(error);
      return respondJson(response, 500, { error: "AssemblyAI bağlantısı kurulamadı." });
    }
  }
  if (request.method === "GET" && pathname === "/api/config") return respondJson(response, 200, { vaultPath });
  if ((request.method === "GET" || request.method === "HEAD") && (pathname === "/" || pathname === "/index.html")) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return response.end(request.method === "HEAD" ? undefined : html);
  }
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Bulunamadı");
});

server.on("error", error => {
  if (error.code === "EADDRINUSE") console.error(\`\${port} portu kullanımda. Açık kalan eski pencereyi kapat ya da: set PORT=4174 && node ders-akisi.mjs\`);
  else console.error(error);
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  const url = \`http://localhost:\${port}\`;
  console.log(\`Uygulama hazır: \${url}  (kapatmak için bu pencereyi kapat veya Ctrl+C)\`);
  const opener = process.platform === "win32" ? \`start "" "\${url}"\` : process.platform === "darwin" ? \`open "\${url}"\` : \`xdg-open "\${url}"\`;
  exec(opener, () => {});
});
`;

await mkdir(new URL("./windows/", import.meta.url), { recursive: true });
await writeFile(new URL("./windows/ders-akisi.mjs", import.meta.url), app, "utf8");
console.log("windows/ders-akisi.mjs üretildi.");

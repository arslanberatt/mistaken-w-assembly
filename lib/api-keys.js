// AssemblyAI ve Anthropic API anahtarlarını proje kökündeki .api-keys.local dosyasında
// kalıcı tutar. Next.js .env.local/.env gibi dosyaları açılışta (ve dosya değiştiğinde)
// process.env'e otomatik yükler; bu depo o adları KASITLI OLARAK kullanmaz, çünkü UI'dan
// silinen bir anahtar Next'in kendi env-reload'ından process.env'de "yapışık" kalabilir.
// Bu modül dosyayı her istek anında okur ki UI'dan yazılan anahtar sunucu yeniden
// başlatılmadan geçerli olsun.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ENV_VARS = { assemblyai: "ASSEMBLYAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" };

const ENV_PATH = join(process.cwd(), ".api-keys.local");

async function readEnvFile() {
  try {
    return await readFile(ENV_PATH, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

function parseEnvText(text) {
  const values = {};
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

export async function getApiKey(name) {
  const envVar = ENV_VARS[name];
  if (!envVar) return "";
  const values = parseEnvText(await readEnvFile());
  return values[envVar] || process.env[envVar] || "";
}

export async function setApiKeys(updates) {
  for (const [name, value] of Object.entries(updates)) {
    if (!ENV_VARS[name]) continue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 500) throw new Error("API anahtarı çok uzun.");
    if (/\r|\n/.test(value)) throw new Error("API anahtarı satır sonu içeremez.");
  }

  const text = await readEnvFile();
  let lines = text.length ? text.split("\n") : [];
  // split("\n") üzerinde sondaki boş satırı ayrı tutup en sonda tekrar ekleyeceğiz.
  if (lines.length && lines[lines.length - 1] === "") lines.pop();

  for (const [name, rawValue] of Object.entries(updates)) {
    const envVar = ENV_VARS[name];
    if (!envVar) continue;
    if (typeof rawValue !== "string") continue;
    const value = rawValue.trim();
    const pattern = new RegExp(`^\\s*(?:export\\s+)?${envVar}\\s*=.*$`);
    const index = lines.findIndex(line => pattern.test(line));
    if (!value) {
      if (index !== -1) lines.splice(index, 1);
      continue;
    }
    const newLine = `${envVar}=${value}`;
    if (index !== -1) {
      lines[index] = newLine;
    } else {
      lines.push(newLine);
    }
  }

  const finalText = lines.length ? `${lines.join("\n")}\n` : "";
  await writeFile(ENV_PATH, finalText, { encoding: "utf8", mode: 0o600 });
}

export function maskKey(value) {
  if (!value || value.length <= 8) return "••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export async function apiKeyStatus() {
  const text = await readEnvFile();
  const fileValues = parseEnvText(text);
  const status = {};
  for (const name of Object.keys(ENV_VARS)) {
    const envVar = ENV_VARS[name];
    const fileValue = fileValues[envVar] || "";
    const envValue = process.env[envVar] || "";
    const value = fileValue || envValue;
    status[name] = {
      configured: Boolean(value),
      masked: value ? maskKey(value) : "",
      source: fileValue ? "file" : envValue ? "env" : ""
    };
  }
  return status;
}

const PROVIDER_VAR = "AI_CLI_PROVIDER";
const CLI_PROVIDERS = ["claude", "codex"];

export async function getCliProvider() {
  const values = parseEnvText(await readEnvFile());
  return CLI_PROVIDERS.includes(values[PROVIDER_VAR]) ? values[PROVIDER_VAR] : "claude";
}

export async function setCliProvider(provider) {
  if (!CLI_PROVIDERS.includes(provider)) throw new Error("Geçersiz CLI seçimi.");
  const text = await readEnvFile();
  let lines = text.length ? text.split("\n") : [];
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  const pattern = new RegExp(`^\\s*(?:export\\s+)?${PROVIDER_VAR}\\s*=.*$`);
  const index = lines.findIndex(line => pattern.test(line));
  const newLine = `${PROVIDER_VAR}=${provider}`;
  if (index !== -1) lines[index] = newLine;
  else lines.push(newLine);
  const finalText = lines.length ? `${lines.join("\n")}\n` : "";
  await writeFile(ENV_PATH, finalText, { encoding: "utf8", mode: 0o600 });
}

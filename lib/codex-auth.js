import { execFile, spawn } from "node:child_process";

// Claude'daki lib/claude-auth.js ile aynı desen: CLI'ın kendi oturum durumunu
// sorgular, giriş/çıkış işlemlerini CLI üzerinden yürütür. OAuth adresi/kodları
// yalnızca Codex CLI içinde kalır; bu modül API'ye asla döndürmez.

let loginProcess = null;
let loginError = "";

function cliStatus() {
  return new Promise(resolve => {
    execFile("codex", ["login", "status"], { timeout: 10_000, maxBuffer: 32_000 }, (error, stdout) => {
      if (error) {
        if (error.code === "ENOENT") return resolve({ loggedIn: false, notInstalled: true });
        // codex login status, giriş yapılmamışsa sıfırdan farklı kodla çıkar (dokümante davranış).
        return resolve({ loggedIn: false, notInstalled: false });
      }
      resolve({ loggedIn: true, notInstalled: false, detail: (stdout || "").trim().slice(0, 200) });
    });
  });
}

export async function getCodexAuthStatus() {
  const status = await cliStatus();
  return {
    loggedIn: status.loggedIn,
    pending: Boolean(loginProcess),
    error: status.notInstalled ? "Codex CLI bu bilgisayarda bulunamadı." : (status.loggedIn ? "" : loginError || "")
  };
}

export async function startCodexLogin() {
  const status = await getCodexAuthStatus();
  if (status.loggedIn || loginProcess) return status;
  if (status.error?.includes("bulunamadı")) return status;

  loginError = "";
  const child = spawn("codex", ["login"], { stdio: ["pipe", "pipe", "pipe"] });
  loginProcess = child;
  const timeout = setTimeout(() => child.kill("SIGTERM"), 10 * 60_000);
  timeout.unref();
  child.stdout.resume();
  child.stderr.resume();
  child.on("error", error => {
    clearTimeout(timeout);
    loginError = error.code === "ENOENT" ? "Codex CLI bu bilgisayarda bulunamadı." : "Codex giriş ekranı açılamadı.";
    loginProcess = null;
  });
  child.on("close", code => {
    clearTimeout(timeout);
    if (loginProcess !== child) return;
    loginProcess = null;
    if (code !== 0) loginError = "Codex girişi tamamlanmadı. Tekrar deneyebilirsin.";
  });
  return { ...status, pending: true, error: "" };
}

export async function logoutCodex() {
  if (loginProcess) throw new Error("Giriş sürerken çıkış yapılamaz.");
  await new Promise((resolve, reject) => {
    execFile("codex", ["logout"], { timeout: 15_000, maxBuffer: 32_000 }, error => {
      if (error) reject(new Error(error.code === "ENOENT" ? "Codex CLI bu bilgisayarda bulunamadı." : "Codex hesabından çıkış yapılamadı."));
      else resolve();
    });
  });
  loginError = "";
  return getCodexAuthStatus();
}

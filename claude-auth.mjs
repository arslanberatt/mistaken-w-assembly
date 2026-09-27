import { execFile, spawn } from "node:child_process";

let loginProcess = null;
let loginError = "";

function cliStatus() {
  return new Promise((resolve, reject) => {
    execFile("claude", ["auth", "status"], { timeout: 10_000, maxBuffer: 32_000 }, (error, stdout) => {
      try {
        const data = JSON.parse(stdout);
        resolve({ loggedIn: data.loggedIn === true, email: data.loggedIn ? data.email || "" : "", subscriptionType: data.loggedIn ? data.subscriptionType || "" : "" });
      } catch {
        reject(error || new Error("Claude hesap durumu okunamadı."));
      }
    });
  });
}

export async function getClaudeAuthStatus() {
  try {
    const status = await cliStatus();
    return { ...status, pending: Boolean(loginProcess), error: loginError };
  } catch (error) {
    return {
      loggedIn: false,
      pending: Boolean(loginProcess),
      error: error.code === "ENOENT" ? "Claude CLI bu bilgisayarda bulunamadı." : "Claude hesap durumu okunamadı."
    };
  }
}

export async function startClaudeLogin() {
  const status = await getClaudeAuthStatus();
  if (status.loggedIn || loginProcess) return status;
  if (status.error?.includes("bulunamadı")) return status;

  loginError = "";
  const child = spawn("claude", ["auth", "login"], { stdio: ["pipe", "pipe", "pipe"] });
  loginProcess = child;
  const timeout = setTimeout(() => child.kill("SIGTERM"), 10 * 60_000);
  timeout.unref();
  // OAuth adresi ve geçici kodlar yalnızca Claude CLI içinde kalır; API'ye döndürülmez.
  child.stdout.resume();
  child.stderr.resume();
  child.on("error", error => {
    clearTimeout(timeout);
    loginError = error.code === "ENOENT" ? "Claude CLI bu bilgisayarda bulunamadı." : "Claude giriş ekranı açılamadı.";
    loginProcess = null;
  });
  child.on("close", code => {
    clearTimeout(timeout);
    if (loginProcess !== child) return;
    loginProcess = null;
    if (code !== 0) loginError = "Claude girişi tamamlanmadı. Tekrar deneyebilirsin.";
  });
  return { ...status, pending: true, error: "" };
}

export async function logoutClaude() {
  if (loginProcess) throw new Error("Giriş sürerken çıkış yapılamaz.");
  await new Promise((resolve, reject) => {
    execFile("claude", ["auth", "logout"], { timeout: 15_000, maxBuffer: 32_000 }, error => {
      if (error) reject(new Error(error.code === "ENOENT" ? "Claude CLI bu bilgisayarda bulunamadı." : "Claude hesabından çıkış yapılamadı."));
      else resolve();
    });
  });
  loginError = "";
  return getClaudeAuthStatus();
}

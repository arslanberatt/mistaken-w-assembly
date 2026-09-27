import { isLocalOrigin, json } from "../../../../lib/http.js";
import { startCodexLogin } from "../../../../lib/codex-auth.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!isLocalOrigin(request)) {
    return json({ error: "Giriş yalnızca yerel uygulamadan başlatılabilir." }, 403);
  }
  return json(await startCodexLogin());
}

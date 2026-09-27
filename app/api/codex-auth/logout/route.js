import { isLocalOrigin, json } from "../../../../lib/http.js";
import { logoutCodex } from "../../../../lib/codex-auth.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!isLocalOrigin(request)) {
    return json({ error: "Çıkış yalnızca yerel uygulamadan yapılabilir." }, 403);
  }
  try {
    return json(await logoutCodex());
  } catch (error) {
    return json({ error: error.message || "Codex hesabından çıkış yapılamadı." }, 500);
  }
}

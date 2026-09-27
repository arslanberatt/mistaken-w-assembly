import { isLocalOrigin, json } from "../../../../lib/http.js";
import { logoutClaude } from "../../../../lib/claude-auth.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!isLocalOrigin(request)) {
    return json({ error: "Çıkış yalnızca yerel uygulamadan yapılabilir." }, 403);
  }
  try {
    return json(await logoutClaude());
  } catch (error) {
    return json({ error: error.message || "Claude hesabından çıkış yapılamadı." }, 500);
  }
}

import { json } from "../../../lib/http.js";
import { getCodexAuthStatus } from "../../../lib/codex-auth.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(await getCodexAuthStatus());
}

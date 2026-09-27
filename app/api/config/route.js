import { json } from "../../../lib/http.js";
import { vaultPath } from "../../../lib/obsidian.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({ vaultPath: vaultPath() });
}

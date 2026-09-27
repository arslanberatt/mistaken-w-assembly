import { json } from "../../../lib/http.js";
import { getClaudeAuthStatus } from "../../../lib/claude-auth.js";
import { getApiKey } from "../../../lib/api-keys.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = await getApiKey("anthropic");
  if (apiKey) {
    return json({ loggedIn: true, mode: "api", email: "", subscriptionType: "", pending: false, error: "" });
  }
  return json({ ...(await getClaudeAuthStatus()), mode: "cli" });
}

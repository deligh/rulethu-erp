// Rulethu AI — secure Claude proxy (Supabase Edge Function, Deno).
//
// WHY THIS EXISTS
// ---------------
// The Rulethu ERP is a 100% static client app. A Claude API key is a SECRET and
// must never live in client code. This function runs on Supabase's servers,
// reads the key from an environment secret (ANTHROPIC_API_KEY), and forwards
// requests to Anthropic's Messages API. The browser never sees the key.
//
// DEPLOY (from the Supabase dashboard — no CLI needed):
//   1. Edge Functions → Deploy a new function → name it exactly  ai
//   2. Paste this whole file as the function body → Deploy.
//   3. Edge Functions → (Secrets / Manage secrets) → add:
//          ANTHROPIC_API_KEY = sk-ant-...     (your key — pasted ONLY here)
//   The function is then live at:
//      https://<your-project>.supabase.co/functions/v1/ai
//
// COST CONTROL
// ------------
// Only two cheap models are allowed, and max_tokens is capped, so a runaway
// call can't drain the balance. Your Anthropic spend cap is the final backstop.
//   - claude-haiku-5-5   $0.10 / $0.50 per 1M   (default — chat, study, Q&A)
//   - claude-sonnet-5-5  $2.00 / $10.0 per 1M   (heavier drafting)

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Allow-list of models (keeps cost predictable). Anything else → haiku.
const ALLOWED = new Set(["claude-haiku-5-5", "claude-sonnet-5-5"]);
const DEFAULT_MODEL = "claude-haiku-5-5";
const MAX_TOKENS_CAP = 4096;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!KEY) {
    return json(
      { error: "AI is not configured yet — ANTHROPIC_API_KEY secret is missing." },
      503,
    );
  }

  let payload: {
    system?: string;
    prompt?: string;
    messages?: { role: "user" | "assistant"; content: unknown }[];
    model?: string;
    max_tokens?: number;
    web_search?: boolean;
    search_max_uses?: number;   // client-tunable so we never redeploy to adjust
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  // Accept either a single `prompt` or a full `messages` array.
  const messages: { role: "user" | "assistant"; content: unknown }[] =
    payload.messages && payload.messages.length
      ? payload.messages
      : [{ role: "user", content: String(payload.prompt ?? "") }];

  const anyText = messages.some(
    (m) => typeof m.content === "string" && m.content.trim(),
  );
  if (!anyText) return json({ error: "Empty prompt." }, 400);

  // Web search needs a model that supports the dynamic tool → use Sonnet.
  const model = payload.web_search
    ? "claude-sonnet-5-5"
    : payload.model && ALLOWED.has(payload.model)
      ? payload.model
      : DEFAULT_MODEL;
  const max_tokens = Math.min(
    Math.max(256, payload.max_tokens ?? 1200),
    MAX_TOKENS_CAP,
  );

  const base: Record<string, unknown> = { model, max_tokens };
  if (payload.system) base.system = payload.system;
  if (payload.web_search) {
    // Bounded so the function stays well under Supabase's resource/time limit:
    // few searches, and cap how much page content each search injects.
    const maxUses = Math.min(Math.max(1, payload.search_max_uses ?? 4), 5);
    base.tools = [{
      type: "web_search_20260209",
      name: "web_search",
      max_uses: maxUses,
      max_content_tokens: 5000,
    }];
  }

  try {
    let usage: unknown = null;
    // Server-tool loop: resend while Claude pauses to run web search.
    // Capped low — each extra round is another full upstream call.
    for (let i = 0; i < 4; i++) {
      const r = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": KEY,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ...base, messages }),
      });

      const data = await r.json();
      if (!r.ok) {
        const msg = (data?.error?.message as string) ?? `Anthropic error ${r.status}`;
        return json({ error: msg }, r.status);
      }
      usage = data?.usage ?? usage;

      if (data?.stop_reason === "refusal") {
        return json({ text: "I can't help with that particular request.", model, refusal: true });
      }

      // If the model paused to use a server tool, append its turn and continue.
      if (data?.stop_reason === "pause_turn" && Array.isArray(data?.content)) {
        messages.push({ role: "assistant", content: data.content });
        continue;
      }

      const text = Array.isArray(data?.content)
        ? data.content
            .filter((b: { type?: string }) => b?.type === "text")
            .map((b: { text?: string }) => b.text ?? "")
            .join("")
            .trim()
        : "";

      return json({ text, model, usage });
    }
    return json({ error: "Search did not converge." }, 504);
  } catch (e) {
    return json({ error: `Upstream call failed: ${String(e)}` }, 502);
  }
});

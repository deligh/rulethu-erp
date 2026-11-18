// Rulethu AI — client wrapper for the secure Claude proxy.
//
// Calls the `ai` Supabase Edge Function (which holds the secret key). The app
// NEVER holds the Claude key. If the function isn't deployed yet, or the key
// secret is missing, or the network fails, every call resolves to `null` so the
// caller falls back to the built-in demo/rule-based answer — the UI never breaks.
//
// Usage:
//   const text = await askClaude({ system, prompt });           // one-shot
//   const text = await askClaude({ messages, model: "sonnet" });// chat / heavier
//
// Model shorthands: "haiku" (default, cheapest) | "sonnet" (heavier drafting).

import { SUPABASE_URL, SUPABASE_KEY } from "./cloud";

const MODEL_IDS: Record<string, string> = {
  haiku: "claude-haiku-5-5",
  sonnet: "claude-sonnet-5-5",
};

export type AiMsg = { role: "user" | "assistant"; content: string };

export interface AskOpts {
  prompt?: string;
  messages?: AiMsg[];
  system?: string;
  model?: "haiku" | "sonnet";
  maxTokens?: number;
  /** Let Claude search the live web (used for the market news feed). */
  webSearch?: boolean;
  /** Max web searches allowed (cost/latency control; default 8 server-side). */
  searchMaxUses?: number;
  /** Let Claude FETCH specific trusted URLs directly (reliable prices). */
  webFetch?: boolean;
  /** Max direct fetches allowed. */
  fetchMaxUses?: number;
  /** ms before we give up and fall back to demo mode (default 30s). */
  timeoutMs?: number;
}

const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/ai` : "";

/** True when the proxy endpoint is reachable in principle (config present). */
export const aiConfigured = !!FN_URL;

// Remember, within a session, whether the key secret is actually set. Avoids
// hammering the endpoint on every keystroke once we know it's demo-only.
let liveKnown: boolean | null = null;
export function aiLiveState(): boolean | null {
  return liveKnown;
}

/**
 * Ask Claude via the secure proxy. Returns the text, or `null` to signal the
 * caller should use its demo fallback (not configured / no key / error).
 */
export async function askClaude(opts: AskOpts): Promise<string | null> {
  if (!FN_URL) return null;

  const body: Record<string, unknown> = {};
  if (opts.messages?.length) body.messages = opts.messages;
  if (opts.prompt) body.prompt = opts.prompt;
  if (opts.system) body.system = opts.system;
  if (opts.model) body.model = MODEL_IDS[opts.model] ?? MODEL_IDS.haiku;
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.webSearch) body.web_search = true;
  if (opts.searchMaxUses) body.search_max_uses = opts.searchMaxUses;
  if (opts.webFetch) body.web_fetch = true;
  if (opts.fetchMaxUses) body.fetch_max_uses = opts.fetchMaxUses;

  const ctrl = new AbortController();
  // Web search / fetch take longer (multiple round-trips server-side).
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? (opts.webSearch || opts.webFetch ? 60_000 : 30_000));

  try {
    const r = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Supabase gateway auth — the PUBLIC key (safe in client code).
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY ?? "",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      // 503 = key secret not set → treat as "demo only" for this session.
      if (r.status === 503) liveKnown = false;
      return null;
    }

    liveKnown = true;
    const text = typeof data?.text === "string" ? data.text.trim() : "";
    return text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One-shot probe used by the admin page to show whether real AI is live.
 * Cheap: 1-token request. Returns "live" | "demo" | "error".
 */
export async function aiHealthcheck(): Promise<"live" | "demo" | "error"> {
  if (!FN_URL) return "demo";
  try {
    const r = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY ?? "",
      },
      body: JSON.stringify({ prompt: "Reply with the single word: ok", max_tokens: 256 }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 503) { liveKnown = false; return "demo"; }
    if (!r.ok) return "error";
    liveKnown = true;
    return data?.text ? "live" : "error";
  } catch {
    return "error";
  }
}

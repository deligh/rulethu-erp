// Shared cloud sync (Supabase) — makes the ERP multi-user: accounts and all
// data live in one hosted row and sync to every device in real time.
//
// Enabled only when NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
// are set at build time. Without them the app runs exactly as before (per-
// browser localStorage), so nothing breaks until the keys are wired in.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Public Supabase config (publishable key is designed to live in client code;
// env vars override these for rotation / self-hosting).
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tngmgmwuqakoaefkhsys.supabase.co";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_pQ3HnlLIof-3qIrbZhbiKQ_g2_Q8H5G";
export const cloudEnabled = !!(URL && KEY);

// Exposed so the AI client can reach the secure Claude proxy (an Edge Function
// deployed at <URL>/functions/v1/ai) and authenticate with the public key.
export const SUPABASE_URL = URL;
export const SUPABASE_KEY = KEY;

// A per-tab id so a client can ignore the echo of its own writes.
export const CLIENT_ID =
  (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const ROW_ID = "singleton";
const TABLE = "erp_state";

let sb: SupabaseClient | null = null;
function client(): SupabaseClient | null {
  if (!cloudEnabled || typeof window === "undefined") return null;
  if (!sb) sb = createClient(URL!, KEY!, { realtime: { params: { eventsPerSecond: 5 } } });
  return sb;
}

// Shared Supabase client for other features (e.g. Storage / file library).
export function supabaseClient(): SupabaseClient | null {
  return client();
}

export interface CloudRow {
  id: string;
  data?: unknown;   // the app data blob (store)
  auth?: unknown;   // the auth overrides blob (accounts/passwords/roles/added)
  updated_by?: string;
  updated_at?: string;
}

export async function cloudLoad(): Promise<CloudRow | null> {
  const c = client();
  if (!c) return null;
  try {
    const { data, error } = await c.from(TABLE).select("id,data,auth,updated_by,updated_at").eq("id", ROW_ID).maybeSingle();
    if (error) { console.warn("[cloud] load", error.message); return null; }
    return (data as CloudRow) ?? null;
  } catch (e) { console.warn("[cloud] load threw", e); return null; }
}

// Upsert only the columns provided, so the store and auth writers don't clobber
// each other (Supabase SETs just the passed columns on conflict).
export async function cloudSave(patch: { data?: unknown; auth?: unknown }): Promise<void> {
  const c = client();
  if (!c) return;
  try {
    await c.from(TABLE).upsert({ id: ROW_ID, ...patch, updated_by: CLIENT_ID, updated_at: new Date().toISOString() });
  } catch (e) { console.warn("[cloud] save threw", e); }
}

// Subscribe to row changes made by OTHER clients. Returns an unsubscribe fn.
export function cloudSubscribe(onRemote: (row: CloudRow) => void): () => void {
  const c = client();
  if (!c) return () => {};
  // Unique channel name per subscriber — the store and auth both subscribe, and
  // Supabase rejects a second `.on()` on an already-subscribed same-named channel.
  const ch = c
    .channel(`erp-${ROW_ID}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE, filter: `id=eq.${ROW_ID}` }, (payload) => {
      const row = payload.new as CloudRow;
      if (row && row.updated_by !== CLIENT_ID) onRemote(row);
    })
    .subscribe();
  return () => { try { c.removeChannel(ch); } catch { /* ignore */ } };
}

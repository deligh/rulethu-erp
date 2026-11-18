// Shared file library backed by Supabase Storage (real cloud storage).
//
// Files uploaded here are stored in a Supabase Storage bucket and are visible
// to everyone in the group, on any device — unlike localStorage, this is true
// shared storage. One-time setup (bucket + policies) is in
// supabase/storage-setup.sql; until it's run, the page shows setup guidance.

import { supabaseClient } from "./cloud";

export const BUCKET = "shared";

export interface StoredFile {
  name: string;        // path within the bucket
  size: number;
  updatedAt: string;
  url: string;         // public URL
}

export function storageReady(): boolean {
  return !!supabaseClient();
}

/** List everything in the bucket (flat), newest first. */
export async function listFiles(): Promise<{ files: StoredFile[]; error?: string }> {
  const c = supabaseClient();
  if (!c) return { files: [], error: "Cloud storage is not configured." };
  const { data, error } = await c.storage.from(BUCKET).list("", {
    limit: 200,
    sortBy: { column: "updated_at", order: "desc" },
  });
  if (error) return { files: [], error: error.message };
  const files = (data ?? [])
    .filter((o) => o.id) // folders have null id
    .map((o) => ({
      name: o.name,
      size: (o.metadata?.size as number) ?? 0,
      updatedAt: o.updated_at ?? o.created_at ?? "",
      url: c.storage.from(BUCKET).getPublicUrl(o.name).data.publicUrl,
    }));
  return { files };
}

/** Upload a file. Prefixes a timestamp so names never collide. */
export async function uploadFile(file: File): Promise<{ ok: boolean; error?: string }> {
  const c = supabaseClient();
  if (!c) return { ok: false, error: "Cloud storage is not configured." };
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${Date.now()}-${safe}`;
  const { error } = await c.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteFile(name: string): Promise<{ ok: boolean; error?: string }> {
  const c = supabaseClient();
  if (!c) return { ok: false, error: "Cloud storage is not configured." };
  const { error } = await c.storage.from(BUCKET).remove([name]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Display name = original name with the timestamp prefix stripped. */
export function displayName(path: string): string {
  return path.replace(/^\d+-/, "");
}

export function fmtSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

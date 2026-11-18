// Shared file library backed by Supabase Storage (real cloud storage), with
// OneDrive-style folders and text extraction so uploads feed the AI knowledge
// base. One-time setup (bucket + policies) is in supabase/storage-setup.sql.

import { supabaseClient } from "./cloud";
import * as XLSX from "xlsx";

export const BUCKET = "shared";
const KEEP = ".keep"; // placeholder object that materialises an (otherwise empty) folder
export const MAX_EXCERPT = 6000; // chars of extracted text we keep per doc

export interface StoredFile {
  name: string;        // base name within its folder
  path: string;        // full path within the bucket
  folder: string;      // "" = root
  size: number;
  updatedAt: string;
  url: string;         // public URL
}

export function storageReady(): boolean {
  return !!supabaseClient();
}

/** List sub-folders (top-level prefixes) in the bucket. */
export async function listFolders(): Promise<string[]> {
  const c = supabaseClient();
  if (!c) return [];
  const { data, error } = await c.storage.from(BUCKET).list("", { limit: 200 });
  if (error) return [];
  return (data ?? []).filter((o) => !o.id).map((o) => o.name).filter((n) => n && n !== KEEP);
}

/** List files inside a folder ("" = root), newest first. */
export async function listFiles(folder = ""): Promise<{ files: StoredFile[]; error?: string }> {
  const c = supabaseClient();
  if (!c) return { files: [], error: "Cloud storage is not configured." };
  const prefix = folder ? `${folder}` : "";
  const { data, error } = await c.storage.from(BUCKET).list(prefix, {
    limit: 300,
    sortBy: { column: "updated_at", order: "desc" },
  });
  if (error) return { files: [], error: error.message };
  const files = (data ?? [])
    .filter((o) => o.id && o.name !== KEEP) // skip folders & placeholders
    .map((o) => {
      const path = folder ? `${folder}/${o.name}` : o.name;
      return {
        name: o.name,
        path,
        folder,
        size: (o.metadata?.size as number) ?? 0,
        updatedAt: o.updated_at ?? o.created_at ?? "",
        url: c.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
      };
    });
  return { files };
}

const safeName = (s: string) => s.replace(/[^\w.\- ]+/g, "_").trim();

/** Create a folder by writing a placeholder object into it. */
export async function createFolder(name: string): Promise<{ ok: boolean; error?: string }> {
  const c = supabaseClient();
  if (!c) return { ok: false, error: "Cloud storage is not configured." };
  const folder = safeName(name).replace(/\//g, "_");
  if (!folder) return { ok: false, error: "Enter a folder name." };
  const { error } = await c.storage.from(BUCKET).upload(`${folder}/${KEEP}`, new Blob([""], { type: "text/plain" }), { upsert: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Upload a file into a folder ("" = root). Timestamp-prefixed so names never collide. */
export async function uploadFile(file: File, folder = ""): Promise<{ ok: boolean; path?: string; error?: string }> {
  const c = supabaseClient();
  if (!c) return { ok: false, error: "Cloud storage is not configured." };
  const base = `${Date.now()}-${safeName(file.name)}`;
  const path = folder ? `${folder}/${base}` : base;
  const { error } = await c.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600", upsert: false, contentType: file.type || undefined,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

export async function deleteFile(path: string): Promise<{ ok: boolean; error?: string }> {
  const c = supabaseClient();
  if (!c) return { ok: false, error: "Cloud storage is not configured." };
  const { error } = await c.storage.from(BUCKET).remove([path]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Pull readable text from a file where we can (txt/md/csv/json/xlsx). Returns
 *  { text, readable }. PDFs/Word return empty text until the backend adds OCR. */
export async function extractText(file: File): Promise<{ text: string; readable: boolean }> {
  const name = file.name.toLowerCase();
  try {
    if (/\.(txt|md|csv|json|tsv|log)$/.test(name) || file.type.startsWith("text/")) {
      const t = await file.text();
      return { text: t.slice(0, MAX_EXCERPT), readable: !!t.trim() };
    }
    if (/\.(xlsx|xls)$/.test(name)) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const parts: string[] = [];
      for (const sheet of wb.SheetNames.slice(0, 6)) {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheet]);
        if (csv.trim()) parts.push(`# ${sheet}\n${csv}`);
        if (parts.join("\n").length > MAX_EXCERPT) break;
      }
      const t = parts.join("\n\n").slice(0, MAX_EXCERPT);
      return { text: t, readable: !!t.trim() };
    }
  } catch { /* fall through */ }
  return { text: "", readable: false };
}

export function displayName(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/^\d+-/, "");
}

export function fmtSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

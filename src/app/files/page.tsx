"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader, Card, Badge, SectionTitle, Table, Th, Td } from "@/components/ui";
import { useAppData, genId } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import {
  listFiles, listFolders, uploadFile, deleteFile, createFolder, extractText,
  displayName, fmtSize, storageReady, StoredFile, BUCKET,
} from "@/lib/files";
import { fmtDate } from "@/lib/format";

export default function FilesPage() {
  const { knowledge, add, remove } = useAppData();
  const { user } = useAuth();
  const [folder, setFolder] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [desc, setDesc] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async (f = folder) => {
    setLoading(true);
    const [fl, { files, error }] = await Promise.all([listFolders(), listFiles(f)]);
    if (error) {
      setErr(error);
      if (/bucket|not found|does not exist/i.test(error)) setNeedsSetup(true);
    } else {
      setErr(null); setNeedsSetup(false); setFolders(fl); setFiles(files);
    }
    setLoading(false);
  }, [folder]);

  useEffect(() => { if (storageReady()) refresh(folder); else { setNeedsSetup(true); setLoading(false); } }, [folder, refresh]);

  const knowFor = (path: string) => knowledge.find((k) => k.path === path);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!f) return;
    if (f.size > 25 * 1e6) { setErr("File is larger than 25 MB."); return; }
    setErr(null); setPending(f); setDesc("");
  };

  const confirmUpload = async () => {
    if (!pending) return;
    setBusy(true); setErr(null);
    const { text, readable } = await extractText(pending);
    const { ok, path, error } = await uploadFile(pending, folder);
    if (!ok || !path) { setBusy(false); setErr(error ?? "Upload failed."); if (error && /bucket|not found/i.test(error)) setNeedsSetup(true); return; }
    add("knowledge", {
      id: genId("K"),
      name: pending.name,
      path,
      folder,
      type: pending.type || "application/octet-stream",
      size: pending.size,
      description: desc.trim(),
      excerpt: text,
      readable,
      uploadedBy: user?.name ?? "Someone",
      createdAt: new Date().toISOString(),
    }, { title: "Document added", body: `${pending.name}${folder ? ` → ${folder}` : ""}`, module: "files" });
    setPending(null); setDesc(""); setBusy(false);
    await refresh(folder);
  };

  const onDelete = async (f: StoredFile) => {
    setBusy(true);
    const { ok, error } = await deleteFile(f.path);
    if (ok) { const k = knowFor(f.path); if (k) remove("knowledge", k.id); await refresh(folder); }
    else setErr(error ?? "Delete failed.");
    setBusy(false);
  };

  const makeFolder = async () => {
    if (!newFolder.trim()) return;
    setBusy(true);
    const { ok, error } = await createFolder(newFolder);
    setBusy(false);
    if (ok) { setNewFolder(""); setShowNewFolder(false); await refresh(folder); }
    else setErr(error ?? "Couldn't create folder.");
  };

  const iStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" };
  const readableCount = knowledge.filter((k) => k.readable).length;

  return (
    <div>
      <PageHeader
        title="File Library"
        subtitle="Shared cloud storage and your knowledge base — upload once, organise in folders, and the AI reads from what you store."
        actions={
          <>
            <input ref={inputRef} type="file" className="hidden" onChange={onPick} />
            <button onClick={() => setShowNewFolder((v) => !v)} disabled={busy || needsSetup} className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text)" }}>＋ Folder</button>
            <button onClick={() => inputRef.current?.click()} disabled={busy || needsSetup} className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>⬆ Upload</button>
          </>
        }
      />

      {err && !needsSetup && <Card className="mb-4" style={{ borderColor: "var(--neg)" }}><p className="text-sm" style={{ color: "var(--neg)" }}>{err}</p></Card>}

      {needsSetup ? (
        <SetupCard onReload={() => refresh(folder)} />
      ) : (
        <>
          {/* breadcrumb + folders */}
          <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
            <button onClick={() => setFolder("")} className="font-medium" style={{ color: folder ? "var(--brand)" : "var(--text)" }}>All files</button>
            {folder && <><span style={{ color: "var(--text-faint)" }}>/</span><span className="font-medium" style={{ color: "var(--text)" }}>{folder}</span></>}
          </div>

          {showNewFolder && (
            <Card className="mb-4">
              <div className="flex flex-wrap gap-2 items-end">
                <label className="text-xs flex-1 min-w-[200px]" style={{ color: "var(--text-muted)" }}>New folder name
                  <input autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)} onKeyDown={(e) => e.key === "Enter" && makeFolder()} placeholder="e.g. Finance, Research, Legal, Board Packs" className="rounded-md border px-2.5 py-1.5 text-sm w-full mt-1" style={iStyle} />
                </label>
                <button onClick={makeFolder} disabled={!newFolder.trim() || busy} className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>Create</button>
              </div>
            </Card>
          )}

          {!folder && folders.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 mb-6">
              {folders.map((name) => (
                <button key={name} onClick={() => setFolder(name)} className="rz-card rounded-lg border p-4 text-left flex items-center gap-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <span className="text-xl">📁</span>
                  <span className="font-medium truncate" style={{ color: "var(--text)" }}>{name}</span>
                </button>
              ))}
            </div>
          )}

          {/* pending upload — ask for a description that feeds the knowledge base */}
          {pending && (
            <Card className="mb-6" style={{ borderColor: "var(--brand)" }}>
              <SectionTitle>Add to knowledge base</SectionTitle>
              <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>
                <strong>{pending.name}</strong> → {folder || "All files"} · {fmtSize(pending.size)}
              </p>
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>What is this document? (helps the AI use it well)
                <textarea autoFocus value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="e.g. Q3 2026 board pack — group financials, pipeline update and fund performance." className="rounded-md border px-2.5 py-1.5 text-sm w-full mt-1" style={iStyle} />
              </label>
              <div className="flex gap-2 mt-3">
                <button onClick={confirmUpload} disabled={busy} className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>{busy ? "Uploading…" : "Upload & save"}</button>
                <button onClick={() => setPending(null)} disabled={busy} className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancel</button>
              </div>
            </Card>
          )}

          {loading ? (
            <Card><p className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p></Card>
          ) : files.length === 0 ? (
            <Card className="border-dashed"><p className="py-10 text-center text-sm" style={{ color: "var(--text-faint)" }}>No files {folder ? `in ${folder}` : "yet"}. Upload the first document.</p></Card>
          ) : (
            <Table head={<><Th>Document</Th><Th>What it is</Th><Th right>Size</Th><Th>Uploaded</Th><Th right>Actions</Th></>}>
              {files.map((f) => {
                const k = knowFor(f.path);
                return (
                  <tr key={f.path}>
                    <Td strong>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)" }}>{displayName(f.path)}</a>
                      {k?.readable && <span className="ml-2"><Badge tone="live">AI-readable</Badge></span>}
                    </Td>
                    <Td><span className="text-xs" style={{ color: "var(--text-muted)" }}>{k?.description || "—"}</span></Td>
                    <Td right>{fmtSize(f.size)}</Td>
                    <Td>{f.updatedAt ? fmtDate(f.updatedAt) : "—"}</Td>
                    <Td right>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium mr-3" style={{ color: "var(--info)" }}>Open</a>
                      <button onClick={() => onDelete(f)} disabled={busy} className="text-xs font-medium disabled:opacity-50" style={{ color: "var(--neg)" }}>Delete</button>
                    </Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={storageReady() && !needsSetup ? "live" : "warn"}>{storageReady() && !needsSetup ? "Cloud storage connected" : "Setup required"}</Badge>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          Supabase Storage · max 25 MB · {knowledge.length} document{knowledge.length === 1 ? "" : "s"} in the knowledge base{readableCount ? `, ${readableCount} AI-readable` : ""}
        </span>
      </div>
    </div>
  );
}

function SetupCard({ onReload }: { onReload: () => void }) {
  return (
    <Card>
      <SectionTitle>One-time setup</SectionTitle>
      <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
        Shared storage needs a one-time bucket in Supabase. In the Supabase dashboard open <strong>SQL Editor</strong>, run the script below, then reload.
      </p>
      <pre className="rounded-md border p-3 text-xs overflow-x-auto" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}>{`insert into storage.buckets (id, name, public)
values ('${BUCKET}', '${BUCKET}', true)
on conflict (id) do nothing;

create policy "shared read"   on storage.objects for select using (bucket_id = '${BUCKET}');
create policy "shared upload" on storage.objects for insert with check (bucket_id = '${BUCKET}');
create policy "shared delete" on storage.objects for delete using (bucket_id = '${BUCKET}');`}</pre>
      <button onClick={onReload} className="mt-3 rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>I&apos;ve run it — reload</button>
    </Card>
  );
}

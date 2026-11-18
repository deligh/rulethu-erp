"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader, Card, Badge, SectionTitle, Table, Th, Td } from "@/components/ui";
import { listFiles, uploadFile, deleteFile, displayName, fmtSize, storageReady, StoredFile, BUCKET } from "@/lib/files";
import { fmtDate } from "@/lib/format";

export default function FilesPage() {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { files, error } = await listFiles();
    if (error) {
      setErr(error);
      if (/bucket|not found|does not exist/i.test(error)) setNeedsSetup(true);
    } else {
      setErr(null);
      setNeedsSetup(false);
      setFiles(files);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (storageReady()) refresh(); else { setNeedsSetup(true); setLoading(false); } }, [refresh]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 25 * 1e6) { setErr("File is larger than 25 MB."); return; }
    setBusy(true); setErr(null);
    const { ok, error } = await uploadFile(f);
    setBusy(false);
    if (!ok) { setErr(error ?? "Upload failed."); if (error && /bucket|not found/i.test(error)) setNeedsSetup(true); }
    else await refresh();
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDelete = async (name: string) => {
    setBusy(true);
    const { ok, error } = await deleteFile(name);
    setBusy(false);
    if (!ok) setErr(error ?? "Delete failed.");
    else await refresh();
  };

  return (
    <div>
      <PageHeader
        title="File Library"
        subtitle="Shared cloud storage for the whole group — upload once, available to everyone on any device."
        actions={
          <>
            <input ref={inputRef} type="file" className="hidden" onChange={onPick} />
            <button onClick={() => inputRef.current?.click()} disabled={busy || needsSetup} className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--brand)" }}>
              {busy ? "Uploading…" : "⬆ Upload file"}
            </button>
          </>
        }
      />

      {err && !needsSetup && <Card className="mb-4" style={{ borderColor: "var(--neg)" }}><p className="text-sm" style={{ color: "var(--neg)" }}>{err}</p></Card>}

      {needsSetup ? (
        <Card>
          <SectionTitle>One-time setup</SectionTitle>
          <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
            Shared storage needs a one-time bucket in Supabase. In the Supabase dashboard open <strong>SQL Editor</strong>, paste the script below and run it. Then reload this page.
          </p>
          <pre className="rounded-md border p-3 text-xs overflow-x-auto" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}>{`-- Shared file library bucket
insert into storage.buckets (id, name, public)
values ('${BUCKET}', '${BUCKET}', true)
on conflict (id) do nothing;

-- Allow the app's public key to read, upload and delete
create policy "shared read"   on storage.objects for select using (bucket_id = '${BUCKET}');
create policy "shared upload" on storage.objects for insert with check (bucket_id = '${BUCKET}');
create policy "shared delete" on storage.objects for delete using (bucket_id = '${BUCKET}');`}</pre>
          <button onClick={refresh} className="mt-3 rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text)" }}>I&apos;ve run it — reload</button>
        </Card>
      ) : loading ? (
        <Card><p className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>Loading files…</p></Card>
      ) : files.length === 0 ? (
        <Card className="border-dashed"><p className="py-10 text-center text-sm" style={{ color: "var(--text-faint)" }}>No files yet. Upload the first document for the team.</p></Card>
      ) : (
        <Table head={<><Th>File</Th><Th right>Size</Th><Th>Uploaded</Th><Th right>Actions</Th></>}>
          {files.map((f) => (
            <tr key={f.name}>
              <Td strong><a href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)" }}>{displayName(f.name)}</a></Td>
              <Td right>{fmtSize(f.size)}</Td>
              <Td>{f.updatedAt ? fmtDate(f.updatedAt) : "—"}</Td>
              <Td right>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium mr-3" style={{ color: "var(--info)" }}>Open</a>
                <button onClick={() => onDelete(f.name)} disabled={busy} className="text-xs font-medium disabled:opacity-50" style={{ color: "var(--neg)" }}>Delete</button>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Badge tone={storageReady() && !needsSetup ? "live" : "warn"}>{storageReady() && !needsSetup ? "Cloud storage connected" : "Setup required"}</Badge>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>Backed by Supabase Storage · max 25 MB per file</span>
      </div>
    </div>
  );
}

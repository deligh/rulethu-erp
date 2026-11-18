-- One-time setup for the shared File Library (Supabase Storage).
-- Run this once in the Supabase dashboard → SQL Editor.
--
-- It creates a public bucket named "shared" and allows the app's public
-- (publishable/anon) key to read, upload and delete files. This matches the
-- demo-grade access model used elsewhere in the app; when per-user auth lands,
-- tighten these policies to the authenticated role.

insert into storage.buckets (id, name, public)
values ('shared', 'shared', true)
on conflict (id) do nothing;

create policy "shared read"   on storage.objects for select using (bucket_id = 'shared');
create policy "shared upload" on storage.objects for insert with check (bucket_id = 'shared');
create policy "shared delete" on storage.objects for delete using (bucket_id = 'shared');

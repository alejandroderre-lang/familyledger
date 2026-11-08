-- Receipts storage bucket.
-- This was configured by hand in the original hosted project and never captured
-- in a migration, so rebuilding the backend produced a database with no bucket
-- and uploads failed. Defined here so any fresh environment matches.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Objects are stored at {user_id}/{uuid}.{ext}, so the first path segment
-- identifies the owner.
create policy "Users can manage own receipt images"
  on storage.objects for all
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Admins can view all receipt images"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Receipt evidence is private user data. It may be reviewed later, but is never
-- promoted into a comparison price directly from the browser.
create table if not exists public.receipt_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  receipt_id text not null,
  chain_id text not null,
  store_id text not null,
  store_address text not null,
  observed_at timestamptz not null,
  payload jsonb not null,
  proof_path text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'accepted', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text,
  unique (user_id, receipt_id)
);

alter table public.receipt_submissions enable row level security;
grant select, insert, delete on public.receipt_submissions to authenticated;

create policy "receipt submitters can read own queue"
on public.receipt_submissions for select to authenticated
using ((select auth.uid()) = user_id);

create policy "receipt submitters can add own evidence"
on public.receipt_submissions for insert to authenticated
with check ((select auth.uid()) = user_id and status = 'pending');

create policy "receipt submitters can remove own pending evidence"
on public.receipt_submissions for delete to authenticated
using ((select auth.uid()) = user_id and status = 'pending');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipt-proofs', 'receipt-proofs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "users can upload own receipt proof"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'receipt-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "users can read own receipt proof"
on storage.objects for select to authenticated
using (
  bucket_id = 'receipt-proofs'
  and owner_id = (select auth.uid()::text)
);

create policy "users can delete own receipt proof"
on storage.objects for delete to authenticated
using (
  bucket_id = 'receipt-proofs'
  and owner_id = (select auth.uid()::text)
);

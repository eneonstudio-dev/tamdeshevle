create table if not exists public.receipt_reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.receipt_reviewers enable row level security;
revoke all on public.receipt_reviewers from anon, authenticated;
grant select on public.receipt_reviewers to authenticated;

create policy "reviewers can read own membership"
on public.receipt_reviewers for select to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.receipt_review_lines (
  submission_id uuid not null references public.receipt_submissions(id) on delete cascade,
  line_index integer not null check (line_index >= 0),
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('accepted', 'rejected')),
  product_id text,
  unit_price numeric(12,2) check (unit_price > 0),
  note text check (char_length(note) <= 300),
  reviewed_at timestamptz not null default now(),
  primary key (submission_id, line_index)
);

alter table public.receipt_review_lines enable row level security;
revoke all on public.receipt_review_lines from anon, authenticated;
grant select, insert on public.receipt_review_lines to authenticated;
grant update (decision, product_id, unit_price, note, reviewed_at) on public.receipt_review_lines to authenticated;

create policy "reviewers can read receipt review lines"
on public.receipt_review_lines for select to authenticated
using (exists (select 1 from public.receipt_reviewers r where r.user_id = (select auth.uid())));

create policy "submitters can read own receipt review lines"
on public.receipt_review_lines for select to authenticated
using (exists (
  select 1 from public.receipt_submissions s
  where s.id = submission_id and s.user_id = (select auth.uid())
));

create policy "reviewers can add receipt review lines"
on public.receipt_review_lines for insert to authenticated
with check (
  reviewer_id = (select auth.uid())
  and exists (select 1 from public.receipt_reviewers r where r.user_id = (select auth.uid()))
);

create policy "reviewers can update receipt review lines"
on public.receipt_review_lines for update to authenticated
using (
  reviewer_id = (select auth.uid())
  and exists (select 1 from public.receipt_reviewers r where r.user_id = (select auth.uid()))
)
with check (
  reviewer_id = (select auth.uid())
  and exists (select 1 from public.receipt_reviewers r where r.user_id = (select auth.uid()))
);

grant update (status, reviewed_at, review_note) on public.receipt_submissions to authenticated;

create policy "reviewers can read receipt queue"
on public.receipt_submissions for select to authenticated
using (exists (select 1 from public.receipt_reviewers r where r.user_id = (select auth.uid())));

create policy "reviewers can update receipt status"
on public.receipt_submissions for update to authenticated
using (exists (select 1 from public.receipt_reviewers r where r.user_id = (select auth.uid())))
with check (exists (select 1 from public.receipt_reviewers r where r.user_id = (select auth.uid())));

create policy "reviewers can read receipt proof"
on storage.objects for select to authenticated
using (
  bucket_id = 'receipt-proofs'
  and exists (select 1 from public.receipt_reviewers r where r.user_id = (select auth.uid()))
);

create index if not exists receipt_submissions_status_submitted_idx
on public.receipt_submissions (status, submitted_at desc);

create index if not exists receipt_review_lines_reviewer_idx
on public.receipt_review_lines (reviewer_id, reviewed_at desc);

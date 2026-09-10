drop policy if exists "submitters can read own accepted price history" on public.receipt_price_history;
drop policy if exists "reviewers can read accepted price history" on public.receipt_price_history;

create policy "owners and reviewers can read accepted price history"
on public.receipt_price_history for select to authenticated
using (
  (select auth.uid()) = submitter_id
  or exists (select 1 from public.receipt_reviewers r where r.user_id = (select auth.uid()))
);

create index if not exists receipt_price_history_reviewer_idx
on public.receipt_price_history (reviewer_id);

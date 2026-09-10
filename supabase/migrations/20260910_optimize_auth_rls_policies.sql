-- Avoid re-evaluating auth.uid() for every row in RLS policies.
-- Supabase recommends wrapping auth.uid() in SELECT so Postgres can use an initplan.

drop policy if exists "profiles own rows" on public.profiles;
create policy "profiles own rows" on public.profiles for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "baskets own rows" on public.baskets;
create policy "baskets own rows" on public.baskets for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "addresses own rows" on public.addresses;
create policy "addresses own rows" on public.addresses for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "basket_history own rows" on public.basket_history;
create policy "basket_history own rows" on public.basket_history for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "preferences own rows" on public.preferences;
create policy "preferences own rows" on public.preferences for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

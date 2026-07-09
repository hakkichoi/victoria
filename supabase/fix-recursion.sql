-- =========================================================
-- VICTORIA PROJECT — fix: infinite recursion in RLS policies
-- Run this ONCE in Supabase Dashboard > SQL Editor.
-- Safe to run even if you already ran schema.sql before —
-- this only replaces the broken admin-check policies, it does
-- not touch your existing tables or data.
-- =========================================================

-- 1) Helper function: checks admin status WITHOUT re-triggering
--    profiles' own RLS policies (this is what breaks the recursion).
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- 2) Drop + recreate every policy that used to check admin status
--    with a direct (recursive) subquery on profiles.

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using ( public.is_admin() );

drop policy if exists "requests_select_admin" on public.exchange_requests;
create policy "requests_select_admin" on public.exchange_requests
  for select using ( public.is_admin() );

drop policy if exists "requests_update_admin" on public.exchange_requests;
create policy "requests_update_admin" on public.exchange_requests
  for update using ( public.is_admin() );

drop policy if exists "blc_price_admin_write" on public.blc_price_history;
create policy "blc_price_admin_write" on public.blc_price_history
  for all using ( public.is_admin() );

drop policy if exists "rates_admin_write" on public.exchange_rates;
create policy "rates_admin_write" on public.exchange_rates
  for all using ( public.is_admin() );

drop policy if exists "funding_tx_admin_write" on public.funding_transactions;
create policy "funding_tx_admin_write" on public.funding_transactions
  for all using ( public.is_admin() );

drop policy if exists "funding_summary_admin_write" on public.funding_summary;
create policy "funding_summary_admin_write" on public.funding_summary
  for all using ( public.is_admin() );

drop policy if exists "planning_admin_write" on public.planning_items;
create policy "planning_admin_write" on public.planning_items
  for all using ( public.is_admin() );

-- Done. Reload your site and try My Page again.

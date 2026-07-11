-- =========================================================
-- VICTORIA PROJECT — migration: VICT lots, site settings, KRW purchases
-- Run this ONCE in Supabase Dashboard > SQL Editor.
-- Safe to run on your existing database — only adds new tables/columns,
-- does not touch anything you already have.
-- =========================================================

-- ---------- SITE SETTINGS (single row, admin-managed) ----------
-- Holds the admin's Tron wallet address (every coin — USDT/VICT/BLC — is a
-- TRON-based token, so there's only ever one deposit address) plus the KRW
-- bank account info used for the "buy VICT with KRW" page.
create table if not exists public.site_settings (
  key text primary key default 'main',
  admin_tron_wallet text not null default 'TDbUMx4frCPRRV4ooYAe1HJL38HiUgXdfV',
  krw_bank_name text,
  krw_bank_account text,
  krw_account_holder text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.site_settings enable row level security;

drop policy if exists "site_settings_select_public" on public.site_settings;
create policy "site_settings_select_public" on public.site_settings
  for select using (true);

drop policy if exists "site_settings_admin_write" on public.site_settings;
create policy "site_settings_admin_write" on public.site_settings
  for all using ( public.is_admin() );

insert into public.site_settings (key) values ('main') on conflict (key) do nothing;

-- exchange_requests: track VICT "unit" (lot) count when the request is a
-- USDT<->VICT lot purchase — 1 unit = 100 VICT = 100 USDT. Null for BLC-side
-- exchanges, which are free-amount.
alter table public.exchange_requests add column if not exists units integer;

-- ---------- KRW -> VICT PURCHASE REQUESTS ----------
-- A separate flow for people who don't hold USDT yet: they pay KRW by bank
-- transfer instead of sending crypto. Same request/confirm/complete-lock
-- pattern as exchange_requests, just a different settlement currency.
do $$ begin
  create type krw_purchase_status as enum ('pending', 'deposit_submitted', 'completed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.krw_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  units integer not null,                 -- number of 100-VICT lots
  vict_amount numeric not null,           -- units * 100
  usd_krw_rate numeric not null,          -- snapshot of the rate applied at request time
  fee_rate numeric not null default 0.03, -- 3%, kept editable in case it ever changes
  krw_amount numeric not null,            -- final amount incl. fee, rounded to the nearest 10 won
  status krw_purchase_status not null default 'pending',
  depositor_name text,                    -- who the bank transfer will show as the sender
  depositor_note text,
  admin_note text,
  created_at timestamptz not null default now(),
  deposit_submitted_at timestamptz,
  completed_at timestamptz
);

alter table public.krw_purchase_requests enable row level security;

drop policy if exists "krw_requests_select_own" on public.krw_purchase_requests;
create policy "krw_requests_select_own" on public.krw_purchase_requests
  for select using (auth.uid() = user_id);

drop policy if exists "krw_requests_insert_own" on public.krw_purchase_requests;
create policy "krw_requests_insert_own" on public.krw_purchase_requests
  for insert with check (auth.uid() = user_id);

drop policy if exists "krw_requests_update_own_not_completed" on public.krw_purchase_requests;
create policy "krw_requests_update_own_not_completed" on public.krw_purchase_requests
  for update using (auth.uid() = user_id and status <> 'completed')
  with check (auth.uid() = user_id and status <> 'completed');

drop policy if exists "krw_requests_select_admin" on public.krw_purchase_requests;
create policy "krw_requests_select_admin" on public.krw_purchase_requests
  for select using ( public.is_admin() );

drop policy if exists "krw_requests_update_admin" on public.krw_purchase_requests;
create policy "krw_requests_update_admin" on public.krw_purchase_requests
  for update using ( public.is_admin() );

-- Done. Reload the site — the VICT-lot exchange, BLC exchange, and the new
-- KRW purchase page should all work once you've also deployed the updated
-- site files and filled in your bank account info in the admin page.

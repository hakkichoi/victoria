-- =========================================================
-- VICTORIA PROJECT — Supabase schema
-- Run this once in Supabase Dashboard > SQL Editor
-- =========================================================

-- ---------- 1. PROFILES ----------
-- One row per auth.users, holds everything the signup form collects.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  phone text,
  full_name text,
  tron_wallet text,
  telegram_id text,
  whatsapp_id text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- users can read/update only their own profile
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- admins can read every profile (needed for admin page to show requester info)
create policy "profiles_select_admin" on public.profiles
  for select using (
    public.is_admin()
  );

-- auto-create a profile row right after signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Checks whether the current user is an admin, WITHOUT going through
-- profiles' own RLS policies. This is essential: a policy on `profiles`
-- (or any other table) that checks admin status by querying `profiles`
-- directly, under RLS, re-triggers profiles' own policies — including
-- itself — causing "infinite recursion detected in policy for relation
-- profiles". SECURITY DEFINER makes this function run with the
-- privileges of its owner, bypassing RLS for this one lookup only.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------- 2. EXCHANGE REQUESTS ----------
create type exchange_status as enum ('pending', 'tx_submitted', 'completed');

create table if not exists public.exchange_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  from_coin text not null,           -- USDT | VICT | BLC
  to_coin text not null,             -- USDT | VICT | BLC
  from_amount numeric not null,
  to_amount numeric not null,
  rate_used numeric not null,        -- snapshot of the rate applied at request time
  status exchange_status not null default 'pending',
  tx_hash text,                      -- transaction info the user submits to admin
  tx_note text,
  admin_note text,
  created_at timestamptz not null default now(),
  tx_submitted_at timestamptz,
  completed_at timestamptz
);

alter table public.exchange_requests enable row level security;

create policy "requests_select_own" on public.exchange_requests
  for select using (auth.uid() = user_id);

create policy "requests_insert_own" on public.exchange_requests
  for insert with check (auth.uid() = user_id);

-- users may only edit their own request, and only while it is NOT completed
-- (this is the server-side lock — the UI lock is just a convenience on top of this)
create policy "requests_update_own_not_completed" on public.exchange_requests
  for update using (auth.uid() = user_id and status <> 'completed')
  with check (auth.uid() = user_id and status <> 'completed');

-- admins can see and update every request (needed to hit "complete")
create policy "requests_select_admin" on public.exchange_requests
  for select using (
    public.is_admin()
  );

create policy "requests_update_admin" on public.exchange_requests
  for update using (
    public.is_admin()
  );

-- ---------- 3. BLC PRICE HISTORY (admin-entered, publicly readable) ----------
create table if not exists public.blc_price_history (
  id bigint generated always as identity primary key,
  price_date date not null unique,
  price numeric not null,
  created_at timestamptz not null default now()
);

alter table public.blc_price_history enable row level security;

create policy "blc_price_select_public" on public.blc_price_history
  for select using (true);

create policy "blc_price_admin_write" on public.blc_price_history
  for all using (
    public.is_admin()
  );

-- ---------- 4. DAILY EXCHANGE RATES (admin-set, publicly readable) ----------
-- Only the USDT<->BLC pair needs an admin rate; USDT<->VICT is fixed 1:1 in the app.
create table if not exists public.exchange_rates (
  pair text primary key,           -- e.g. 'USDT_BLC'
  rate numeric not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.exchange_rates enable row level security;

create policy "rates_select_public" on public.exchange_rates
  for select using (true);

create policy "rates_admin_write" on public.exchange_rates
  for all using (
    public.is_admin()
  );

-- seed a starting rate so the calculator has something to show on day 1
insert into public.exchange_rates (pair, rate)
values ('USDT_BLC', 1.0)
on conflict (pair) do nothing;

-- ---------- 5. SITE SETTINGS (single row, admin-managed) ----------
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

create policy "site_settings_select_public" on public.site_settings
  for select using (true);

create policy "site_settings_admin_write" on public.site_settings
  for all using ( public.is_admin() );

insert into public.site_settings (key) values ('main') on conflict (key) do nothing;

-- exchange_requests: track VICT "unit" (lot) count when the request is a
-- USDT<->VICT lot purchase — 1 unit = 100 VICT = 100 USDT. Null for BLC-side
-- exchanges, which are free-amount.
alter table public.exchange_requests add column if not exists units integer;

-- ---------- 5b. KRW -> VICT PURCHASE REQUESTS ----------
-- A separate flow for people who don't hold USDT yet: they pay KRW by bank
-- transfer instead of sending crypto. Same request/confirm/complete-lock
-- pattern as exchange_requests, just a different settlement currency.
create type krw_purchase_status as enum ('pending', 'deposit_submitted', 'completed');

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

create policy "krw_requests_select_own" on public.krw_purchase_requests
  for select using (auth.uid() = user_id);

create policy "krw_requests_insert_own" on public.krw_purchase_requests
  for insert with check (auth.uid() = user_id);

create policy "krw_requests_update_own_not_completed" on public.krw_purchase_requests
  for update using (auth.uid() = user_id and status <> 'completed')
  with check (auth.uid() = user_id and status <> 'completed');

create policy "krw_requests_select_admin" on public.krw_purchase_requests
  for select using ( public.is_admin() );

create policy "krw_requests_update_admin" on public.krw_purchase_requests
  for update using ( public.is_admin() );


-- ---------- 6. VICT FUNDING SECTION ----------
-- Individual funding transactions shown on the homepage "VICT FUNDING" list.
-- Every row here is entered by an admin — this is a public, read-only
-- transparency feed, not something regular users write to.
create table if not exists public.funding_transactions (
  id bigint generated always as identity primary key,
  tx_date date not null,
  tx_address text not null,
  amount numeric not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

alter table public.funding_transactions enable row level security;

create policy "funding_tx_select_public" on public.funding_transactions
  for select using (true);

create policy "funding_tx_admin_write" on public.funding_transactions
  for all using (
    public.is_admin()
  );

-- Single-row summary strip (total wallets / cumulative amount / reward count) —
-- also entirely admin-entered, publicly readable.
create table if not exists public.funding_summary (
  key text primary key default 'main',
  total_wallets integer not null default 0,
  cumulative_amount numeric not null default 0,
  reward_count integer not null default 0,
  reward_amount numeric not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.funding_summary enable row level security;

create policy "funding_summary_select_public" on public.funding_summary
  for select using (true);

create policy "funding_summary_admin_write" on public.funding_summary
  for all using (
    public.is_admin()
  );

insert into public.funding_summary (key) values ('main') on conflict (key) do nothing;

-- ---------- 7. PLANNING / ROADMAP SECTION ----------
-- Year/month business milestones shown in the "Planning" section — entirely
-- admin-entered, publicly readable, editable at any time.
create table if not exists public.planning_items (
  id bigint generated always as identity primary key,
  period_date date not null,   -- store as the 1st of the month, e.g. 2026-07-01
  title text not null,
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.planning_items enable row level security;

create policy "planning_select_public" on public.planning_items
  for select using (true);

create policy "planning_admin_write" on public.planning_items
  for all using (
    public.is_admin()
  );

-- ---------- Make yourself admin ----------
-- After you sign up once through the site, run this (replace the email):
-- update public.profiles set is_admin = true where email = 'you@example.com';

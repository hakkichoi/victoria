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
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
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
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

create policy "requests_update_admin" on public.exchange_requests
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
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
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
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
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- seed a starting rate so the calculator has something to show on day 1
insert into public.exchange_rates (pair, rate)
values ('USDT_BLC', 1.0)
on conflict (pair) do nothing;

-- ---------- 5. Make yourself admin ----------
-- After you sign up once through the site, run this (replace the email):
-- update public.profiles set is_admin = true where email = 'you@example.com';

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
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
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
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

insert into public.funding_summary (key) values ('main') on conflict (key) do nothing;

-- ============================================================
-- TripSplit Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ── Trips ──────────────────────────────────────────────────
create table if not exists trips (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       char(6) unique not null,
  starts_at  date,
  ends_at    date,
  created_at timestamptz not null default now()
);

-- Auto-generate 6-char uppercase code
create or replace function generate_trip_code() returns trigger language plpgsql as $$
declare
  new_code char(6);
  exists_check int;
begin
  loop
    new_code := upper(substring(md5(random()::text) from 1 for 6));
    select count(*) into exists_check from trips where code = new_code;
    exit when exists_check = 0;
  end loop;
  new.code := new_code;
  return new;
end;
$$;

create trigger set_trip_code
  before insert on trips
  for each row when (new.code is null or new.code = '')
  execute function generate_trip_code();

-- ── Members ────────────────────────────────────────────────
create table if not exists members (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trips(id) on delete cascade,
  name           text not null,
  pin_hash       text,                   -- bcrypt hash of 4-digit PIN
  bank_type      text,                   -- 'bank' | 'promptpay' | 'truewallet'
  bank_name      text,
  account_number text,
  promptpay      text,
  truewallet     text,
  created_at     timestamptz not null default now()
);

-- ── Expenses ───────────────────────────────────────────────
create table if not exists expenses (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  title      text not null,
  amount     numeric(12,2) not null,
  paid_by    uuid not null references members(id),
  paid_at    timestamptz not null default now(),
  slip_url   text,
  created_by uuid references members(id),
  created_at timestamptz not null default now()
);

-- ── Expense Splits ─────────────────────────────────────────
create table if not exists expense_splits (
  id         uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  member_id  uuid not null references members(id) on delete cascade,
  amount     numeric(12,2) not null,
  unique (expense_id, member_id)
);

-- ── Settlements ────────────────────────────────────────────
create table if not exists settlements (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  from_member uuid not null references members(id),
  to_member   uuid not null references members(id),
  amount      numeric(12,2) not null,
  slip_url    text,
  status      text not null default 'pending',  -- 'pending' | 'confirmed'
  created_at  timestamptz not null default now(),
  confirmed_at timestamptz
);

-- ── Activity Logs ──────────────────────────────────────────
create table if not exists activity_logs (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  member_id  uuid references members(id),
  action     text not null,   -- 'CREATE' | 'UPDATE' | 'DELETE' | 'CONFIRM'
  entity     text not null,   -- 'expense' | 'settlement' | 'member'
  old_val    jsonb,
  new_val    jsonb,
  created_at timestamptz not null default now()
);

-- ── Storage bucket for slips ───────────────────────────────
insert into storage.buckets (id, name, public)
values ('slips', 'slips', true)
on conflict (id) do nothing;

-- ── RLS Policies ───────────────────────────────────────────
alter table trips        enable row level security;
alter table members      enable row level security;
alter table expenses     enable row level security;
alter table expense_splits enable row level security;
alter table settlements  enable row level security;
alter table activity_logs enable row level security;

-- Allow everyone to read/write (PIN-based auth is client-side)
-- For production you'd tighten these with JWT claims
create policy "open_access" on trips        for all using (true) with check (true);
create policy "open_access" on members      for all using (true) with check (true);
create policy "open_access" on expenses     for all using (true) with check (true);
create policy "open_access" on expense_splits for all using (true) with check (true);
create policy "open_access" on settlements  for all using (true) with check (true);
create policy "open_access" on activity_logs for all using (true) with check (true);

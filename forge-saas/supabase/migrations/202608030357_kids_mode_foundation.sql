-- Kids Mode — Phase 1 foundation.
-- Additive only: one new column on an existing table, two new tables. No
-- existing column, policy, or table is altered — see docs/kids-mode/00-principles.md
-- P1 and P4.
--
-- Rollback: drop table if exists public.parent_pins;
--           drop table if exists public.child_profiles;
--           alter table public.profiles drop column if exists kids_mode_enabled;

-- ============================================================
-- Per-profile allow-list (docs/kids-mode/05-delivery-roadmap.md task 1.2).
-- This is the SECOND of the two required layers (docs/kids-mode/00-principles.md
-- P9) — the first is the `kids_mode` entry in src/lib/entitlements.ts's
-- AVAILABLE_ON, which ships as `[]` (closed to everyone, no exceptions,
-- regardless of this column) until deliberately opened. Even with both layers
-- open for an account, this column defaults to false: nobody gets Kids Mode
-- by simply existing.
-- ============================================================

alter table public.profiles
  add column if not exists kids_mode_enabled boolean not null default false;

-- ============================================================
-- CHILD_PROFILES ---------------------------------------------------------------
-- One row per child. The parent holds the login; children are dependent
-- records, never their own auth.users row — docs/kids-mode/00-principles.md P3.
-- child_index is a small, parent-scoped, never-reused integer used in the
-- /kids/[index] URL instead of the row's uuid — chosen over the raw id so a
-- shared-phone browser history or screenshot doesn't carry a stable child
-- identifier (docs/kids-mode/03-architecture-and-data.md §3, OD-5 resolved
-- this way — see docs/kids-mode/01-decisions.md).
-- ============================================================

create table if not exists public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references public.profiles (id) on delete cascade,
  child_index int not null check (child_index between 1 and 5),
  display_name text not null check (char_length(display_name) between 1 and 30),
  age_band text not null check (age_band in ('4-6', '7-10', '11-14')),
  avatar_id text not null default 'animal-1' check (avatar_id ~ '^animal-([1-9]|1[0-2])$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parent_user_id, child_index)
);

create index if not exists child_profiles_parent_idx on public.child_profiles (parent_user_id);

alter table public.child_profiles enable row level security;

drop policy if exists "child_profiles: select own" on public.child_profiles;
create policy "child_profiles: select own" on public.child_profiles
  for select using (auth.uid() = parent_user_id);

drop policy if exists "child_profiles: insert own" on public.child_profiles;
create policy "child_profiles: insert own" on public.child_profiles
  for insert with check (auth.uid() = parent_user_id);

drop policy if exists "child_profiles: update own" on public.child_profiles;
create policy "child_profiles: update own" on public.child_profiles
  for update using (auth.uid() = parent_user_id);

-- Deleting is part of the feature, not an admin task — a parent must be able
-- to erase a child's data outright. Same reasoning as cycle_settings's delete
-- policy (supabase/schema.sql "17. CYCLE TRACKING").
drop policy if exists "child_profiles: delete own" on public.child_profiles;
create policy "child_profiles: delete own" on public.child_profiles
  for delete using (auth.uid() = parent_user_id);

-- ============================================================
-- PARENT_PINS -------------------------------------------------------------------
-- A PIN gate for re-entering /parent from Kids Mode. This is a UX speed bump,
-- never the security boundary — docs/kids-mode/00-principles.md P2 states this
-- explicitly. The real boundary is auth.uid() = parent_user_id above, enforced
-- identically whether or not a PIN session is present. A parent may have zero
-- rows here (no PIN configured yet); at most one PIN per account.
-- ============================================================

create table if not exists public.parent_pins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.parent_pins enable row level security;

drop policy if exists "parent_pins: select own" on public.parent_pins;
create policy "parent_pins: select own" on public.parent_pins
  for select using (auth.uid() = user_id);

drop policy if exists "parent_pins: insert own" on public.parent_pins;
create policy "parent_pins: insert own" on public.parent_pins
  for insert with check (auth.uid() = user_id);

drop policy if exists "parent_pins: update own" on public.parent_pins;
create policy "parent_pins: update own" on public.parent_pins
  for update using (auth.uid() = user_id);

drop policy if exists "parent_pins: delete own" on public.parent_pins;
create policy "parent_pins: delete own" on public.parent_pins
  for delete using (auth.uid() = user_id);

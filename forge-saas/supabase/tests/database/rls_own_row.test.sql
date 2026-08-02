-- RLS ownership test — proof of pattern for Kids Mode, and a real regression
-- test for Adult Mode today.
--
-- Every table in this app uses the same shape: a row belongs to one user, and
-- RLS policies read "auth.uid() = user_id" (see supabase/schema.sql — 41
-- policies, all this shape). Kids Mode's child_profiles table will use the
-- identical shape with parent_user_id. Nothing about that shape has ever been
-- tested against a real Postgres session — it has been believed correct
-- because it was written carefully.
--
-- This test picks `cycle_settings` as the example (it already has all four
-- policies — select/insert/update/delete — the exact set a Kids Mode table
-- needs) and proves the thing that actually matters: a second, unrelated user
-- cannot read, and cannot write, a row that isn't theirs.
--
-- When child_profiles exists, copy this file to rls_child_profiles.test.sql
-- and swap the table/column names. The pattern does not change.
--
-- Run with: supabase test db
-- Requires Docker (`supabase start` spins up a local Postgres). This file has
-- NOT been executed in the environment it was written in — that environment
-- has no Docker daemon. Treat the first real run as a verification, not a
-- formality. See docs/kids-mode/05-delivery-roadmap.md Phase 0.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- Two users, standing in for two unrelated parents. Their public.profiles
-- rows are NOT inserted here — schema.sql's on_auth_user_created trigger
-- (section 1, handle_new_user) fires on this insert and creates them
-- automatically, exactly as it does for a real signup. Inserting them by hand
-- as well duplicates the trigger's own insert and fails on the primary key —
-- confirmed the hard way running this for real against a genuine Supabase
-- auth.users table (the trigger doesn't exist on a bare pgTAP rehearsal
-- rig without it, which is why this went unnoticed until then).
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'intruder@example.test');

-- The owner creates their own cycle_settings row, as themselves.
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.cycle_settings (user_id, enabled, average_cycle_length, period_duration)
     values ('11111111-1111-1111-1111-111111111111', true, 28, 5) $$,
  'the owner can insert their own row'
);

-- Now become the second, unrelated user and try to reach the first user's row.
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is_empty(
  $$ select * from public.cycle_settings where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'an unrelated user cannot SELECT another user''s row — RLS filters it out silently'
);

select results_eq(
  $$ update public.cycle_settings
       set average_cycle_length = 30
     where user_id = '11111111-1111-1111-1111-111111111111'
     returning user_id $$,
  $$ select null::uuid where false $$,
  'an unrelated user''s UPDATE matches zero rows — RLS, not an application-level check, is what stops it'
);

select is(
  (select average_cycle_length from public.cycle_settings
     where user_id = '11111111-1111-1111-1111-111111111111'),
  28,
  'the row is provably unchanged after the unrelated user''s update attempt'
);

select results_eq(
  $$ delete from public.cycle_settings
     where user_id = '11111111-1111-1111-1111-111111111111'
     returning user_id $$,
  $$ select null::uuid where false $$,
  'an unrelated user''s DELETE matches zero rows'
);

-- Prove the row still exists at all — the previous checks would also pass on
-- a table with no rows in it, which would be a false negative.
select is(
  (select count(*) from public.cycle_settings
     where user_id = '11111111-1111-1111-1111-111111111111')::int,
  1,
  'the owner''s row survived every attempt by the unrelated user'
);

select * from finish();

rollback;

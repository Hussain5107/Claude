-- RLS ownership test for child_profiles — the pattern from rls_own_row.test.sql,
-- copied per that file's own header instruction ("When child_profiles exists,
-- copy this file... and swap the table/column names. The pattern does not
-- change.") now that Phase 1 has created the real table.
--
-- Same shape, one difference: the owner column is parent_user_id, not
-- user_id, and there's a second uniqueness dimension (child_index) instead of
-- a single-row-per-user primary key. Otherwise this proves exactly what
-- rls_own_row.test.sql proves for cycle_settings: a second, unrelated user
-- cannot read, and cannot write, a row that isn't theirs.
--
-- Run with: supabase test db (via .github/workflows/db-tests.yml).

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- Two users, standing in for two unrelated parents. Their public.profiles
-- rows are NOT inserted here — schema.sql's on_auth_user_created trigger
-- (section 1, handle_new_user) fires on this insert and creates them
-- automatically, exactly as it does for a real signup. See rls_own_row.test.sql
-- for the real bug this repository hit the first time this was gotten wrong.
insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'parent-a@example.test'),
  ('44444444-4444-4444-4444-444444444444', 'parent-b@example.test');

-- Parent A creates their own child, as themselves.
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.child_profiles (parent_user_id, child_index, display_name, age_band, avatar_id)
     values ('33333333-3333-3333-3333-333333333333', 1, 'Riley', '7-10', 'animal-1') $$,
  'a parent can insert their own child'
);

-- Now become the second, unrelated parent and try to reach the first parent's child.
set local "request.jwt.claims" to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';

select is_empty(
  $$ select * from public.child_profiles where parent_user_id = '33333333-3333-3333-3333-333333333333' $$,
  'an unrelated parent cannot SELECT another parent''s child — RLS filters it out silently'
);

select results_eq(
  $$ update public.child_profiles
       set display_name = 'Hijacked'
     where parent_user_id = '33333333-3333-3333-3333-333333333333'
     returning parent_user_id $$,
  $$ select null::uuid where false $$,
  'an unrelated parent''s UPDATE matches zero rows — RLS, not an application-level check, is what stops it'
);

-- Switch back to parent A to check the row's actual state — checking while
-- still impersonating the unrelated parent would prove nothing either way,
-- since RLS hides the row from them regardless of whether the attack
-- succeeded (the exact bug this project's pgTAP tests caught once already —
-- see docs/kids-mode/01-decisions.md E-012).
set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select is(
  (select display_name from public.child_profiles
     where parent_user_id = '33333333-3333-3333-3333-333333333333'),
  'Riley',
  'the child''s name is provably unchanged after the unrelated parent''s update attempt'
);

set local "request.jwt.claims" to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';

select results_eq(
  $$ delete from public.child_profiles
     where parent_user_id = '33333333-3333-3333-3333-333333333333'
     returning parent_user_id $$,
  $$ select null::uuid where false $$,
  'an unrelated parent''s DELETE matches zero rows'
);

set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select is(
  (select count(*) from public.child_profiles
     where parent_user_id = '33333333-3333-3333-3333-333333333333')::int,
  1,
  'the child survived every attempt by the unrelated parent'
);

select * from finish();

rollback;

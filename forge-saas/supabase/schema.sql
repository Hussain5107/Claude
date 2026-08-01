-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- for a brand new project. Safe to re-run: uses "if not exists" / "or replace"
-- throughout.

-- 1. PROFILES ---------------------------------------------------------------
-- One row per signed-up user, created automatically by the trigger below.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  age int check (age between 13 and 100),
  sex text check (sex in ('male', 'female')),
  height_cm numeric check (height_cm between 100 and 250),
  weight_kg numeric check (weight_kg between 30 and 300),
  goal text check (goal in ('muscle', 'strength', 'fat_loss', 'general_fitness')),
  experience text check (experience in ('beginner', 'intermediate', 'advanced')),
  onboarded boolean not null default false,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. PROGRAMS ----------------------------------------------------------------
-- The latest generated program per user (regenerating overwrites this row).

create table if not exists public.programs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  program jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.programs enable row level security;

drop policy if exists "programs: select own" on public.programs;
create policy "programs: select own" on public.programs
  for select using (auth.uid() = user_id);

drop policy if exists "programs: upsert own" on public.programs;
create policy "programs: upsert own" on public.programs
  for insert with check (auth.uid() = user_id);

drop policy if exists "programs: update own" on public.programs;
create policy "programs: update own" on public.programs
  for update using (auth.uid() = user_id);

-- 3. PROGRESS ------------------------------------------------------------
-- One row per exercise, per calendar date, per user.

create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  day_number int not null,
  exercise_slug text not null,
  done boolean not null default false,
  note text,
  updated_at timestamptz not null default now(),
  unique (user_id, log_date, exercise_slug)
);

alter table public.progress enable row level security;

drop policy if exists "progress: select own" on public.progress;
create policy "progress: select own" on public.progress
  for select using (auth.uid() = user_id);

drop policy if exists "progress: upsert own" on public.progress;
create policy "progress: upsert own" on public.progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "progress: update own" on public.progress;
create policy "progress: update own" on public.progress
  for update using (auth.uid() = user_id);

create index if not exists progress_user_date_idx on public.progress (user_id, log_date);

-- 4. WORKOUT_SETS -------------------------------------------------------------
-- One row per logged set (actual weight/reps used), for progress charts and
-- PR detection. Separate from `progress` (which just tracks done/notes).

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  day_number int not null,
  exercise_slug text not null,
  exercise_name text not null,
  set_number int not null,
  weight_kg numeric check (weight_kg >= 0),
  reps int check (reps >= 0),
  rpe numeric check (rpe between 1 and 10),
  logged_at timestamptz not null default now()
);

alter table public.workout_sets enable row level security;

drop policy if exists "workout_sets: select own" on public.workout_sets;
create policy "workout_sets: select own" on public.workout_sets
  for select using (auth.uid() = user_id);

drop policy if exists "workout_sets: insert own" on public.workout_sets;
create policy "workout_sets: insert own" on public.workout_sets
  for insert with check (auth.uid() = user_id);

drop policy if exists "workout_sets: delete own" on public.workout_sets;
create policy "workout_sets: delete own" on public.workout_sets
  for delete using (auth.uid() = user_id);

create index if not exists workout_sets_user_exercise_idx on public.workout_sets (user_id, exercise_slug, logged_at desc);
create index if not exists workout_sets_user_date_idx on public.workout_sets (user_id, log_date);

-- 5. PERSONAL_RECORDS ---------------------------------------------------------
-- Append-only: a new row every time a PR is beaten, so history is preserved.
-- The current PR per exercise is just the latest row for that exercise.

create table if not exists public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  exercise_slug text not null,
  exercise_name text not null,
  weight_kg numeric not null,
  reps int not null,
  estimated_1rm numeric not null,
  achieved_at timestamptz not null default now()
);

alter table public.personal_records enable row level security;

drop policy if exists "personal_records: select own" on public.personal_records;
create policy "personal_records: select own" on public.personal_records
  for select using (auth.uid() = user_id);

drop policy if exists "personal_records: insert own" on public.personal_records;
create policy "personal_records: insert own" on public.personal_records
  for insert with check (auth.uid() = user_id);

create index if not exists personal_records_user_exercise_idx on public.personal_records (user_id, exercise_slug, achieved_at desc);

-- 6. STREAKS -------------------------------------------------------------
-- One row per user, updated whenever they log at least one set for the day.

create table if not exists public.streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_workout_date date,
  total_workouts int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.streaks enable row level security;

drop policy if exists "streaks: select own" on public.streaks;
create policy "streaks: select own" on public.streaks
  for select using (auth.uid() = user_id);

drop policy if exists "streaks: upsert own" on public.streaks;
create policy "streaks: upsert own" on public.streaks
  for insert with check (auth.uid() = user_id);

drop policy if exists "streaks: update own" on public.streaks;
create policy "streaks: update own" on public.streaks
  for update using (auth.uid() = user_id);

-- 7. PROFILE EXTENSIONS ---------------------------------------------------
-- Additional optional profile fields, editable any time from Settings.

alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists phone_number text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists has_diabetes boolean not null default false;
alter table public.profiles add column if not exists has_high_blood_pressure boolean not null default false;
alter table public.profiles add column if not exists other_health_notes text;
alter table public.profiles add column if not exists water_reminder_enabled boolean not null default false;
alter table public.profiles add column if not exists water_reminder_hour int check (water_reminder_hour between 0 and 23) default 10;
alter table public.profiles add column if not exists workout_reminder_enabled boolean not null default false;
alter table public.profiles add column if not exists workout_reminder_hour int check (workout_reminder_hour between 0 and 23) default 7;

-- 8. REVIEWS ---------------------------------------------------------------
-- Real, user-submitted reviews only. One per user; existence of a row means
-- "never prompt again."

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

drop policy if exists "reviews: select own" on public.reviews;
create policy "reviews: select own" on public.reviews
  for select using (auth.uid() = user_id);

drop policy if exists "reviews: insert own" on public.reviews;
create policy "reviews: insert own" on public.reviews
  for insert with check (auth.uid() = user_id);

-- 9. PROGRESS_PHOTOS ---------------------------------------------------------
-- Before/after photos so users can compare progress across months.

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  photo_url text not null,
  taken_at date not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.progress_photos enable row level security;

drop policy if exists "progress_photos: select own" on public.progress_photos;
create policy "progress_photos: select own" on public.progress_photos
  for select using (auth.uid() = user_id);

drop policy if exists "progress_photos: insert own" on public.progress_photos;
create policy "progress_photos: insert own" on public.progress_photos
  for insert with check (auth.uid() = user_id);

drop policy if exists "progress_photos: delete own" on public.progress_photos;
create policy "progress_photos: delete own" on public.progress_photos
  for delete using (auth.uid() = user_id);

create index if not exists progress_photos_user_date_idx on public.progress_photos (user_id, taken_at);

-- Storage bucket for progress photos + avatars. Run once; safe to re-run.
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', true)
on conflict (id) do nothing;

drop policy if exists "progress-photos: read own" on storage.objects;
create policy "progress-photos: read own" on storage.objects
  for select using (bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "progress-photos: insert own" on storage.objects;
create policy "progress-photos: insert own" on storage.objects
  for insert with check (bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "progress-photos: delete own" on storage.objects;
create policy "progress-photos: delete own" on storage.objects
  for delete using (bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- 10. HEALTH_METRICS ---------------------------------------------------------
-- Optional daily health tracking (blood pressure etc.), logged after workouts.

create table if not exists public.health_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  systolic int check (systolic between 60 and 260),
  diastolic int check (diastolic between 40 and 160),
  pulse int check (pulse between 30 and 220),
  notes text,
  logged_at timestamptz not null default now()
);

alter table public.health_metrics enable row level security;

drop policy if exists "health_metrics: select own" on public.health_metrics;
create policy "health_metrics: select own" on public.health_metrics
  for select using (auth.uid() = user_id);

drop policy if exists "health_metrics: insert own" on public.health_metrics;
create policy "health_metrics: insert own" on public.health_metrics
  for insert with check (auth.uid() = user_id);

create index if not exists health_metrics_user_date_idx on public.health_metrics (user_id, log_date);

-- 11. PUSH_SUBSCRIPTIONS ------------------------------------------------------
-- Web Push subscriptions for reminder notifications (one browser install per row).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions: select own" on public.push_subscriptions;
create policy "push_subscriptions: select own" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push_subscriptions: insert own" on public.push_subscriptions;
create policy "push_subscriptions: insert own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions: delete own" on public.push_subscriptions;
create policy "push_subscriptions: delete own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

drop policy if exists "push_subscriptions: update own" on public.push_subscriptions;
create policy "push_subscriptions: update own" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- 12. WORKOUT DAY ROTATION + TRAINING LOCATION ------------------------------
-- day_offset shifts which PPL day (Push A/Pull A/Legs A/Push B/Pull B/Legs B)
-- falls on which weekday, so colleagues sharing the app don't all get leg day
-- on the same Tuesday. Defaults to 0 (today's fixed Mon-Sat mapping) so
-- existing users are unaffected; set once at onboarding for new users.
--
-- training_location / has_dumbbells_at_home drive which exercise program is
-- generated: gym (full equipment), home with dumbbells, or fully bodyweight
-- (home without dumbbells, or training in a park).

alter table public.profiles add column if not exists day_offset int not null default 0 check (day_offset between 0 and 5);
alter table public.profiles add column if not exists training_location text not null default 'gym' check (training_location in ('gym', 'home'));
alter table public.profiles add column if not exists has_dumbbells_at_home boolean not null default true;

-- 13. DAILY INTAKE ------------------------------------------------------------
-- Actual logged water/protein intake per day, tracked against the computed
-- targets shown on the dashboard (which were target-only before this).

create table if not exists public.daily_intake (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  water_ml int not null default 0,
  protein_g int not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

alter table public.daily_intake enable row level security;

drop policy if exists "daily_intake: select own" on public.daily_intake;
create policy "daily_intake: select own" on public.daily_intake
  for select using (auth.uid() = user_id);

drop policy if exists "daily_intake: insert own" on public.daily_intake;
create policy "daily_intake: insert own" on public.daily_intake
  for insert with check (auth.uid() = user_id);

drop policy if exists "daily_intake: update own" on public.daily_intake;
create policy "daily_intake: update own" on public.daily_intake
  for update using (auth.uid() = user_id);

create index if not exists daily_intake_user_date_idx on public.daily_intake (user_id, log_date);

-- 14. TRAINING FREQUENCY -------------------------------------------------------
-- How many days a week the user wants to train. Drives which split the program
-- generator builds: 3 = full body, 4 = upper/lower, 5 = PPL + upper/lower,
-- 6 = the original Push/Pull/Legs ×2. Defaults to 6 so existing users keep the
-- exact plan they already have.

alter table public.profiles add column if not exists days_per_week int not null default 6 check (days_per_week between 3 and 6);

-- 15. PUBLIC REVIEW SUMMARY ----------------------------------------------------
-- The reviews table is readable only by its author, which is what we want for
-- the comments people write. But the landing page needs an overall rating, and
-- it's shown to logged-out visitors.
--
-- This view exposes ONLY the aggregate — never a row, a comment, or a user id.
-- Views run with their owner's privileges, so it can read across the table
-- without loosening the row policy on reviews itself.

create or replace view public.review_stats as
  select
    count(*)::int                             as review_count,
    round(avg(rating)::numeric, 2)::float8    as average_rating
  from public.reviews;

grant select on public.review_stats to anon, authenticated;

-- 16. THEME --------------------------------------------------------------------
-- Which colour theme the app paints in. This is a look preference, not a second
-- record of the user's sex — `profiles.sex` already holds that, and is used for
-- the BMR calculation. Onboarding pre-selects a theme from the sex the user
-- entered and lets them change it there and in Settings.
--
-- Defaults to 'forge', so every account that existed before themes keeps the
-- original violet-and-cyan branding until they choose otherwise.

alter table public.profiles add column if not exists theme text not null default 'forge';

alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles add constraint profiles_theme_check
  check (theme in ('forge', 'blue', 'pink'));

-- 17. CYCLE TRACKING -----------------------------------------------------------
-- Optional, opt-in, and private to the user who entered it.
--
-- Two tables rather than columns on `profiles`: this is health information, and
-- keeping it separate means it can be deleted outright (a single delete of the
-- row) without touching the account. Nothing here is ever aggregated into the
-- public review_stats view or any other shared surface.

create table if not exists public.cycle_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  enabled boolean not null default false,
  last_period_start date,
  average_cycle_length int not null default 28 check (average_cycle_length between 20 and 45),
  period_duration int not null default 5 check (period_duration between 1 and 10),
  updated_at timestamptz not null default now()
);

alter table public.cycle_settings enable row level security;

drop policy if exists "cycle_settings: select own" on public.cycle_settings;
create policy "cycle_settings: select own" on public.cycle_settings
  for select using (auth.uid() = user_id);

drop policy if exists "cycle_settings: insert own" on public.cycle_settings;
create policy "cycle_settings: insert own" on public.cycle_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists "cycle_settings: update own" on public.cycle_settings;
create policy "cycle_settings: update own" on public.cycle_settings
  for update using (auth.uid() = user_id);

-- Deleting is part of the feature, not an admin task: "turn this off and erase
-- what I entered" has to be something the user can actually do.
drop policy if exists "cycle_settings: delete own" on public.cycle_settings;
create policy "cycle_settings: delete own" on public.cycle_settings
  for delete using (auth.uid() = user_id);

-- One optional check-in per day: how the user feels, in their own words as far
-- as the app is concerned. Used only to soften or restore today's suggestion.

create table if not exists public.cycle_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  energy text check (energy in ('low', 'medium', 'high')),
  symptoms text[] not null default '{}',
  -- 'follow' takes the suggestion, 'push' means the user has decided to train
  -- as normal today. Their call always wins over the calculated phase.
  override text check (override in ('follow', 'push')),
  logged_at timestamptz not null default now(),
  unique (user_id, log_date)
);

alter table public.cycle_checkins enable row level security;

drop policy if exists "cycle_checkins: select own" on public.cycle_checkins;
create policy "cycle_checkins: select own" on public.cycle_checkins
  for select using (auth.uid() = user_id);

drop policy if exists "cycle_checkins: insert own" on public.cycle_checkins;
create policy "cycle_checkins: insert own" on public.cycle_checkins
  for insert with check (auth.uid() = user_id);

drop policy if exists "cycle_checkins: update own" on public.cycle_checkins;
create policy "cycle_checkins: update own" on public.cycle_checkins
  for update using (auth.uid() = user_id);

drop policy if exists "cycle_checkins: delete own" on public.cycle_checkins;
create policy "cycle_checkins: delete own" on public.cycle_checkins
  for delete using (auth.uid() = user_id);

create index if not exists cycle_checkins_user_date_idx on public.cycle_checkins (user_id, log_date);

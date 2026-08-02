# Database backups

**The Supabase free tier provides no automated backups.** Production is currently the
only copy of every user's history — profiles, logged sets, personal records, streaks,
health metrics and cycle entries. If the project is deleted or corrupted, that data is
gone.

This document is the mitigation. It is a manual process, and it only works if someone
actually runs it.

---

## Take a backup

```bash
./scripts/backup-db.sh
```

Writes `backups/forge-YYYY-MM-DD-HHMM.sql.gz`. The `backups/` directory is gitignored.

### One-time setup

1. Get the **direct Postgres connection string** — this is *not* the same as
   `NEXT_PUBLIC_SUPABASE_URL`:

   Supabase dashboard → Project Settings → Database → Connection string → **URI**

2. Add it to `.env.local` (gitignored):

   ```
   SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres
   ```

3. Install `pg_dump` if you don't have it:

   | Platform | Command |
   |---|---|
   | macOS | `brew install libpq && brew link --force libpq` |
   | Debian/Ubuntu | `sudo apt-get install postgresql-client` |
   | Windows | Install PostgreSQL, or use WSL |

   No `pg_dump`? The Supabase CLI does the same job:
   `npx supabase db dump --db-url "$SUPABASE_DB_URL" -f backup.sql`

---

## When to run it

| Trigger | Why |
|---|---|
| **Before any schema change** | Non-negotiable. A bad migration is the most likely way to lose data. |
| **Before the first Kids Mode migration** | Phase 0 task 0.2 in `docs/kids-mode/05-delivery-roadmap.md` |
| Weekly, or whenever there is activity worth not losing | Everything since the last backup is what you lose |
| Before changing anything in the Supabase dashboard | Dashboard actions are immediate and unlogged |

---

## What the dump contains

`public` **and** `auth` schemas.

`auth` is included deliberately: `profiles.id` references `auth.users(id)`
(`supabase/schema.sql:9`). A public-only dump could not be restored without every row
being orphaned, because the users those rows belong to would not exist.

**Not included:** Supabase-managed internals (`storage`, `realtime`, `extensions`,
`vault`), and **the contents of the `progress-photos` storage bucket**. Uploaded photos
and avatars are files in object storage, not rows — this dump does not cover them. Only
their URLs are backed up. Backing up the bucket itself is a separate job that does not
exist yet.

---

## Handling the file

The dump contains real personal data: email addresses, blood-pressure readings, and
cycle-tracking entries — which is health data about identifiable people.

- **Never commit it.** `/backups` is gitignored, but a dump moved elsewhere is not.
- **Never attach it to an issue, a chat, or a support ticket.**
- **Copy it somewhere durable.** A backup that only exists on the laptop that made it
  is not a backup.
- **Delete old copies.** Data you do not keep cannot leak.

---

## Restoring — read before you need it

**Rehearsed once, end to end, against a real PostgreSQL 16 instance** — not a real
Supabase project (this environment can't reach Supabase), but the actual `pg_dump` /
`gzip` / restore commands, the actual `schema.sql`, and synthetic data standing in for
a real user. Full run: applied `schema.sql` in full (all 14 relations, all 41 RLS
policies — matches the audit exactly), seeded one obviously-fake profile plus a streak
and a workout set, ran the exact `pg_dump` command `scripts/backup-db.sh` uses, gzipped
it, restored the gzip into a second, completely separate database, and confirmed every
row came back identical and RLS still filtered correctly (a stranger's JWT saw 0 rows;
the seeded user's JWT saw exactly 1). Torn down immediately after — no synthetic data,
databases, or files were left behind.

Rough shape:

```bash
gunzip -c backups/forge-YYYY-MM-DD-HHMM.sql.gz | psql "$TARGET_DB_URL"
```

**One real step the rehearsal found that the shape above glosses over:** the target
database's `public` schema already exists (Postgres creates every new database with an
empty one), and the dump's own `CREATE SCHEMA "public"` statement collides with it.
Before restoring:

```sql
drop schema public cascade;
```

Without this, the restore fails immediately on the very first `CREATE SCHEMA` — it
doesn't corrupt anything, but it does mean the rough shape above does not work as
written. **Predicted, not confirmed, for a real Supabase project specifically:** every
Postgres database creates schemas this way, so the same conflict should occur there
too — but this hasn't been run against actual Supabase infrastructure, only against
plain PostgreSQL 16, so treat this one line as a strong hint, not a guarantee.

**A second real finding:** `scripts/backup-db.sh` passes `--no-privileges` to
`pg_dump`, which is correct — the dump shouldn't be trying to recreate Supabase's own
role setup — but it means the dump contains **no** `GRANT` statements at all, including
the schema- and table-level access that lets the `authenticated` and `anon` roles read
anything. On a real, fresh Supabase project this is a non-issue: Supabase's platform
provisions those grants automatically for every new project, independent of anything in
`schema.sql`. It only became visible in this rehearsal because the test rig was raw
Postgres with no such platform behind it, and had to be given `grant select, insert,
update, delete on all tables in schema public to authenticated` (and `select` for
`anon`) by hand before RLS could be exercised at all. Worth knowing regardless: if a
restore ever *doesn't* land inside a fresh Supabase project (some other Postgres target),
those grants will need to be added by hand, or nothing will be readable no matter how
correct the RLS policies are.

Other things that will bite, not yet rehearsed:

- A fresh Supabase project means a new project URL and new API keys → Vercel
  environment variables must be updated.
- Storage bucket contents are not in the dump (see above).

---

## Why this isn't automated

Considered and rejected for now:

| Option | Why not |
|---|---|
| GitHub Actions on a schedule | Artifacts in a **public** repository are downloadable. Putting a dump of users' health data there would be worse than having no backup. |
| Commit dumps to a private repo | Personal data in Git history is effectively permanent and cannot be selectively deleted. |
| Supabase Pro | Provides daily backups and point-in-time recovery. Costs money; a real option if this becomes a commercial product. |

If automation is wanted, it needs a **private** destination — an object store with
restricted access — and that is a decision with a cost attached, not a script.

---

## Honest limitations

1. **Manual.** If nobody runs it, there is no backup.
2. **Rehearsed against plain PostgreSQL, not real Supabase.** The dump/restore/RLS
   mechanics are now genuinely proven — see "Restoring" above — but always against a
   local PostgreSQL 16 instance carrying `schema.sql`, never against an actual Supabase
   project, because this environment cannot reach Supabase's network at all (confirmed:
   direct connection attempts are rejected by the sandbox's proxy policy). **The one
   step that still needs a real run: backing up actual production and restoring it into
   a real, fresh Supabase project.** Do that once, and update this file with what
   differs, if anything, from the plain-Postgres rehearsal above.
3. **No storage bucket coverage.** Progress photos and avatars are not backed up.
4. **No retention policy.** Old dumps accumulate until someone deletes them.
5. **The 10KB minimum-size guard was calibrated on a near-empty database.** The
   rehearsal's single-synthetic-user dump compressed to ~4.6KB — *below* the script's
   own "too small to be real" threshold, on a database holding real rows across every
   table. Production, with 15 real user profiles and their accumulated history, is
   almost certainly comfortably over 10KB compressed — but this wasn't measurable from
   here, so if the very first real backup gets rejected as "too small," that's why:
   lower the threshold in `scripts/backup-db.sh`, don't just retry.

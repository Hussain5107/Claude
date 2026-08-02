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

Restoring is not a one-liner, and **this procedure has not been rehearsed.** An
unrehearsed restore is a plan, not a guarantee. Rehearsing it once against a throwaway
Supabase project is the single highest-value thing that could be done with these files.

Rough shape:

```bash
gunzip -c backups/forge-YYYY-MM-DD-HHMM.sql.gz | psql "$TARGET_DB_URL"
```

Things that will bite:

- Restoring into a project that already has data will conflict. A restore usually means
  a fresh project.
- A fresh project means a new project URL and new API keys → Vercel environment
  variables must be updated.
- Storage bucket contents are not in the dump (see above).
- Supabase-managed roles and extensions may need to exist before the restore runs.

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
2. **Unrehearsed restore.** See above.
3. **No storage bucket coverage.** Progress photos and avatars are not backed up.
4. **No retention policy.** Old dumps accumulate until someone deletes them.
5. **Not verified from this environment.** The sandbox this script was written in cannot
   reach Supabase, so it has been syntax-checked and its failure paths tested, but it
   has never completed a real dump. **The first run should be treated as a test** —
   check the file size and open the gzip before relying on it.

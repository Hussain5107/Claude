> ## ⚠️ The FORGE app is not maintained here
>
> This branch contains a copy of the FORGE web app under `forge-saas/`. It is an
> **archive**. Vercel does not build from it, so changes pushed here never reach
> production — that has already caused several hours of lost time.
>
> **FORGE lives at [`Hussain5107/forge-saas`](https://github.com/Hussain5107/forge-saas)
> (branch `main`). Push application changes there.**
>
> See `forge-saas/docs/repository.md` for the full history of why.

---

# Gym Reminder

A standalone, always-on 6am gym reminder that pushes a real phone notification
every day with that day's Push/Pull/Legs workout. Runs entirely on GitHub
Actions (free, no server/laptop required) and delivers via
[ntfy.sh](https://ntfy.sh) (free, no account needed).

This is independent of Claude Cowork's scheduled tasks feature — it does not
depend on any of your devices being awake or online.

## How it works

- `.github/workflows/gym-reminder.yml` runs on a GitHub Actions cron schedule
  at 02:00 UTC every day, which is **06:00 Asia/Dubai** (UTC+4, no DST).
- `scripts/send_reminder.py` computes the current day of week in
  `Asia/Dubai` time, looks up the matching workout in `data/workouts.json`,
  and POSTs it to your ntfy.sh topic as a push notification.
- `data/workouts.json` holds all 6 day-scripts (Push/Pull/Legs, each with
  warm-up, exercises, sets/reps, cooldown) plus the day-of-week schedule.
  Edit this file any time to change your workouts — no need to touch the
  workflow or script.

Schedule (in `data/workouts.json` under `"schedule"`):

| Day | Workout |
|-----|---------|
| Monday | Push |
| Tuesday | Pull |
| Wednesday | Legs |
| Thursday | Push |
| Friday | Pull |
| Saturday | Legs |
| Sunday | Rest |

## Setup

1. **Install the ntfy app** on your phone (iOS App Store / Google Play:
   search "ntfy"), or use the web app at https://ntfy.sh/app.

2. **Pick a unique, hard-to-guess topic name.** Anyone who knows your topic
   name can read your notifications or publish to it, since ntfy.sh topics
   are public by default (unless you self-host or pay for ntfy Pro). Do not
   use something guessable like `john-gym`. A good pattern is
   `gym-<random string>`, e.g. `gym-7k2m9xqf31`.

3. **Subscribe to that topic in the ntfy app** (tap "+", enter the topic
   name, use the default `ntfy.sh` server).

4. **Add the topic as a GitHub repository secret** (this repo, not a file —
   keeping it out of the repo avoids leaking it if the repo is ever made
   public):
   - Go to this repo on GitHub → **Settings → Secrets and variables →
     Actions → New repository secret**.
   - Name: `NTFY_TOPIC`
   - Value: the topic name you picked in step 2.
   - Save.

5. **(Optional) Edit your workouts.** Open `data/workouts.json` and adjust
   exercises, sets/reps, warm-up, or cooldown to taste. Commit and push your
   changes.

6. **Commit and push** (if you made any edits):
   ```bash
   git add data/workouts.json
   git commit -m "Customize workouts"
   git push -u origin claude/gym-reminder-github-actions-w03bfv
   ```

7. **Test it on demand** instead of waiting for 6am:
   - Go to this repo on GitHub → **Actions → Gym Reminder → Run workflow**.
   - Leave `topic_override` blank to send to your real `NTFY_TOPIC` secret,
     or fill it in with a throwaway topic name to test without touching your
     real one.
   - Click **Run workflow**.

8. **Verify it on your phone.** Within a few seconds of the run finishing,
   you should see a push notification titled e.g. "Friday: Pull Day (Back /
   Biceps)" with the full workout as the body. If nothing arrives:
   - Check the ntfy app is actually subscribed to the exact topic name in
     your `NTFY_TOPIC` secret (typos are the most common cause).
   - Check notification permissions are enabled for the ntfy app in your
     phone's OS settings.
   - Check the workflow run's logs in the GitHub Actions tab for the HTTP
     status code returned by ntfy.sh.

Once merged to your default branch, the schedule trigger takes over and
you'll get the reminder automatically every day at 6am Asia/Dubai time — no
laptop or app needs to be open.

## Changing timezone or send time

Edit the cron line in `.github/workflows/gym-reminder.yml`:

```yaml
schedule:
  - cron: "0 2 * * *"   # 02:00 UTC
```

GitHub Actions cron always runs in UTC, so convert your desired local time
to UTC and update the comment above it. Note GitHub Actions schedules can be
delayed by a few minutes during high load; this is a platform limitation.

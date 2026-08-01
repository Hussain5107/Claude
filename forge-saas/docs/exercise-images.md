# Exercise images

Every exercise FORGE can prescribe, across all three equipment libraries.

**99 unique exercises.** 43 already have a photo; **56 have none** — those
currently point at a file that doesn't exist, so the app falls back to a 🏋️ emoji.

## What to generate

| Spec | Value |
|---|---|
| Size | **1024 × 1024 px, square** |
| Format | JPG (PNG is fine too — I'll convert) |
| Filename | Exactly the slug in the table, e.g. `dumbbell-goblet-squat.jpg` |
| Framing | Whole body in frame, centred, ~10% empty margin all round |
| Background | Plain, dark, uncluttered |

Square matters: the same file is shown as a small portrait thumbnail in the
exercise list **and** as a larger square in the expanded card. Anything centred
in a square survives both crops. Leave margin so a head or a foot isn't clipped.

Don't put text, arrows, logos or watermarks in the image — the app already
shows the name, the sets, the reps and the cues next to it.

## Prompt template for Gemini

> Photorealistic fitness photograph of a person performing a **{EXERCISE NAME}**,
> at the mid-point of the movement with correct form. {KEY FORM CUE}.
> Equipment: {EQUIPMENT}. Full body visible, centred in frame with space around
> the subject. Plain dark charcoal studio background, soft directional lighting.
> Square 1:1 composition. No text, no logos, no watermarks.

Fill `{EXERCISE NAME}`, `{KEY FORM CUE}` and `{EQUIPMENT}` from the table rows.

A few worth calling out, because a generic prompt gets them wrong:

- **Home exercises** should look like a home — a living room or bedroom, not a
  commercial gym. Same for the dark background; just make the room read as domestic.
- **Park / bodyweight exercises** work well outdoors: a park, a bench, a low bar.
- **Isometric towel and doorframe moves** are unusual and easy to render as
  nonsense. Check these ones by eye before you keep them.
- **Machine exercises** (leg press, cable crossover, lat pulldown) need the
  machine to be recognisable, not an invented contraption.

## Consistency

The 43 existing photos are stock photography. If you generate the
56 missing ones in a different style, the list will look mixed.
Generating all 99 in one style gives a better result — your call,
and the second table below is there if you want to.

## How to hand them back

Zip them, or drop them into `forge-saas/public/images/` and push. I'll resize,
compress and wire up every path. Only the filenames need to be right.

---

## Table 1 — needed now (56)

| # | Filename to save as | Exercise | Equipment | Used in | Key form cue (use in your prompt) |
|---|---|---|---|---|---|
| 1 | `dumbbell-floor-press.jpg` | Dumbbell Floor Press | Dumbbells | Home | Lie on the floor, knees bent, feet flat |
| 2 | `standing-dumbbell-shoulder-press.jpg` | Standing Dumbbell Shoulder Press | Dumbbells | Home | Brace your core, ribs down |
| 3 | `push-up.jpg` | Push-Up | Bodyweight | Home, Park | Hands slightly wider than shoulders |
| 4 | `dumbbell-floor-fly.jpg` | Dumbbell Floor Fly | Dumbbells | Home | Slight bend in the elbows, locked in place |
| 5 | `dumbbell-bent-over-row.jpg` | Dumbbell Bent-Over Row | Dumbbells | Home | Hinge at the hips, flat back, soft knees |
| 6 | `dumbbell-renegade-row.jpg` | Dumbbell Renegade Row | Dumbbells | Home | Plank position, hands on dumbbells, feet wide for stability |
| 7 | `reverse-crunch.jpg` | Reverse Crunch | Bodyweight | Home | Lie on your back, knees bent to 90° |
| 8 | `dumbbell-goblet-squat.jpg` | Dumbbell Goblet Squat | Dumbbells | Home | Hold one dumbbell vertically at your chest |
| 9 | `dumbbell-romanian-deadlift.jpg` | Dumbbell Romanian Deadlift | Dumbbells | Home | Soft knees, push your hips straight back |
| 10 | `single-leg-dumbbell-deadlift.jpg` | Single-Leg Dumbbell Deadlift | Dumbbells | Home | Hold a dumbbell in the opposite hand to your standing leg |
| 11 | `standing-dumbbell-calf-raise.jpg` | Standing Dumbbell Calf Raise | Dumbbells | Home | Stand on a step edge if available for full range |
| 12 | `dumbbell-russian-twist.jpg` | Dumbbell Russian Twist | Dumbbells | Home | Lean back to about 45°, feet lifted if you can |
| 13 | `diamond-push-up.jpg` | Diamond Push-Up | Bodyweight | Home, Park | Hands together under your chest, thumbs and index fingers touching |
| 14 | `wide-push-up.jpg` | Wide Push-Up | Bodyweight | Home, Park | Hands set wider than shoulder width |
| 15 | `dumbbell-front-raise.jpg` | Dumbbell Front Raise | Dumbbells | Home | Slight bend in the elbows |
| 16 | `dumbbell-pullover.jpg` | Dumbbell Pullover | Dumbbells | Home | Lie across a chair/sofa with hips supported, or flat on the floor |
| 17 | `dumbbell-reverse-fly.jpg` | Dumbbell Reverse Fly | Dumbbells | Home | Hinge forward at the hips, flat back, dumbbells hanging straight down |
| 18 | `dumbbell-zottman-curl.jpg` | Dumbbell Zottman Curl | Dumbbells | Home | Curl up with palms facing up (regular curl) |
| 19 | `cross-body-hammer-curl.jpg` | Cross-Body Hammer Curl | Dumbbells | Home | Palms face each other (neutral grip) |
| 20 | `superman.jpg` | Superman | Bodyweight | Home, Park | Lie face down, arms extended overhead |
| 21 | `bicycle-crunch.jpg` | Bicycle Crunch | Bodyweight | Home | Hands lightly behind your head, elbows wide |
| 22 | `dumbbell-sumo-squat.jpg` | Dumbbell Sumo Squat | Dumbbells | Home | Wide stance, toes turned out ~30° |
| 23 | `dumbbell-hip-thrust.jpg` | Dumbbell Hip Thrust | Dumbbells + Sofa or Chair | Home | Upper back braced against a sofa/sturdy chair edge |
| 24 | `single-leg-dumbbell-calf-raise.jpg` | Single-Leg Dumbbell Calf Raise | Dumbbells | Home | Hold one dumbbell, use a wall for light balance support |
| 25 | `dumbbell-glute-bridge.jpg` | Dumbbell Glute Bridge | Dumbbells | Home | Lie on your back, knees bent, dumbbell resting on your hips |
| 26 | `sumo-squat-pulse.jpg` | Sumo Squat Pulse | Bodyweight | Home, Park | Wide stance, sink to the bottom of a sumo squat |
| 27 | `plank-leg-lift.jpg` | Plank Leg Lift | Bodyweight | Home, Park | Hold a standard forearm plank |
| 28 | `decline-push-up.jpg` | Decline Push-Up | Bodyweight + Bench, Step, or Stairs | Park | Feet elevated on a bench, step, or stairs |
| 29 | `pike-push-up.jpg` | Pike Push-Up | Bodyweight | Park | Hips high, forming an inverted V shape |
| 30 | `tricep-dip-bench.jpg` | Bench/Chair Triceps Dip | Bench, Chair, or Park Bench | Park | Hands on the edge, fingers forward, legs extended |
| 31 | `plank-shoulder-tap.jpg` | Plank Shoulder Tap | Bodyweight | Park | High plank position, hands under shoulders |
| 32 | `table-inverted-row.jpg` | Table/Low-Bar Inverted Row | Sturdy Table or Park Bar | Park | Lie under a sturdy table/low bar, grip the edge, body straight |
| 33 | `prone-y-raise.jpg` | Prone Y-Raise | Bodyweight | Park | Lie face down, arms extended overhead in a Y shape |
| 34 | `reverse-snow-angel.jpg` | Reverse Snow Angel | Bodyweight | Park | Lie face down, arms at your sides, palms down |
| 35 | `doorframe-isometric-row.jpg` | Doorframe Isometric Row | Doorframe | Park | Grip the inside edge of a doorframe with one hand |
| 36 | `towel-isometric-curl.jpg` | Towel Isometric Curl | Towel | Park | Stand on one end of a towel, grip the other end |
| 37 | `bird-dog.jpg` | Bird Dog | Bodyweight | Park | Start on hands and knees, spine neutral |
| 38 | `bodyweight-squat.jpg` | Bodyweight Squat | Bodyweight | Park | Feet shoulder-width, toes slightly out |
| 39 | `reverse-lunge.jpg` | Reverse Lunge | Bodyweight | Park | Step one leg back, lower until both knees hit ~90° |
| 40 | `single-leg-glute-bridge.jpg` | Single-Leg Glute Bridge | Bodyweight | Park | Lie on your back, one knee bent foot flat, other leg extended |
| 41 | `step-up-park-bench.jpg` | Step-Up (Bench or Stairs) | Bench, Step, or Stairs | Park | Full foot planted on the step, not just the toes |
| 42 | `wall-sit.jpg` | Wall Sit | Bodyweight | Park | Back flat against a wall, thighs parallel to the floor |
| 43 | `calf-raise.jpg` | Calf Raise | Bodyweight | Park | Stand on a step edge if available for full range |
| 44 | `russian-twist-bodyweight.jpg` | Russian Twist | Bodyweight | Park | Lean back to about 45°, feet lifted if you can |
| 45 | `pike-push-up-elevated.jpg` | Elevated Pike Push-Up | Bodyweight + Bench, Step, or Stairs | Park | Feet elevated on a step/bench, hips high in a pike shape |
| 46 | `plank-walkout.jpg` | Plank Walkout | Bodyweight | Park | Start standing, hinge and walk your hands out to a plank |
| 47 | `archer-push-up.jpg` | Archer Push-Up | Bodyweight | Park | Hands set very wide, wider than a wide push-up |
| 48 | `incline-push-up.jpg` | Incline Push-Up | Bodyweight + Bench, Step, or Wall | Park | Hands elevated on a bench, step, or wall |
| 49 | `prone-t-raise.jpg` | Prone T-Raise | Bodyweight | Park | Lie face down, arms extended straight out to the sides (T shape) |
| 50 | `towel-hammer-curl-isometric.jpg` | Towel Isometric Hammer Curl | Towel | Park | Stand on one end of a towel, grip the other end with a neutral (palms-in) grip |
| 51 | `side-plank.jpg` | Side Plank | Bodyweight | Park | Forearm and feet stacked, hips lifted into a straight line |
| 52 | `jump-squat.jpg` | Jump Squat | Bodyweight | Park | Squat down like a normal bodyweight squat |
| 53 | `curtsy-lunge.jpg` | Curtsy Lunge | Bodyweight | Park | Step one leg diagonally behind the other, like a curtsy |
| 54 | `single-leg-romanian-deadlift-bodyweight.jpg` | Single-Leg Romanian Deadlift | Bodyweight | Park | Stand on one leg, soft knee bend |
| 55 | `glute-bridge-march.jpg` | Glute Bridge March | Bodyweight | Park | Hold a two-leg glute bridge at the top |
| 56 | `single-leg-calf-raise.jpg` | Single-Leg Calf Raise | Bodyweight | Park | Stand on one foot, use a wall for light balance support |

---

## Table 2 — already have a photo (43, optional regenerate)

| # | Filename to save as | Exercise | Equipment | Used in | Key form cue (use in your prompt) |
|---|---|---|---|---|---|
| 1 | `barbell-bench-press.jpg` | Barbell Bench Press | Barbell + Bench | Gym | Shoulder blades pulled back and down, feet flat |
| 2 | `incline-dumbbell-press.jpg` | Incline Dumbbell Press | Dumbbells + Incline Bench | Gym, Home | 30–45° bench angle |
| 3 | `seated-dumbbell-shoulder-press.jpg` | Seated Dumbbell Shoulder Press | Dumbbells + Bench | Gym | Brace your core, don't over-arch the lower back |
| 4 | `cable-machine-chest-fly.jpg` | Cable / Machine Chest Fly | Cable Machine | Gym | Slight elbow bend held throughout |
| 5 | `dumbbell-lateral-raise.jpg` | Dumbbell Lateral Raise | Dumbbells | Gym, Home | Lead with elbows |
| 6 | `cable-rope-triceps-pushdown.jpg` | Cable Rope Triceps Pushdown | Cable Machine | Gym | Elbows pinned to your sides |
| 7 | `overhead-triceps-extension.jpg` | Overhead Triceps Extension | Cable or Dumbbell | Gym, Home | Elbows stay close to your head |
| 8 | `plank.jpg` | Plank | Bodyweight | Gym, Home, Park | Neutral spine, ribs down |
| 9 | `lat-pulldown.jpg` | Lat Pulldown | Cable Machine | Gym | Pull to upper chest |
| 10 | `seated-cable-row.jpg` | Seated Cable Row | Cable Machine | Gym | Chest up, pull to lower ribs |
| 11 | `barbell-bent-over-row.jpg` | Barbell Bent-Over Row | Barbell | Gym | Hinge at hips ~45°, flat back |
| 12 | `machine-dumbbell-rear-delt-fly.jpg` | Machine / Dumbbell Rear Delt Fly | Machine or Dumbbells | Gym, Home | Slight elbow bend |
| 13 | `barbell-dumbbell-curl.jpg` | Barbell / Dumbbell Curl | Barbell or Dumbbells | Gym | Elbows pinned to sides |
| 14 | `hammer-curl.jpg` | Hammer Curl | Dumbbells | Gym, Home | Neutral grip throughout |
| 15 | `hanging-knee-raise.jpg` | Hanging Knee Raise | Pull-up Bar | Gym | Curl the pelvis at the top |
| 16 | `barbell-back-squat.jpg` | Barbell Back Squat | Barbell + Rack | Gym | Chest up, knees track over toes |
| 17 | `romanian-deadlift.jpg` | Romanian Deadlift | Barbell or Dumbbells | Gym | Soft knee bend, hinge at the hips |
| 18 | `leg-press.jpg` | Leg Press | Leg Press Machine | Gym | Feet shoulder-width on the platform |
| 19 | `dumbbell-walking-lunge.jpg` | Dumbbell Walking Lunge | Dumbbells | Gym, Home | Front knee stays over the ankle |
| 20 | `leg-curl-machine.jpg` | Leg Curl (machine) | Machine | Gym | Control the eccentric |
| 21 | `standing-seated-calf-raise.jpg` | Standing / Seated Calf Raise | Machine | Gym | Full stretch at the bottom |
| 22 | `cable-woodchopper-weighted-sit-up.jpg` | Cable Woodchopper / Weighted Sit-up | Cable or Plate | Gym | Rotate from the torso, not the arms |
| 23 | `incline-barbell-press.jpg` | Incline Barbell Press | Barbell + Incline Bench | Gym | 30° incline |
| 24 | `flat-dumbbell-press.jpg` | Flat Dumbbell Press | Dumbbells + Bench | Gym | Full range of motion |
| 25 | `standing-dumbbell-arnold-press.jpg` | Standing Dumbbell Arnold Press | Dumbbells | Gym, Home | Rotate palms outward as you press |
| 26 | `cable-crossover.jpg` | Cable Crossover | Cable Machine | Gym | Slight forward lean |
| 27 | `single-arm-cable-lateral-raise.jpg` | Single-Arm Cable Lateral Raise | Cable Machine | Gym | Constant tension from the cable |
| 28 | `bench-dip-machine-assisted-dip.jpg` | Bench Dip / Machine-Assisted Dip | Bench or Dip Machine | Gym | Elbows track backward, not outward |
| 29 | `skull-crusher.jpg` | Skull Crusher | EZ Bar or Dumbbells | Gym, Home | Elbows stay stationary |
| 30 | `pull-up-lat-pulldown-wide-grip.jpg` | Pull-Up / Lat Pulldown (wide grip) | Pull-up Bar or Cable | Gym | Full hang at the bottom |
| 31 | `single-arm-dumbbell-row.jpg` | Single-Arm Dumbbell Row | Dumbbell + Bench | Gym, Home | Flat back throughout |
| 32 | `chest-supported-dumbbell-row.jpg` | Chest-Supported Dumbbell Row | Dumbbells + Incline Bench | Gym, Home | Pull to your hips |
| 33 | `cable-face-pull.jpg` | Cable Face Pull | Cable Machine | Gym | Pull to eye level |
| 34 | `ez-bar-barbell-curl.jpg` | EZ-Bar / Barbell Curl | EZ Bar or Barbell | Gym | Elbows pinned to sides |
| 35 | `dumbbell-concentration-curl.jpg` | Dumbbell Concentration Curl | Dumbbell | Gym, Home | Brace elbow on inner thigh |
| 36 | `cable-crunch.jpg` | Cable Crunch | Cable Machine | Gym | Round through the spine |
| 37 | `bulgarian-split-squat.jpg` | Bulgarian Split Squat | Dumbbells + Bench | Gym, Home | Torso upright |
| 38 | `hip-thrust.jpg` | Hip Thrust | Barbell or Smith Machine | Gym | Chin tucked |
| 39 | `leg-extension-machine.jpg` | Leg Extension (machine) | Machine | Gym | Controlled tempo |
| 40 | `seated-lying-leg-curl.jpg` | Seated / Lying Leg Curl | Machine | Gym | Control the eccentric |
| 41 | `dumbbell-step-up.jpg` | Dumbbell Step-Up | Dumbbells + Bench | Gym, Home | Drive through the heel of the working leg |
| 42 | `seated-calf-raise-machine.jpg` | Seated Calf Raise (machine) | Machine | Gym | Full stretch at the bottom |
| 43 | `weighted-russian-twist-hanging-leg-raise.jpg` | Weighted Russian Twist / Hanging Leg Raise | Plate or Pull-up Bar | Gym | Rotate from the core |

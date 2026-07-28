# Addendum: PAV Route for Arrhenius, and Property Selection for Oven Ageing

Companion to `arrhenius-test-design-and-weaknesses.md`.

---

## PART 1 — Using PAV on the blend directly

### Short answer

**Yes — and it solves three of the severe weaknesses identified earlier, not just the speed problem.** But it cannot replace the membrane oven work entirely. Use both, for different purposes.

### What the PAV route fixes

| Problem from the earlier review | How PAV addresses it |
|---|---|
| **Diffusion-limited oxidation** (§2.1) | PAV runs at 2.10 MPa air — roughly 20× atmospheric oxygen partial pressure — on a ~3.2 mm film. Oxygen supply stops being rate-limiting. This is precisely why PAV was designed with pressure instead of extreme temperature |
| **Reinforcement confounding** (§2.3) | No scrim. You measure the binder, which is the thing that actually ages |
| **No rheology** (§2.2) | PAV-aged binder goes straight into DSR and FTIR. This is the standard workflow the bitumen research community expects |
| **Speed** | 20 h per run instead of thousands of hours |
| **Mechanism shift at high temperature** | Pressure buys acceleration without pushing temperature into the SBS crosslinking regime |

There's a further benefit that matters for publication: **PAV is the field-standard method.** ASTM D6521 / AASHTO R28 is what every reviewer at *Construction and Building Materials* uses. Presenting PAV + DSR + FTIR data immediately positions the work inside the discipline's normal vocabulary, which a bespoke oven programme does not.

### Standard PAV conditions (verify against your own SOP)

- **Pressure:** 2.10 MPa (300 psi) air
- **Duration:** 20 h standard
- **Temperature:** 90, 100, or 110 °C
- **Specimen:** ~50 g per pan, 140 mm pan, ~3.2 mm film
- **Normally preceded by:** RTFO (ASTM D2872, 163 °C, 85 min)
- **Followed by:** vacuum degassing per ASTM D6521

### Temperature set for an Arrhenius series

PAV's controllable range gives you a natural three-point set:

| Temp | 1/T (K⁻¹) |
|---|---|
| 90 °C | 2.7537 × 10⁻³ |
| 100 °C | 2.6799 × 10⁻³ |
| 110 °C | 2.6100 × 10⁻³ |

Span = 1.437 × 10⁻⁴, comparable to the 70–90 °C oven span (1.605 × 10⁻⁴). Workable.

**Caution at 110 °C.** For a high-SBS membrane compound this may enter the crosslinking-dominant regime. Run it, but treat it as a point to be *validated*, not assumed — if it falls off the line defined by 90 and 100 °C, that's your mechanism-shift evidence and you report it. If your PAV can be controlled below 90 °C, an 85/95/105 °C set would be safer; check the vessel's stable control range.

### Time matrix — extended PAV

A single 20 h run gives one data point, not a rate. You need a time series at each temperature. Extended PAV (40 h, 60 h) is well established in the ageing literature.

| Temp | Run durations |
|---|---|
| 90 °C | 20, 40, 60, 80 h |
| 100 °C | 10, 20, 40, 60 h |
| 110 °C | 5, 10, 20, 40 h |

Twelve runs. At roughly 24 h per cycle including heat-up, cool-down and degassing, that is **3–4 weeks of PAV time** versus 8 months of ovens. That is the whole argument for this route.

### Four things it does *not* do

**1. You cannot merge PAV data with your 70 °C oven data on one Arrhenius plot.**

This is the hard constraint. Pressure changes the oxidation rate, so PAV and atmospheric oven ageing are different experiments. Bitumen oxidation rate scales with oxygen partial pressure as roughly `pO₂ⁿ`, with n well below 1 — so the pressure effect is not a clean constant multiplier you can factor out.

What you *can* do, and it's elegant: derive **Ea from the PAV series alone** (three temperatures, internally consistent), then use that Ea to test whether it predicts your 14,400 h oven result. Agreement is a genuine cross-validation between two independent methods. Present them as two datasets that corroborate each other, never as one merged fit.

**2. No mechanical properties.** PAV yields ~500 g of aged binder per run — enough for DSR, FTIR, softening point and penetration, nowhere near enough for tensile, elongation or tear on membrane specimens. Binder-level only.

**3. It doesn't give you a membrane service-life claim.** Your commercial value — BBA, EPD, tender specifications — rests on *product* durability. Binder ageing data doesn't transfer to the finished membrane without a demonstrated correlation.

**4. RTFO may not work on your compound.** RTFO requires the binder to flow and form a film in rotating bottles at 163 °C. A heavily filled, high-SBS membrane compound may be too viscous, and filler can settle.

**Better argument for your case:** skip RTFO and take the blend **straight from the production mixer**, which has already carried its full manufacturing heat history. That is more representative of the real short-term ageing your product experiences than RTFO is, and it's defensible in print — state it explicitly in the methods as a deliberate substitution with the reasoning.

### Filled or unfilled?

| Option | Pros | Cons |
|---|---|---|
| **Unfilled SBS-bitumen blend** | Clean DSR, directly comparable to published literature, cleanest science | Less representative of your actual product |
| **Full production compound (filled)** | Representative | Pan-filling and levelling difficulties; filler may complicate DSR |

**Recommendation: run both.** Unfilled as the primary Arrhenius series (comparable to literature, clean rheology), filled as a secondary comparison. Mineral filler can act as either a pro-oxidant or an antioxidant depending on its surface chemistry, so **the filler effect on ageing kinetics is itself a publishable finding** — and it's one only someone with your industrial access could produce.

Practical notes: pour hot (~160–180 °C) into PAV pans so the filled compound levels to a uniform film. For DSR on filled material, typical limestone filler at <75 µm is fine against an 8 mm plate / 2 mm gap; confirm your filler's top particle size first.

### Recommended structure

Run **both tracks**, for different jobs:

| Track | Purpose | Output |
|---|---|---|
| **PAV on blend** (3–4 weeks) | Measure Ea properly; DSR + FTIR; mechanism | The research paper |
| **Reduced oven programme on membrane** (running in parallel) | Link binder ageing to finished-product performance | The BBA/EPD/commercial claim |

This combination is stronger than either alone, and it opens a paper the field genuinely lacks: **a correlation between PAV-accelerated binder ageing and long-term oven ageing of the finished membrane.** There is no accepted bridge between binder-level and membrane-level durability in the waterproofing literature. You are unusually well placed to build one.

---

## PART 2 — Which properties to measure after oven ageing

**Measure several. Designate exactly one as the primary endpoint criterion for the Arrhenius fit.** Those are different decisions and conflating them is a common error.

### Ranked by binder sensitivity

| Property | Binder sensitivity | Role |
|---|---|---|
| **Cold flexibility (failure temperature)** | **Highest** | **Primary endpoint criterion** |
| Elongation at break | High | Secondary / cross-check |
| Softening point (extracted binder) | High | Supporting |
| Penetration (extracted binder) | High | Supporting |
| FTIR carbonyl / sulfoxide index | Chemical ground truth | Supporting, strongly recommended |
| Mass change | Moderate | Free — catches oil migration and volatiles |
| Tensile strength | **Low — scrim dominated** | Report only |
| Tear resistance | **Low — scrim dominated** | Report only |

### Make cold flexibility a continuous variable

This is the single most useful change to your test method.

Cold flexibility as normally run is **pass/fail at a fixed temperature** (−20 °C). A pass/fail result cannot be used as an Arrhenius endpoint — you can't fit a rate to a binary.

Instead, at each sampling point, determine the **failure temperature**: test down in 2–3 °C steps until cracking occurs, and record the temperature at which it fails. That converts the measurement into a continuous variable that shifts progressively upward as the binder ages — which is exactly what an Arrhenius fit needs.

Three reasons this should be your primary criterion:
1. Most binder-dominated property on the list — the scrim contributes almost nothing
2. It's the property that actually governs field failure in these membranes
3. **You already have two-year field data on it** — which is what makes the predicted-vs-measured field validation (the strongest available result) possible

Secondary criterion: **50 % retention of elongation at break**, as a cross-check. If both give a similar Ea, that's strong internal consistency and worth reporting.

### Sampling matrix

Not every property at every point — that's how specimen budgets collapse.

| Property | Frequency | n |
|---|---|---|
| Mass change | Every point | 3 |
| Cold flexibility (failure temp) | Every point | 3 |
| Elongation at break | Every point | 5 |
| FTIR carbonyl / sulfoxide | Every point | 2 |
| Softening point (extracted) | Every point | 2 |
| Penetration (extracted) | Alternate points | 2 |
| Tensile strength | Start, mid, end only | 3 |
| Tear resistance | Start, mid, end only | 3 |

n = 5 on elongation because it scatters more than the others. Report mean ± SD throughout — the earlier review flagged missing error bars as a high-severity issue, and this is where you fix it.

**Also profile the cross-section for DLO** (§2.1) at the final sampling point for each temperature. FTIR carbonyl index through the cut face. Flat = clean; gradient = diffusion-limited, and you report it.

### Corresponding properties on the PAV track

| Property | Purpose |
|---|---|
| **DSR** — G*, phase angle δ, master curves; ageing index as G* ratio | Primary. This is what the field expects |
| **FTIR** — carbonyl and sulfoxide indices | Chemical ageing ground truth |
| Softening point, penetration | Conventional, cheap, cross-comparable |
| Elastic recovery / MSCR | SBS network integrity |
| Fluorescence microscopy | SBS phase morphology — shows network breakdown directly, and makes an excellent figure |

For the PAV Arrhenius fit, the conventional endpoint is a **defined ageing index** — e.g. time to reach a specified G* ratio, or a specified carbonyl index increment. Pre-declare it before you start, as with the oven work.

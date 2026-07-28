# Multi-Temperature Arrhenius Test Design + Critical Review of the Study

**Context:** Study 1 currently has a single ageing temperature (70 °C, 14,400 h) with an *assumed* Ea = 90 kJ/mol. This document specifies the additional ageing temperatures and durations needed to measure Ea properly, and identifies the other methodological weaknesses a reviewer will attack.

---

## PART 1 — Temperature and duration design

### 1.1 Which temperatures

**Use 80 °C and 90 °C as your two additional points. Optionally add 100 °C as a diagnostic.**

| Temperature | Status | Purpose |
|---|---|---|
| 70 °C | Already complete (14,400 h) | Anchor point, longest data |
| **80 °C** | **Add** | Mid-point |
| **90 °C** | **Add** | Upper practical limit |
| 100 °C | Optional | Widens 1/T span *and* acts as a mechanism-change detector |

**Why not higher.** Three hard limits sit just above 90 °C:

1. **Softening point.** A well-made SBS PMB membrane softens around 110–130 °C. Above ~100 °C an unsupported specimen sags, blocks, or changes geometry — and geometry change invalidates the mechanical comparison.
2. **SBS degradation mechanism shift.** SBS ages by two competing routes: chain scission at the polybutadiene double bonds, and crosslinking/gel formation. Below ~90 °C scission dominates, which is the service-relevant mechanism. Above roughly 100–110 °C the balance tips toward crosslinking. **Arrhenius is only valid if the mechanism is constant across all temperatures** — this is the single most common way accelerated-ageing papers get rejected.
3. **Diffusion-limited oxidation** — see §2.1. This is severe for a 4.5 mm specimen and it gets worse with temperature.

**Why 100 °C is still worth running.** With four points you can *test* for curvature in the Arrhenius plot. If the 100 °C point falls off the line defined by 70/80/90, you have direct evidence of a mechanism change, you drop it with justification, and you report the check. Reviewers respect that enormously — it turns "I assumed Arrhenius holds" into "I verified Arrhenius holds." If the point falls *on* the line, you gain a wider 1/T span and a tighter Ea.

### 1.2 How long

**Important caveat on circularity:** the durations below are estimated *using* the assumed Ea = 90 kJ/mol — the very number you're trying to measure. That's normal practice for test design, but it means if the true Ea is lower, degradation will run slower than planned and you'll need longer. **Build in margin and sample continuously rather than only at the end.**

Acceleration factors relative to 70 °C, at Ea = 90 kJ/mol:

| From 70 °C to | Acceleration factor | Time equivalent to 14,400 h @ 70 °C |
|---|---|---|
| 80 °C | 2.44 | **5,890 h** (~8.2 months) |
| 90 °C | 5.68 | **2,535 h** (~3.5 months) |
| 100 °C | 12.63 | **1,140 h** (~7 weeks) |

### 1.3 The key point that saves you time

**You do not need to replicate the total damage of the 14,400-hour run at each temperature.**

For an Arrhenius plot you need a **rate constant** at each temperature, not an equivalent dose. The standard method (as in IEC 60216 and ISO 11346) is:

1. Define an **end-of-life criterion** in advance — conventionally **50 % retention of elongation at break**
2. At each temperature, measure the time to reach it: t₅₀
3. Plot **ln(t₅₀) vs 1/T** — the slope is **Ea/R**

This requires **interim sampling**, not just a start and end point. Which leads to the most urgent thing to check:

> **Check whether your 70 °C run has interim data.** If you sampled at intervals (1,000 / 2,000 / 4,000 / 8,000 / 14,400 h), you can fit a degradation curve and you are in excellent shape. If you only have t=0 and t=14,400 h, you have two points and no rate — and it's possible the material never reached a measurable endpoint at all, in which case that run gives you a *lower bound on durability*, not a rate constant. This single fact determines how much new work is needed.

### 1.4 Recommended protocol

Run all temperatures **in parallel**, starting simultaneously. Wall-clock time is then set by the longest run, not the sum.

| Temp | Total duration | Sampling points (hours) |
|---|---|---|
| 80 °C | 6,000 h (~8.3 months) | 0, 500, 1000, 2000, 3000, 4000, 5000, 6000 |
| 90 °C | 3,000 h (~4.2 months) | 0, 250, 500, 1000, 1500, 2000, 2500, 3000 |
| 100 °C *(optional)* | 1,500 h (~2 months) | 0, 125, 250, 500, 750, 1000, 1250, 1500 |

**Compressed minimum**, if capacity or time is tight — drop 80 °C and run 90 °C + 100 °C only. You still get three points (70/90/100) with a *wider* 1/T span than 70/80/90, and wall-clock drops to ~4.2 months. It's a defensible design; four points would be better.

### 1.5 Specimen budget — the thing that actually derails these studies

Per temperature: 8 sampling points × 3 replicates × each property tested.

For elongation, tensile, tear and cold flexibility at n=3, that is roughly **96 specimens per temperature**, plus spares. Across three temperatures, budget **350–400 specimens**. Cut them all from the same production batch, at the same time, and condition them identically. Cutting a fresh batch halfway through introduces a variable you can never remove.

### 1.6 Two experimental controls that must be identical across ovens

1. **Air exchange rate.** Oxidation rate depends on oxygen availability. EN 1296 specifies controlled air changes for exactly this reason. If your three ovens have different forced-draft rates, your Arrhenius plot is measuring ventilation as much as temperature. Use ovens of the same type, verify and **document the air change rate for each**.
2. **Specimen spacing and orientation.** Same rack position logic, same spacing, no stacking, no contact. Rotate positions on a schedule if the ovens have thermal gradients — and map those gradients first with a calibrated probe.

Also: bituminous samples at 90–100 °C generate fumes. Use ventilated ovens with appropriate extraction.

---

## PART 2 — The other weaknesses, ranked by how badly they will hurt you

### 2.1 Diffusion-limited oxidation (DLO) — **severe**

Your specimen is **4.5 mm thick**. At elevated temperature, the oxidation reaction at the surface can consume oxygen faster than it diffuses into the bulk. The result is a heavily oxidised skin over a nearly unaged core — a fundamentally different degradation profile from slow, uniform, oxygen-sufficient ageing in service.

This is *the* classic failure mode of accelerated ageing on thick polymer specimens, and it breaks Arrhenius extrapolation directly: the acceleration you measure isn't chemistry, it's a diffusion boundary.

**How to test for it:** cross-section aged specimens and profile through the thickness —
- **FTIR carbonyl index** measured at intervals through the cut face (most direct evidence)
- or microhardness / modulus profiling across the section

A flat profile means oxygen-sufficient ageing and your data is clean. A gradient means DLO, and it will be worse at 90 and 100 °C than at 70 °C.

**How to handle it:** report the profile explicitly. If a gradient appears at higher temperatures, that is itself a publishable finding and a strong justification for capping the temperature range. Alternatively, run a parallel set of **thinner specimens** (say 1–1.5 mm, or extracted binder films) to confirm the mechanism without the diffusion limit.

### 2.2 No rheological characterisation — **severe for this field**

This is the largest gap for *Construction and Building Materials* specifically. Bituminous materials research communicates in rheology. A binder ageing paper without **DSR** data will read as an industrial test report rather than research.

**What to add:**
- **Dynamic Shear Rheometer** — complex modulus G*, phase angle δ, frequency sweeps, master curves via time-temperature superposition. Report ageing index as G* ratio (aged/unaged)
- **FTIR carbonyl index (~1700 cm⁻¹) and sulfoxide index (~1030 cm⁻¹)** — the standard chemical ageing metrics for bitumen. Cheap, fast, and universally expected
- **Softening point and penetration** on extracted binder — you already run these routinely
- **GPC/SEC** if accessible — shows molecular weight distribution and direct evidence of SBS block scission
- **Fluorescence microscopy** — SBS phase morphology and dispersion; shows polymer network breakdown visually and makes an excellent figure

You'd need to **extract the binder from the membrane** for DSR. That's routine, but specify the extraction solvent and method, and confirm the extraction itself doesn't age the binder.

If you can only add one thing from this list, **add FTIR carbonyl index.** Best credibility per dirham of anything here.

### 2.3 The reinforcement is confounding your mechanical data — **high, and probably explains your results**

Your membrane contains polyester or glass reinforcement. **Tensile strength and tear resistance are dominated by the reinforcement, not the binder.** Polyester scrim barely degrades at 70 °C.

This likely explains why your post-ageing tensile figures (24.4 / 20.6 kN/m) look so healthy — you may be measuring an intact scrim while the binder around it oxidises significantly. If so, tensile retention is close to meaningless as a durability indicator for this system, and a reviewer will say so.

**Fix:** shift your primary endpoint criterion onto binder-sensitive properties —
- **Cold flexibility** (you already have this — it's the most binder-sensitive property on your list)
- **Elongation at break** — more binder-sensitive than tensile strength
- **Extracted-binder properties** — DSR, softening point, penetration

Keep tensile and tear as reported data, but do not build the service-life model on them. Say explicitly in the paper that reinforcement dominates those properties. Pre-empting this converts a fatal criticism into a demonstration of rigour.

*(Incidentally, "24.4 / 20.6" reads as machine direction / cross direction, not replicates. Label it — see §2.5.)*

### 2.4 The extrapolation ratio is very aggressive — **high**

14,400 h = 1.64 years, projected to 103 years. That's a **~63× extrapolation**. IEC 60216 practice discourages extrapolating far beyond the longest test duration, and reviewers get uncomfortable well below 63×.

**Fix — reframe the claim.** Do not headline "103 years." Instead:
- Report against a **realistic design life**: "retains ≥X % of property Y after the equivalent of 50 years at UAE service temperature, with a safety factor of Z" — far more defensible, and commercially just as strong for BBA/EPD purposes
- Present the full **Ea sensitivity envelope** (70–110 kJ/mol → ~42 to ~266 years), so the reader sees the bounds
- State the extrapolation ratio openly in the limitations section

Note that Study 2 already applies a 5.0× cumulative safety factor. Use the same discipline in Study 1.

### 2.5 No replicates, no error bars, no confidence interval on Ea — **high**

Nothing in your dataset shows n, standard deviation, or scatter. Ea appears as a bare "90,000 J/mol." A measured activation energy must be reported **with its confidence interval from the regression** — e.g. "Ea = 90 ± 12 kJ/mol (95 % CI)" — because that uncertainty propagates directly into the service-life bound.

**Fix:** n ≥ 3 per point (n = 5 for elongation, which scatters). Report mean ± SD. Get the CI on Ea from the linear regression of ln(t₅₀) vs 1/T, and report R². Propagate that CI through to the service-life figure and report the life as a range.

### 2.6 Service temperature is under-justified — **high**

You use 30 °C (UAE mean air temperature). A roofing membrane under solar load in Abu Dhabi reaches **70–80 °C surface temperature**. A reviewer will ask immediately, and the answer moves your headline number enormously.

**Fix — derive a Mean Effective Temperature (MET).** Because degradation is exponential in temperature, hot hours dominate and a simple arithmetic mean badly understates it. Take hourly membrane surface temperature over a representative year, then:

```
MET = −(Ea/R) / ln[ (1/n) · Σ exp(−Ea / R·Tᵢ) ]
```

This gives the single constant temperature producing the same cumulative damage as the real annual cycle. Use measured surface temperatures if you have them, or model them from local solar and air-temperature data with stated assumptions. **Alternatively**, if the application is buried or protected (podium, basement, under screed), state that explicitly — then 30 °C becomes entirely defensible and the objection disappears. Either answer works; silence does not.

### 2.7 Field correlation is qualitative — **this is your biggest missed opportunity**

Right now the 2-year UAE exposure appears as a supporting statement: "cold flexibility retained at −20 °C." That's an anecdote, not a validation.

**But you have the ingredients for the strongest thing in the whole paper.** Do this instead:

1. Compute MET for the exposure site over the 2-year period
2. Use the Arrhenius model to **predict** property retention at 2 years
3. **Measure** actual retention on the field-exposed samples
4. Compare predicted vs measured

If they agree, you have **experimentally validated an accelerated ageing model against real hot-arid field performance** — which is genuinely novel, is exactly what the literature lacks, and is a legitimate headline claim in a way that "103 years" is not. Very few groups have matched field samples to run this against.

If you still have those field-exposed samples, protect them. If you can start a fresh exposure rack now, do it — it accrues value continuously.

### 2.8 Thermal ageing only — **moderate**

Real membranes fail from combined thermal, UV, moisture and thermal-cycling stress. Study 1 is thermal only.

**Fix:** acknowledge it as a scope limitation, and use the field exposure as your combined-stressor evidence (that exposure carried UV index >10, 48–50 °C peaks, >85 % RH — cite those conditions explicitly). Study 2 already includes 430 h UV at 350 MJ/m², so you can reference it as the companion work.

### 2.9 No control and no comparator — **moderate**

One product, no baseline. Without an unmodified control you cannot demonstrate what the SBS modification actually contributes to durability.

**Fix — cheap and high value:** run **neat/oxidised bitumen** (no polymer) alongside, in the same ovens, on the same schedule. Optionally add one of your **APP** membranes. The marginal cost is oven space and specimens; the gain is a mechanism argument and a comparison figure. An SBS-vs-APP-vs-neat ageing comparison under hot-arid conditions is close to a second paper on its own.

### 2.10 No pre-declared end-of-life criterion — **moderate but easy**

Define it now, in writing, before the new runs start: **50 % retention of elongation at break**, with cold-flexibility failure at −20 °C as a secondary criterion. Choosing the endpoint after seeing the data is how papers get accused of fitting to a conclusion.

---

## PART 3 — What this means for your timeline

**The multi-temperature work and an October 2026 submission are not compatible.** Even the compressed 90 °C run needs ~4 months from a standing start, and the full design needs ~8.

Run both tracks:

| Track | Content | Submit |
|---|---|---|
| **Paper 1** | Single-temperature data reframed as an **Arrhenius sensitivity and field-correlation study** (§2.4, §2.6, §2.7). No new lab work required. Add FTIR if you can get it quickly | **October 2026** — in time to cite as "under review" on PhD applications |
| **Paper 2** | Measured multi-temperature Ea, DLO profiling, DSR/rheology, controls | **Mid-to-late 2027** — lands during your first PhD year |

Start the ovens **now**, in parallel with writing Paper 1. The oven time is wall-clock you cannot compress, so it should be running while you do everything else. This gives you two publications instead of one, and the second is far stronger for having the first already in the literature.

---

## Priority order

1. **Check whether the 70 °C run has interim sampling data** — this determines everything else
2. Start 80/90 °C ovens (plus 100 °C if capacity allows), all in parallel, from one specimen batch
3. Pre-declare the end-of-life criterion
4. Add FTIR carbonyl/sulfoxide indexing — highest credibility per unit cost
5. Derive MET for the service temperature
6. Quantify the field correlation properly — predicted vs measured at 2 years
7. Add DSR on extracted binder
8. Add neat-bitumen control
9. Re-report everything with n, SD, and a CI on Ea

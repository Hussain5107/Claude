# How to Publish the Arrhenius SBS Service-Life Study

**Goal:** reach "under review at a peer-reviewed journal" status by **late October 2026**, in time to cite on Canadian supervisor approaches, Australian HDR applications, and US PhD applications closing December 2026 – January 2027.

---

## 0. Pre-flight: what you have, and the one thing that will get you rejected

### What you have (Study 1 — the one to publish first)

| Parameter | Value |
|---|---|
| Product | SBS-modified bituminous membrane (Colphene BSW Unilay HP, 4.5 mm) |
| Ageing condition | 70 °C, 14,400 h (1.64 years) |
| Standard | ASTM D5147 |
| Activation energy | Ea = 90,000 J/mol |
| Projected service life | ~103 years at 30 °C mean (UAE) |
| Third-party validation | Wimpey Laboratories LLC, ISO/IEC 17025, DCL-accredited |
| Post-ageing tensile | 24.4 / 20.6 kN/m |
| Post-ageing elongation | 59% / 71% |
| Tear resistance | 880 / 846 N |
| Hydrostatic resistance | 1,100 kPa (110 m head), zero leakage |
| Cold flexibility | retained at −20 °C after 2-year UAE outdoor exposure (UV index >10, 48–50 °C peak, >85% RH) |

This is a real dataset. 14,400 hours of continuous ageing with ISO 17025 third-party verification is more than most academic groups can afford to run. **The data is not the problem.**

### The problem: single-temperature Arrhenius

The Arrhenius model is:

```
k = A · exp(−Ea / RT)
```

To *measure* Ea, you need degradation rate constants at **three or more temperatures** and take the slope of ln(k) vs 1/T. Your Study 1 ran at **70 °C only**. That means Ea = 90 kJ/mol was **assumed** (from literature or supplier data), not determined. Study 2 states this openly — "Ea = 85 kJ/mol (literature-validated)."

A reviewer at *Construction and Building Materials* will identify this within ten minutes and it is the single most likely cause of rejection.

**Why it matters — run the sensitivity yourself:**

Acceleration factor: `AF = exp[(Ea/R)(1/T_service − 1/T_test)]`

At T_test = 343.15 K (70 °C), T_service = 303.15 K (30 °C):

| Assumed Ea | Acceleration factor | Projected service life |
|---|---|---|
| 70 kJ/mol | 25.5 | **~42 years** |
| 90 kJ/mol *(your figure)* | 64.2 | **~106 years** |
| 110 kJ/mol | 161.8 | **~266 years** |

Your arithmetic is internally correct — 14,400 h × 64.2 ≈ 924,000 h ≈ 105 years, which matches your reported 103 years at a slightly different mean temperature. **The maths is sound. The input assumption is unvalidated**, and it swings the answer across a 6× range.

### The fix — three options, in order of preference

1. **Run two more ageing temperatures.** E.g. 80 °C and 90 °C, to failure or to a defined property-retention threshold. This gives you a genuine three-point Arrhenius plot and an *measured* Ea. It is the only option that produces an unimpeachable paper. Shorter runs at higher temperatures — you do not need another 14,400 hours. **If SOPREMA will approve the oven time, do this.**

2. **Reframe as a sensitivity study.** Keep the single-temperature data, but present service life as a **range across a defensible Ea envelope (70–110 kJ/mol)** rather than a single number. Title it around methodology — "Sensitivity of Arrhenius service-life prediction for SBS-modified bituminous membranes to activation-energy assumption." This converts your weakness into your research question. Fully publishable, and honest.

3. **Reframe as a case study.** Lead with the 2-year real UAE outdoor exposure and the accelerated data as corroboration, rather than leading with the 103-year claim. Best fit for *Case Studies in Construction Materials*.

**Second reviewer objection to pre-empt:** you use 30 °C as service temperature (UAE mean air temperature). A roofing membrane under solar load in Abu Dhabi reaches 70–80 °C surface temperature. Reviewers will ask why. Use a **weighted effective temperature** derived from a temperature-duration histogram, or justify 30 °C explicitly for a buried/protected application. Do not leave this unaddressed.

**Do not submit a paper whose headline claim is "103 years."** Submit one whose headline claim is a *method*, with the service-life figure as an output with stated bounds.

---

## 1. Clear IP with SOPREMA — do this first

Nothing else starts until this is settled. You are the Plant Manager and sole formulation custodian; publishing product performance data without written release is a genuine employment risk, not a formality.

**Who to approach:** your reporting line (Managing Director / Group R&D) plus whoever owns IP at group level in France. SOPREMA has an active patent programme — route through it, not around it.

**Ask for, in writing:**
- Permission to publish the ageing and service-life data
- Agreement on whether the **commercial product name** (Colphene BSW Unilay HP) may appear, or whether it must be anonymised to "a commercially available SBS-modified APP membrane, 4.5 mm"
- Confirmation that **no formulation detail** (SBS %, filler ratios, bitumen grade) will be disclosed — you do not need it for this paper, and saying so up front removes their main objection
- Whether SOPREMA is named as affiliation
- Co-authorship for anyone who contributed
- **Whether SOPREMA will fund the article processing charge** (see §3 — this can be USD 2,500–3,000)

**How to frame it — this matters.** Do not frame it as a personal favour for a PhD application. Frame it as:

> A peer-reviewed publication establishing 100-year-class service life for our SBS system, validated by an ISO 17025 laboratory, is a marketing and specification asset. It supports BBA and EPD submissions, strengthens high-spec tender positions in the UAE and Europe, and it is independent third-party credibility that a TDS cannot buy. I would like to publish it with SOPREMA named as the affiliation.

That is true, and it converts the request from a cost into a benefit. Most industrial IP releases are refused because the employee asked for the wrong thing in the wrong way.

**Realistic timeline:** 2–6 weeks. Start now. If the answer is a hard no, fall back to a fully anonymised methods paper — the Arrhenius sensitivity framing in §0 option 2 works without naming any product.

---

## 2. Authorship

**Add an academic co-author.** This is the highest-return single decision in this whole process.

- It roughly doubles your acceptance probability — reviewers treat a paper from a named university group differently from a lone industrial author
- It gets your manuscript structured correctly the first time
- It produces a **reference letter from an academic**, which your PhD applications currently lack entirely
- If you choose that co-author well, they become your **prospective supervisor**

**Who to approach:** the same people you will be emailing about PhD positions anyway. A/Prof. Ailar Hajimohammadi at UNSW works directly on bitumen ageing and recycled-polymer modification. Auburn/NCAT staff. Any pavement or bituminous-materials academic whose recent work overlaps yours.

**How to approach:** short email — you have a 14,400-hour ISO 17025-validated ageing dataset on a commercial SBS membrane, you want to publish it, you would value their input on the Arrhenius treatment and would offer co-authorship. Academics rarely refuse free high-quality industrial data. This email does double duty as your PhD introduction.

**Author order:** you first (you generated and own the data), academic collaborator last (senior/corresponding position), SOPREMA colleagues in between as contribution warrants.

---

## 3. Choose the journal

| Journal | Publisher | Fit | Speed | Cost | Verdict |
|---|---|---|---|---|---|
| **Case Studies in Construction Materials** | Elsevier | Explicitly built for industrial case studies. Your best structural fit | ~4–8 wks to first decision | **Gold OA — APC applies, roughly USD 2,500–3,000. Verify current rate** | **Primary target** |
| **Construction and Building Materials** | Elsevier | Highest prestige of the realistic options. Wants a research question, not a product report | ~8–12 wks, high desk-reject rate | Hybrid — **subscription publication is free**; OA optional (~USD 3,800) | Target if you complete the multi-temperature work in §0 option 1 |
| **Journal of Building Engineering** | Elsevier | Good fit for building-envelope durability | ~8–12 wks | Hybrid, free subscription route | Strong second choice |
| **Polymer Degradation and Stability** | Elsevier | The *correct* home for Arrhenius ageing kinetics — but methodologically demanding | Slow | Hybrid | Only with measured Ea |
| **Materials** / **Buildings** | MDPI | Fast and receptive | ~3–5 wks to first decision | APC ~CHF 2,300–2,600 | Fastest route to "under review", lower prestige |
| **Journal of Materials in Civil Engineering** | ASCE | Well regarded in pavements/materials | Slow | Free subscription route | Good, but slow for your timeline |

**Recommendation:** *Case Studies in Construction Materials*, using the framing from §0 option 3, with the sensitivity analysis from option 2 built in. If SOPREMA declines to fund the APC, switch to *Journal of Building Engineering* or *Construction and Building Materials* — both let you publish free via the subscription route.

Check the journal's Aims & Scope and read three recent papers before writing a word. Match their structure exactly.

---

## 4. Write the paper

Target **6,000–8,000 words**, 6–10 figures. Standard IMRaD structure:

**Title** — method-led, not claim-led.
> *"Accelerated thermal ageing and Arrhenius service-life prediction of SBS-modified bituminous waterproofing membranes: a 14,400-hour study with two-year hot-arid field correlation"*

**Abstract (250 words)** — problem, method, key numbers, what is new. Write this last.

**1. Introduction** — why service-life prediction for waterproofing membranes matters (replacement cost, embodied carbon, EPD/LCA service-life inputs); what exists in the literature; what is missing. State your contribution in one sentence. **Cite 40–60 papers.** You will need to read them — this is the part that takes longest and you cannot skip it.

**2. Materials and methods** — membrane description (anonymised if required), ageing protocol, ASTM D5147 conditions, test methods for tensile/elongation/tear/hydrostatic/cold flexibility, the Wimpey ISO 17025 verification, the field exposure site and its climate data. Must be reproducible by a stranger.

**3. Arrhenius framework** — the model, the acceleration-factor derivation, **an explicit statement of how Ea was obtained**, the effective service-temperature derivation, and the sensitivity analysis across the Ea envelope.

**4. Results** — property retention vs ageing time, the field-exposure comparison, computed service life *with bounds*.

**5. Discussion** — what the accelerated-to-field correlation shows, comparison against Luciani et al. (2020) and Zhang et al. (2025), and implications for EPD service-life declarations. **A limitations subsection is mandatory** — single ageing temperature, extrapolation ratio, single product. Reviewers punish concealed limitations far harder than acknowledged ones.

**6. Conclusions** — 4–6 numbered points.

**Practical notes:**
- Use a reference manager from the first day — **Zotero** (free) or Mendeley. Do not format references by hand.
- Redraw every figure to publication quality. No screenshots of Excel defaults, no company templates, no logos.
- If English phrasing is a concern, budget for a language-editing service (~USD 150–400). It measurably reduces desk rejection.

**Realistic effort:** 4–8 weeks alongside a Plant Manager role. The literature review is the bottleneck.

---

## 5. Set up your researcher identity — 30 minutes, do it today

1. **ORCID** — register at [orcid.org](https://orcid.org). Free, five minutes. Every submission system and every Australian HDR form asks for it.
2. **Google Scholar profile** — create it now, even empty. It populates automatically once published.
3. **ResearchGate** — optional, but useful for supervisor visibility.

---

## 6. Submit

Elsevier journals use **Editorial Manager**. From the journal's homepage on ScienceDirect, click "Submit your article."

**What you will need ready:**
- Manuscript (Word or LaTeX), anonymised if the journal is double-blind
- Title page with all authors, affiliations, ORCIDs, and a designated corresponding author
- **Cover letter** (see below)
- Figures as separate high-resolution files
- Highlights — 3–5 bullets, max 85 characters each
- Declaration of Interest statement — **you must declare SOPREMA employment and funding.** Non-disclosure discovered later is a retraction-level problem
- Suggested reviewers — 3–5 names, no conflicts, none from your own institution
- Data availability statement

**Cover letter — one page:**
> Dear Editor, we submit "[title]" for consideration in [journal]. The work reports a 14,400-hour accelerated thermal ageing programme on SBS-modified bituminous membrane, independently verified by an ISO/IEC 17025-accredited laboratory, together with two-year field exposure in a hot-arid climate. To our knowledge this is the longest continuous laboratory ageing dataset published for this material class, and the first to correlate accelerated Arrhenius prediction against real hot-arid field performance. The manuscript is original, not under consideration elsewhere, and all authors have approved submission.

Then say plainly what you contributed and why it matters. Do not oversell.

---

## 7. Post a preprint the same week — this is the tactical shortcut

The moment you submit, post the manuscript as a **preprint**. You get a **citable DOI within days**, so you can list a real reference on PhD applications while peer review runs for months.

- **SSRN** (Elsevier's preprint server — integrates with Editorial Manager, often a single checkbox during submission)
- **engrXiv** — engineering preprints, free
- Check the target journal's preprint policy first. Elsevier permits preprints; some publishers do not.

On your CV and applications, write it exactly like this:

> Hussain, I., et al. "Accelerated thermal ageing and Arrhenius service-life prediction of SBS-modified bituminous waterproofing membranes." *Preprint*, DOI: 10.xxxx/xxxxx. **Under review, [Journal Name], 2026.**

That single line does the job. It is honest, verifiable, and it removes "no publications" from your profile.

---

## 8. Timeline

| Window | Action |
|---|---|
| **Week 1 (now)** | ORCID + Google Scholar. Open the SOPREMA IP conversation. Email 3 prospective academic co-authors |
| **Weeks 2–4** | IP release in writing. Co-author confirmed. Decide §0 fix option. If option 1, start the extra ageing temperatures now |
| **Weeks 3–8** | Literature review (40–60 papers). Draft methods and results |
| **Weeks 8–10** | Full draft. Co-author review. Language edit |
| **Week 10–11** | **Submit + post preprint** — target mid-to-late October 2026 |
| **Weeks 12–14** | Desk decision. If desk-rejected, reformat and resubmit to the next journal within 7 days |
| **Nov 2026 – Jan 2027** | Cite as "under review" on all PhD applications |
| **Q1–Q2 2027** | Reviewer comments. Revise and resubmit |

**This timeline works** — you clear the December/January US deadline and the Canadian supervisor season with a citable output.

---

## 9. If it is rejected

Expect it. Rejection is normal and carries no stigma.

- **Desk reject** (no review) — usually scope mismatch. Reformat to the next journal and resubmit within a week. Costs you nothing but time.
- **Reject after review** — you have free expert feedback. Address every point, then submit to a lower-tier journal.
- **Major revision** — this is a *good* outcome. Answer every comment in a point-by-point response document, politely, even where you disagree.

Do not submit to two journals simultaneously. It is a serious ethical breach and editors detect it.

**Your preprint DOI stays valid throughout.** Once posted, you have a citable research output regardless of what any journal decides — which is the actual objective for your applications.

---

## 10. Afterwards

Study 2 (PVC-P Flagon BSL, 5,856 h warm-water immersion, 120-year projection, cross-validated against Luciani 2020 and Zhang 2025) is your **second paper**. Do not combine them — two publications are worth considerably more than one longer one, and the second is much faster once you know the process.

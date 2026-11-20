# Scoring v3: tighter leads (Amli, after Nils's final run)

Goal: only startups we would really pitch reach **call now**. No free points, missing information never helps,
the order on the screen follows quality, and the rules match HTGF's own criteria. Then one real end-to-end run,
shown on the local app (`/proof/live` on :4000).

Owner for this change: Amli (agreed: Nils hands over flows 13 and 15 when his final run is done).
Rollback: 13 `a3fc2818-acb5-4e78-a51e-183b5612dbe8`, 15 `b9ea2f27-1f04-4bbe-b3ac-2831dd01961f` (versions on 20 Nov ~21:40).

## What HTGF says (htgf.de/en, "Our investment criteria", page updated 18 Nov 2026)
1. First investment in pre-seed and seed: **sweet spot €800,000+**, flexible to the startup's needs; HTGF is the **lead investor** and brings co-investors.
2. Company **no older than three years**.
3. Headquartered in Germany **or, for startups from other countries, a German base of operations**.
4. Digital tech, industrial tech, life sciences, chemistry **or related business areas**.

€800k+ is HTGF's own ticket, not a cap on what the startup raised. Our own additions (high-tech minimum, legal company,
no institutional round yet) stay, and the pitch calls them our choices.

## Measured on the 130 leads scored by 15 (20 Nov ~21:30)
| Criterion | Max now | Avg on survivors | Problem |
|---|---|---|---|
| germany | 10 | 96% | free points (it is a hard check anyway) |
| sector | 15 | 99% | free points (hard check) |
| no_funding | 10 | 98% when known, unknown for 46 of 78 | free points, or 0 for saying nothing |
| stage | 10 | 85% | mostly free (hard check) |
| tech_depth | 25 | 80% | real signal |
| corporate_pull | 15 | 27%, unknown for 35 | strongest differentiator |
| patent_before_company | 15 | unknown for 77 of 78 | almost never earned |

Ranking inside a verdict uses timing only, so thin leads (fit 35, team unknown) sit above strong ones (fit 74, team 90).

## The new rules
**Fit (only what separates a great startup), max 100**
| Criterion | Max | Notes |
|---|---|---|
| tech_depth | 40 | same rubric (0–9 standard, 10–14 own logic, top band hard to copy) |
| corporate_pull | 25 | pilots, LOIs, named industrial users |
| research_or_patent | 20 | patent, lab results, spin-off from research (was patent_before_company) |
| capital_need | 15 | **new**: evidence the company needs an €800k+ round (hardware, lab, clinical/regulatory, stated raise of that size). Small software projects score low |
| germany, sector, stage, no_funding | 0 | hard checks only, no points |

Anti-signals (from 15, at most −30 together): thin_wrapper −10, agency_income −10, marketing_no_product −10, too_many_projects −5.
Unknown = 0 points. A point without a cited trace (`unsupported`) counts 0 (as today).

**Team**: weights unchanged; `team_score_known` as today.

**Hard checks (13)**
- germany: pass = German HQ **or a German base of operations** (German city, German office or register entry). Fail only with no German presence at all.
- age: older than 3 years fails; use the exact register date (`registered_at`) when there is one, else the founding year.
- sector: unchanged (lenient, "or related").
- too late: unchanged (Series A+, seed round led by a VC fund or corporate VC, €3M+ disclosed, a fund in the register). No €800k cap.
- **student teams are not startups**: research chairs, labs, student racing/competition teams, university initiatives, e.V. (e.g. MIRMI-ERL, TUM Autonomous Motorsport, BEAM Hyperloop) → `not_a_startup`, unless the evidence shows a company or a founding plan.

**Call now = all of these** (unknown or unsupported counts as not met)
1. tech_depth ≥ 70% of its max, with evidence
2. at least one outside validation: corporate_pull > 0, research_or_patent > 0, a grant (EXIST etc.), or a prize/accelerator trace
3. technical_founder known and > 0, team_score_known ≥ 60
4. fit ≥ **FIT_BAR** (new scale; set in step 0 so the list is short and strong, expected around 55–65)
5. no failed hard check

**Order on the screen**: priority = verdict weight + min(99, round(0.5 × fit + 0.3 × team_score_known + 0.2 × timing) + flight-risk bonus). Verdict first, then quality.

## Steps
### 0. Now, while Nils runs (safe: nothing live is touched)
- Draft the new code for 13 ("Classify leads") and 15 ("Compute scores", "Build strong request") in `n8n/flows/drafts/`.
- Test the 13 draft offline on an export of the Leads table: verdict counts before/after, the new call-now list, the top 15, FIT_BAR.
- Draft the 15 prompt changes (new maxima, capital_need, research_or_patent, anti-signal values).

### 1. When Nils posts "final run done" in STATUS (~1.5 h in total)
1. Note the live versions of 13 and 15 (rollback).
2. **13** (pure code, free): apply the draft, run 13 by hand. It recomputes fit for every lead from the stored points (points ÷ old max × new max), so all leads move to v3 at once. Check the counts and the call-now list. ~15 min
3. **15**: apply the new maxima and prompt. ~15 min
4. **Re-score the top ~40** with 15 (call now, watchlist, top of needs enrichment) so they get `capital_need` and the new anti-signals: ~4 runs of 10, ~$4, ~5 min.
5. **Calibration**: run flow 18 on the 20 hand-labelled traces. Target: no false call now. ~10 min
6. **Full run**: 00 Run all (scan ~17 min, then screening). Watch the Run costs table; stop above $10.
7. **Hook up the local app**: publish flow 20, open http://localhost:4000/proof/live (banner turns green "Live: N leads"), `/api/briefing?format=json`, `/api/funnel`.
8. **Check**: call-now list makes sense (each with evidence links), no student team or HTGF portfolio company on top, `/proof/live` cards show verdict, next step and points per criterion, briefing speaks the top 5.
9. Update STATUS and `n8n/README.md`, tag `demo-v1` when the team agrees.

Optional after: re-run Nils's blind backtest (41) so the pitch numbers use v3.

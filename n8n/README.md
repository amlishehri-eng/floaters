# n8n (Person 1: sources)

Everything runs in the n8n Cloud project **HTGF** (floaters.app.n8n.cloud), shared with the whole team.
The files in `flows/` are the code each workflow was built from (n8n workflow SDK), kept here as a record
and so a flow can be rebuilt if someone breaks it. **n8n itself is the live copy**: edit there, then update the file here.

## Workflows
| # | Name | n8n id | Owner | What it does |
|---|---|---|---|---|
| 00 | Run all sources | `YLjdNTgC73QKTWKg` | Person 1 | Runs 01, 02, 03, 05, 06 in turn, then 10. A source with nothing new or an error does not stop the rest. Schedule every 6 h (off until published) + demo webhook `GET /webhook/run-all` |
| 01 | Luma Munich -> Traces | `dkBBn1k8pGmdUqfv` | Person 1 | luma.com/munich public page → startup events (keyword filter) → each event page. source `luma` |
| 02 | LMU pinboard -> Traces | `6e9qbOQ2CzcjxVz3` | Person 1 | lmu-pinboard.munich-startup.de: co-founder search, jobs, cooperations, other → each new post. source `campus` |
| 03 | TUM Venture Labs -> Traces | `rBvaaF23ZcfY1Hcd` | Person 1 | tum-venture-labs.de sitemap → every /teams/ page → team, lab, founders. 84 teams. source `campus` |
| 04 | Eventbrite Munich -> Traces | `kvSBgO4NLMRVswB0` | Person 1 | Built but **not in Run all**: Eventbrite shows n8n Cloud a "human verification" page. We don't get around that. Works from a home connection (17 startup events in a local test). **To do later:** run it from Amli's laptop and post into Traces via a webhook (see STATUS.md) |
| 05 | GitHub Munich -> Traces | `Fg6ZU1fqi7JnRNu2` | Person 1 | GitHub API (no token): new organisations located in Munich/München (last 120 days) → profile, newest repos, public members, Hugging Face models/datasets. source `github` |
| 06 | Pitch podcasts -> Traces | `J0YCRvXE1fVlNsXT` | Person 1 | PITCH & PEOPLE + Lenas Start-ups RSS → every episode of the last 2 years from its show notes; the 3 newest new episodes transcribed by **ElevenLabs** (speakers told apart). source `recording`. Needs the n8n credential "ElevenLabs" (Header Auth `xi-api-key`) |
| 10–19 | Make leads, days ahead, … | `jLWKNwEC08SHfAfP`, … | Person 2 (Nils) | Screening and eligibility: Traces → Leads. Their code lives in n8n |

One owner per workflow: n8n does not merge edits, the last save wins. Every source flow has three triggers: Run by hand, Called by Run all, Run from demo (webhook path = the flow's name, e.g. `/webhook/tum-venture-labs`).

## Tables (n8n data tables in the HTGF project)
| Table | id | Written by | Read by |
|---|---|---|---|
| Traces | `crxSUMWXcPfMrXt4` | source flows 01–06 | screening (10–19) |
| Leads | `CmDqydXaXEK5mg6F` | screening (10–19) | the screen |

**Differences from the contract in AGENTS.md** (n8n data tables reserve the column name `id`):
- Traces: the trace id lives in `trace_id` (e.g. `tumvl:planqc`, `github:<login>`, `podcast:<guid>`).
- Leads: the lead id lives in `lead_key` (no `lead:` prefix).
- Traces now has the `extraction` column; pinboard rows use `source = campus` (old rows relabelled).

## Rules
- Public pages only. Never Luma's internal API (api.lu.ma).
- Only public, professional facts about people. Phone numbers and emails are removed in the flows.
- Keys only in n8n Credentials. OpenAI in flow 10 uses n8n's built-in credits ("Gateway credits").
- Every fetch is gentle: one page every 2 s.

## Traces so far (20 Nov, 14:50)
Luma 4 · LMU pinboard 42 · TUM Venture Labs 84 · GitHub 6 · podcasts 65 = about 200 traces.

## First full run (20 Nov, 14:25)
46 traces (Luma + pinboard) → first 10 → 8 leads in 3.5 min. Top: KyNext (fit 80 / team 60), Klarvus (78/30),
ReXanh (75/30), an AI HR startup (75/30). Luma events correctly filtered out as event only.

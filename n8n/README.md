# n8n (Person 1: sources)

Everything runs in the n8n Cloud project **HTGF** (floaters.app.n8n.cloud), shared with the whole team.
The files in `flows/` are the code each workflow was built from (n8n workflow SDK), kept here as a record
and so a flow can be rebuilt if someone breaks it. **n8n itself is the live copy**: edit there, then update the file here.

## Workflows
| # | Name | n8n id | Owner | What it does |
|---|---|---|---|---|
| 00 | Run all sources | `YLjdNTgC73QKTWKg` | Person 1 | Runs 01, 02, 03, 05, 06, 07, 08, 30, 31, then 32 (duplicates), 09 (websites), then 10. A first full run takes ~27 min (scan 18 min 49 s for 01–09; 30 ~1.5 min; 31 ~5–7 min); repeat runs ~14 min, because 07 and 31 skip unchanged pages (50 s / 56 s instead of ~5.5 min each) and every source skips what it already has. A source with nothing new or an error does not stop the rest. Schedule every 6 h (off until published) + demo webhook `GET /webhook/run-all` |
| 01 | Luma Germany -> Traces | `dkBBn1k8pGmdUqfv` | Person 1 | luma.com pages for **Munich, Berlin, Hamburg, Frankfurt** (other cities have none) → startup events (keyword filter) → each new event page. source `luma` |
| 02 | LMU pinboard -> Traces | `6e9qbOQ2CzcjxVz3` | Person 1 | lmu-pinboard.munich-startup.de: co-founder search, jobs, cooperations, other → each new post. source `campus` |
| 03 | TUM Venture Labs -> Traces | `rBvaaF23ZcfY1Hcd` | Person 1 | tum-venture-labs.de sitemap → every /teams/ page → team, lab, founders. source `campus` |
| 04 | Eventbrite Munich -> Traces | `kvSBgO4NLMRVswB0` | Person 1 | Built but **not in Run all**: Eventbrite shows n8n Cloud a "human verification" page. We don't get around that. **To do later:** run it from Amli's laptop (see STATUS.md) |
| 05 | GitHub Germany -> Traces | `Fg6ZU1fqi7JnRNu2` | Person 1 | GitHub API (no token): new organisations (last 120 days) in **16 German places**, searches 7 s apart → profile, newest repos, public members, Hugging Face. Max 15 orgs per run. `website` from the org profile. source `github` |
| 06 | Pitch podcasts -> Traces | `J0YCRvXE1fVlNsXT` | Person 1 | PITCH & PEOPLE + Lenas Start-ups RSS → every episode of the last 2 years from its show notes; each run, the 3 newest episodes without a transcript are transcribed by **ElevenLabs** (speakers told apart). source `recording` |
| 07 | University startups Germany -> Traces | `938DWxWRYzIEvNNh` | Person 1 | 15 public university/incubator startup lists (TU Berlin, HU Berlin, Max Planck, Fraunhofer, KIT, TU Darmstadt, Tübingen, Cologne, Heidelberg, Hamburg, Leipzig SpinLab, Stuttgart, Hannover, Oldenburg, Kaiserslautern) → OpenAI (gateway credits) reads each page → one trace per startup with founders and `website`. trace_id `uni:<host>:<slug>`, source `campus`. Skips pages that did not change since last read (table **Page memory** `HU8vkWsRJIGzz7Rv`, fingerprint per page, re-read at least weekly) |
| 08 | Spin-off news (idw) -> Traces | `6ZlZePphuAyIfo90` | Person 1 | idw-online.de newest 8 listing pages (~160 university press releases; its robots.txt forbids search/RSS, so not used) → startup/spin-off headlines (~1–3 a day) → each release. trace_id `idw:<id>`, source `campus` |
| 09 | Find websites | `3omXcLPOp5Y7i2pE` | Person 1 | Traces with an org_name and no `website` → Brave search (credential "Brave Search account", max 50 per run, ~3 min) → official site checked on its home page → writes **only** `website` (or `none`). Never touches status |
| 30 | First hires (job ads) -> Traces | `08C3DOx2nldpCt1i` | Person 1 | Bundesagentur für Arbeit job search API (official, public client id): "Founding", "Mitgründer", "Gründerteam", "Spin-off", "Ausgründung", "Pre-Seed", "Startup" … → drops big firms, agencies, recruiters, ads older than 120 days → startups hiring their first people. trace_id `jobs:<refnr>`, **source `jobs`**. ~36 ads on the first run |
| 31 | Accelerators and competitions -> Traces | `nHxaczLdIVLQzAC2` | Person 1 | 28 public cohort / winner pages across Germany (UnternehmerTUM batch, BayStartUP, Start-up BW, CyberLab, Hessen Ideen, TechQuartier, Pioniergeist, Saarland, KUER.NRW, MUT NRW, NBank, Bremen, AI.STARTUP.HUB Hamburg, KfW Award, Deutscher Gründerpreis, German Startup Awards, futureSAX, ExciteLab, ThEx …) → OpenAI reads each page (gateway credits) → one trace per startup. trace_id `cohort:<host>:<slug>`, **source `accelerator`**. 301 startups on the first run. Skips unchanged pages like 07 (Page memory) |
| 32 | Remove duplicate traces | `l8SnodVexcqO2HXs` | Person 1 | Same source + same listing page + same company name (ignoring GmbH, .ai, Technologies…) → keeps the oldest row, removes the others **only if still `new`**. The same company in two different sources is kept (convergence). First run removed 5 TUM double pages (Futurail, Oceanflight, Caire, OmicsDiscoveries, EASE) |
| 10–19 | Make leads, days ahead, … | `jLWKNwEC08SHfAfP`, … | Person 2 (Nils) | Screening and eligibility: Traces → Leads. Their code lives in n8n |
| 39 | App check | `TFPplznOSk0566db` | Person 1 | `POST /webhook/htgf-automation` → answers `{ ok, flow, received, at }`. The app's `/api/automation` (`N8N_WEBHOOK_URL_MAIN`) and the `/test` panel use it to check the app reaches n8n. Published |
| 20 | Leads for the screen | `qd840KXqIoUEnbxl` | Person 3 (set up by Amli) | Read-only link `GET /webhook/htgf-leads`: every lead + date, source, link and title of the traces behind it. The app's `/proof/live` and `/api/leads` read it (`lib/n8n.js` → `getLeads`). **Works only while published** |

Person 1 owns 00–09 and 30–39 (more sources). One owner per workflow: n8n does not merge edits, the last save wins. Every source flow has three triggers: Run by hand, Called by Run all, Run from demo (webhook path = the flow's name, e.g. `/webhook/tum-venture-labs`).

## Handover to screening (Nils, flows 10–19)
How the two parts connect: **00 Run all** runs every source flow, then calls **10 Make leads** (its "Called by Run all" trigger), which calls **11 Days ahead**. The Traces table is the handshake: a source writes a row with `status = new`, screening sets it to `processed` or `failed`.

What screening should know about the rows:
- **Backlog:** ~180 traces are `new` (TUM 84, podcasts 65, pinboard, GitHub, Luma). 10 Make leads takes 10 per run, so at one run every 6 h that is 4–5 days. Raise the limit or drain it once by hand.
- **A trace can come back as `new`.** When a podcast episode gets its ElevenLabs transcript, flow 06 adds it to the text and sets `status = new`, `extraction` empty, so screening reads it again with the transcript. Same trace_id, so Merge leads does not count it twice.
- **Per source:**
  - `luma`: an event, usually `event_only`; hosts and guests in `people` may be founders.
  - `campus` + `pinboard:`: one post, often a co-founder search; the poster is in `people`.
  - `campus` + `tumvl:`: one TUM Venture Labs team with its founders. `happened_at` is the page's last-edit date, not the founding date (often a bulk edit, e.g. 2026-04-29); the founding year is in the text when the page gives it.
  - `github`: a new organisation; `happened_at` = when it was created on GitHub; `people` are GitHub logins, not names; Hugging Face lines in the text if any.
  - `recording`: a podcast episode; `people` is empty, names are in the show notes and transcript (Speaker 0/1, the host is Kyrill Ring on PITCH & PEOPLE). `org_name` is the episode topic, which can be an investor or an association (Start Munich, Women in Business e.V.), not a startup. Those should not end up `vc_backable`.
- Text is at most 5000 characters, 12000 for an episode with a transcript.

## Setting `N8N_WEBHOOK_URL_MAIN` (done 20 Nov ~21:15: flow "39 App check" `TFPplznOSk0566db`, published, path `htgf-automation`)
Not needed for the demo. Only the `/test` panel's "n8n → /api/automation" button uses it: `/api/automation` → `lib/n8n.js` `trigger()` sends a **POST** with a JSON body to this URL and shows the answer. Empty = the button answers the mock (`mocked: true`), which is harmless. No flow listens for it yet; 00 Run all's `/webhook/run-all` is GET only and starts a ~14 min run, so don't use that one.

Step by step, once there is a flow for it:
1. In n8n (project HTGF), give the flow a **Webhook** trigger: method **POST**, a path (e.g. `htgf-automation`), "Respond" = "Using 'Respond to Webhook' node" or "Immediately". End with **Respond to Webhook** answering JSON (an object, e.g. `{ "ok": true }`).
2. **Publish** the flow. Only the production link (`/webhook/...`) works then; `/webhook-test/...` only works while the editor is listening.
3. In `~/Desktop/floaters`, create `.env.local` (git ignores `.env.*`, it is never pushed) with one line:
   `N8N_WEBHOOK_URL_MAIN=https://floaters.app.n8n.cloud/webhook/htgf-automation`
4. Restart `npm run dev` (the app reads `.env.local` only at start).
5. Open http://localhost:4000/test → "n8n → /api/automation". `mocked: true` in the answer = it did not reach n8n (not published, wrong path, or GET instead of POST). The timeout is 8 s.
6. For Vercel: add the same variable under Project → Settings → Environment Variables, then redeploy.

## Tables (n8n data tables in the HTGF project)
| Table | id | Written by | Read by |
|---|---|---|---|
| Traces | `crxSUMWXcPfMrXt4` | source flows 01–09 and 30–39 | screening (10–19) |
| Page memory | `HU8vkWsRJIGzz7Rv` | flows 07 and 31 | flows 07 and 31 (which pages changed) |
| Leads | `CmDqydXaXEK5mg6F` | screening (10–19) | the screen |

**Differences from the contract in AGENTS.md** (n8n data tables reserve the column name `id`):
- Traces: the trace id lives in `trace_id` (e.g. `tumvl:planqc`, `github:<login>`, `podcast:<guid>`).
- Leads: the lead id lives in `lead_key` (no `lead:` prefix).
- Traces has the `extraction` column and a `website` column (the company's own site, or `none` when 09 could not find one); pinboard rows use `source = campus`.
- 20 Nov ~16:00: Traces was emptied on purpose and everything rescanned Germany-wide (Amli's decision). Full scan 15:56–16:15 (19 min): ~900 traces, 251 with a website. University pages 682, TUM 84, podcasts 65, pinboard 42, GitHub 15, Luma 9, spin-off news 3. Then 30 first hires (+36) and 31 accelerators (+301): ~1,240 traces.

## Rules
- Public pages only. Never Luma's internal API (api.lu.ma).
- Only public, professional facts about people. Phone numbers and emails are removed in the flows.
- Keys only in n8n Credentials. n8n's built-in AI credits ("Gateway credits") ran out on 20 Nov; our own keys replace them (20 Nov ~18:20):
  - **OpenAI Team Key** (OpenAI): 07, 31 (Person 1); 10, 11, 15, 16, 18 (Person 2).
  - **Brave Search account** (Brave Search API): 09 Find websites (web search), 11 Days ahead (news search).
  - **handelsregister.ai** (Header Auth): 12 Registry check (search, fetch company, founder's other companies).
  - **xi-api-key** (ElevenLabs, Header Auth): 06 podcast transcripts.
- Every fetch is gentle: one page every 2 s.

## Traces so far (20 Nov, 14:50)
Luma 4 · LMU pinboard 42 · TUM Venture Labs 84 · GitHub 6 · podcasts 65 = about 200 traces.

## First full run (20 Nov, 14:25)
46 traces (Luma + pinboard) → first 10 → 8 leads in 3.5 min. Top: KyNext (fit 80 / team 60), Klarvus (78/30),
ReXanh (75/30), an AI HR startup (75/30). Luma events correctly filtered out as event only.

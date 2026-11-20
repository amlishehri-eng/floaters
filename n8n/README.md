# n8n (Person 1: sources)

Everything runs in the n8n Cloud project **HTGF** (floaters.app.n8n.cloud), shared with the whole team.
The files in `flows/` are the code each workflow was built from (n8n workflow SDK), kept here as a record
and so a flow can be rebuilt if someone breaks it. **n8n itself is the live copy**: edit there, then update the file here.

## Workflows
| # | Name | n8n id | Owner | What it does |
|---|---|---|---|---|
| 00 | Run all sources | `YLjdNTgC73QKTWKg` | Person 1 | Runs 01, 02, … in turn, then 10. Schedule every 6 h (off until published) + demo webhook `GET /webhook/run-all` |
| 01 | Luma Munich -> Traces | `dkBBn1k8pGmdUqfv` | Person 1 | luma.com/munich public page → startup events (keyword filter) → each event page → Traces |
| 02 | LMU pinboard -> Traces | `6e9qbOQ2CzcjxVz3` | Person 1 | lmu-pinboard.munich-startup.de: co-founder search, jobs, cooperations, other → each new post → Traces |
| 10 | Make leads | `jLWKNwEC08SHfAfP` | Person 2 | **Stand-in** so the pipeline runs end to end: 10 new traces → OpenAI (n8n credits) → Leads. To be replaced by the call to `/api/brain/run` (see `docs/brain.md`) |

One owner per workflow: n8n does not merge edits, the last save wins.

## Tables (n8n data tables in the HTGF project)
| Table | id | Written by | Read by |
|---|---|---|---|
| Traces | `crxSUMWXcPfMrXt4` | 01, 02, … | the brain |
| Leads | `CmDqydXaXEK5mg6F` | the brain | the screen |

**Differences from the contract in AGENTS.md** (n8n data tables reserve the column name `id`):
- Traces: the trace id lives in `trace_id`. Map `trace_id` → `id` when sending rows to `/api/brain/run`, and back when applying `trace_updates`.
- Leads (stand-in): the lead id lives in `lead_key` (no `lead:` prefix); lists are plain text, not JSON strings. The real brain's `rows` should be written with `id` → `lead_key` (or a new column).
- Traces has no `extraction` column yet; pinboard rows use `source = pinboard` (contract list says `campus`). Being fixed next.

## Rules
- Public pages only. Never Luma's internal API (api.lu.ma).
- Only public, professional facts about people. Phone numbers and emails are removed in the flows.
- Keys only in n8n Credentials. OpenAI in flow 10 uses n8n's built-in credits ("Gateway credits").
- Every fetch is gentle: one page every 2 s.

## First full run (20 Nov, 14:25)
46 traces (Luma + pinboard) → first 10 → 8 leads in 3.5 min. Top: KyNext (fit 80 / team 60), Klarvus (78/30),
ReXanh (75/30), an AI HR startup (75/30). Luma events correctly filtered out as event only.

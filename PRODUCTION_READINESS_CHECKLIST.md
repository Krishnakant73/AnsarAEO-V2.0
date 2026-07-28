# Production Readiness Checklist — AnsarAEO Workflow

Status legend: ✅ done · 🟡 pending/verify · ⚠️ action required

## Schema & migrations
- [x] DB backed up before changes (`backup_20260714` schema, 57 tables)
- [x] Migrations **005–011** applied to live DB and registered in `supabase_migrations`
- [x] `gsc_index_status` table + RLS policy created (was the only genuinely missing object)
- [x] Migration **022** applied — `opportunity_recommendations` unique `(brand_id, type)` constraint added (fixes broken `generateOpportunities`)
- [x] Migrations 005/006/008/011 made idempotent (`IF NOT EXISTS` + `DROP POLICY IF EXISTS`)
- [x] Repo migration files match applied state (no drift)

## Engines & RLS
- [x] All 6 engines present + active: chatgpt, perplexity, gemini, google_ai_overview, grok, copilot
- [x] RLS policies exist for `content_items`, `automation_actions`, `integrations`, `gsc_index_status`, `opportunity_recommendations`, etc.
- [x] `content_items` / `automation_actions` / `integrations` tables verified to match migration definitions

## Engine correctness (validated)
- [x] Deterministic e2e validation passes **6/6** (`validation/workflow-e2e.test.ts`)
      scan → opportunities → mission → tasks → state machine + deploy gate → verify → history
- [x] `decomposeOpportunity` produces deterministic `fix→…→verify` templates
- [x] Task/mission state machine rejects illegal transitions
- [x] Deploy-approval gate (module 9) blocks completion while approval pending
- [x] `verifyTask` computes deterministic metric delta + emits notification
- [x] History (`history_observations`/`history_events`) records runs

## Data dependencies for the live feature
- [🟡] `benchmark_aggregates` must have **published** rows for a brand's `industry_category`
      before `generateOpportunities` yields anything (currently empty in prod — seed before GA).
- [🟡] `benchmark_brand_snapshots` must exist for a brand before `verifyTask` can compute.
      `runVisibilityCheck` only *marks dirty*; the **benchmark engine / nightly cron**
      must run to populate the snapshot from real runs.
- [🟡] Confirm `/api/cron/nightly-runs` and the benchmark cron are wired in `vercel.json`
      and fire with `CRON_SECRET`.

## Environment (real scans)
- [⚠️] Set real `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `GOOGLE_AI_API_KEY` for live scans
      (currently placeholders). `GROK_API_KEY` / `COPILOT_API_URL+KEY` optional (skip gracefully).
- [⚠️] `CRON_SECRET` must match Vercel env for cron routes.
- [⚠️] `ENCRYPTION_KEY` (32-byte hex) present for `integrations` credential encryption.
- [⚠️] Razorpay webhook (`/api/billing/webhook`) verifies signature before trusting payload.
- [⚠️] `DATAFORSEO_LOGIN`/`PASSWORD` if real Google AI Overviews are required (else skips).

## Validation still to run
- [🟡] **Real-AI end-to-end** pass per `RUNBOOK_REAL_AI.md` (user runs in their env with keys).
- [🟡] Local validation (lint / typecheck / build / tests) per approval #2.

## Rollback
- [x] In-DB backup schema `backup_20260714` available to restore any pre-change table.
- [x] `node scripts/seed-sample-brand.mjs --reset` removes the validation sample brand.

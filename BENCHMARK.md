# AnsarAEO — AI Industry Benchmark Platform (Foundation MVP)

Anonymous, aggregate industry benchmarking built on top of every `visibility_run`.
Turns "how is *my* brand doing?" into "how do I compare to my *industry*?" — a
compounding data moat that grows as more brands onboard.

## Privacy model (the moat is anonymous)

- **Two layers.** `benchmark_brand_snapshots` is *attributed* (has `brand_id`, RLS
  org-scoped) and feeds only the brand's own "Your Position" view.
  `benchmark_aggregates` is *anonymous* — **it stores no `brand_id`**, only
  normalized dimensions + derived metrics.
- **k-anonymity.** A benchmark cell is published only when it aggregates **≥ 5
  distinct brands** (`K_ANONYMITY_THRESHOLD` in `src/lib/benchmark-privacy.ts`).
  Below that, APIs return an honest "not enough data yet" — never a fabricated
  number.
- **No PII in the warehouse.** No brand name, domain, prompt text, or raw run
  content is stored in either table — only normalized dimensions (industry,
  region, country, language, engine, intent, size/band) + metrics.
- **Opt-in.** `benchmark_opt_in` (default true) controls whether a brand
  contributes; `benchmark_public_opt_in` (default false) gates *naming* on a
  public leaderboard (Phase 2).

## Architecture

```
visibility_runs ──▶ benchmark_brand_snapshots (per-brand, RLS) ──▶ benchmark_aggregates (anonymous, k-anon gated)
                       ▲ computeBrandSnapshot (daily cron)            ▲ aggregateBenchmarks (daily cron)
                       │                                             │
                  "Your Position"                               Benchmark Center + APIs
```

- Write path hooks into `visibility-engine.ts` beside `safeRecordRunHistory`
  (failure-isolated; never breaks a visibility run).
- Pure math lives in `src/lib/benchmark-metrics.ts` (percentiles, trust/visibility
  scores, rates) — fully unit-tested.
- Normalization in `src/lib/industry-taxonomy.ts` (free-form industry → canonical
  key; country → region; enrichment enums).
- IO/orchestration in `src/lib/benchmark-engine.ts`; short-lived cache in
  `src/lib/benchmark-cache.ts`.

## Metrics

AI Recommendation Rate · AI Citation Rate · Avg Recommendation Position · AI Trust
Score · Avg Visibility · per-dimension averages + p10/p50/p90 percentiles ·
period-over-period growth. All deterministic from real runs (no LLM).

## Enabling (migration is file-only)

`migration_019_benchmarks.sql` is additive (new brand columns + two tables + RLS).
Apply via the Supabase MCP / a dev branch, or review-then-apply in the deploy
flow. `supabase/reset.sql` drops the new tables so a clean reseed stays consistent.

## Cron (vercel.json)

- `/api/cron/benchmark-snapshot` — `0 22 * * *` — recompute per-brand snapshots.
- `/api/cron/benchmark-aggregate` — `30 22 * * *` — roll up anonymous aggregates
  (current + prior month). Both gated by `Bearer ${CRON_SECRET}`.

## APIs (`src/app/api/benchmark/*`)

- `overview` — benchmark cell + your position for a dimension/metric.
- `leaderboard` — ranked, anonymous dimension values (top industries, etc.).
- `compare` — full distribution across a dimension (region/language/engine bars).
- `history` — multi-month series (industry vs your brand).

Brand identity is always resolved from the session, never a query param.

## Dashboard

`/dashboard/benchmark` (Benchmark Center): Industry Average · Your Position ·
Top 10% · Historical Comparison · Industry Leaderboard · Regional / Language / AI
Engine comparison. Low-data segments show an honest empty state.

## Extending

- New dimension: add a column to `benchmark_brand_snapshots`, capture it in
  `computeBrandSnapshot`, group by it in `aggregateBenchmarks`, add a comparison
  widget. Privacy gate is automatic.

## Phase 2 (deferred, schema-ready)

Public SEO Benchmark Portal · Agency dashboard · Monthly PDF reports (shared
`reports.ts`) · Public report generator · AI-Agent benchmark reasoning.

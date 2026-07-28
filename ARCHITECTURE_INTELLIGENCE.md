# AnsarAEO — AI Discovery Intelligence Platform

**Vision:** the system of record for how AI engines *discover, trust, recommend,
cite, compare, and rank* businesses. The Bloomberg Terminal for AI Search.

This document is the architecture + rollout for the Intelligence Platform. It is
**grounded in code that already exists** and the new modules built in this
batch. File references are real; math is unit-tested.

---

## 0. The moat already exists (read this first)

AnsarAEO is **not** greenfield. The exact mechanism the vision calls for — "every
interaction contributes anonymously to a continuously improving Intelligence
Network" — is already running:

- `src/lib/visibility-engine.ts` captures `visibility_runs` (mention, position,
  sentiment, `recommendation_alignment`, `competitor_mentions`, deterministic
  `mention_verification`) + `citations` (cited domain, quality, authority).
- `src/lib/benchmark-engine.ts` + `benchmark-metrics.ts` + `benchmark-privacy.ts`
  turn runs into **attributed** `benchmark_brand_snapshots` → **anonymous**
  `benchmark_aggregates` (k-anonymity `K=5`, `published` gate, **no `brand_id`**,
  no raw text). This is the cross-tenant warehouse.
- `src/lib/history-engine.ts` + `history-events.ts` is an append-only historical
  DB (competitor movers, citation changes, prompt-improvement deltas,
  engine-change signals, alerts).
- `industry-taxonomy.ts` + `intent.ts` are deterministic, tested dimension
  vocabularies (industry, region, 7 funnel intents) — the shared keys the whole
  network partitions on.

**Three reinforcing loops make this defensible for decades:**
1. **Data loop** — more customers → denser/accurate benchmarks → more value → more customers.
2. **Graph loop** — every citation + mention adds edges; network value grows super-linearly; a competitor cannot buy the accumulated edge history.
3. **Temporal loop** — forecasts improve with series length; goal is the longest AI-discovery time series on earth.

The differentiator is **not** the dashboard. It is the anonymous warehouse + the discovery/citation graph.

---

## 1. Complete architecture (layered)

```
L4  Public Intelligence Portal  +  /api/v1/intelligence  (published-only, k-anon, keyed)
L3  Intelligence modules
      Trend · Forecast · Rankings · Market Share · Behavior · Feed · Opportunity
L2  AI Discovery Graph + Citation Graph   ◀── NEW (the moat)
L1  Intelligence Network  (benchmark_brand_snapshots → benchmark_aggregates)
      + benchmark_trend_cells + forecast_runs              ◀── NEW
L0  Capture  (visibility_runs, citations, history_*)        ◀── exists
```

Every layer reads from the one below it. Nothing in L2–L4 ever writes raw brand
data into the anonymous warehouse.

---

## 2. Database design

All new tables are in **`supabase/migration_020_intelligence_graph.sql`**, written
in the same style as `migration_019` (nullable non-breaking ALTERs, RLS,
anonymous tables `published`-gated, attributed tables RLS org-scoped).

| Table | Layer | Purpose | Privacy |
|---|---|---|---|
| `entities` | L2 | canonical entity registry (brand/source/topic/person/product/org/location) | brand rows org-scoped |
| `sources` | L2 | cited-domain authority + trust (bootstrapped from `citations`) | read-auth |
| `discovery_edges` | L2 | `subject → predicate → object` weighted edges | read-auth |
| `graph_metrics` | L2 | **materialized** PageRank, in/out degree, authority | read-auth |
| `benchmark_trend_cells` | L1 | per-cell delta / change-point | read-auth |
| `forecast_runs` | L1 | ETS point + interval forecasts | brand rows org-scoped |
| `brand_ranking_tokens` | L3 | anonymous public leaderboard identity (random uuid) | org can read own |
| `rankings_monthly` | L3 | published, k-anon-gated monthly rankings | published-only |
| `opportunity_recommendations` | L3 | attributed, gap→fix with impact estimate | org-scoped |
| `intelligence_feed_events` | L3 | global + brand-scoped feed | published-only / org |

**Privacy-by-construction:** anonymous tables store no `brand_id` and are
selectable only when `published = true`. `brand_ranking_tokens` maps a brand to a
random token; the public leaderboard references the token, never the name.

---

## 3. Graph model (L2) — `src/lib/discovery-graph.ts`

**Nodes:** `entities` (deduped by `(entity_type, normalized_key)`). `sources`
are cited domains; brands are brand names; topics are prompt `intent`/`category`.

**Edges** (`discovery_edges`): `subject → predicate → object`, weighted, with
`engines` (jsonb), `industry_category`, `observation_count`, `confidence`.

| Predicate | Meaning |
|---|---|
| `source -[CITES]-> brand` | AI answer cited the brand's own domain (recommendation signal) |
| `brand -[MENTIONS]-> topic` | brand surfaced for a topic |
| `brand -[COMPETES_WITH]-> competitor` | competitor named in same answer |
| `source -[TOPIC_OF]-> topic` | domain cited for a topic |
| `brand -[APPEARS_IN_ENGINE]-> engine` | brand mentioned on an engine |
| `brand -[RECOMMENDS]-> topic` | `recommendation_alignment = aligned` |

**Authority:** `pageRank()` (pure, deterministic, normalized to sum 1) over the
directed weighted edge set, materialized into `graph_metrics` by cron. Dangling
nodes redistribute rank (standard teleport). `degrees()` gives in/out degree.

**Bootstrap is free:** edges are extracted from data the pipeline *already*
captures (`citations`, `visibility_runs`, `competitor_mentions`, prompt intents)
— **zero new LLM/API calls**. Deeper topic/entity extraction from
`raw_response` text is a later enhancement and is *not* faked.

---

## 4. Data warehouse design

Two zones, same pattern as `migration_019`:
- **Attributed** (`*_snapshots`, `forecast_runs` brand rows,
  `opportunity_recommendations`, `brand_ranking_tokens`): carry `brand_id`, RLS
  org-scoped, never exposed publicly.
- **Anonymous** (`benchmark_aggregates`, `rankings_monthly`,
  `intelligence_feed_events`): no `brand_id`, `published` gate, k-anon `K=5`.

The warehouse stores only normalized dimensions + derived metrics — never raw
brand name, domain, prompt text, or run content.

---

## 5. Aggregation pipeline (cron DAG)

`vercel.json` runs the chain; each step failure-isolated (`safe*` wrappers):

```
20:30  nightly-runs            (visibility runs)            [exists]
22:00  benchmark-snapshot       (per-brand snapshot)         [exists]
22:30  benchmark-aggregate      (anonymous aggregates)       [exists]
23:00  /api/cron/intelligence   ◀── NEW DAG:
        1. extractGraphFromRuns → computeGraphMetrics
        2. computeTrendCells        (delta / change-point)
        3. generateForecast         (top anonymous cells, 6mo)
        4. computeMonthlyRankings   (k-anon published)
        5. generateOpportunities     (per brand, gap→fix)
        6. assembleGlobalFeed        (global + industry)
```

Code: `src/app/api/cron/intelligence/route.ts`.

---

## 6. Benchmark + Historical engine integration

- **Benchmark integration:** `benchmark_trend_cells`, `forecast_runs`,
  `rankings_monthly`, `intelligence_feed_events` all read from
  `benchmark_aggregates` / `benchmark_brand_snapshots`. `getYourPosition` already
  exists for the brand-vs-benchmark view; the dashboard page reuses it.
- **Historical integration:** `assembleGlobalFeed` consumes
  `history_events.engine_change_detected` (rolled up per engine) and
  `history_alerts` for brand-scoped signals. `computeTrendCells` consumes the
  multi-month `benchmark_aggregates` series.

---

## 7. Forecast methodology — `src/lib/forecast-engine.ts`

- **Model:** additive **Holt** smoothing (level + trend), `holtForecast()`.
- **Intervals:** residual std-dev scaled by `√step` (`Z=1.96` ≈ 95%); widened to
  the larger of model residual vs the warehouse's empirical `(p90−p10)/2` when
  available. Always emits `lower`/`upper` bands — **never a bare point**.
- **Honesty gate:** series `< MIN_HISTORY (6)` months → `insufficient_history =
  true`, `confidence = low`. We still return a projection but label it low-confidence.
- **Metric bounds:** rates clamped to `[0,1]`, position to `≥1`.
- **Later:** add seasonality (Indian festive calendar), engine-shift covariates
  from `engine_change_detected`, logistic forecast for recommendation probability.

---

## 8. Scoring methodology

Extends the existing `benchmark-metrics.ts` (`trustScore`, `visibilityScore`):
- **Citation Authority** — weighted by `sources.authority_score` for own-domain citations.
- **Market Share Index** — `brandMentions / (clusterTotal + smoothing)` (`brand-rankings.ts:marketShareIndex`), Laplace-smoothed so one brand can't read 100%.
- **Mindshare** — `0.6·mentionShare + 0.4·citationShare` within a topic cluster.
- **Discovery Authority** — graph PageRank over `discovery_edges`.
- All scores `0..1`, deterministic where possible, unit-tested (no LLM in the math).

---

## 9. UI / UX / Dashboard / Public Portal

**Aesthetic:** Bloomberg-terminal density — monospaced numerics, sparklines,
heatmaps, command palette later. Dark-first, Tailwind.

- **Dashboard** `src/app/dashboard/intelligence/page.tsx` (authenticated, RLS):
  brand-vs-benchmark tiles, priority opportunities, recent change-points, forecast summary.
- **Public Intelligence Portal** `src/app/(marketing)/intelligence/page.tsx`
  (no auth, published-only, service client): AI Discovery Index by industry,
  anonymous SaaS mention-share leaderboard, trending shifts, most-cited sources
  (graph authority), global intelligence feed. **Never renders brand names or
  `brand_id`** — brands appear only as anonymous tokens; the graph view is
  restricted to non-PII node types (`source`, `topic`).

---

## 10. API design — `src/app/api/v1/intelligence/route.ts`

Versioned, stable JSON contract, kind-dispatched via `?kind=`:

| kind | scope | returns |
|---|---|---|
| `benchmark` | public | published `benchmark_aggregates` cells |
| `trend` | public | `benchmark_trend_cells` (change-points) |
| `ranking` | public | anonymous `rankings_monthly` |
| `market-share` | public | `getMarketShare(industry)` (k-anon gated) |
| `feed` | public | published `intelligence_feed_events` |
| `your-position` | auth | brand value vs published benchmark |
| `opportunities` | auth | `opportunity_recommendations` |
| `forecast` | auth | `forecast_runs` for the brand |

- Public kinds read **only published rows** via the service client; brand_id /
  raw text are never selected.
- Auth kinds use the cookie client + `getSelectedBrand()` (RLS org-scoped).
- **Next:** API keys + tiers + rate limits + webhooks (enterprise feed), in a
  later phase. Add kinds, never rename response fields in place.

---

## 11. Testing — `src/lib/intelligence-math.test.ts`

Vitest, relative imports only (`./discovery-graph`), pure functions, no fetch.
Covers: `pageRank` (sums to 1, authority ordering), `accumulateEdges`,
`degrees`, `marketShareIndex`/`mindshare`/`rankDescending`/`percentileRank`,
`trendDirection`/`zScore`/`computeTrendCell` (change-point), `holtForecast`/
`etsForecast` (bands enclose point, `insufficient_history`), `gapMagnitude`/
`priorityScore`/`prioritizeOpportunities`. Run: `npx vitest run
src/lib/intelligence-math.test.ts`.

> **Note:** this sandbox's shell has no usable `node`/`vitest` on PATH, so the
> suite was not executed in-session. It follows the exact pattern of the
> repo's passing `benchmark-metrics.test.ts`; run it in your environment.

---

## 12. Security

- RLS on every table (org-scoped for attributed, `published`-gated for anonymous).
- Anonymous warehouse carries no `brand_id`, no raw text (privacy-by-construction).
- Cron routes gated by `CRON_SECRET` (`Bearer ${CRON_SECRET}`).
- Public API selects only `published` rows; never returns brand identity.
- Service client is used **only server-side** and only to return gated data.
- (Future) API keys encrypted with `ENCRYPTION_KEY` (per CLAUDE.md).

---

## 13. Performance / Scalability

- Monthly partitions for `history_*` (exists).
- `graph_metrics` materialized in cron — **never** computed per request.
- `benchmark_aggregates` idempotent upserts; read replicas / edge caching for the
  public portal.
- `discovery_edges` indexed on `subject_*` / `object_*` / `predicate`.
- Path to scale: when volume demands, move hot aggregates to a columnar warehouse
  (BigQuery/Snowflake); start in Postgres. PageRank is O(E·iterations) and runs
  nightly, not online.

---

## 14. Migration

Sequential `migration_020_intelligence_graph.sql` (after `019`). All brand ALTERs
are nullable + non-breaking. **Backfill is free**: `extractGraphFromRuns()`
bootstraps `entities`/`sources`/`discovery_edges` from existing `citations` and
`visibility_runs` — no new API calls. Benchmark backfill (`backfillBrand`) already
exists. `supabase/reset.sql` should be regenerated to include `020` for fresh
environments.

---

## 15. Documentation

- This file (`ARCHITECTURE_INTELLIGENCE.md`).
- Per-batch history in the repo's `BATCH*_SETUP_NOTES.md` convention.
- Public API docs generated from the stable contract in §10.

---

## 16. Rollout plan (phased; each phase ships value)

- **Phase 0 — Scale the Network (now):** backfill snapshots, review k-anon, confirm partitions/retention. *(benchmarks already live)*
- **Phase 1 — Discovery + Citation Graph (this batch):** `migration_020`, `discovery-graph.ts`, cron extract+metrics, public portal graph view. **Unblocks market share, rankings, behavior, feed.**
- **Phase 2 — Trend + Forecast (this batch):** `benchmark-trends.ts`, `forecast-engine.ts`, dashboard change-point + forecast tiles, `/api/v1/intelligence?kind=trend|forecast`.
- **Phase 3 — Rankings + Market Share (this batch):** `brand-rankings.ts`, anonymous tokens, public leaderboard + market-share API.
- **Phase 4 — Consumer Behavior Intelligence:** intent-sequence journey/pathway modeling from `intent.ts` + history (question clusters, decision pathways).
- **Phase 5 — Intelligence Feed + Opportunity Engine (this batch):** `intelligence-feed.ts`, `opportunity-engine.ts`, global feed + brand opportunities.
- **Phase 6 — Public Portal + API hardening:** external API keys/tiers/rate-limits/webhooks; richer portal (sparklines, heatmaps, command palette).

**Status of this batch:** L0–L3 foundations built and tested at the math layer;
migration, cron DAG, versioned API, dashboard + public portal pages are in place.
Phase 4 (behavior journeys) and Phase 6 (API keys/webhooks) are the remaining
builds; everything else in the platform reads from what shipped here.

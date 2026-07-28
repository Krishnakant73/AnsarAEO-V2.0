# History Engine — Historical AI Recommendation Database

> Runbook + reference for AnsarAEO's immutable history layer. This is the
> system of record for *every* AI-engine interaction a brand has ever had.
> It extends the existing visibility pipeline; it does not replace it.

---

## 1. Purpose & scope

Every call to an AI engine (ChatGPT, Perplexity, Gemini, Google AI Overview,
Grok, Copilot) becomes **historical knowledge**. We never overwrite an
observation — each visibility run is stored once as an immutable snapshot, and
changes between consecutive snapshots are derived as **timeline events**.

This lets users answer questions like:

- *When did ChatGPT first recommend our brand?*
- *Which competitors gained visibility over the last 12 months?*
- *Which citations were lost after our content update?*
- *Which prompts improved after we published new pages?*
- *Did an AI-engine change affect our visibility?*

Design philosophy: **Git commits for AI recommendations** — append-only,
date-accurate, honest about missing data.

---

## 2. Architecture

```
visibility-engine.runVisibilityCheck()
        │  (one row per prompt × active engine)
        ▼
visibility_runs  (existing table — the source of truth for a single run)
        │
        ├─► recordObservationFromRun()  ──► history_observations  (immutable snapshot, partitioned by month)
        │                                     │
        │                                     └─► deriveAndStoreEvents() ──► history_events (timeline deltas, partitioned by month)
        │                                                                            │
        │                                                                            └─► negative events ──► history_alerts (actionable feed)
        │
        └─► recordSkippedObservation() ──► history_observations (skipped=true, no delta events)

Read path:
  history-engine.getTimeline/getTrends/getInsights/getComparison/getPromptObservations/getAlerts
        │
        └─► history-cache (brand-scoped TTL) ──► UI (dashboard/history) + Agent (buildHistoryContext)
```

Two clients are used deliberately:

- **Service client** (`createServiceClient`) — all writes, backfill, prune,
  and derivation. Trusted, bypasses RLS (background work).
- **Cookie client** (`createClient`) — only the user-facing `GET`/`PUT
  /api/history/retention` and the alert-ack `PATCH`, so RLS scopes every
  mutation to the org's own brand.

A history failure must **never** break a visibility run. Every write entry
point is wrapped in `safeRecordRunHistory` / `safeRecordSkippedHistory`
(failure-isolated) and reports via `monitoring.reportError`.

---

## 3. Schema reference

### `history_observations` (partitioned by month on `observed_at`)
| column | type | notes |
|---|---|---|
| `id` | uuid | PK `(id, observed_at)` |
| `brand_id` | uuid | denormalized; RLS funnel |
| `prompt_id` | uuid | |
| `engine_id` | uuid | null for backfilled runs (derivation falls back to `engine_name`) |
| `engine_name` | text | |
| `prompt_text` | text | snapshot of the prompt at run time |
| `run_id` | uuid | FK → `visibility_runs(id)` on delete cascade; unique `(run_id, observed_at)` for idempotent backfill |
| `observed_at` | timestamptz | **partition key**; `now()` for live runs, `run.run_at` for backfill |
| `skipped` | bool | "we checked, engine returned nothing" — excluded from mention-rate denominators |
| `skip_reason` | text | |
| `brand_mentioned` / `brand_position` / `sentiment` / `recommendation_alignment` | — | the measured verdict |
| `competitor_mentions` | jsonb | |
| `mention_verification` | jsonb | deterministic-vs-LLM reconciliation (see visibility-engine) |
| `raw_response` | text | the actual AI answer (kept for audit + engine-change detection) |
| `tokens_used` / `cost_usd` | int / numeric | |

### `history_events` (partitioned by month on `occurred_at`)
| column | type | notes |
|---|---|---|
| `id` | uuid | PK `(id, occurred_at)` |
| `brand_id`, `prompt_id`, `engine_id`, `engine_name` | — | |
| `event_type` | text | one of 14 `EVENT_TYPES` (text, not enum — new types need no migration) |
| `occurred_at` | timestamptz | **partition key** (= the current observation's `observed_at`) |
| `prior_observation_id` / `observation_id` | uuid | links the delta to its two source rows |
| `from_state` / `to_state` / `detail` | jsonb | |
| `severity` | text | `positive` / `negative` / `info` |

### `history_alerts` (NOT partitioned — small, negative-only)
| column | type | notes |
|---|---|---|
| `id` | uuid | PK |
| `event_id` | uuid | unique-indexed; one alert per negative event (idempotent) |
| `brand_id`, `prompt_id`, `engine_id`, `engine_name` | — | |
| `alert_type` | text | mirrors `event_type` |
| `severity` | text | `negative` |
| `occurred_at` | timestamptz | |
| `detail` | jsonb | |
| `acknowledged` | bool | |

### Indexes (inherited by every partition)
- `history_obs_brand_time (brand_id, observed_at desc)`
- `history_obs_prompt_engine_time (brand_id, prompt_id, engine_id, observed_at desc)`
- `history_obs_engine_time (engine_name, observed_at desc)`
- `history_obs_run (run_id)` + unique `history_obs_run_uniq (run_id, observed_at)`
- `history_evt_brand_time`, `history_evt_brand_type_time`, `history_evt_prompt_engine_time`
- `history_alerts_brand_time`, unique `history_alerts_event_uniq (event_id)`

### RLS
`history_observations` / `history_events` / `history_alerts` all mirror the
existing `visibility_runs` policy shape: `brand_id in (select id from brands
where org_id in (select org_id from org_members where user_id = auth.uid()))`.
`history_alerts` additionally has a `WITH CHECK` so acks can only target the
org's own rows.

### Partition functions (DDL in `supabase/migration_016_history.sql`, `migration_018_history_backfill_partitions.sql`)
- `ensure_history_partitions()` — creates the current + next 3 months for both
  tables. Called at migration time and monthly by `/api/cron/ensure-history-partitions`.
- `ensure_history_partitions_for_range(from_date, to_date)` — creates any
  missing monthly partition across an arbitrary inclusive month range. Called
  by `backfillBrand()` with the min/max `run_at` of the brand's runs. **This is
  what keeps backfill from failing on >4-month-old data.**

There is **no DEFAULT partition** by design — a missing month fails loudly
(rather than silently dumping into a catch-all), and the two functions above
keep every needed month covered.

---

## 4. Timeline event model

Derived in `src/lib/history-events.ts` (`diffObservation`, pure + unit-tested).
Fourteen event types:

| event_type | severity | fires when |
|---|---|---|
| `first_mention` | positive | brand first appears (no prior / prior skipped) |
| `mention_gained` | positive | false → true |
| `mention_lost` | negative | true → false |
| `first_recommendation` | positive | first time `recommendation_alignment = aligned` |
| `recommendation_gained` | positive | → aligned |
| `recommendation_lost` | negative | aligned → not |
| `position_improved` | positive | rank number drops |
| `position_dropped` | negative | rank number rises |
| `sentiment_shifted` | positive/negative/info | sentiment changes (directional severity) |
| `citation_gained` | positive | cited domain appears (set diff) |
| `citation_lost` | negative | cited domain disappears |
| `competitor_gained` | negative | a competitor starts being mentioned |
| `competitor_lost` | positive | a competitor stops being mentioned |
| `engine_change_detected` | info | response signature changed **and** mention verdict flipped (heuristic, honestly labeled) |

**Honesty rules baked into the logic:**
- A skipped run emits **no delta events** (skip ≠ not-mentioned).
- On the *first* observation we only emit "firsts" — never citation/competitor
  deltas (those would all be "gained" = noise).
- A bucket with runs but no scorable verdict (all skipped) returns `rate = null`,
  **never 0**. Empty windows in `getComparison` return `delta = null`, never 0.
- `engine_change_detected` is explicitly a heuristic, not proof of an engine update.

---

## 5. API reference (`src/app/api/history/*`)

All read routes are service-client backed (route resolves `brandId` via
`getSelectedBrand()`), except `retention` + `alerts/[id]/ack` which use the
cookie client for RLS-scoped writes.

| route | method | auth | purpose |
|---|---|---|---|
| `/history/insights` | GET | service | first mentions, competitor movers, prompt improvements, citation changes, engine-change count (12-mo window) |
| `/history/trends?bucket=day\|week\|month&engine=` | GET | service | bucketed mention rate overall + per engine |
| `/history/competitors` | GET | service | per-competitor monthly mention trend + movers |
| `/history/citations` | GET | service | gained/lost citation domains in window |
| `/history/timeline?limit=&engine=&eventType=` | GET | service | raw event feed (newest first) |
| `/history/compare?fromA&toA&fromB&toB&engine=&promptId=` | GET | service | two-window mention-rate + citation deltas |
| `/history/prompt?promptId=` | GET | service | immutable observation series for one prompt |
| `/history/alerts?limit=&onlyUnacked=` | GET | service | negative-event alert feed |
| `/history/alerts/[id]/ack` | PATCH | cookie | acknowledge an alert (`acknowledged = true`) |
| `/history/retention` | GET / PUT | cookie | read / set `brands.history_retention_tier` (`30d` / `365d` / `unlimited`) |
| `/history/backfill` | POST | cookie + rate-limited | replay `visibility_runs` → history (idempotent) |
| `/history/export?type=observations\|events` | GET | cookie | CSV/JSON download |

Cron routes (gated by `CRON_SECRET` in `vercel.json`):
`/api/cron/ensure-history-partitions`, `/api/cron/history-prune`.

---

## 6. Caching strategy (`src/lib/history-cache.ts`)

- Module-scoped `Map` (per server instance), **not** a shared/CDN cache.
- `cachedHistory(key, ttl, producer)` — default **2-minute TTL**. History is
  slow-moving (changes only on a run), so staleness is invisible.
- **Cache key always includes `brandId`** — two brands can never share a
  payload (a URL-only cache would leak brand A's history to brand B, since the
  brand is resolved from the auth cookie).
- `invalidateHistoryCache(brandId)` is called on every write (backfill, retention
  change) so a just-recorded run is visible immediately.
- It is a cache, not a store: a miss/eviction just falls through to the DB; no
  correctness depends on it.

---

## 7. Performance & scalability

- **Partition pruning**: every time-range query is bounded by `observed_at` /
  `occurred_at`, so Postgres prunes to only the relevant monthly partitions.
- **Composite PK + inherited indexes** keep per-brand/per-prompt/per-engine
  lookups fast even at scale.
- **Append-only writes**: no `UPDATE`/`DELETE` on observations/events except the
  single retention-prune path.
- **Backfill is idempotent and resumable**: `INSERT ... ON CONFLICT (run_id,
  observed_at) DO NOTHING` skips already-recorded runs; partial progress is
  preserved across retries.
- **Derivation is idempotent**: `deriveAndStoreEvents` skips a observation that
  already has events.

---

## 8. Retention tiers + prune cron

`brands.history_retention_tier` ∈ `30d` | `365d` | `unlimited` (default
`unlimited`).

- Users set it from the **History dashboard → "History settings"** panel
  (`GET`/`PUT /api/history/retention`). No plan-gating in v1 — any brand can
  pick any tier (plan-gating is a future enhancement).
- Nightly `/api/cron/history-prune` calls `pruneByRetention()`, which:
  1. selects brands with tier `30d`/`365d`,
  2. computes the cutoff via `computeRetentionCutoff(tier, now)`,
  3. deletes `history_events` and `history_observations` older than the cutoff
     (the **only** delete path in the system).
- `unlimited` brands are never pruned.

---

## 9. Edge cases & honesty principles

- **Skip runs** (no AI Overview, missing key, no Copilot proxy) are stored as
  `skipped=true, brand_mentioned=null` — real "we checked" history, excluded
  from denominators. Never faked as "0% mentioned".
- **Backfill partition coverage**: backfill replays at the run's *real* date
  (`observed_at = run.run_at`). `ensure_history_partitions_for_range()` creates
  any missing historical month *before* replaying, so old runs don't fail to
  insert. (Before this fix, backfill mis-dated everything to `now()` and could
  drop old runs.)
- **Idempotent upserts**: re-running backfill or derivation is safe.
- **Empty windows**: trends/comparison return `null` rates and `null` deltas,
  never fabricated 0s.
- **Engine-change** is a labeled heuristic, not a claim.
- **RLS**: every user-facing read/write is org-scoped; service client only for
  trusted background work.

---

## 10. Backfill (operational)

`POST /api/history/backfill` (rate-limited 5/min/IP) replays a brand's existing
`visibility_runs` into `history_observations` + derives `history_events`. It is
the one-time seed after the history tables exist, and is safely re-runnable.

Implementation (`backfillBrand` in `src/lib/history-engine.ts`):
1. Load all `visibility_runs` for the brand, ordered by `run_at` asc.
2. Compute the min/max `run_at`; call `ensure_history_partitions_for_range`.
3. For each run: upsert an observation with `observed_at = run.run_at`
   (`engine_id = null`, `engine_name` preserved), then `deriveAndStoreEvents`.

---

## 11. Testing strategy

- **Pure logic** (`src/lib/history-events.ts`): `src/lib/history-engine.test.ts`
  covers every `EVENT_TYPES` transition, `bucketTrend` (incl. `null` rate for
  all-skip buckets), `bucketCompetitorTrend`, retention helpers, `bucketKey`,
  `normalizeResponse`.
- **Partition coverage** (`src/lib/history-partitions.ts`):
  `src/lib/history-partitions.test.ts` covers the month-range computation that
  backfill relies on (single month, year boundary, >12-month span, reversed
  input, invalid input). Pure — no DB required.
- **DB integration** (timeline correctness, partition DDL, prune) is exercised
  manually against a Supabase project (vitest has no DB/alias); see §12.

Run: `npx vitest run src/lib/history`.

---

## 12. Rollout & operations

Migrations `016` + `017` + `018` are already applied (schema + alerts +
backfill-partition function). Crons are registered in `vercel.json`
(`ensure-history-partitions`, `history-prune`). To operate:

1. `npx vitest run src/lib/history` — green.
2. `npm run build` — green (partitioned schema + UI compile).
3. On a brand with existing runs: `POST /api/history/backfill`, confirm
   observations land with correct `observed_at` (not all "today") and no
   partition errors for old months.
4. Change retention tier via the History dashboard; confirm `GET
   /api/history/retention` reflects it and the nightly prune honors it.
5. `GET /api/cron/ensure-history-partitions` (with `CRON_SECRET`) keeps future
   months covered.

---

## 13. File list (this feature)

**Schema / migrations**
- `supabase/migration_016_history.sql` — `history_observations`, `history_events`, `brands.history_retention_tier`, `ensure_history_partitions()`
- `supabase/migration_017_history_alerts.sql` — `history_alerts`
- `supabase/migration_018_history_backfill_partitions.sql` — `ensure_history_partitions_for_range()`

**Engine (lib)**
- `src/lib/history-engine.ts` — IO: writes, derivation, backfill, prune, read APIs, comparison, alerts
- `src/lib/history-events.ts` — pure diff + aggregation logic (14 event types)
- `src/lib/history-cache.ts` — brand-scoped TTL cache
- `src/lib/history-partitions.ts` — pure partition-month helper (added in this pass)
- `src/lib/history-agent-context.ts` — grounds the chat Agent in history

**API routes**
- `src/app/api/history/{timeline,trends,insights,compare,citations,competitors,alerts,alerts/[id]/ack,backfill,retention,export,prompt}/route.ts`

**Cron**
- `src/app/api/cron/ensure-history-partitions/route.ts`
- `src/app/api/cron/history-prune/route.ts`
- `vercel.json` (cron entries)

**Dashboard**
- `src/app/dashboard/history/page.tsx`
- `src/app/dashboard/history/HistoryClient.tsx` (7 tabs + History-settings panel w/ retention select, backfill, export)
- `src/components/dashboard/nav-config.ts` (nav link)

**Agent**
- `src/lib/agent-context.ts` (calls `buildHistoryContext`)

**Tests**
- `src/lib/history-engine.test.ts`
- `src/lib/history-aggregation.test.ts` *(historical name; covers history-events)*
- `src/lib/history-partitions.test.ts` (added in this pass)

**Docs**
- `docs/history-engine.md` (this file)

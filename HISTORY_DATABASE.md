# Historical AI Recommendation Database

AnsarAEO's system of record for AI Search. Every interaction with an AI engine
becomes **immutable historical knowledge** — append-only observations plus a
derived timeline of changes. Think Git commits, Google Analytics, Stripe events.

This is an **extension** of the existing architecture. It does not replace
`visibility_runs` / `citations`; it captures them as a durable, queryable history
and layers change-detection on top.

---

## 1. Architecture

```
visibility-engine.runVisibilityCheck()
        │  (one row per engine, already append-only)
        ▼
 safeRecordRunHistory()  ──►  history_observations  (1 immutable snapshot / run)
        │                          │
        │                          ▼
        │                   deriveAndStoreEvents()
        │                          │  diff prev vs curr observation
        │                          ▼
        │                   history_events  (timeline deltas: first mention,
        │                                       mention lost, citation gained, …)
        ▼
 safeRecordSkippedHistory() ─► history_observations (skipped=true, brand_mentioned=null)

Read layer (history-engine.ts) ──► /api/history/* ──► /dashboard/history (UI)
                                     /api/cron/*    ──► partition upkeep + retention prune

buildHistoryContext() (history-agent-context.ts) ──► Agent grounding
```

**Honesty principle (carried from the rest of the product):**
- Skipped runs are stored (`skipped=true`, `brand_mentioned=null`) but emit **no**
  delta events — *skip ≠ not-mentioned*.
- Months/buckets with no qualifying runs return `rate=null`, **never a 0%**.
- The retention prune only deletes data a customer explicitly chose to expire.
- Nothing is ever estimated or back-filled from thin air.

---

## 2. Database schema

Defined in `supabase/migration_016_history.sql`.

### `history_observations` (partitioned by month on `observed_at`)
| column | type | notes |
|---|---|---|
| id | uuid | PK (composite with `observed_at`) |
| brand_id | uuid | denormalized for RLS + fast scoping |
| prompt_id | uuid | |
| engine_id | uuid \| null | null for backfilled pre-016 runs |
| engine_name | text | always present; event derivation falls back to this |
| prompt_text | text | snapshot at observation time |
| run_id | uuid → visibility_runs | the immutable source run |
| observed_at | timestamptz | partition key |
| skipped | bool | "we checked, engine returned nothing" |
| skip_reason | text | |
| brand_mentioned / brand_position / sentiment / recommendation_alignment | | the verdict snapshot |
| competitor_mentions | jsonb | |
| mention_verification | jsonb | LLM vs deterministic reconciliation |
| raw_response | text | the actual answer (pruned under retention tiers) |
| tokens_used / cost_usd | | optional cost accounting |

### `history_events` (partitioned by month on `occurred_at`)
| column | type | notes |
|---|---|---|
| id | uuid | PK (composite with `occurred_at`) |
| brand_id | uuid | |
| prompt_id / engine_id / engine_name | | |
| event_type | text | **not an enum** — new types need no migration |
| occurred_at | timestamptz | partition key (= curr observation time) |
| prior_observation_id / observation_id | uuid | links the delta to its two observations |
| from_state / to_state | jsonb | before/after of the changed field |
| detail | jsonb | event-specific payload (domains, competitors, from→to) |
| severity | text | positive / negative / info |

**Partitioning:** native PostgreSQL RANGE partitioning by month. `brand_id` is
denormalized so RLS funnels through `brands` exactly like `visibility_runs` /
`citations`. Indexes (inherited by every partition): `(brand_id, observed_at)`,
`(brand_id, prompt_id, engine_id, observed_at)`, `(brand_id, event_type,
occurred_at)`, plus a unique `(run_id, observed_at)` that powers idempotent backfill.

**RLS:** brand-scoped policies mirror the existing `visibility_runs` shape — a
member can only read history for brands in their org.

---

## 3. Migration & rollout order

`migration_016_history.sql` is the single migration. It:
1. Adds `brands.history_retention_tier` (default `unlimited`).
2. Creates both partitioned tables + indexes.
3. Enables RLS + brand-scoped policies.
4. Creates `ensure_history_partitions()` and runs it once (current + next 3 months).

Migration sequence is `schema.sql` → `002`…`015` → **`016`**. (Run migrations in
order; `reset.sql` wipes+reseeds from `schema.sql`, so apply migrations after a
reset.)

---

## 4. Timeline event model

Pure, deterministic logic in `src/lib/history-events.ts` (`diffObservation`).
Same inputs → same events. Event types:

`first_mention`, `mention_gained`, `mention_lost`, `first_recommendation`,
`recommendation_gained`, `recommendation_lost`, `position_improved`,
`position_dropped`, `sentiment_shifted`, `citation_gained`, `citation_lost`,
`competitor_gained`, `competitor_lost`, `engine_change_detected`.

- A **first** observation (or first since a skip) emits only `first_*` events —
  never citation/competitor deltas (which would all be "gained" = noise).
- `competitor_gained` is **negative** (a rival gaining ground hurts us);
  `competitor_lost` is **positive**.
- `engine_change_detected` fires only when the response text changed materially
  **and** the mention verdict flipped — honestly a *heuristic*, labeled as such.
- Idempotent: `deriveAndStoreEvents` checks for an existing event on the current
  observation before inserting, so re-runs/backfills never duplicate.

---

## 5. APIs (`src/app/api/history/*`)

All read routes resolve the brand via `getSelectedBrand()` (auth cookie) and are
brand-scoped; writes flow through the service or cookie client as appropriate.
Honest empty states, never fabricated.

| route | method | purpose |
|---|---|---|
| `/api/history/insights` | GET | summary: first mentions, competitor movers, citation changes, improving prompts, engine-change signals |
| `/api/history/timeline` | GET | event feed (filters: `from`,`to`,`engine`,`eventType`,`limit`≤500) |
| `/api/history/trends` | GET | monthly/weekly/daily mention-rate series, overall + per engine |
| `/api/history/competitors` | GET | per-competitor monthly series + net movers |
| `/api/history/citations` | GET | citations gained/lost + domains |
| `/api/history/backfill` | POST | replay existing `visibility_runs` into history (idempotent, rate-limited) |
| `/api/history/retention` | GET/PUT | read/update the brand's `history_retention_tier` |

### Cron routes (`src/app/api/cron/*`, CRON_SECRET-gated)
| route | schedule | purpose |
|---|---|---|
| `/api/cron/ensure-history-partitions` | daily `5 0 * * *` | idempotently create missing monthly partitions |
| `/api/cron/history-prune` | daily `15 4 * * *` | the **only** delete path — prune `30d`/`365d` tiers |

Both are registered in `vercel.json`.

---

## 6. UI/UX (`/dashboard/history`)

Server page resolves the brand; `HistoryClient.tsx` (client) renders five tabs:

- **Overview** — stat tiles (first mentioned date, competitors gaining/losing,
  citations gained/lost), first-recommended-by list, competitor movers, prompts
  improving after content activity.
- **Timeline** — chronological feed of events with engine/type filters; severity
  colored dots; honest gaps for missing data.
- **Trends** — recharts line chart (overall + per-engine monthly rate) plus a
  monthly breakdown table. Gaps = months with no runs (never 0%).
- **Competitors** — movers (gaining = threat, losing = win) + monthly mention-rate
  matrix.
- **Citations** — gained/lost chips (domains).

Top bar: **retention tier** select (30d / 365d / unlimited) and **Backfill**
button (replays existing runs; idempotent).

---

## 7. AI Agent integration

`src/lib/history-agent-context.ts` → `buildHistoryContext(brandId)` is called from
`agent-context.ts` on every Agent turn. It feeds the brand's real historical
record (first mentions, competitor movers, citation gains/losses, improving
prompts, engine-change signals) into the system prompt so the Agent can answer
"When did ChatGPT first recommend us?", "Which competitors gained visibility over
12 months?", "Which citations were lost?" — and says so plainly when no history
exists yet.

---

## 8. Caching strategy

`src/lib/history-cache.ts` — a small **in-memory TTL cache** (default 2 min)
keyed by `brandId | endpoint | params`. History only changes on runs, so a short
TTL eliminates redundant dashboard + Agent reads with zero user-visible staleness.

**Why in-memory + brandId-keyed, not a public `Cache-Control` header:** the brand
is resolved from the auth cookie, not the URL. A URL-only CDN cache would leak
brand A's history to brand B. The cache key always contains `brandId`, so
cross-brand leakage is impossible. Writes (`backfill`, `retention` PUT) call
`invalidateHistoryCache(brandId)` so fresh data is visible immediately. Read
routes also send `Cache-Control: private, max-age=60` so the browser can reuse
briefly without caching across users.

---

## 9. Performance considerations

- **Partition pruning**: every query filters on `observed_at`/`occurred_at`, so
  Postgres only scans the relevant monthly partitions.
- **Indexes**: `(brand_id, observed_at)`, `(brand_id, prompt_id, engine_id,
  observed_at)`, `(brand_id, event_type, occurred_at)` cover the common access
  paths.
- **`event_type` is TEXT**, so adding a new event type is code-only — no migration.
- **Future**: a `history_daily_rollup` materialized table could pre-aggregate very
  large brands; not needed at current scale.
- **Caps**: timeline `limit` capped at 500; insights window clamped to 5 years.

---

## 10. Edge cases

- **Partition gap**: if a write lands in a month with no partition, the INSERT
  errors. `ensure_history_partitions()` runs at migration time (+3 months) and
  daily via cron, so the gap window is tiny. The error is caught by
  `safeRecordRunHistory` so it never breaks a visibility run.
- **Backfill idempotency**: `INSERT ... ON CONFLICT (run_id)` skips already-
  recorded runs; event derivation is guarded against duplicates.
- **Pre-016 runs**: replayed with `engine_id=null`; derivation matches on
  `engine_name` (`.is(null)`) so events still derive correctly.
- **Retention**: default `unlimited` → nothing prunes unless the customer opts in.
  Prune deletes oldest events **and** observations (including `raw_response`) per
  the tier contract.
- **Multi-brand orgs**: RLS + `getSelectedBrand()` ensure a user only sees their
  brand's history.
- **No data yet**: every surface shows an explicit "no history yet" state; the
  Agent says so rather than guessing.

---

## 11. Testing

`src/lib/history-engine.test.ts` (vitest) covers the **pure** logic deterministically:
`diffObservation` (every event type, severities, skip handling, first-observation
rules), `bucketTrend` (monthly rates, null-vs-0 honesty), `bucketCompetitorTrend`,
`bucketKey` (day/week/month boundaries), `computeRetentionCutoff` / `isRetentionTier`,
`normalizeResponse`.

Per the project's stated honest gap, there are **no API-route integration tests**
(no DB-backed setup). The IO/read layer is exercised in production via the
existing `visibility-engine` path and is failure-isolated end-to-end.

---

## 12. Rollout plan

1. **Apply `migration_016_history.sql`** in the Supabase SQL editor. Verify
   partitions were created (the migration calls `ensure_history_partitions()` at
   the end; check `history_observations_YYYY_MM` tables exist).
2. **Deploy code** (routes, UI, nav, cron, `vercel.json`). Cron routes are
   CRON_SECRET-gated; Vercel injects the header on cron invocations.
3. **(Optional) Backfill** existing brands: `POST /api/history/backfill` per
   brand (idempotent) or the in-UI button. This replays real `visibility_runs`
   into history so trends are populated immediately.
4. **Cron schedules** take effect on the next deploy. `ensure-history-partitions`
   (daily) and `history-prune` (daily) are both Hobby-tier-safe.
5. **Agent** already consumes history — no change required.

No env vars, no new dependencies, no schema change beyond migration_016.

---

## 13. Files

- `supabase/migration_016_history.sql` — schema, partitions, RLS, partition fn
- `supabase/migration_017_history_alerts.sql` — `history_alerts` table + RLS (negative-event feed)
- `src/lib/history-events.ts` — pure event-diff + trends + retention + aggregation logic
- `src/lib/history-engine.ts` — IO (record, derive, backfill, reads, comparison, prompt drill-down, alerts, prune)
- `src/lib/history-agent-context.ts` — Agent grounding (incl. open-alert summary)
- `src/lib/history-cache.ts` — in-memory TTL cache
- `src/lib/history-engine.test.ts` — unit tests (event-diff, buckets, retention)
- `src/lib/history-aggregation.test.ts` — unit tests (first-mention, movers, prompt improvements, window diff)
- `src/app/api/history/{insights,timeline,trends,competitors,citations,backfill,retention}/route.ts`
- `src/app/api/history/compare/route.ts` — two-window comparison
- `src/app/api/history/prompt/route.ts` — per-prompt observation series + events
- `src/app/api/history/alerts/route.ts` + `src/app/api/history/alerts/[id]/ack/route.ts` — alert list + acknowledge
- `src/app/api/history/export/route.ts` — CSV export (observations | events)
- `src/app/api/prompts/route.ts` — added brand-scoped GET (lists prompts for the drill-down)
- `src/app/api/cron/{ensure-history-partitions,history-prune}/route.ts`
- `src/app/dashboard/history/{page.tsx,HistoryClient.tsx}` — Overview/Timeline/Trends/Competitors/Citations/**Prompts**/**Alerts** tabs, Compare control, Export buttons
- `src/components/dashboard/nav-config.ts` — History nav entry
- `vercel.json` — cron schedules

---

## 14. Operations runbook

**Backfill existing runs (idempotent).** Replays a brand's `visibility_runs` into the
immutable history tables. Safe to run repeatedly (INSERT … ON CONFLICT DO NOTHING on
`run_id`; one alert per event via unique `event_id`). Trigger via the in-UI **Backfill**
button, or `POST /api/history/backfill` (rate-limited 5/min). Backfilled runs carry
`engine_id = null` but a real `engine_name`; event derivation matches on `engine_name`
when `engine_id` is null so two different engines' observations are never diffed against
each other (this was a bug fixed after the initial build — see `deriveAndStoreEvents`).

**Force partition creation.** If writes ever land in a month with no partition (the INSERT
would otherwise fail, caught + reported so it never breaks a run), create the missing
partitions for both history tables:
`GET /api/cron/ensure-history-partitions` with `Authorization: Bearer $CRON_SECRET`.
The daily cron (`5 0 * * *`) also runs this. It creates partitions for the current month
+ the next 3.

**Inspect partitions.**
```sql
select relname from pg_class
where relname like 'history_observations_%' or relname like 'history_events_%'
order by relname;
```

**Verify the prune.** `GET /api/cron/history-prune` (daily `15 4 * * *`,
`Bearer $CRON_SECRET`) is the only delete path. It removes `observations` + `events`
older than the tier cutoff for brands on `30d` / `365d`; `unlimited` brands are skipped.
Check a brand's tier: `select history_retention_tier from brands where id = '<brand>'`.

**History alerts.** Negative timeline events (mention_lost, citation_lost,
competitor_gained, position_dropped, recommendation_lost) are written to `history_alerts`
(one per event, idempotent) at derivation time. Surface them in the dashboard's **Alerts**
tab; acknowledge via `PUT /api/history/alerts/:id/ack` (cookie client, RLS-scoped). Unlike
`history_observations`/`history_events`, `history_alerts` is **not** partitioned (it is
small + negative-only) and is **not** pruned by the retention job.

**Common failure modes.**
- *Visibility run succeeds but no history row appears* → partition for the month is
  missing (see "Force partition creation"). The run itself is unaffected.
- *Comparison/export returns — for an empty window* → that is correct (honesty: no
  fabricated 0%; `rate = null` / `delta = null`).
- *Alerts tab empty after a known mention loss* → confirm `migration_017` was applied and
  the event's `severity` is `negative` (only negative events become alerts).


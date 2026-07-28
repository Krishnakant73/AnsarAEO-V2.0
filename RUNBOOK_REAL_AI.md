# Runbook — Real-AI End-to-End Workflow Validation

The deterministic validation (`validation/workflow-e2e.test.ts`) simulates the
scan because this environment has no engine API keys. To validate the **real**
pipeline (actual ChatGPT/Perplexity/Gemini calls), follow this runbook in your
own environment where the API keys live.

---

## Prerequisites

1. `.env.local` with **real** engine keys:
   - `OPENAI_API_KEY` (chatgpt + classification)
   - `PERPLEXITY_API_KEY` (perplexity)
   - `GOOGLE_AI_API_KEY` (gemini)
   - `GROK_API_KEY` *(optional)* — grok skips without it
   - `COPILOT_API_URL` + `COPILOT_API_KEY` *(optional)* — copilot skips without a proxy
   - `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` *(optional)* — google_ai_overview scrapes without it
2. `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` (already in `.env.local`).
3. Node + `npx tsx` (or use the `node …/vitest.mjs` invocation shown in the report).

> Engines `grok` and `copilot` **skip gracefully** when their keys are absent
> (honest degradation — no fake runs). Only chatgpt/perplexity/gemini need keys.

---

## Step 1 — Seed the sample brand (no simulated scan)

```bash
node scripts/seed-sample-brand.mjs
```

This creates `Zorastra Wellness (sample)` + 1 prompt + 2 competitors + a
**published** industry p50 aggregate + a brand snapshot *below* p50 (so
opportunities are generated). It does **not** insert a scan — we'll do a real
one next.

---

## Step 2 — Run a REAL scan

### Option A — via the validation test (recommended)

Edit `validation/workflow-e2e.test.ts` `beforeAll`, replacing the
**"SIMULATED SCAN"** block (the two `visibility_runs` inserts + citations +
history) with a single real call:

```ts
import { runVisibilityCheck } from "@/lib/visibility-engine";
// ...
const outcomes = await runVisibilityCheck(promptId);
console.log("scan outcomes:", outcomes);
```

Then run:
```bash
npx vitest run --config vitest.e2e.config.ts validation/workflow-e2e.test.ts
```

The rest of the test (opportunities → mission → tasks → verify) now runs
against **real engine responses** for `visibility_runs`.

> Note: `runVisibilityCheck` calls `safeMarkBenchmarkDirty()` (marks the
> snapshot stale) but does not compute it. The seeded snapshot from Step 1
> remains, so `generateOpportunities` still has data. For a fully-real benchmark,
> trigger the benchmark cron after the scan (Step 4 note).

### Option B — via the running app (most realistic)

```bash
npm run dev            # in one terminal
# log in, select the sample brand, open the prompt, click "Run scan"
# or:
curl -X POST http://localhost:3000/api/visibility-check \
  -H "Content-Type: application/json" -H "Cookie: <your-session>" \
  -d '{"promptId":"<prompt-id>"}'
```

---

## Step 3 — Generate opportunities

The test does this automatically (`generateOpportunities`). To do it
standalone via the API:
```bash
curl -X POST http://localhost:3000/api/v1/intelligence \
  -H "Content-Type: application/json" -H "Cookie: <your-session>" \
  -d '{"brandId":"<brand-id>","periodStart":"2026-07-01"}'
```
*(Or just run the validation test — it calls `generateOpportunities` directly.)*

---

## Step 4 — Accept → work tasks → verify

- **Accept** an open opportunity (UI "Accept" button, or the test's
  `acceptOpportunity`): creates a mission + a `content→approve→deploy→verify`
  task sequence.
- **Work tasks** through their states in the dashboard (or the test walks them):
  backlog→todo→in_progress→in_review→done. The **deploy** task is blocked while
  a **pending approval** exists (module 9) — approve it, then complete.
- **Verify**: the `verify` task compares the current `benchmark_brand_snapshots`
  value against the opportunity's baseline/target. To see a *pass*, update the
  snapshot after the "fix" (simulating measured improvement), e.g.:
  ```sql
  update benchmark_brand_snapshots set citation_rate = 0.6
  where brand_id = '<brand-id>';
  ```
  then run/complete the verify task → `verifyTask` writes `verification_result`
  and emits a notification.

> For a real benchmark snapshot instead of the seeded one, run the benchmark
> engine / nightly cron (`/api/cron/nightly-runs` with `CRON_SECRET`) after the
> scan so `benchmark_brand_snapshots` is computed from the actual runs.

---

## Step 5 — Cleanup

```bash
node scripts/seed-sample-brand.mjs --reset
```

---

## Success criteria (same as deterministic run)

- [ ] `visibility_runs` contain **real** engine responses + `mention_verification`
- [ ] `generateOpportunities` returns > 0 open opportunities
- [ ] `acceptOpportunity` creates a mission + `verify` task; opportunity → `acknowledged`
- [ ] deploy task blocked until approval, unblocked after
- [ ] `verifyTask` returns `passed: true` and writes `verification_result`
- [ ] `history_observations` / `history_events` recorded

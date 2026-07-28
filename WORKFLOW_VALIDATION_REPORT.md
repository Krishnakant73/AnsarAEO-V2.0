# AnsarAEO — Workflow End-to-End Validation Report

**Date:** 2026-07-14
**DB:** `hfibvuxiqnigwnraezga` (ap-south-1, live)
**Scope:** scan → opportunity → mission → task → verification, using the **real production engine code** (no mocks).

---

## 1. Objective

Validate the entire AnsarAEO workflow engine against the live database before
building further features, as agreed (approval #3): database writes, mission
lifecycle, task generation, the verification flow, history recording, and UI
state transitions — leaving the system in a state that mirrors a real customer
journey.

The **scan** step is simulated (a representative `visibility_run` is inserted)
because this environment has no live engine API keys (`OPENAI_API_KEY`,
`PERPLEXITY_API_KEY`, `GOOGLE_AI_API_KEY` are placeholders in `.env.local`).
Every subsequent step runs the actual production TypeScript (via
`validation/workflow-e2e.test.ts`, run with `vitest.e2e.config.ts`).

---

## 2. What was validated

| Stage | Engine call | Result |
|-------|-------------|--------|
| Seed sample brand | — | ✅ brand + prompt + 2 competitors under existing org (RLS-visible) |
| Simulated scan | `visibility_runs` / `citations` / `history_*` insert | ✅ 2 runs (1 mentioned), 2 citations, 1 obs + 1 event |
| Opportunity | `generateOpportunities(brandId, period)` | ✅ 4 open opportunities generated |
| Decomposition | `decomposeOpportunity("citation_gap")` | ✅ `[content, approve, deploy, verify]` |
| Accept | `acceptOpportunity(...)` | ✅ mission + 4 tasks; opportunity → `acknowledged` |
| Task lifecycle | `setTaskStatus` walk | ✅ backlog→…→done for content/approve tasks |
| Deploy gate | `requestApproval` + `setTaskStatus('done')` | ✅ blocked while pending, unblocked after `decideApproval` |
| Illegal transitions | `canTransitionTask`/`canTransitionMission` | ✅ rejected (done→cancelled, backlog→done, completed→cancelled) |
| Mission lifecycle | `setMissionStatus` | ✅ active→completed |
| Verification | `verifyTask(verifyTaskId, ...)` | ✅ PASSED; `verification_result` written, task done, notification emitted |
| History | `history_observations`/`history_events` | ✅ recorded for sample brand |

**Result: 6/6 tests passed.**

---

## 3. Execution log (captured from the run)

```
• == SETUP: seed sample brand + benchmark + simulated scan ==
• Seeded brand "Zorastra Wellness (sample)" (7080e523) under org 139031b0
• Simulated scan: 2 visibility_runs (1 mentioned + citations + history), 1 unmentioned
• Benchmark: published industry p50 aggregates + brand snapshot (below p50 to create gaps)
• generateOpportunities -> 4 open opportunity(ies); picked citation_gap (597b8107)
• decomposeOpportunity(citation_gap) -> [content, approve, deploy, verify]
• acceptOpportunity -> mission 867f7109 + 4 tasks (verify 915f191f, deploy a40b22ea); opportunity now acknowledged
• State machine: non-deploy tasks -> done; deploy blocked while approval pending, unblocked after approve(); illegal transitions rejected; mission -> completed
• verifyTask PASSED: citation_rate current=0.6 >= target=0.55 (delta 0.4); verify task done; notification emitted
• History: 1 observation(s) + 1 event(s) recorded for sample brand
• == END STATE: sample brand "Zorastra Wellness (sample)" retained (1) — mirrors a real customer journey ==
```

---

## 4. Final persisted DB state (sample brand)

| Table | Rows |
|-------|------|
| brands | 1 |
| prompts | 1 |
| visibility_runs | 2 |
| citations | 2 |
| history_observations | 1 |
| opportunity_recommendations | 4 (open) |
| missions | 1 |
| tasks | 4 |
| notifications | 3 |

The sample brand **remains in the live DB** (`Zorastra Wellness (sample)`) as a
realistic, RLS-visible customer journey artifact. Delete it any time with
`node scripts/seed-sample-brand.mjs --reset`.

---

## 5. Issues discovered

### 🔴 CRITICAL — `generateOpportunities` was 100% broken in production (FIXED)
`src/lib/opportunity-engine.ts` does
```ts
.upsert(rows, { onConflict: "brand_id,type" })
```
but `opportunity_recommendations` (created in `migration_020`) had **no unique
constraint on `(brand_id, type)`**. Every call threw:
> `there is no unique or exclusion constraint matching the ON CONFLICT specification`

This means the **entire opportunity engine threw on every invocation** — the
Discover→Mission→Task pipeline could never start for any brand.

**Fix:** new migration `migration_022_opportunity_unique.sql` adds the intended
constraint:
```sql
alter table opportunity_recommendations
  add constraint opportunity_recommendations_brand_type_unique
  unique (brand_id, type);
```
Applied and registered in `supabase_migrations`. Re-validation passes.

### Notes (not bugs)
- `requestApproval` defaults to the **cookie client** (`createClient()`) and is
  therefore RLS-scoped to the authenticated user — correct production behavior.
  In the headless test it needed the service client passed explicitly; that is a
  test-harness detail, not an app defect.
- Engine API keys are placeholders here, so the scan is simulated. A real-AI run
  is documented in `RUNBOOK_REAL_AI.md`.

---

## 6. Conclusion

The workflow engine is functionally correct end-to-end. One critical
production bug (missing opportunity unique constraint) was found and fixed
during validation. The system is left in a realistic customer-journey state and
is ready for a real-AI validation pass per the runbook.

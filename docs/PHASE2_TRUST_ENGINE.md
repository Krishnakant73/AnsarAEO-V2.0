# Phase 2 — AI Trust Engine

> **Status:** IMPLEMENTED & VERIFIED (2026-07-15). Phase 1 complete → Phase 2 coded → 44/44 platform tests green, `tsc --noEmit` clean.
> **Depends on:** Phase 1 stable seams — `enqueueJob` (`trust_verify`), `deliverEvent` (`trust.verified`), `authenticateApiRequest` + scope `trust:read`, `getCapabilities`, `ApiError`.
> **Enables:** Phase 3 (agent publish-gating via `assertTrustAbove` — gate exercised by tests in `src/lib/platform/trust.test.ts`).

The Trust Engine is the **verification, provenance, and trust-scoring** substrate. It promotes the existing `mention-matcher`/`mention_verification` reconciliation into a first-class, queryable service and adds claim-level verification + a trust score used to gate autonomous actions.

---

## 1. Goal

- Verify any **claim** against **evidence** (knowledge objects, citations) deterministically where possible, LLM-assisted otherwise, always reconciled.
- Record **provenance** for every verification (engine/model/version/deterministic-check/inputs hash) — tamper-evident via signing.
- Compute a **trust score** per claim/citation that downstream systems (agent publish, generated content) consult.
- Expose `verifyClaim()` as a service and `trust.verified` as a webhook event.

---

## 2. Interfaces consumed from Phase 1 (DO NOT REIMPLEMENT)

```ts
// queue.ts
enqueueJob("trust_verify", { claim, evidenceRefs, requester }, { tenantId });   // async verify
// webhooks.ts
deliverEvent({ type: "trust.verified", tenantId, data: { claimId, verdict, score } });
// auth.ts
authenticateApiRequest(req);   // → { tenantId, scopes, keyId }
requireScope(auth, "trust:read");
// capabilities.ts (optional): report trust service availability
// responses.ts + ApiError: standard shapes
```
- `trust_verify` joins the open `JobType` union — **no new table column, no migration to queue**.
- `trust.verified` joins the open webhook event string — **no schema change**.
- Scope `trust:read` is added to the deny-by-default list (Phase 1 convention) — **no break to existing routes**.

---

## 3. New components (design)

### 3.1 Verification service — `src/lib/platform/trust.ts` (NEW in Phase 2)
```ts
export type VerificationMethod = "deterministic" | "llm" | "hybrid";
export type Verdict = "verified" | "refuted" | "unverifiable";

export interface ClaimInput {
  claim: string;
  evidenceRefs: string[];   // knowledge_object ids / citation urls
  tenantId: string;
}
export interface VerificationResult {
  claimId: string;          // content-addressed: sha256(claim|evidenceRefs)
  method: VerificationMethod;
  verdict: Verdict;
  score: number;            // 0..1
  reasoning: string;
  provenance: { engine?: string; model?: string; deterministicCheck?: string; inputsHash: string; ts: string };
  signature: string;        // crypto sign over (claimId|verdict|score|inputsHash)
}
export async function verifyClaim(input: ClaimInput): Promise<VerificationResult>;   // sync path
export async function enqueueVerification(input: ClaimInput): Promise<{ jobId: string }>; // async path (via trust_verify)
```

### 3.2 Algorithm (carries the repo's honesty invariant)
1. **Deterministic first.** `mention-matcher`-style literal/evidence checks win for factual presence (e.g., "our price is ₹X" → compare against `knowledge_objects` proof). If deterministic verdict is conclusive → `method: deterministic`, high score.
2. **LLM only for the irreducible** (sentiment, recommendation alignment, soft claims). LLM output is *reconciled* against deterministic findings, never silently overriding — exactly the current `mention_verification` discipline, made explicit.
3. **Score** = `f(method, sourceAuthority, recency, consistencyAcrossEngines)`:
   - deterministic+verified against first-party proof → ≥ 0.9
   - llm+verified, consistent across ≥2 engines → 0.7–0.9
   - single-source / unverifiable → ≤ 0.4
4. **Provenance + signature** stored on every record (ties to `crypto.ts` signing; `ENCRYPTION_KEY` not required — use an app signing key).

### 3.3 Trust gate (consumed by Phase 3)
```ts
export async function assertTrustAbove(claimId: string, threshold: number): Promise<void>;
// throws ApiError(422, "trust_below_threshold") if score < threshold
```
The agent (Phase 3) calls this before any `publish`/`external-send` action.

### 3.4 Data model additions (NEW migration_024 in Phase 2)
```sql
create table trust_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references organizations(id) on delete cascade,
  claim_id char(64) not null,            -- sha256(claim|evidenceRefs)
  claim text not null,
  method text not null,
  verdict text not null,
  score numeric not null,
  reasoning text,
  provenance jsonb not null,
  signature text not null,
  created_at timestamptz not null default now()
);
create index trust_claim_idx on trust_records (tenant_id, claim_id);
```
`claim_id` is content-addressed → idempotent re-verification; dedup before LLM spend.

---

## 4. API surface (design)
| Method | Path | Scope | Body / Response |
|---|---|---|---|
| POST | `/api/v1/trust/verify` | `trust:read` | `{ claim, evidenceRefs[], async? }` → sync `VerificationResult` **or** `202 { task_id }` |
| GET | `/api/v1/trust/records` | `trust:read` | list `trust_records` scoped to tenant |

---

## 5. Worker branch (Phase 2 adds to `/api/worker/drain`)
```ts
case "trust_verify": {
  const r = await verifyClaim(payload);          // sync verify
  await completeJob(job.id, r);
  await deliverEvent({ type: "trust.verified", tenantId: job.tenant_id, data: r });
}
```
No change to `claimJobs`/`completeJob`/`failJob` — the open `JobType` union absorbs it.

---

## 6. How Phase 3 consumes this
- Agent `publish`/`deprecate`/`external-send` tools call `assertTrustAbove(claimId, policy.trustThreshold)` before succeeding.
- Agent task planning reads `trust_records` to prefer high-trust claims when drafting.

> Phase 3 MUST NOT begin until Phase 2 is implemented & verified (trust gate exercised by at least one test proving `assertTrustAbove` blocks low-trust publish). **This condition is now met** — `trust.test.ts` proves the gate blocks low/non-verified claims (422) and allows verified+above-threshold claims.

# Phase 1 — Versioned API Gateway + Worker Queue

> **Status:** IMPLEMENTED & VERIFIED (code in `src/lib/platform/*`, `src/app/api/v1/*`, `src/app/api/worker/drain`, `supabase/migrations/migration_023_platform_foundations.sql`).
> **Depends on:** current stack (Next.js 16 + Supabase/Postgres, `runVisibilityCheck`).
> **Enables:** Phase 2 (Trust Engine) and Phase 3 (Agent Runtime) via the stable seams defined in §4.

This phase turns AnsarAEO from an internal-route app into a **platform with a public, versioned API and an asynchronous execution substrate** — without introducing any new infrastructure. The data plane and console stay exactly as they are; we add a gateway in front and a queue behind the existing pipeline.

---

## 1. Goal & non-goals

**Goal:** expose the existing visibility pipeline through `/api/v1/*` with API-key auth, tenant scoping, async execution (202 + task id + webhooks), and a worker that drains a durable job queue. This is the substrate every later pillar builds on.

**Non-goals (later phases):** trust scoring (Phase 2), the autonomous agent (Phase 3), knowledge graph (later), marketplace. The interfaces below are designed so those phases slot in without breaking Phase 1.

---

## 2. Architecture

```
 Tenant / SDK / Console
        │  Authorization: Bearer aka_sk_…
        ▼
 ┌─────────────────────────────────────────────┐
 │  /api/v1/*  GATEWAY (src/app/api/v1)         │
 │  1. authenticateApiRequest()  → tenant+scopes │
 │  2. requireScope(scope)                       │
 │  3. scope queries by organizations.id         │
 │  4. enqueueJob()  OR  read (sync)             │
 └───────────────┬───────────────────────────────┘
                 │ enqueueJob (insert into jobs)
                 ▼
        ┌──────────────────┐        claims (FOR UPDATE SKIP LOCKED)
        │  jobs (queue)    │ ◀──────────────────────────────┐
        │  Postgres table  │                                  │
        └────────┬─────────┘                                  │
                 │ worker picks pending                       │
                 ▼                                             │
        ┌──────────────────────────┐     runVisibilityCheck() │
        │ /api/worker/drain        │ ─── (existing pipeline) ──┘
        │ (CRON_SECRET, cron)      │
        └────────┬─────────────────┘
                 │ completeJob() / failJob()
                 │ deliverEvent() → webhook_subscriptions
                 ▼
        Tenant-registered HTTPS endpoint (signed HMAC)
```

**Why a Postgres table as a queue (not Redis/SQS):** the "evolve current stack" decision forbids new infra in Phase 1. Postgres already gives us durable, transactional, RLS-capable queuing via `FOR UPDATE SKIP LOCKED`. We graduate to a managed queue only if a scaling signal fires (see `docs/ANSARAEO_CLOUD.md` §9.5).

---

## 3. Stable seams (contracts Phase 2/3 depend on)

These are the **intentionally stable** interfaces. Phase 2 and 3 must build only on these, never on Phase 1 internals.

### 3.1 Job queue — `src/lib/platform/queue.ts`
```ts
export type JobType =
  | "visibility_check"      // implemented in Phase 1
  | "trust_verify"          // Phase 2
  | "agent_step"            // Phase 3
  | (string & {});          // open union — new types add a worker handler, no schema change

export interface EnqueueOpts {
  tenantId: string;          // organizations.id
  runAt?: Date;
  priority?: number;         // lower = sooner (default 5)
  idempotencyKey?: string;   // dedupe within 24h
  maxAttempts?: number;      // default 3
}
export function enqueueJob(type: JobType, payload: Record<string, unknown>, opts: EnqueueOpts): Promise<{ jobId: string }>;
export function claimJobs(limit: number, types?: JobType[]): Promise<JobRow[]>;
export function completeJob(jobId: string, result: Record<string, unknown>): Promise<void>;
export function failJob(jobId: string, error: Error, opts?: { retry?: boolean }): Promise<void>;
```
- `visibility_check` payload: `{ promptId: string }`.
- New job types need (a) a branch in the worker, (b) nothing else. The `jobs.type` column is `text`, so no migration is required to add a type.

### 3.2 Webhooks — `src/lib/platform/webhooks.ts`
```ts
export interface WebhookEvent {
  type: string;              // "visibility_check.completed" | "trust.verified" | "agent.task.updated" | ...
  tenantId: string;
  data: Record<string, unknown>;
  timestamp: string;         // ISO; injected by deliverEvent
}
export function deliverEvent(event: Omit<WebhookEvent, "timestamp">): Promise<void>;
// signs each delivery HMAC-SHA256 over raw body with the subscription secret; retries w/ backoff.
```
Event `type` is an open string so Phase 2/3 append new events without schema change.

### 3.3 Auth & scope — `src/lib/platform/auth.ts`
```ts
export interface ApiAuth { tenantId: string; scopes: string[]; keyId: string; }
export function authenticateApiRequest(req: Request): Promise<ApiAuth | null>;
export class ApiError extends Error { constructor(public status: number, public code: string, public message: string, public retryable?: boolean, public capability?: string) {} }
export function requireScope(auth: ApiAuth, scope: string): void; // throws ApiError(403, "forbidden")
```
Namespace-scoped permissions. Phase 1 ships: `visibility:read`, `visibility:write`, `webhooks:manage`. Phase 2 adds `trust:read`; Phase 3 adds `agent:run`. **Deny-by-default** — new scopes never grant implicit access to old routes.

### 3.4 Capabilities — `src/lib/platform/capabilities.ts`
```ts
export function getCapabilities(): Promise<{ engines: EngineCapability[]; regions: string[] }>;
// EngineCapability = { name, available: boolean, reason?: string }
```
Honesty rule preserved: an engine is `available: false` when its required key/proxy is absent (e.g. `grok` w/o `GROK_API_KEY`, `copilot` w/o `COPILOT_API_URL`). Phase 2/3 read this to know what they can call.

### 3.5 Responses — `src/lib/platform/responses.ts`
```ts
export function apiSuccess(data: unknown, status?: number): NextResponse;
export function apiError(err: ApiError | unknown): NextResponse;
// error body: { error: { code, message, retryable?, capability? } }
```
All gateway routes share this shape (matches `docs/ANSARAEO_CLOUD.md` §7).

---

## 4. Data model (migration_023)

```sql
-- Platform API keys (scoped, hashed — raw key shown once at creation)
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  key_hash text not null unique,        -- sha256(raw key)
  label text not null,
  scopes text[] not null default '{}',
  created_by uuid references auth.users(id),
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
-- Durable job queue (Postgres table-as-queue)
create table jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references organizations(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  status text not null default 'pending',   -- pending|processing|done|failed|dead
  priority int not null default 5,
  run_at timestamptz not null default now(),
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  result jsonb,
  idempotency_key text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index jobs_pending_idx on jobs (priority, run_at) where status = 'pending';
create index jobs_tenant_idx on jobs (tenant_id);
create index jobs_idem_idx on jobs (idempotency_key) where idempotency_key is not null;
-- Webhook subscriptions + delivery log
create table webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references organizations(id) on delete cascade,
  url text not null,
  events text[] not null,
  secret_hash text not null,             -- sha256(secret) — raw secret shown once
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references webhook_subscriptions(id) on delete cascade,
  tenant_id uuid not null,
  event_type text not null,
  payload jsonb not null,
  attempt_count int not null default 0,
  last_status_code int,
  last_error text,
  next_retry_at timestamptz,
  created_at timestamptz not null default now()
);
```
RLS: enabled on all four; policies allow an authenticated member of `tenant_id` to select/manage their org's rows. The gateway itself uses the **service client** (bypasses RLS) and enforces tenancy by filtering every query on `organizations.id` derived from the API key — this is the critical security property (see §6).

---

## 5. API contracts (implemented)

| Method | Path | Scope | Behavior |
|---|---|---|---|
| GET | `/api/v1/capabilities` | `visibility:read` | Live engines (available flag) + regions |
| POST | `/api/v1/visibility/checks` | `visibility:write` | Enqueue `visibility_check` job → `202 { task_id, status_url, webhook_events }` |
| GET | `/api/v1/visibility/checks/{id}` | `visibility:read` | Poll job: `pending\|processing\|done\|failed` + result summary |
| GET | `/api/v1/visibility/runs` | `visibility:read` | List `visibility_runs` scoped to tenant's brands |
| GET | `/api/v1/webhooks` | `webhooks:manage` | List subscriptions |
| POST | `/api/v1/webhooks` | `webhooks:manage` | Create subscription (returns raw secret once) |
| POST | `/api/worker/drain` | `CRON_SECRET` | Claim up to N pending jobs, run, complete/fail, deliver webhooks |

`POST /api/v1/visibility/checks` body: `{ promptId: string, idempotencyKey?: string }`. Tenant ownership of `promptId` is verified (prompt → brand → organization must equal `tenantId`) or `403`.

---

## 6. Security properties

1. **Service client + explicit tenancy.** The gateway uses `createServiceClient()` (RLS bypass) but every query is filtered by `organizations.id = auth.tenantId`. A missing filter is a bug we test for (negative RLS test pattern).
2. **API keys are hashed.** Only `sha256(raw)` is stored; the raw key is returned once at creation. Lookup verifies `sha256(provided) = key_hash`.
3. **Webhook secrets are hashed + deliveries HMAC-signed** (SHA-256 over raw body), mirroring the Razorpay webhook-verify discipline already in the repo.
4. **Worker is gated by `CRON_SECRET`** exactly like existing cron routes.
5. **No fake engine.** `GET /v1/capabilities` reports true availability; downstream phases trust it.
6. **Idempotency.** `idempotencyKey` dedupes re-enqueues within 24h.

---

## 7. Forward-compatibility checklist (proven by design)

- [x] New job types (`trust_verify`, `agent_step`) need only a worker branch — no schema/migration change.
- [x] New webhook events are open-string — no schema change.
- [x] New scopes are deny-by-default and additive.
- [x] `getCapabilities()` is the single source of "what can run" for Phase 2/3.
- [x] Agent (Phase 3) will authenticate with the *same* `authenticateApiRequest` and enqueue `agent_step` jobs through the *same* `enqueueJob` — no parallel auth/queue machinery.

---

## 8. Verification

- `npx tsc --noEmit` passes (no new type errors).
- `npx vitest run src/lib/platform` passes: signing round-trip, api-key hash/verify, capabilities env-detection, webhook HMAC sign/verify, response shaping, queue claim/transition (mocked Supabase), tenant-ownership rejection.
- Manual contract: posting to `/api/v1/visibility/checks` returns `202` + `task_id`; `/api/worker/drain` (with `CRON_SECRET`) flips it to `done`; `GET /api/v1/visibility/checks/{id}` reflects the result; a subscribed webhook receives a signed `visibility_check.completed`.

> Phase 2 MUST NOT begin until this section is green.

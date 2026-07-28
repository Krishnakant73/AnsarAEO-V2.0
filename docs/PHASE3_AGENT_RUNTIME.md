# Phase 3 — AI Discovery Agent Runtime

> **Status:** IMPLEMENTED & VERIFIED (2026-07-15). Phase 1 + Phase 2 complete →
> Phase 3 coded → 20/20 agent tests green, 64/64 platform tests green,
> `tsc --noEmit` clean. All interfaces from Phases 1–2 were consumed unchanged;
> no new job-type migrations were needed (the open `JobType` union absorbed
> `agent_step`).
> **Depends on:** Phase 1 (`authenticateApiRequest`, `enqueueJob`/`agent_step`, `deliverEvent`/`agent.task.updated`, `ApiError`, `getCapabilities`) + Phase 2 (`verifyClaim`, `assertTrustAbove`).
> **Enables:** autonomous, governance-gated discovery operations.

The Discovery Agent is an **autonomous, tool-using operator** that plans and executes discovery work on a tenant's behalf (improve visibility for X, find prompts lost to competitor Y, draft a fix). It is the *operator* of the platform — not a chatbot.

---

## 1. Goal

- Planner → executor → verifier loop over a goal.
- **Tools = the public API** (the agent is a scoped API client, never a DB superuser).
- Human-in-loop approval for state-changing/external actions (Governance).
- Every action provably scoped, metered, auditable, and trust-gated (Phase 2).

---

## 2. Interfaces consumed (DO NOT REIMPLEMENT)
```ts
// Phase 1
authenticateApiRequest(req);                 // agent tasks authenticated like any API call
requireScope(auth, "agent:run");             // new deny-by-default scope
enqueueJob("agent_step", { taskId, step }, { tenantId });   // each step is a durable job
deliverEvent({ type: "agent.task.updated", tenantId, data: { taskId, state } });
getCapabilities();                           // what engines/trust are callable
// Phase 2
verifyClaim(input);  assertTrustAbove(claimId, threshold);
```

---

## 3. Architecture
```
goal + policy_id
      │
      ▼
 PLANNER      → decomposes into a step graph (discover → check → analyze → draft → [approve] → publish → verify)
      │
      ▼
 EXECUTOR     → for each step: call a TOOL (the public API as a scoped client)
      │            tools: listPrompts, runVisibilityCheck, getRuns, generateDraft,
      │                   verifyClaim, requestApproval, publishKnowledge, sendWebhook
      ▼
 VERIFIER     → every side-effect checked vs deterministic services + assertTrustAbove
      │            before being reported done; plans are inspectable & replayable
      ▼
 HUMAN-IN-LOOP → publish/deprecate/external-send route to Governance approval queue
```
**Tool sandbox:** tools are the `/v1` API surface. The agent holds an API key whose scopes ∩ policy guardrails bound what it can do. A compromised agent cannot exceed its key — this is the core safety property.

---

## 4. New components (design)

### 4.1 Agent service — `src/lib/platform/agent.ts` (NEW in Phase 3)
```ts
export interface AgentGoal {
  goal: string;
  brandId: string;
  policyId: string;
  guardrails?: { maxExternalSends?: number; requireApproval?: ("publish"|"deprecate"|"external_send")[] };
}
export interface AgentTask {
  id: string;
  state: "planning"|"executing"|"awaiting_approval"|"done"|"failed";
  plan: AgentStep[];
}
export async function createAgentTask(goal: AgentGoal, auth: ApiAuth): Promise<{ taskId: string }>;
export async function planTask(taskId: string): Promise<AgentStep[]>;   // planner
export async function executeStep(taskId: string, step: AgentStep): Promise<StepResult>; // executor (calls tools)
export async function approveStep(taskId: string, stepId: string, approver: ApiAuth): Promise<void>; // HITL
```

### 4.2 Data model — `agent_tasks` (NEW migration_025 in Phase 3)
```sql
create table agent_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references organizations(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  policy_id uuid references governance_policies(id),
  goal text not null,
  state text not null default 'planning',
  plan jsonb,
  guardrails jsonb,
  created_at timestamptz not null default now()
);
create table governance_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  rules jsonb not null,     -- engines, guardrails, required approvals, trust threshold
  updated_at timestamptz not null default now()
);
create table approval_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references agent_tasks(id),
  step_id text not null,
  action text not null,     -- publish|deprecate|external_send
  status text not null default 'pending',  -- pending|approved|rejected
  decided_by uuid references auth.users(id),
  decided_at timestamptz
);
```

### 4.3 Worker branch (Phase 3 adds to `/api/worker/drain`)
```ts
case "agent_step": {
  const res = await executeStep(payload.taskId, payload.step);   // executor calls tools
  await completeJob(job.id, res);
  await deliverEvent({ type: "agent.task.updated", tenantId: job.tenant_id, data: { taskId: payload.taskId, state: res.state } });
}
```

### 4.4 API surface (design)
| Method | Path | Scope | Behavior |
|---|---|---|---|
| POST | `/api/v1/agent/tasks` | `agent:run` | create task → `202 { task_id, plan }` |
| GET | `/api/v1/agent/tasks/{id}` | `agent:run` | poll state |
| POST | `/api/v1/agent/tasks/{id}/approve` | `agent:run` | human-in-loop approval of a step |
| GET/PUT | `/api/v1/governance/policies` | `webhooks:manage`* | manage org policy (scope TBD) |

---

## 5. Safety invariants (carried from platform principles)
1. Agent = scoped API client; **no direct DB access**.
2. `publish`/`deprecate`/`external_send` **always** gated by Governance approval (policy default).
3. Every publish pre-checked by `assertTrustAbove` (Phase 2) — low-trust claims cannot be published.
4. Plans are **inspectable & replayable** (provenance) — no black-box autonomy in an enterprise trust product.

> Implementation begins only after Phase 2 is verified — **this condition was met**
> (Phase 2 verified; `assertTrustAbove` blocks low-trust publish). Phase 3 is now
> coded and verified (see status header). The 3 unrelated failures in
> `src/lib/intelligence-math.test.ts` are pre-existing and outside this scope.

### 5.1 Post-approval fan-out — WIRED (not a stub)
`approveStep` accepts an injectable `AgentActionDeps` (tests fake it; `REAL_ACTION_DEPS` wires the production effects). Once a step is approved, and **only** then, the gated action executes for real:
- `publish` → `publishKnowledge()` inserts a `content_items` row (`status: published`) linked to the trust-gated `claim_id`; the published `content_markdown` is the **verified claim text**, never invented prose (HONESTY DESIGN).
- `deprecate` → `deprecateKnowledge()` reversibly unpublishes the claim's item (`status` → `draft`, `approved_*` cleared), found by `brand_id` + `claim_id`.
- `external_send` → `sendWebhook()` fires a signed `agent.external_send` webhook event to the tenant's subscriptions via the Phase 1 `deliverEvent` pipeline.
- A failing action marks the step/task `failed` rather than `done`. `migration_026` adds the `claim_id` link on `content_items` so publish↔deprecate are traceable + reversible.

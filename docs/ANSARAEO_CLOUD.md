# AnsarAEO Cloud — Infrastructure for AI Discovery

> *The control plane for how the world's brands are found, understood, and trusted by AI.*
>
> Design charter for evolving AnsarAEO from a single-tenant-aware SaaS into a multi-tenant **cloud platform** — the AWS/Stripe/Snowflake analog for the AI-first internet. Authored as the CTO/CPO/CAIO/Cloud Architect view. Anchored on the **current stack** (Next.js 16 + Supabase/Postgres + Auth/RLS) and evolved in place before introducing dedicated infrastructure.

---

## 0. How to read this document

| Section | Audience | Depth |
|---|---|---|
| 1–4 Vision, principles, baseline, target architecture | Exec / all | Strategy |
| 5 The 15 pillars | Product + Eng | Architecture altitude + contracts for the load-bearing 4 |
| 6–8 Data model, API surface, SDK | Eng | Concrete |
| 9–12 Security, scale, permissions, compliance | Eng + Security | Concrete |
| 13–15 Testing, migration, rollout | Eng + GTM | Plan |

Everything here is **grounded**: where something already exists in the repo, it is named and extended rather than redesigned. Where the vision outruns the current code, the gap is called out as a **build target** with a phase.

---

## 1. Vision & positioning

### 1.1 The thesis

Search is being replaced by **answering**. The surface that decides whether a brand is recommended is no longer a ranked list of blue links — it is the training data, retrieval corpus, and prompt-time reasoning of ChatGPT, Perplexity, Gemini, Google AI Overviews, Copilot, and Grok (today's 6 engines; dozens more coming).

AnsarAEO today answers one question well: *"Is my brand mentioned when a relevant question is asked of an AI engine, and why not?"*

**AnsarAEO Cloud** answers the platform question: *"How does every enterprise **manage, optimize, automate, and understand** every dimension of its AI discovery — as a managed service, via API, SDK, agent, and console?"*

The analogy set:

| AWS gave | Stripe gave | Snowflake gave | OpenAI Platform gave | **AnsarAEO Cloud gives** |
|---|---|---|---|---|
| Compute/storage primitives | Payments as API | Warehouse as service | Intelligence as API | **AI discovery as managed infrastructure** |
| EC2/S3/IAM | Charges/Subscriptions | Shared data + governance | Models + evals | Knowledge Cloud, Discovery APIs, Graph, Trust, Agent |

We are not a "dashboard vendor." We are the **trust + retrieval substrate** between enterprises and the models that answer on their behalf.

### 1.2 The decade framing

- **2026–2027 (now → platform):** Multi-tenant SaaS → platform with public API + SDK; enterprises programmatically manage discovery.
- **2028–2029 (graph + trust):** Enterprise Knowledge Graph + Brand Digital Twin + AI Trust Engine become the data backbone; the Global Discovery Graph becomes a shared intelligence asset.
- **2030–2035 (open economy):** Marketplace + Open Platform + Research Center turn AnsarAEO Cloud into the **default substrate** that third parties build discovery/trust products on — the "app store + AWS" of AI citation.

### 1.3 Non-negotiable product truths (carried from today)

These constraints from `CLAUDE.md` are **non-negotiable** and shape the cloud design:

1. **Honesty by design** — generation is always a *draft* with `[ADD …]` placeholders for owner-only facts. The cloud never fabricates report sections for stateless features. This becomes a **platform invariant**: every generated artifact carries provenance + a confidence/draft flag.
2. **Deterministic over LLM self-report** — literal brand-name presence is decided by `mention-matcher.ts`, not the model. The cloud promotes this to a first-class **Verification/Trust service**.
3. **No fake engine** — `grok` skips without a key, `copilot` skips without a proxy. The cloud is explicit about *capability availability per tenant/region*.
4. **Per-engine failure isolation** (`Promise.allSettled`) — the platform never lets one engine's outage sink a run.
5. **Razorpay lazy-init**, **`ENCRYPTION_KEY` AES-256-GCM** for creds, **RLS org-scoped** — security primitives that the cloud inherits and hardens.

---

## 2. Platform principles

1. **Data plane stays Supabase/Postgres.** Tenant data remains in Postgres behind RLS. We do not rewrites the data layer; we *wrap and extend* it. Multi-tenancy is already solved by `org_members → brands → …` RLS funnel.
2. **Control plane is additive.** New capabilities (API gateway, agent runtime, graph store, event bus, OLAP) are *added around* the existing app, not by replacing it. The Next.js app becomes one *tenant console + internal API* among several platform surfaces.
3. **Everything is an API.** Every feature reachable in the console is reachable via a versioned, authenticated API and SDK. The console is just the first customer of the platform API (dogfooding = "eat our own API").
4. **Deterministic core, probabilistic edge.** Parsing, matching, validation, and graph traversal are deterministic and unit-tested. Only classification/sentiment/recommendation use LLMs, and always reconciled against the deterministic layer.
5. **Provenance everywhere.** Every mention, citation, score, and generated artifact records *how it was computed* (engine, model, version, deterministic check, timestamp). This is the foundation of the Trust Engine and of compliance.
6. **Capability-aware, not feature-faking.** The platform reports exactly what it can and cannot do per engine/tenant/region. "Skipped" is a first-class, queryable state.
7. **India-first, globally scalable.** INR pricing, multilingual (starting with Indic languages), DPDP Act 2023 compliance, then GDPR/CCPA. Multi-region starts with `ap-south-1` (existing Supabase) and adds `us`/`eu` for Global Discovery Graph replicas.
8. **Migrations are sequential and replayable.** `schema.sql → migration_002…011 → 015 → 0xx`. The cloud adds a migration ledger with forward/rollback and zero-downtime apply.

---

## 3. Current-state baseline (what exists)

This is the jump-off point. All grounded in the repo.

### 3.1 Stack
- **App:** Next.js 16 (App Router) + React 19 + TypeScript; Tailwind v4; `@base-ui/react`; `@react-pdf/renderer` (shared PDF); `recharts`.
- **Data:** Supabase = Postgres + Auth + RLS. Service client (`createServiceClient()`) bypasses RLS for trusted server work; cookie client enforces RLS for user queries.
- **Engine connectors:** `src/lib/visibility-engine.ts` → `ENGINE_CALLERS` registry for `chatgpt`, `perplexity`, `gemini`, `google_ai_overview`, `grok`, `copilot`.
- **Classification:** `gpt-4o-mini` JSON-mode, reconciled vs `src/lib/mention-matcher.ts`.
- **Module catalog (already substantial):** content-engine, content-optimizer, pdp-generator, answer-blocks, fanout-coverage, geo-linter, llms-txt-validator, robots-validator, schema-for-ai, site-audit-engine, ai-index-generator, internal/header-link-graph, topical-coverage, token-bloat, price-factcheck, blind-discovery, visibility-consistency (`callEngine`), competitor-intel, content-gap, social-signals, brand-perception, gbp-audit, gsc, revenue-attribution, crypto (AES-256-GCM), whatsapp, razorpay, reports/report-document, agent-context.
- **Scheduling:** `vercel.json` cron → `/api/cron/nightly-runs`, `/api/whatsapp/send-digest`, gated by `CRON_SECRET`.
- **Billing:** Razorpay (lazy-init `getRazorpay()`), INR.
- **Secrets:** `ENCRYPTION_KEY` (32-byte hex) for integration creds; never plaintext/committed/logged.

### 3.2 Domain model (today)
`orgs → brands → prompts (language-tagged) → visibility_runs (prompt × engine; raw_response, brand_mentioned, citations, competitor_mentions JSONB, mention_verification JSONB)`. Plus `competitors`, `content_items`, `integrations`, `site_audits`, `payments/plan_limits`, `agent_conversations`, `brand_positioning/brand_perception`.

### 3.3 What this baseline gives the cloud for free
- RLS-based multi-tenancy (no re-architecture needed for tenant isolation).
- A working 6-engine acquisition + classification pipeline.
- ~30 production modules covering content, audit, competitor, perception, billing — each a candidate **cloud microservice boundary**.
- Proven honesty/determinism discipline.
- Supabase Auth (SSO-ready) + Razorpay billing.

### 3.4 The gaps the cloud must close
| Gap | Today | Cloud target |
|---|---|---|
| API surface | Internal `/api/*` + cron | Versioned **public** platform API + SDK |
| Orchestration | Cron-only, synchronous-ish | **Event-driven** queue + workers, fan-out |
| Knowledge | `prompts` + `visibility_runs` only | **AI Knowledge Cloud** (structured, versioned, retrievable) |
| Graph | None (JSONB blobs) | **Enterprise Knowledge Graph** + **Global Discovery Graph** |
| Agent | `agent-context` (chat only) | **Autonomous AI Discovery Agent** (plan/act/verify) |
| Trust | `mention_verification` JSONB | **AI Trust Engine** (provenance, verification, scoring) |
| Console | Single Next.js app | **Enterprise Console** + **Open Platform** |
| Governance | plan_limits only | **Governance Layer** (policy, approval, audit) |
| Compliance | Implicit | **Compliance Layer** (DPDP/GDPR/SOC2) |
| Research | None | **Research Center** (eval, benchmarks, red-team) |

---

## 4. Target architecture (layered)

```
                         ┌──────────────────────────────────────────────────────────┐
   Developers/ISVs  ───▶ │                   OPEN PLATFORM / MARKETPLACE             │
   Enterprise admins ──▶ │              ENTERPRISE CONSOLE (Next.js 16)              │
   AI Agents ──────────▶ │              AI DISCOVERY AGENT RUNTIME                   │
                         └───────────────────────────┬──────────────────────────────┘
                                                     │  (all surfaces call the same API)
                         ┌───────────────────────────▼──────────────────────────────┐
                         │              PLATFORM API GATEWAY  (v1, authN/Z, quota)   │
                         │   rate-limit · tenant-routing · capability-negotiation     │
                         └───────┬───────────────┬───────────────┬───────────────────┘
                                 │               │               │
                ┌────────────────▼───┐   ┌────────▼────────┐  ┌──▼───────────────────┐
                │ CONTROL PLANE      │   │ EVENT BUS        │  │ AGENT RUNTIME        │
                │ • entitlements     │   │ (queue + workers)│  │ • planner/executor   │
                │ • orchestration    │   │ • nightly runs   │  │ • tool sandbox       │
                │ • billing/metering │   │ • webhooks        │  │ • human-in-loop      │
                └─────────┬──────────┘   └────────┬─────────┘  └──┬───────────────────┘
                          │                       │                │
        ┌─────────────────▼───────────────────────▼────────────────▼───────────────┐
        │                        SERVICE MESH (microservices)                        │
        │  Knowledge · Discovery · Graph · Trust · Twin · Compliance · Governance ·  │
        │  Research · Marketplace · Reporting · Billing                            │
        └───────────────────────────────┬─────────────────────────────────────────┘
                                         │
            ┌────────────────────────────▼────────────────────────────┐
            │                    DATA PLANE (tenant-scoped)            │
            │  Supabase/Postgres (RLS) · pgvector · graph schema       │
            │  + OLAP replica (Global Discovery Graph analytics)        │
            │  + object store (knowledge artifacts, PDFs, exports)      │
            └─────────────────────────────────────────────────────────┘
```

**Key architectural decision (respects "evolve current stack"):** The data plane and the Next.js console remain Supabase/Postgres/Next.js. The *control plane, event bus, agent runtime, and service mesh* are added as **new services in the same repo/monorepo** (or a sibling `platform/` workspace) that talk to Postgres via the existing service client pattern. We do **not** migrate to Kubernetes in Phase 1–2. We earn the right to add dedicated infrastructure (graph DB, OLAP, multi-region) only when Postgres shows a limit (see §9.5).

---

## 5. The 15 pillars

Each pillar: **What it is · What exists today · Build target · API/SDK surface · Key decisions.** The first four (Knowledge Cloud, Discovery APIs, Agent, Knowledge Graph) get concrete contracts; the rest are at architecture altitude with their boundary defined.

---

### 5.1 AI Knowledge Cloud

**What it is.** The enterprise's *structured, versioned, machine-readable memory* that AI engines should retrieve and cite. The canonical source of truth for "what this brand is, offers, proves, and claims" — feedstock for both optimization and for the models themselves (via llms.txt / GBP / structured data / direct ingestion partnerships).

**What exists today.** Fragmented across `prompts`, `visibility_runs`, `content_items`, `brand_positioning`, `brand_perception`, `site_audits`. No unified "knowledge object" concept. `ai-index-generator` produces `llms.txt`/`robots`/`JSON-LD`/`aeo.json`/`entity.json` but these are generated outputs, not a managed store.

**Build target.** A first-class `knowledge_objects` store:
- Every entity (product, claim, FAQ, proof, person, location, policy) is a **knowledge object** with `id`, `type`, `canonical_text`, `language`, `evidence_refs[]`, `status` (`draft|published|deprecated`), `version`, `owner_id`, `provenance`.
- Objects are **versioned** and **immutable-append** (publish = new version; deprecate = soft).
- Objects feed deterministic generators (`ai-index-generator`, `schema-for-ai`) and are the retrieval corpus for the Brand Digital Twin and the agent.
- A **Knowledge Sync** service pushes published objects to downstream surfaces (llms.txt, GBP, JSON-LD, IndexNow — already wired) and, where partnered, to engine ingestion endpoints.

**API surface (concrete).**
```
POST   /v1/knowledge/objects            # create (draft)
PUT    /v1/knowledge/objects/{id}       # new version
GET    /v1/knowledge/objects?brand_id&type&status&lang
POST   /v1/knowledge/objects/{id}/publish
POST   /v1/knowledge/objects/{id}/deprecate
GET    /v1/knowledge/exports/llms-txt   # generated artifact (deterministic)
POST   /v1/knowledge/sync               # push to downstream surfaces
```

**Key decisions.**
- Knowledge objects are **content-addressed** (`sha256(canonical_text)`), enabling dedup + citation stability.
- `status=draft` preserves the honesty invariant — unpublished objects never reach engines.
- The Knowledge Cloud is the **single input** to every generator, killing the current "many modules each re-read the site" pattern.

---

### 5.2 AI Discovery APIs  *(load-bearing — concrete)*

**What it is.** The public, versioned, authenticated API surface that exposes every platform capability. This is the product. Everything else (console, SDK, agent, marketplace apps) is a consumer.

**What exists today.** Internal routes only: `/api/visibility-check`, `/api/cron/*`, `/api/content/generate`, `/api/agent/chat`, `/api/billing/*`. No versioning, no public auth model beyond Supabase session, no quota/rate-limit layer, no capability negotiation.

**Build target.** A standalone gateway (`/v1/...`) with:
- **AuthN:** Supabase session *or* platform API key (HMAC-signed, scopes=permissions).
- **AuthZ:** tenant-scoped (RLS still enforces at DB; gateway adds per-key scopes + quotas).
- **Rate limiting + metering:** every call metered for billing (Stripe-like usage records).
- **Capability negotiation:** `GET /v1/capabilities` returns which engines/regions are live *for this tenant* (honors "no fake engine").
- **Idempotency:** all mutating calls accept `Idempotency-Key`.
- **Webhooks:** async results (visibility runs, agent tasks) delivered to tenant-registered URLs, signed.

**Core endpoints (Phase 1).**
```
GET    /v1/capabilities                         # engines/regions live for tenant
POST   /v1/visibility/checks                    # enqueue a visibility check (async)
GET    /v1/visibility/checks/{id}               # poll result
GET    /v1/visibility/runs?brand_id&prompt_id&engine&from&to
POST   /v1/prompts                              # manage the question bank
GET    /v1/brands/{id}/score                    # aggregated visibility score
POST   /v1/content/generate                     # draft generation (always draft)
POST   /v1/audits/site                          # site audit (reuses site-audit-engine)
POST   /v1/agent/tasks                          # delegate to the Discovery Agent
GET    /v1/knowledge/objects  (see 5.1)
```

**Key decisions.**
- **Async by default.** Long operations (visibility checks, audits, agent tasks) return `202 + task_id`; results via `GET` or webhook. No 30s-synchronous LLM calls on the public edge.
- **Versioned from day one** (`/v1`). Breaking changes = `/v2` with overlap window.
- **The console is the first API consumer** — we ban console-only code paths. This enforces §2.3.

---

### 5.3 SDKs

**What it is.** First-party, typed SDKs that make the Discovery APIs trivially embeddable. The "Stripe SDK" moment — the API is only as good as its SDK.

**What exists today.** None. Internal TS only, using `@/` imports.

**Build target.** Publish (monorepo, versioned independently):
- **`ansaraeo-node`** (TypeScript/Node) — first; mirrors `/v1`.
- **`ansaraeo-py`** (Python) — for data/ML teams building discovery pipelines.
- **`ansaraeo-go`** — for backend services.
- Webhooks verification helper, retry/backoff, idempotency, typed errors.
- Each SDK generated from an **OpenAPI 3.1 spec** of `/v1` (single source of truth → generated clients + docs).

**Key decisions.**
- SDKs are **generated** from the API spec; the spec is the contract. Hand-written SDK drift is a bug.
- Ship a **minimal** SDK (zero-dep core) + optional feature packages (agent, knowledge) so embedding stays light.
- Include a **local mock server** (`ansaraeo mock`) so developers build against the API offline — dogfooding the honesty/testing culture.

---

### 5.4 AI Discovery Agent  *(load-bearing — concrete)*

**What it is.** An autonomous, tool-using agent that *plans and executes* discovery work on a tenant's behalf: "Improve our visibility for 'best CRM for Indian SaaS' across Perplexity and Gemini within policy," or "Find every prompt where we lost to competitor X this week and draft a fix." It is the **operator** of the platform, not a chatbot.

**What exists today.** `agent-context.ts` (`/api/agent/chat`) — a *chat* agent with `agent_conversations`. No planning loop, no tool sandbox, no human-in-loop, no policy gating.

**Build target.** A **planner → executor → verifier** loop:
- **Planner:** given a goal + policy, decomposes into a task graph (discover prompts, run checks, analyze gaps, draft content, request publish-approval, verify).
- **Executor:** calls platform APIs as *tools* (never raw DB). Tools are the SDK surface, sandboxed per tenant.
- **Verifier:** every agent action is checked against deterministic services (`mention-matcher`, `geo-linter`, `llms-txt-validator`) and the Trust Engine before being reported done. Agent never marks "published" without a human approval gate when policy requires.
- **Human-in-loop:** publish/deprecate/externally-sending actions route through the Governance approval queue.

**Agent task contract (concrete).**
```
POST /v1/agent/tasks
{ "goal": "...", "brand_id": "uuid", "policy_id": "uuid",
  "guardrails": { "max_external_sends": 0, "require_approval": ["publish","deprecate"] } }
→ 202 { "task_id": "uuid", "plan": [ ...steps ] }

GET /v1/agent/tasks/{id}   → state: planning|executing|awaiting_approval|done|failed
POST /v1/agent/tasks/{id}/approve   { "step_id": "..." }   # human-in-loop
```

**Key decisions.**
- **Tools = the public API.** The agent has no superuser DB access; it is a tenant-scoped API client. This makes agent actions automatically governed, metered, and auditable.
- **Approval-gated by default** for anything that touches the outside world or published state — the honesty invariant extended to autonomy.
- **Plans are inspectable and replayable** (provenance). No black-box agents in an enterprise trust product.

---

### 5.5 Enterprise Knowledge Graph

**What it is.** The enterprise's entities and relationships as a queryable graph: brand → products → claims → proofs → competitors → topics → prompts → engines → citations. Enables "why was we cited," "what claim backs this mention," "which competitor owns this topic."

**What exists today.** Relationships live in JSONB (`competitor_mentions`, `mention_verification`) and loose FKs. No graph query capability.

**Build target.**
- **Phase A (evolve):** Model the graph in Postgres — a `graph_nodes` + `graph_edges` schema with typed edges (`MENTIONS`, `SUPPORTS`, `COMPETES_WITH`, `ANSWERS`, `CITES`). Use recursive CTEs for traversal; `pgvector` for semantic node similarity. This ships *without new infrastructure* and respects the anchor.
- **Phase B (scale):** When traversal depth/volume exceeds Postgres comfort, mirror to a dedicated graph store (Neo4j / Nebula / Apache AGE) as a *read replica* of the Postgres graph. Postgres remains the write source of truth.
- Graph is **derived** from Knowledge Cloud + visibility_runs + audits — never hand-maintained as the primary store.

**API surface.**
```
GET /v1/graph/nodes?type=claim&brand_id=
GET /v1/graph/paths?from={node}&to={node}&max_hops=3
GET /v1/graph/topics/{topic}/owners         # who owns a topic (brand vs competitors)
```

**Key decisions.**
- Write to Postgres; graph store is a *derived read model*. Avoids a second source of truth.
- Edges carry `provenance` (which run/citation created them) — this is what makes the Trust Engine possible.

---

### 5.6 Brand Digital Twin

**What it is.** A living, queryable *representation* of the brand as AI engines perceive it: its positioning, the claims attributed to it, sentiment, perceived differentiators, and the gap between **intended** positioning (`brand_positioning`) and **perceived** (`brand_perception` + run outputs). The "source of truth for how you're seen."

**What exists today.** `brand_positioning` + `brand_perception` (+ `-io.ts`) tables and modules. Static-ish; not a unified, continuously-updated model.

**Build target.** A **materialized twin** refreshed each discovery cycle:
- Intended state (from Knowledge Cloud + positioning).
- Perceived state (aggregated from visibility_runs + perception analysis).
- **Gap model:** every divergence is a ranked, actionable recommendation.
- Exposed to the agent and console as the planning context ("here's the current twin; here's the gap to close").

**Key decisions.** Twin is *derived*, never authored directly. It's a view over Knowledge Cloud + Graph + runs.

---

### 5.7 AI Trust Engine

**What it is.** The system of record for **verification, provenance, and trust scoring** of every mention, citation, claim, and generated artifact. The differentiator that makes AnsarAEO a *trust* substrate, not just a monitoring tool.

**What exists today.** `mention_verification` JSONB (deterministic vs LLM reconciliation) + `mention-matcher.ts` + `crypto.ts` (encryption). The seed is here; it's not a standalone, queryable service.

**Build target.**
- **Verification service:** deterministic checks win for literal presence; LLM authoritative for sentiment/position; every decision logged with both inputs + the tiebreak rule (exactly the current reconciliation, promoted to a service with an API).
- **Provenance ledger:** content-addressed record of *how every fact was produced* (engine, model, version, deterministic check, inputs hash, timestamp).
- **Trust score:** per-claim and per-citation trust = f(verification method, source authority, recency, consistency across engines). Surfaced in reports and to the agent as a gating signal ("don't publish a claim with trust < threshold").
- **Claim verification API:** `POST /v1/trust/verify { claim, evidence_refs[] }` → verified/refuted/unverifiable + reasoning.

**Key decisions.**
- Trust Engine is the **gatekeeper** for the agent's publish actions and for any externally-sent content (honesty invariant, enforced by code).
- Provenance is stored content-addressed so it's tamper-evident (ties into `crypto.ts` signing).

---

### 5.8 Global Discovery Graph

**What it is.** The **aggregate, anonymized, cross-tenant** intelligence layer: how topics, entities, and intents map to engine behavior across *all* tenants and the open web. The Snowflake analog — shared data as a product. Powers category benchmarks, emerging-intent discovery, and "blind discovery" at scale.

**What exists today.** `blind-discovery.ts` (per-tenant discovery of unowned prompts) — a single-tenant prototype of this idea.

**Build target.**
- An **OLAP + graph** store (Phase A: Postgres aggregate views + a read replica; Phase B: ClickHouse/Snowflake-style columnar store for the aggregate, kept *anonymized and aggregated*).
- **Anonymization boundary:** the Global Graph contains *no* raw tenant content — only aggregate topic/intent/engine-behavior signals and differentially-private aggregates.
- Powers: category benchmarks, intent trends, competitor-ecosystem maps (without exposing any single tenant's data), and a paid **insights API**.
- **Opt-in contribution:** tenants can contribute de-identified signals for benchmark access (privacy-preserving, DPDP/GDPR-safe).

**Key decisions.**
- **Hard isolation:** tenant data never enters the Global Graph un-aggregated. Compliance Layer audits this boundary continuously.
- Global Graph is a **read model** derived from tenant runs via an ETL that strips PII at the edge.

---

### 5.9 Marketplace

**What it is.** A venue where third parties publish **discovery apps, agents, knowledge connectors, and insight packs** built on the Open Platform. The "AWS Marketplace / Slack App Directory" for AI discovery.

**Build target.**
- Listings: agents (5.4 tools), connectors (new engine/source integrations), insight packs (Global Graph queries), content templates.
- Each listing is a versioned artifact with permissions scopes, reviewed by the Compliance/Governance layers before publish.
- Revenue share + metering via the billing service (reuse Razorpay; add marketplace payouts).

**Key decisions.** Every marketplace app is *just* a packaged use of the public API + agent tools. No special access — same trust boundary as first-party.

---

### 5.10 Enterprise Console

**What it is.** The flagship UI — an evolution of the current Next.js 16 dashboard into a multi-workspace, role-aware command center: workspaces (orgs/brands), the twin view, graph explorer, agent task board, trust dashboard, marketplace, governance inbox.

**What exists today.** `dashboard/*` (RLS + `selected_brand_id` cookie) + `(auth)/` + `(marketing)/`.

**Build target.**
- Console becomes a **thin client** of `/v1` (no server-only logic that isn't also an API).
- Role-based workspaces, multi-brand switching, graph visualizer, agent task board, approval inbox.
- White-label/embeddable iframe for enterprise customers (console-as-a-component).

**Key decisions.** Console must pass the "no API旁路" test — if the console can do it, the API can do it.

---

### 5.11 Compliance Layer

**What it is.** Continuous, auditable compliance across jurisdictions and standards: DPDP Act 2023 (India), GDPR, CCPA, SOC 2, and vertical regs (finance/health disclaimers). Not a checkbox — a *runtime* that gates data flow.

**What exists today.** Implicit only (`ENCRYPTION_KEY`, RLS). No compliance automation.

**Build target.**
- **Data residency:** tenant data pinned to region (`ap-south-1` default; `eu`/`us` on request) — enforced at the data-plane routing layer.
- **PII handling:** classification + masking + right-to-erasure hooks wired to `delete` cascades; the Global Graph's anonymization boundary is *verified* here, not assumed.
- **Retention policies:** per-table TTL, audit-log immutability.
- **Certification evidence:** auto-generated SOC 2 control evidence from the audit log + governance records.
- **Compliance API:** `GET /v1/compliance/status`, `POST /v1/compliance/data-export` (portability), `POST /v1/compliance/erasure`.

**Key decisions.** Compliance is **enforced in the data path**, not documented after the fact. The audit log is the source of truth for every control.

---

### 5.12 Governance Layer

**What it is.** The policy + approval + audit system that keeps autonomy safe: who can publish, what the agent may do, approval workflows, and an immutable decision log.

**What exists today.** `plan_limits` (plan gating only). No policy/approval/audit framework.

**Build target.**
- **Policies:** per-org rules — allowed engines, agent guardrails, required approvals, external-send caps, content trust thresholds.
- **Approval queue:** human-in-loop for publish/deprecate/external-send (consumed by the agent + console).
- **Audit log:** every privileged action (who/what/when/why/provenance) — immutable, signed (`crypto.ts`), the backbone of compliance evidence.
- **Policy API:** `GET/PUT /v1/governance/policies`, `GET /v1/governance/audit`, `POST /v1/governance/approvals`.

**Key decisions.** Governance is *authoritative* — the agent and API both consult it before state-changing actions. No privileged path bypasses it.

---

### 5.13 Research Center

**What it is.** The internal + opt-in external lab for **evaluation, benchmarking, and red-teaming** of discovery/trust methods: are our classifiers accurate? Are engines drifting? What new prompt patterns emerge?

**What exists today.** None (the deterministic test culture in `*.test.ts` is the seed).

**Build target.**
- **Evals:** golden datasets of (prompt, expected mention) → continuous classifier accuracy tracking.
- **Engine drift monitor:** detect when an engine changes behavior/format (the `callEngine` contract breaks) before customers do.
- **Red-team:** adversarial prompts to test the Trust Engine's resistance to manipulation (fake citations, poisoned knowledge).
- **Published benchmarks:** opt-in tenants get category benchmarks from the Global Graph.

**Key decisions.** Research outputs feed *back* into the deterministic services (new matchers, validators) — closing the loop between eval and production.

---

### 5.14 Open Platform

**What it is.** The developer ecosystem: public API + SDKs + webhooks + docs + sandbox + app registration. The "AWS for builders" surface.

**Build target.**
- Developer portal: API reference (from OpenAPI), SDKs, sandbox (`ansaraeo mock`), app registration, OAuth for third-party apps acting on behalf of tenants.
- **OAuth2 client credentials + authorization code** flows for marketplace/partner apps (scoped, consented).
- Public status + changelog + SLA dashboards.

**Key decisions.** The Open Platform is *the same API* the console and agent use — one contract, many clients.

---

### 5.15 Cloud Architecture

See §4 (target architecture) and §9 (scalability/infra). Summarized here as the **physical** layer:
- **Monorepo** (`apps/console`, `apps/gateway`, `services/*`, `platform/sdk-*`, `infra/`).
- **Compute:** Phase 1–2 — Vercel (console) + Supabase (data) + a worker service (queue consumers) on a container platform; Phase 3 — Kubernetes/edge for the gateway + agent runtime when scale demands.
- **Storage:** Postgres (tenant + graph write source) → OLAP replica (Global Graph) → object store (artifacts).
- **Eventing:** a managed queue (Supabase Edge/or a hosted Redis/queue) for runs, webhooks, agent steps.
- **Observability:** traces on every API call + run; the audit log *is* the compliance record.

---

## 6. Data model evolution

The baseline schema (`orgs → brands → prompts → visibility_runs`) is preserved. We **add** the cloud tables as new migrations, never altering the tenant-funnel RLS pattern.

### 6.1 New core tables (Phase 1)
```sql
-- AI Knowledge Cloud
create table knowledge_objects (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id),
  type text not null,                      -- product|claim|faq|proof|person|location|policy
  content_hash char(64) not null,          -- sha256(canonical_text) — content address
  canonical_text text not null,
  language text not null default 'en',
  status text not null default 'draft',    -- draft|published|deprecated
  version int not null default 1,
  owner_id uuid references auth.users(id),
  provenance jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on knowledge_objects (brand_id, type, status);

-- Enterprise Knowledge Graph (write source; Postgres-first)
create table graph_nodes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id),
  kind text not null,                      -- brand|product|claim|topic|prompt|engine|competitor
  ref_id uuid,                             -- points to source row (knowledge_objects/prompts/...)
  label text not null,
  embedding vector(1536),                  -- pgvector for semantic similarity
  created_at timestamptz not null default now()
);
create table graph_edges (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references graph_nodes(id),
  to_id uuid not null references graph_nodes(id),
  kind text not null,                      -- MENTIONS|SUPPORTS|COMPETES_WITH|ANSWERS|CITES
  provenance jsonb not null,               -- which run/citation created this edge
  created_at timestamptz not null default now()
);

-- Trust ledger (content-addressed provenance)
create table trust_records (
  id uuid primary key default gen_random_uuid(),
  content_hash char(64) not null,
  method text not null,                    -- deterministic|llm|hybrid
  verdict text not null,                   -- verified|refuted|unverifiable
  score numeric not null,
  inputs_hash char(64) not null,
  signature text not null,                 -- crypto.ts signs the record
  created_at timestamptz not null default now()
);

-- Agent tasks + governance
create table agent_tasks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id),
  policy_id uuid references governance_policies(id),
  goal text not null,
  state text not null default 'planning', -- planning|executing|awaiting_approval|done|failed
  plan jsonb,
  created_at timestamptz not null default now()
);
create table governance_policies (
  org_id uuid not null references orgs(id),
  rules jsonb not null,                    -- engines, guardrails, approvals, trust thresholds
  updated_at timestamptz not null default now()
);
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid, tenant_id uuid, action text not null,
  target text, decision jsonb, signature text not null,
  created_at timestamptz not null default now()
);
```

### 6.2 Migration discipline
Sequential ledger: `schema.sql → 002…011 → 015 → 0xx`. Each new migration is **forward + rollback**, applied zero-downtime (additive columns, backfilled async). A `migration_ledger` table records applied versions + checksums (ties into Compliance Layer).

---

## 7. API & SDK design (concrete)

**Single contract:** `openapi/ansaraeo-v1.yaml` (OpenAPI 3.1) is the source of truth. SDKs, docs, and the mock server are generated from it.

**Auth model.**
- User sessions: Supabase JWT (cookie client, RLS-enforced).
- API keys: `aka_sk_…` HMAC-signed, scoped to permissions; the gateway maps key → tenant + scopes.
- OAuth2 (Phase 3): client-credentials + auth-code for third-party apps.

**Cross-cutting headers.** `Idempotency-Key`, `X-Tenant-Id` (derived from auth), `X-Request-Id` (traced), `X-Capabilities` (echoed live engines/regions).

**Error shape.**
```json
{ "error": { "code": "ENGINE_UNAVAILABLE", "message": "...",
            "retryable": true, "capability": "grok" } }
```

**Async pattern.** Mutating long ops return `202 { task_id, status_url, webhook_events }`. Webhooks signed with the tenant's webhook secret (HMAC), like the Razorpay webhook today.

---

## 8. Security model

Carried + hardened from today:
- **RLS remains the tenant isolation primitive.** The gateway never bypasses it for user-scoped calls. Service client is used *only* inside trusted workers, never exposed.
- **`ENCRYPTION_KEY` AES-256-GCM** for all integration creds (WhatsApp, GSC, Razorpay, GA4, Shopify) — extended to API-key material and the trust ledger signatures.
- **Secrets never in logs / never committed** — enforced by CI (secret scan) + the Compliance Layer.
- **Razorpay webhook signature verified** before trust (pattern reused for *all* inbound webhooks).
- **Capability-aware attack surface:** an engine with no key is simply not advertised — no stub endpoints to probe.
- **Agent sandbox:** the agent is a scoped API client; it cannot touch the DB directly, so a compromised agent is bounded by its key's scopes + governance policy.
- **Audit log is signed + immutable** — tampering is detectable; this is the compliance backbone.

---

## 9. Scalability & cloud architecture

### 9.1 Evolution path (respects "evolve current stack")
- **Phase 1 (0–6 mo):** Keep Next.js + Supabase. Add a **versioned gateway** (same runtime) + a **worker service** consuming a queue for visibility runs (replaces pure cron). Public API + Node SDK. No new infra.
- **Phase 2 (6–12 mo):** Extract services (`services/knowledge`, `services/trust`, `services/graph`, `services/agent`) as separate deployables in the monorepo, still Postgres-backed. Agent runtime + Governance + Compliance live.
- **Phase 3 (12–24 mo):** When limits hit — add **OLAP replica** (Global Graph), optional **graph store** (derived read model), **multi-region** (data residency), and container/K8s for gateway + agent at scale.

### 9.2 Scaling the acquisition pipeline
- Visibility runs are **embarrassingly parallel** (prompt × engine). Move from `Promise.allSettled` in a single request to **queue + worker pool** with per-engine concurrency limits and exponential backoff.
- Engine rate-limit awareness: a token-bucket per `engine × tenant`; the `grok`/`copilot` skip rules become *graceful degradations* with metrics, not exceptions.

### 9.3 Cost control
- LLM classification (`gpt-4o-mini`) is the dominant cost. Cache classifications by `content_hash` (deterministic content → same classification). Add a **classification cache** keyed on `sha256(answer_text)` to cut repeat spend on identical engine responses.
- Batch runs (nightly) use spot/low-priority workers.

### 9.4 Observability
- Every API call + run emits a trace (engine, model, version, latency, cost, deterministic-check result). The trace *is* the provenance record.
- Run-level metrics feed the Research Center's drift monitor.

### 9.5 When Postgres is not enough (explicit triggers to add infra)
| Signal | Add |
|---|---|
| Graph traversal > 4 hops at high QPS | dedicated graph read replica |
| Global Graph aggregate queries slow | columnar OLAP store |
| Data-residency demand in EU/US | second region + routing |
| Gateway p99 > SLA | K8s/edge for gateway |

Until a signal fires, **do not** add infrastructure. This is the discipline that keeps "evolve" honest.

---

## 10. Permissions model

Layered, all ultimately enforced by RLS + gateway scopes + governance policy:
1. **AuthN:** Supabase user *or* API key *or* OAuth app.
2. **Tenant scope:** `org_members → brands → …` RLS funnel (unchanged).
3. **API key scopes:** `permissions` array on the key (e.g., `visibility:read`, `content:write`, `agent:run`).
4. **Org roles:** `owner | admin | member | viewer | auditor` (the current `org_member` gains a role column).
5. **Governance policy:** runtime gates on top of roles (e.g., `member` can *draft* but `publish` requires `admin` approval).
6. **Agent scopes:** an agent task runs with the *intersection* of its key scopes and its policy guardrails.

**Principle:** permissions are **deny-by-default**; every new capability ships with the least scope it needs.

---

## 11. Compliance map

| Requirement | Mechanism |
|---|---|
| DPDP Act 2023 (India) | Data residency (`ap-south-1` default), consent logs, erasure hooks, audit log |
| GDPR / CCPA | Portability export, erasure, masking, opt-out of Global Graph |
| SOC 2 | Immutable signed audit log → auto control evidence |
| PCI-ish (billing) | Razorpay handles card data; we never store PAN; webhook signature verified |
| Vertical disclaimers (finance/health) | Trust Engine flags unverifiable claims; policy can require disclaimers on generated content |
| Secrets | `ENCRYPTION_KEY` AES-256-GCM; CI secret scan; never logged |

The **Compliance Layer verifies the Global Graph anonymization boundary** continuously — if any tenant PII is detectable in the aggregate, the ETL is blocked.

---

## 12. Testing strategy

Built on the existing `vitest` + deterministic-parser culture; extended for a distributed platform.

1. **Deterministic unit tests** (carried): parsers/validators/matchers tested with `vi.stubGlobal("fetch", …)` — no network, no keys.
2. **Contract tests:** generated SDK vs OpenAPI spec — fail the build if they diverge.
3. **Capability tests:** every engine caller tested for *skip* behavior when its key is absent (no fake engine).
4. **Reconciliation tests:** deterministic `mention-matcher` must win over LLM for literal presence — regression-guarded.
5. **Trust/eval tests:** golden (prompt, expected) datasets in the Research Center; classifier accuracy tracked per release.
6. **Integration tests:** worker + gateway against a seeded Supabase (reuse `reset.sql`).
7. **Chaos/isolation:** one engine always-down run must not fail the batch (carried `allSettled` discipline, now load-tested).
8. **Load tests:** nightly-run fan-out at 10× current volume before Phase 3 scale claims.
9. **Compliance tests:** assert no tenant row is readable cross-tenant (RLS negative tests); assert Global Graph contains zero raw PII.

---

## 13. Migration strategy (SaaS → Cloud)

**Rule:** existing customers feel no breaking change. The console keeps working; we *add* the API beside it.

- **Step 1 — Instrument, don't migrate.** Wrap existing routes; emit provenance + traces. No schema break.
- **Step 2 — Extract the API.** Stand up `/v1` gateway that *re-implements* console actions by calling the same lib functions. Console gradually calls `/v1`. (Ban new console-only logic.)
- **Step 3 — Knowledge Cloud backfill.** Migrate `content_items` + `brand_positioning` + site-audit outputs into `knowledge_objects` via a backfill migration; old tables become views.
- **Step 4 — Eventify.** Replace cron with queue + workers; old cron routes become enqueue triggers (kept for backward compat, deprecated).
- **Step 5 — Graph + Trust.** Build `graph_nodes/edges` + `trust_records` from existing runs (ETL). Existing `mention_verification` JSONB becomes the seed.
- **Step 6 — Agent + Governance.** Ship agent runtime + approval queue; opt-in per org.
- **Step 7 — Global Graph + Marketplace.** Phase 3, after anonymization boundary is proven by Compliance tests.

Each step is **reversible** (feature-flagged) and has a rollback migration.

---

## 14. Rollout / GTM strategy

| Phase | Window | Ships | Audience |
|---|---|---|---|
| **P1 Platform Foundations** | 0–6 mo | Versioned API, Node SDK, worker queue, capabilities endpoint, webhooks | Existing customers + developers (private beta) |
| **P2 Knowledge + Trust + Graph** | 6–12 mo | Knowledge Cloud, Trust Engine, Enterprise KG, Brand Twin, Governance | Enterprise design partners |
| **P3 Agent + Console v2** | 12–18 mo | AI Discovery Agent (HITL), Enterprise Console, Compliance Layer | Enterprises |
| **P4 Global Graph + Marketplace + Open** | 18–30 mo | Global Discovery Graph (benchmarks), Marketplace, Open Platform, Research public benchmarks | Ecosystem / ISVs |
| **P5 Scale + Multi-region** | 30 mo+ | OLAP/graph infra, EU/US regions, K8s edge | Global enterprises |

**Packaging:** keep the SaaS tiers (INR) and add **Platform/API metering** (usage-based, Stripe/Razorpay-style) + **Enterprise** (data residency, SSO, dedicated agent quota) + **Marketplace revenue share**.

**Beachhead:** Indian D2C/SAAS brands (existing base) → expand to agencies (multi-brand console) → global enterprises (residency + compliance).

---

## 15. Open questions (for follow-up deep-dives)

1. **Engine partnerships:** Can we move from *scraping/querying* engines to *ingestion partnerships* (brands submit knowledge directly)? Legal + commercial.
2. **Global Graph privacy math:** What differential-privacy epsilon is acceptable for benchmark usefulness vs DPDP/GDPR safety? (Research Center owns this.)
3. **Agent autonomy ceiling:** How much can the agent *do* without human approval before enterprise trust breaks? Policy default proposal: `publish`/`deprecate`/`external-send` always gated; `draft`/`analyze`/`plan` autonomous.
4. **Multi-region data model:** Active-active vs primary+replica for `ap-south-1` + `eu`? Affects graph consistency.
5. **SDK language priority:** Node first (assumed); confirm Python vs Go as #2 from customer signal.

---

### Appendix A — Glossary
- **Discovery:** the process by which an AI engine decides to mention/cite a brand in answer to a prompt.
- **Visibility run:** one prompt × one engine execution + classification.
- **Knowledge object:** a versioned, content-addressed unit of brand truth.
- **Twin:** derived model of perceived-vs-intended brand positioning.
- **Trust record:** signed, provenance-bearing verification of a claim/citation.
- **Capability:** an engine/region a tenant can actually use (key present, live).

### Appendix B — Anchoring summary
Every cloud pillar maps to existing code: Knowledge Cloud ← `ai-index-generator`/`content_items`; Discovery APIs ← `/api/*`; Agent ← `agent-context`; KG ← `competitor_mentions`/`mention_verification`; Trust ← `mention-matcher`/`crypto`; Twin ← `brand_positioning`/`brand_perception`; Graph ← `blind-discovery`; Compliance/Governance ← `ENCRYPTION_KEY`/RLS/`plan_limits`; Cloud Arch ← Next.js+Supabase. **Nothing in this design requires discarding the current stack** — it wraps, extracts, and extends it.

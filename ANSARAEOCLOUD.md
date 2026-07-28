# AnsarAEO Cloud — Infrastructure for AI Discovery

**Status:** 🌟 North-star **design of record**. Implementation **FROZEN** (see
`PLATFORM_ARCHITECTURE.md` freeze). This document is the *evolution* of that frozen platform
design to infrastructure scale. **Do not implement** until: (1) the customer-facing product
is validated with real users, and (2) the public APIs are stabilized. This doc is the
long-horizon target; the frozen platform doc is the near-term on-ramp to it.

**Persona brief:
** CTO / CPO / CAIO / Principal Cloud Architect. Design the infrastructure
layer for the AI-first internet — think AWS (primitives), Stripe (metering/billing),
Snowflake (data/warehouse), OpenAI Platform (APIs + SDKs + agents).

---

## 0. North-star thesis

The internet is becoming **AI-mediated**: a growing share of discovery happens *through* ChatGPT,
Perplexity, Gemini, AI Overviews, Copilot, and Grok rather than blue links. Every enterprise
therefore needs a **system of record for how it is represented, found, trusted, and chosen by
AI**. AnsarAEO Cloud is that system — the control plane for AI discovery.

Three planes (the AWS/Stripe shape):

| Plane | Job | AnsarAEO analog |
|---|---|---|
| **Control plane** | Tenancy, identity, entitlements, metering, console | Supabase Auth + org model → tenant service |
| **Data plane** | Discovery execution, knowledge, graph, trust | `visibility-engine` + `ENGINE_CALLERS` → discovery mesh |
| **Experience plane** | APIs, SDKs, agent, console, marketplace | `/api/*` + future OpenAPI/SDKs |

**Ten-year bet:** as answers replace pages, the brand that is *structured, proven, and trusted*
for machines wins. AnsarAEO Cloud makes that a managed service.

---

## 1. Cloud services (the 15 build items)

Each build item becomes a first-class, independently deployable service behind the control
plane. Status is *design* — none are implemented while frozen.

| # | Build item | Cloud service | Near-term anchor in current code |
|---|---|---|---|
| 1 | AI Knowledge Cloud | `knowledge-cloud` (object + vector + structured facts) | `ai-index-generator`, `content_items` |
| 2 | AI Discovery APIs | `discovery-api` gateway + versioned surfaces | `/api/*`, frozen §7 public API |
| 3 | SDKs | `ansaraeo-sdk` (TS/Py/…) + codegen | frozen §5 SDK |
| 4 | AI Discovery Agent | `discovery-agent` orchestration runtime | `/api/agent/chat`, `agent-context.ts` |
| 5 | Enterprise Knowledge Graph | `kg-enterprise` (per-tenant graph) | new; schema from `entities` |
| 6 | Brand Digital Twin | `brand-twin` (live brand-as-AI-sees-it) | `brand_perception`, `brand_positioning` |
| 7 | AI Trust Engine | `trust-engine` (provenance/verify/score) | `pdp-generator` evidence ledger, `mention-matcher` |
| 8 | Global Discovery Graph | `kg-global` (anonymized cross-tenant) | Benchmark Community (`benchmark-engine`) |
| 9 | Marketplace | `marketplace` (extensions/agents/playbooks) | frozen §6 |
| 10 | Enterprise Console | `console` (tenant ops, metering, graph explorer) | frozen §13 admin portal |
| 11 | Compliance Layer | `compliance` (DPDP/GDPR/SOC2/ISO, residency) | new; `crypto.ts` KMS pattern |
| 12 | Governance Layer | `governance` (RBAC/ABAC/capability, policy) | frozen §4 capability gateway |
| 13 | Research Center | `research` (aggregated datasets, trends) | `kg-global` + benchmark |
| 14 | Open Platform | `open-platform` (OAuth apps, webhooks, sandbox) | frozen §7/§11 |
| 15 | Cloud Architecture | the substrate (this doc) | Supabase + Next.js + Vercel |

---

## 2. Cloud architecture (logical)

```
                 ┌──────────────────────────────────────────────────────┐
   Web · Mobile ·│   Experience plane                                     │
   Partner apps  │  Console · SDKs · Discovery Agent · Marketplace        │
                 └───────────────────────┬──────────────────────────────┘
                                         │ mTLS / API-key / OAuth2
                 ┌───────────────────────▼──────────────────────────────┐
                 │  API Gateway + Edge (rate limit, authn, usage meter)   │
                 └───────┬───────────────────────────┬──────────────────┘
          Control plane │                           │ Data plane
       ┌────────────────▼──────────┐    ┌────────────▼──────────────────┐
       │ identity · tenant ·        │    │ discovery mesh (ENGINE_CALLERS │
       │ entitlements · metering ·  │    │  at scale) · knowledge-cloud · │
       │ billing · audit · policy   │    │ kg-enterprise · kg-global ·    │
       │ (Stripe/Razorpay shape)    │    │ trust-engine · brand-twin      │
       └────────────────┬──────────┘    └────────────┬──────────────────┘
                        │                             │
                 ┌──────▼─────────────────────────────▼──────┐
                 │  Event bus (discovery jobs, graph updates,  │
                 │  trust events, metering ticks)              │
                 └───────────────────────┬─────────────────────┘
                                         │
                 ┌───────────────────────▼─────────────────────┐
                 │  Polyglot persistence (see §4) + object store │
                 └───────────────────────────────────────────────┘
```

**Control/data separation** (AWS-like): the control plane is the source of truth for *who may
do what and what they owe*; the data plane executes discovery and mutates knowledge. The data
plane never sees tenant credentials — it receives scoped capability tokens from the control
plane (reuses the frozen capability-gateway concept).

---

## 3. Microservices decomposition

Strangler-fig from today's Next.js monolith: keep the monolith running, peel services out
behind the gateway, dual-write during transition.

| Service | Owns | Talks to |
|---|---|---|
| `identity` | users, orgs, org_members, SSO/SCIM | auth, entitlements |
| `tenant` | plan, limits, feature flags, data-residency zone | metering, billing |
| `entitlements` | RBAC/ABAC + capability grants | gateway, all data-plane svcs |
| `metering` | usage events → billable units | billing, audit |
| `billing` | Razorpay (India) + invoicing, payouts | metering, marketplace |
| `discovery` | `ENGINE_CALLERS` mesh, runs, citations | knowledge-cloud, trust-engine |
| `knowledge-cloud` | facts, docs, vectors, llms.txt/aeo.json | kg-enterprise, twin |
| `kg-enterprise` | per-tenant entity graph | twin, trust-engine |
| `kg-global` | anonymized aggregate graph | research, benchmark |
| `trust-engine` | provenance ledger, verify, score | twin, compliance |
| `brand-twin` | live twin materialization + API | kg-enterprise, trust-engine |
| `agent` | Discovery Agent runtime + tool calling | all data-plane svcs |
| `marketplace` | extensions, installs, reviews | billing, entitlements |
| `console` | tenant UX, graph explorer, cost view | all |
| `compliance` | residency, retention, audit export | all (read-only observers) |
| `governance` | policy engine (OPA), approvals | entitlements, audit |

Inter-service contracts: versioned async events on the bus + typed RPC/REST internally;
external = OpenAPI only.

---

## 4. Database & persistence (polyglot, not one Postgres)

Today: Supabase Postgres + RLS (`org_members → brands → …`). That **stays** as the OLTP +
entitlements backbone. At cloud scale we add purpose-built stores:

| Need | Store | Why |
|---|---|---|
| OLTP, tenancy, RLS entitlements | **Postgres (Supabase)** | keep; proven, RLS funnel intact |
| Entity + relationship graph | **Postgres recursive CTEs + pgvector** (v1) → **Neo4j** (v2 if scale demands) | graph queries + embeddings co-located first |
| Embeddings / semantic retrieval | **pgvector** or dedicated vector DB | twin + retrieval |
| Analytics, Benchmark, Research | **Columnar warehouse** (Snowflake-like; ClickHouse/BigQuery interim) | cheap scans over aggregates |
| Knowledge Cloud artifacts, PDFs | **Object store** (S3/R2) | large blobs, versioned |
| Hot reads, rate limits, sessions | **Redis** | latency + gateway metering |
| Async discovery jobs, fanout | **Queue** (SQS / Redis Streams) | `Promise.allSettled` isolation → durable queues |

Migrations remain sequential and backward-compatible (per `CLAUDE.md`); new stores get their
own migration/seed path. **No existing table semantics change.**

---

## 5. Knowledge graph

**Enterprise Knowledge Graph (`kg-enterprise`)** — per-tenant: brand entities (products,
people, claims, locations), typed relationships, sourced facts with **provenance** (which
citation/URL supports each fact), freshness timestamps. Powers the twin and retrieval.

**Global Discovery Graph (`kg-global`)** — cross-tenant, **anonymized/aggregated** copy:
"in category X, AI answers cite domains Y/Z; sentiment trends W." This is the Benchmark
Community + Research Center substrate. Strictly no PII; residency-aware (Indian tenants never
leave `ap-south-1` in raw form).

Ingestion: discovery runs + `ai-index-generator` outputs + partner feeds → graph writer with
provenance. Query: GraphQL/REST for twin + analytics.

---

## 6. Brand Digital Twin

A **live, queryable representation of a brand as AI perceives it**:
`entity graph + citation footprint + perception/sentiment + freshness + trust score`.
Materialized by `brand-twin` from `kg-enterprise` + `trust-engine` + `brand_perception`.
Consumed via API, agent, and console ("Twin view"). This is the product's flagship enterprise
primitive — the thing a CMO logs into daily.

---

## 7. AI Trust Engine

Provenance + verification + transparency scoring. Reuses the *honesty-design* DNA already in
the codebase: `pdp-generator` evidence ledger, `mention-matcher` deterministic-over-LLM,
`geo-linter`/`llms-txt-validator` deterministic checks. Adds:
- **Fact ledger:** every claim the brand publishes carries a verification state.
- **Citation quality:** reuse `citation-quality` + `domain-authority`.
- **Transparency score:** how machine-readable/honest the brand's AI surface is.
Feeds compliance (what can we assert?) and the twin (trust dimension).

---

## 8. AI Discovery APIs

Evolves the frozen public-API design (§7 of `PLATFORM_ARCHITECTURE.md`) into a full surface:
`discovery`, `knowledge`, `graph`, `twin`, `trust`, `agent`, `analytics`, `marketplace`.
Versioned (`/v1`), gateway-authn (API keys + OAuth apps), **usage-metered** (Stripe/Razorpay
shape), rate-tiered by plan. All request/response bodies `zod`-validated (existing pattern);
OpenAPI 3.1 published.

---

## 9. SDKs

Multi-language, built on the frozen SDK design: `@ansaraeo/sdk` (TS/JS, server) +
`@ansaraeo/api-client` (integrators) + **Python** (the ML/enterprise default) + REST for the
rest. **Codegen from OpenAPI** keeps them in lockstep with the API. Server SDK = builders
(engines/agents/integrations); client SDK = typed API access. (Deferred per freeze until APIs
stabilize — but spec'd now.)

---

## 10. AI Discovery Agent

Conversational **and** autonomous orchestration over the cloud: monitor discovery, flag
mention drops, draft remediation, deploy playbooks. Reuses `/api/agent/chat` +
`agent-context.ts`. At cloud scale it becomes a multi-tenant agent runtime with tool-calling
into every data-plane service, and a **marketplace of agents** (frozen §8).

---

## 11–14. Marketplace · Enterprise Console · Compliance · Governance

- **Marketplace:** the frozen `PLATFORM_ARCHITECTURE.md` §6, now multi-tenant + metered.
- **Enterprise Console:** frozen §13 admin portal evolves into the tenant console (config,
  entitlements, cost/metering, **graph explorer**, **twin viewer**, audit export).
- **Compliance Layer (`compliance`):** India **DPDP Act 2023**, GDPR, SOC 2 Type II, ISO 27001,
  data residency (`ap-south-1` primary; EU/US zones opt-in), PII minimization, retention +
  right-to-erasure, immutable audit trails, consent logging. Reuses `crypto.ts` AES-256-GCM
  for secrets/KMS.
- **Governance Layer (`governance`):** RBAC + **ABAC** + the capability model from the frozen
  §4; **OPA** policy engine; approval workflows; tenant-isolation guarantees; change control;
  risk scoring. This is what makes multi-tenant safe.

---

## 15. Research Center

Aggregated, anonymized `kg-global` insights + benchmark trends + published datasets. Dual
purpose: (a) product intelligence (what's changing in AI discovery), (b) thought leadership /
lead-gen. Strictly derived from anonymized data — never raw tenant content.

---

## 16. Open Platform

The "extensible" promise made real: OpenAPI, **OAuth app ecosystem**, outbound/inbound
**webhooks** (HMAC-verified, mirroring the Razorpay webhook pattern), **sandbox** tenants, and
the Partner Directory / Certified program from the frozen §11–§12. This is the on-ramp from
the frozen platform design into the cloud.

---

## 17. Cross-cutting delivery (the requested deliverables)

**Security (zero-trust):** no service trusts another by network location; every call carries a
scoped token. Tenant isolation enforced at entitlement + storage layer. KMS = `crypto.ts`
AES-256-GCM pattern, never plaintext, never logged. Supply-chain scanning in CI (reuse frozen
§9/§10). Pen-test before GA.

**Scalability:** stateless services horizontal-scale; tenant-aware sharding; durable queues
for discovery (replaces in-process `Promise.allSettled` with observable, retryable jobs);
Redis caching; multi-region `ap-south-1` primary → active-passive → active-active; autoscaling
on queue depth + request rate.

**Enterprise architecture:** SSO (SAML/OIDC), SCIM provisioning, **BYOK**, dedicated
single-tenant zones for regulated customers, audit-log streaming to customer SIEM, contractual
SLAs/Uptime.

**Permissions:** capability model (frozen §4) + ABAC attributes (region, plan, data-class) +
explicit consent. `impersonate`/`service_role`/`payments:pay` never granted to third parties.

**Compliance:** see §14.

**Testing:** contract tests per service boundary; chaos/load for the discovery mesh; e2e
against seeded sandbox tenants; **determinism** preserved (reuse vitest + `vi.stubGlobal`
patterns for parsers/matchers); golden tests for twin/trust scoring.

**Migration (strangler-fig):** keep monolith; route new traffic through gateway; peel services
out with **dual-write**; feature-flag per service; **zero-downtime**; only begin after product
validation + API stabilization (per freeze). Never alter existing table semantics.

**Documentation:** ADRs for every architectural decision; OpenAPI + TypeDoc + runbooks; public
docs site (frozen §11). This file + `PLATFORM_ARCHITECTURE.md` are the design-of-record set.

**Rollout:** Landing zone (internal) → **private beta** (design partners, ap-south-1) → GA
tiers: **Free / Pro / Enterprise / Cloud** (Cloud = dedicated + BYOK + SLA). Marketplace +
SDKs GA alongside Pro.

---

## 18. Relationship to the frozen doc + the freeze

```
validate product (customer-facing)  ─▶  stabilize APIs  ─▶  UNFREEZE
        │                                        │
        ▼                                        ▼
   PLATFORM_ARCHITECTURE.md (near-term)  ─▶  ANSARAEOCLOUD.md (this, infrastructure scale)
```
The frozen platform doc is the **on-ramp**; this cloud doc is the **destination**. Both stay
design-only until the product earns the build. Keeping internals modular *now* (the user's
explicit ask) protects the `ENGINE_CALLERS` / `src/lib/*` seams these designs depend on.

---

## 19. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Multi-tenant isolation breach | capability + ABAC + storage-layer tenancy; pen-test; zero-trust |
| Graph cost at scale | start pgvector/recursive; graduate to Neo4j only on proven need |
| India data-residency conflict | `ap-south-1` primary; raw never leaves zone; global graph anonymized |
| Building before validating | freeze holds; customer-facing first (explicit) |
| LLM providers eat the layer | differentiate on *verified, structured, owned* truth, not raw answers |
| Talent / cost of cloud ops | strangler-fig; managed Supabase/Vercel/Razorpay; autoscale |

---

### One-line summary
AnsarAEO Cloud is the **control plane for AI discovery** — keep the proven Postgres+RLS core,
peel the `ENGINE_CALLERS` mesh and `src/lib/*` modules into scoped cloud services behind a
capability-gated control plane, and add a knowledge graph, brand twin, and trust engine so
every enterprise can manage how AI represents, finds, trusts, and chooses them. Design now;
build only after the product is validated.

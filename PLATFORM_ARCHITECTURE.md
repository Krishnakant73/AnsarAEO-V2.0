# AnsarAEO Platform Architecture

**Author:** Platform / Ecosystem org
**Status:** 🔒 FROZEN — design of record. Do **not** implement yet. Deferred until the
product is validated with real users and the public APIs are stabilized. Keep internal
services modular so the `ENGINE_CALLERS`-style extension points stay clean for later.
**Audience:** Eng, Product, Partnerships, Security, Revenue

---

## 0. Thesis — why this wins

AnsarAEO is an AEO SaaS with a strong *engine* core (`src/lib/visibility-engine.ts` →
`ENGINE_CALLERS` registry) and a clean, org-scoped data model
(`orgs → org_members → brands → prompts → visibility_runs`). The fastest, safest way to
become a *platform* is to **turn our internal extension surfaces into first-class,
third-party-addressable registries** — the same pattern that made Shopify App Store,
Salesforce AppExchange, Atlassian Marketplace, and HubSpot Solutions Partners compound in
value.

Three forces we are engineering for:

1. **Switching costs** — a brand that installs 6 marketplace extensions, certifies 2 agency
   partners, and runs playbooks against its own prompt library cannot leave without
   re-platforming its entire AEO workflow.
2. **Third-party innovation** — developers/agencies ship engines, agents, analyzers, and
   integrations we would never have time to build, against a stable SDK.
3. **Network effects without linear eng cost** — each installed extension, each shared
   prompt, each benchmark submission makes the *baseline* product better for everyone; our
   internal team only runs the platform, the review process, and the revenue plumbing.

**Non-negotiable constraint:** everything below is *additive*. Existing tables, the RLS
funnel, the cookie auth path, the Razorpay lazy-init (`getRazorpay()`), and the
`CRON_SECRET` gating of `/api/cron/*` are **never modified in semantics**. New capability =
new table, new route, new env var, new migration. Feature-flagged.

---

## 1. The unifying design: one Extension Framework

Today the codebase already has registries — they are just private:

| Existing surface | File | Today | As a platform surface |
|---|---|---|---|
| Answer engines | `src/lib/visibility-engine.ts` `ENGINE_CALLERS` | 6 hardcoded callers | **Engine plugins** (new engines) |
| Lib modules | `src/lib/*` (site-audit, geo-linter, content-engine…) | internal imports | **Analyzer modules** (new analyzers) |
| Agent | `src/lib/agent-context.ts` `/api/agent/chat` | one built-in agent | **AI Agents** (deployable) |
| Prompts | `brands → prompts` | per-brand, private | **Community Prompt Library** (shareable) |
| Integrations | `integrations` table | GA4/Shopify/Zoho | **Integration Hub** (partner connectors) |

We generalize these into **one typed Extension Framework** with a single lifecycle,
permission model, review pipeline, and revenue path. Every one of the 15 build items is a
*flavor* of extension:

| # | Build item | Extension type | Registry |
|---|---|---|---|
| 1 | Marketplace | shell over all types | — |
| 2 | Plugin SDK | the SDK that authors all types | — |
| 3 | Partner Directory | `partners` table + profile | — |
| 4 | Certified Agency Program | `partners` (agency kind) + rev-share | — |
| 5 | AI Playbook Marketplace | `playbooks` (prompt+config bundles) | prompts |
| 6 | Integration Hub | `integrations` (partner-kind) | integrations |
| 7 | Public APIs | `api_keys` + REST/OpenAPI | — |
| 8 | AI Agent Marketplace | `extensions` (agent flavor) | agents |
| 9 | Community Prompt Library | `prompts` (shared scope) | prompts |
| 10 | Benchmark Community | `benchmark_submissions` (existing) + sharing | benchmark |
| 11 | Enterprise Extensions | `extensions` (enterprise flavor) | any |
| 12 | Revenue Sharing | `payout_ledger` + Razorpay Transfers | — |
| 13 | Developer Documentation | `/docs` + OpenAPI + SDK ref | — |
| 14 | Certification Academy | `certifications` + courses | — |
| 15 | Research Center | `research_datasets` (aggregated, anonymized) | — |

**Decision (recommended):** ship the framework once, then each build item is configuration
+ a data model + UI, not a bespoke subsystem.

---

## 2. Platform architecture (logical)

```
                         ┌─────────────────────────────────────────────┐
   Brand / Agency  ─────▶│  AnsarAEO App (Next.js 16 App Router)        │
   Developer / Partner   │  /dashboard  /marketplace  /developers      │
                         │  /admin  /docs                              │
                         └───────────────┬─────────────────────────────┘
                                         │  cookie auth (unchanged) + API-key auth (new)
                         ┌───────────────▼─────────────────────────────┐
                         │  Capability Gateway (SECURITY DEFINER)       │  ← NEW, the heart
                         │  validates installation token + capability   │
                         │  impersonates org_member within granted scope│
                         └───────┬───────────────────┬──────────────────┘
                  Hosted runtime │                   │ Connected (webhook)
                 (worker/V8 iso) │                   │ partner HTTPS endpoint
                         ┌───────▼────────┐    ┌──────▼──────────────────┐
                         │ Extension Host │    │ Partner Endpoint        │
                         │ (capability-   │    │ (signed payloads,       │
                         │  scoped, egress│    │  webhook sig verified)  │
                         │  proxied)      │    └─────────────────────────┘
                         └───────┬────────┘
                                 │
                 ┌───────────────▼────────────────────────────────────┐
                 │  Supabase (Postgres + Auth + RLS)                    │
                 │  Core (untouched): orgs, org_members, brands,        │
                 │    prompts, visibility_runs, citations, integrations │
                 │  Platform (new): extensions, installations,          │
                 │    capabilities, api_keys, partners, certifications, │
                 │    payout_ledger, playbooks, reviews, benchmark_*    │
                 └───────────────┬────────────────────────────────────┘
                                 │ service client (trusted, server-only)
                 ┌───────────────▼────────────────────────────────────┐
                 │  Revenue Plumbing: Razorpay (lazy getRazorpay()) +   │
                 │  Razorpay Transfers → developer-linked payout accts  │
                 │  cron reconciliation (reuses CRON_SECRET pattern)    │
                 └─────────────────────────────────────────────────────┘
```

The **Capability Gateway** is the single new runtime component. It is the only thing that
bridges third-party code to our data, and it enforces the permission model below.

---

## 3. Data model additions (all RLS org-scoped, additive)

Guiding rule (from `CLAUDE.md`): *user-facing code uses the cookie client; RLS funnels
every query through `org_members → brands → …`*. New tables follow the same funnel — every
platform table carries `org_id` (or `author_org_id`) and gets RLS policies keyed to
`org_members`.

### 3.1 `extensions` (the catalog row)
```sql
create table extensions (
  id uuid primary key default gen_random_uuid(),
  author_org_id uuid not null references orgs(id),
  slug text not null unique,                 -- "acme-readability-scorer"
  display_name text not null,
  type text not null                         -- engine|analyzer|agent|integration|playbook|enterprise
                 check (type in ('engine','analyzer','agent','integration','playbook','enterprise')),
  category text not null,
  summary text not null,
  description text,
  pricing_model text not null default 'free' -- free|one_time|subscription|usage|certification
                  check (pricing_model in ('free','one_time','subscription','usage','certification')),
  price_inr numeric,                          -- plan price (INR, matches PLAN_PRICING convention)
  revenue_share_pct numeric not null default 20,  -- platform take
  status text not null default 'draft'        -- draft|submitted|in_review|approved|published|suspended|archived
                  check (status in ('draft','submitted','in_review','approved','published','suspended','archived')),
  install_count int not null default 0,
  avg_rating numeric,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
-- RLS: readable by any authenticated user (public catalog); writable only by author_org members.
```

### 3.2 `extension_versions` (immutable, content-addressed)
```sql
create table extension_versions (
  id uuid primary key default gen_random_uuid(),
  extension_id uuid not null references extensions(id) on delete cascade,
  version text not null,                      -- semver
  manifest_json jsonb not null,               -- declared capabilities, endpoints, deps
  bundle_sha256 text,                         -- for hosted; null for connected
  execution_model text not null default 'connected' -- hosted|connected
                  check (execution_model in ('hosted','connected')),
  endpoint_url text,                          -- for connected (partner HTTPS)
  reviewed_by uuid,
  review_status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (extension_id, version)
);
```

### 3.3 `capabilities` (the permission vocabulary)
A flat, auditable capability list. Extensions request a *minimum* set; orgs grant a
*subset* at install. Mirrors the existing "scoped service client" philosophy.
```sql
create table capabilities (
  key text primary key,                        -- 'brands:read','visibility_runs:write',...
  description text not null,
  risk text not null default 'low' check (risk in ('low','medium','high'))
);
-- Seed rows:
--  brands:read, brands:write, prompts:read, prompts:write,
--  visibility_runs:read, visibility_runs:write, citations:read,
--  content_items:read, content_items:write, analytics:read,
--  webhooks:receive, integrations:manage, benchmark:submit
--  NEVER granted to 3p by default: impersonate, service_role, payments:pay
```

### 3.4 `installations` (org × extension, the grant)
```sql
create table installations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  extension_id uuid not null references extensions(id),
  version text not null,
  granted_capabilities text[] not null,       -- subset the org approved
  config_json jsonb not null default '{}',     -- partner-provided settings
  status text not null default 'active' check (status in ('active','paused','revoked')),
  installed_by uuid not null references auth.users(id),
  installed_at timestamptz not null default now(),
  unique (org_id, extension_id)
);
-- RLS: readable/writable only by org_members of org_id.
```

### 3.5 `api_keys` (public API auth — NEW auth path, does not touch cookie auth)
```sql
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  label text not null,
  key_prefix text not null,                    -- for display/"sk_live_abc…"
  key_hash bytea not null,                     -- store hash only (never raw), like ENCRYPTION_KEY handling
  scopes text[] not null,                      -- capability keys granted to this key
  rate_tier text not null default 'standard',  -- standard|pro|enterprise (maps to plan)
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
-- RLS: only org_members of org_id may read/rotate their org's keys.
```

### 3.6 Revenue / partnership / enablement
```sql
create table partners (
  org_id uuid primary key references orgs(id),
  kind text not null check (kind in ('developer','agency','technology','enterprise')),
  company_name text not null, gstin text,       -- INR payout/KYC (reuse Razorpay)
  razorpay_linked_account text,                  -- for Transfers
  tier text default 'member' check (tier in ('member','certified','elite')),
  referral_code text unique,                     -- Certified Agency Program rev-share
  directory_visible boolean default true,
  bio text, logo_url text, website text
);

create table payout_ledger (
  id uuid primary key default gen_random_uuid(),
  extension_id uuid references extensions(id),
  partner_org_id uuid references orgs(id),
  gross_inr numeric not null, platform_fee_inr numeric not null,
  developer_inr numeric not null, razorpay_transfer_id text,
  period_start date, period_end date, status text default 'pending',
  created_at timestamptz not null default now()
);

create table certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  org_id uuid references orgs(id),
  tier text not null check (tier in ('associate','professional','expert')),
  track text not null,                           -- developer|agency|architect
  issued_at timestamptz not null default now(),
  expires_at timestamptz
);

create table playbooks (
  id uuid primary key default gen_random_uuid(),
  author_org_id uuid references orgs(id),
  title text not null, prompt_template text not null,
  config_json jsonb not null default '{}', scope text default 'public'
    check (scope in ('public','org','private')),
  installs int not null default 0
);

create table extension_reviews (
  id uuid primary key default gen_random_uuid(),
  extension_id uuid not null references extensions(id),
  org_member_id uuid not null references auth.users(id),
  rating int not null check (rating between 1 and 5),
  body text, helpful int not null default 0, created_at timestamptz not null default now()
);
```

All new tables get the same RLS treatment as core: policies referencing `org_members`
(`auth.uid()` → membership → row access). No existing table is altered.

---

## 4. Permission model (capability-scoped, no raw service key to 3p)

**Principle:** a third-party extension *never* receives the Supabase service role key and
*never* receives the installing user's session cookie. It receives a **capability-scoped
installation token** (a short-lived JWT, HS256, signed by a platform secret; the secret is
stored with the same at-rest care as `ENCRYPTION_KEY` — AES-256-GCM, never logged).

Flow:
1. At install, org approves a capability subset via a consent modal.
2. Platform issues `installation_token = sign({ installation_id, org_id, caps[] }, PLATFORM_SECRET, ttl=1h)`.
3. Extension calls the **Capability Gateway** (`/api/platform/*`) presenting the token + the
   capability it wants to exercise.
4. Gateway verifies signature + expiry, then calls a `SECURITY DEFINER`
   `check_capability(installation_id, required_cap)` function that:
   - confirms the capability is in the installation's `granted_capabilities`,
   - confirms the target resource belongs to `org_id` (reuses the existing
     `org_members → brands → …` ownership chain),
   - returns an authorized, *scoped* service-client query result.
5. For **connected** extensions, outbound calls to the partner endpoint are signed (HMAC)
   identically to the Razorpay webhook verification, and the partner verifies the signature
   before trusting payloads.

**Why this is safe and consistent:** it is exactly the existing rule "service client bypasses
RLS, server-only, trusted work" — extended so that *third-party* trusted work is also scoped,
logged, and revocable per installation. `revoked` installations immediately fail gateway
checks. High-risk capabilities (`visibility_runs:write`, `integrations:manage`) require
explicit org consent and are flagged in review.

---

## 5. SDK design

Two complementary packages, both published from this repo (npm `@ansaraeo/sdk`,
`@ansaraeo/api-client`), matching the existing TypeScript/Next.js conventions (`zod` for
validation, relative-import-friendly).

### 5.1 Extension SDK (`@ansaraeo/sdk`) — for builders
Server-side (Node). Lets a developer declare an extension and register handlers into the
same registries the core uses.
```ts
import { defineEngine, defineAgent, defineAnalyzer, defineIntegration,
        createExtension, AnsarAEOContext } from "@ansaraeo/sdk";

// An Engine plugin → slots into ENGINE_CALLERS at runtime
export const myEngine = defineEngine({
  name: "my_engine",
  capabilities: ["visibility_runs:write"],
  async run(ctx: AnsarAEOContext, promptText: string) {
    // ctx is capability-scoped; network egress is proxied + logged
    const res = await ctx.fetch("https://api.my-engine.example", { … });
    return { content: res.text, citedUrls: res.citations };
  },
});

// An AI Agent → slots into the agent registry (mirrors /api/agent/chat)
export const myAgent = defineAgent({
  name: "support-triage",
  capabilities: ["prompts:read", "content_items:write"],
  async handle(ctx, message) { /* … */ },
});

export default createExtension({ name: "acme-aeo-pack", version: "1.0.0",
  engines: [myEngine], agents: [myAgent] });
```
The SDK also ships: `verifyWebhook(rawBody, signature)` (mirrors Razorpay sig check),
`manifest()` validator, and a **local dev harness** (`aeo dev`) that boots a seeded test
org so the extension can be exercised end-to-end before submission.

### 5.2 Public API client (`@ansaraeo/api-client`) — for integrators
Typed wrapper over the Public REST API (§7). API-key auth, auto rate-limit backoff, zod
response types. (Separate from the SDK because its consumers are *not* running inside our
runtime — they are pulling AnsarAEO data into their own apps.)

---

## 6. Marketplace architecture

**Two execution models** (both first-class):

- **Connected (default for v1, lower risk):** partner hosts an HTTPS endpoint; AnsarAEO
  invokes it with signed payloads. Partner verifies signature. No untrusted code in our
  runtime. Ideal for integrations, enterprise extensions, and agents.
- **Hosted (v2):** extension bundle (content-addressed `bundle_sha256`) runs inside our
  **Extension Host** — worker threads / V8 isolate, no internal network except the
  Capability Gateway, egress proxied + logged, CPU/mem capped, per-extension failure
  isolation via `Promise.allSettled` (reusing the existing per-engine isolation pattern).

**Lifecycle state machine** (`extension_versions.review_status` + `extensions.status`):
```
draft → submitted → in_review → (auto-screen pass?) → approved → published
                                  │
                                  └─ fail → changes_requested → submitted
published → suspended (security/abuse) → archived
```
Patch versions with *no new capabilities* auto-publish after the automated screen.
Minor/major or new capabilities always require human review for paid listings.

**Catalog / discovery:** `extensions` is the public, RLS-readable catalog. Search/filter by
`type`, `category`, `pricing_model`, `avg_rating`. Install count + ratings drive ranking;
featured slots are admin-curated (§12).

---

## 7. Public APIs

REST, versioned (`/api/v1/...`), auth via `api_keys` (new path, **does not alter** the
cookie/session auth used by the app). Key presented as `Authorization: Bearer sk_live_…`;
gateway hashes + looks up + checks `scopes` + enforces `rate_tier` (standard/pro/enterprise
mirroring plan tiers). All request/response bodies validated with `zod` (existing pattern).

| Endpoint | Capability | Notes |
|---|---|---|
| `GET /v1/brands` | `brands:read` | list brands for the key's org |
| `GET /v1/prompts` | `prompts:read` | language-tagged (existing model) |
| `GET /v1/visibility-runs` | `visibility_runs:read` | includes citations, competitor_mentions |
| `POST /v1/visibility-runs` | `visibility_runs:write` | trigger a run (respects engine skip rules) |
| `GET /v1/citations` | `citations:read` | |
| `GET /v1/analytics` | `analytics:read` | rollups |
| `POST /v1/agents/{slug}/invoke` | agent capability | invoke an installed agent |
| `POST /v1/benchmark` | `benchmark:submit` | feed the Benchmark Community |

Reuses existing route handlers' *logic* (never duplicate — the `CLAUDE.md` "shared report
code path" rule applies: put platform-facing logic in the lib layer, route handlers stay thin).
OpenAPI 3.1 spec generated and served at `/docs/openapi.json`; developer portal renders it.

---

## 8. Revenue model

Built entirely on the existing Razorpay integration (`getRazorpay()`, webhook signature
verification). We add **Razorpay Transfers** so a single customer payment is split at capture:
`gross = platform_fee (revenue_share_pct, default 20%) + developer_payout`, routed to the
developer's `razorpay_linked_account`. Platform default take **20%** (between Shopify 20% /
Atlassian 25% / HubSpot 15–20%). Free & community extensions = 0%.

| Stream | Mechanism | Platform take |
|---|---|---|
| Paid extension subscription/usage | Razorpay Transfers at capture | 20% |
| One-time extension | Razorpay Transfers | 20% |
| Certified Agency referral | `partners.referral_code` on new subscription | 15–25% (tiered) |
| Certification Academy | one-time INR course/exam | 100% |
| Enterprise Extensions | annual contract, invoiced | 100% (custom) |
| Listing fee | optional one-time for featured placement | 100% |

`payout_ledger` records every split; a **cron job** (reusing the `CRON_SECRET` gating pattern
from `/api/cron/*`) reconciles ledger vs Razorpay transfers monthly and flags discrepancies.
Partner payout credentials stored encrypted with the same `ENCRYPTION_KEY` AES-256-GCM
handling — never plaintext, never logged.

---

## 9. Security

Threats and controls (consistent with `CLAUDE.md` strict rules):

- **No service key to 3p** → capability-scoped installation tokens + Gateway + SECURITY
  DEFINER checks (§4).
- **Supply chain / malicious hosted code** → automated review (§10) blocks `child_process`,
  dynamic `eval` of untrusted input, non-allowlisted `require`, and outbound calls outside
  the egress proxy; hosted bundles run sandboxed with resource caps; per-extension failure
  isolation.
- **Webhook tampering** → HMAC signature verification (mirror of Razorpay webhook) on every
  connected call, both directions.
- **Secret leakage** → `key_hash` only for API keys; platform secret + partner payout creds
  AES-256-GCM at rest; never logged (existing rule).
- **Privilege creep** → high-risk capabilities require explicit org consent + flagged review;
  `impersonate`/`service_role`/`payments:pay` are **deny-by-default, never granted to 3p**.
- **Abuse / spam in community** → rate tiers, install consent, admin suspension (§12),
  review moderation.
- **RLS integrity** → core tables untouched; new tables inherit the `org_members` funnel.

---

## 10. Review process

**Automated pre-screen (CI, runs on every submit):**
1. Manifest schema validation (zod) — declared capabilities, endpoints, deps.
2. Capability-minimization audit — warn if requested caps exceed functional need.
3. Dependency CVE scan — block known vulnerabilities.
4. Static analysis — forbid dangerous APIs (see §9).
5. Sandbox smoke test — run against a seeded test org; assert no internal-network calls,
   no crashes, capability boundaries respected.

**Tiered human review:**
- *Free / Community / Playbook / Prompt:* automated only.
- *Paid / Agent / Enterprise:* automated + human (SLA). Enterprise adds security review +
  contract.
- Version bumps: patch w/ same caps → auto-publish; new caps → human re-review.

**Outcome:** `changes_requested` (with reasons) or `approved → published`. Post-publish
monitoring feeds suspension decisions.

---

## 11. Developer documentation

- `/docs` route group (new, separate from marketing) — getting started, quickstarts
  ("Build your first engine", "Build your first agent", "Connect an integration"),
  recipe cookbook, SDK reference (TypeDoc from `@ansaraeo/sdk`), and the live OpenAPI
  console.
- `README` + `examples/` in the SDK package.
- `INTEGRATION_GUIDE.md` (exists) extended with the partner/extension authoring path.
- Changelog + capability vocabulary reference (`capabilities` table seeded values).
- The codebase's own disciplined comments (e.g., the `callCopilot` "never fake an engine"
  honesty note) become the tone of the docs — *honesty design* carries into the ecosystem.

---

## 12. Certification flow + Partner onboarding

**Certification Academy:** courses + quiz + proctored exam → `certifications` row
(associate / professional / expert; tracks: developer / agency / architect). Badge unlocks
directory eligibility and higher revenue-share tiers. Paid (one-time INR), platform keeps
100%.

**Partner onboarding (wizard in `/developers` or `/dashboard/partners`):**
1. Apply → choose kind (developer / agency / technology / enterprise).
2. KYC: `gstin` + link Razorpay payout account (reuse Razorpay; enables Transfers).
3. Profile → `partners` row → Partner Directory (public, `directory_visible`).
4. Certified Agency gets a `referral_code` for subscription rev-share.
5. Submit first extension → enters review (§10).

**Partner Directory:** public browse of certified agencies/tech partners with bio, logo,
tier, specialties, and (optionally) their published extensions.

---

## 13. Marketplace UX & Administration portal

**Marketplace UX:**
- Public storefront `/marketplace` — categories, ratings, pricing, install.
- In-app **Discover** inside `/dashboard` — 2-click install with a capability-consent modal
  (shows exactly what the extension can read/write).
- **Publisher console** `/developers` — submit/manage versions, view install analytics,
  payout dashboard.

**Administration portal `/admin`** (gated by `org_members.role = platform_admin`):
- Review queue (§10) with diff + capability view.
- Extension analytics + `payout_ledger` reconciliation view.
- Certification issuance / revocation.
- Partner management + directory moderation.
- Featured/shelf curation, fraud & abuse suspension.
- Security incident log.

---

## 14. Rollout strategy (phased, each phase additive + flag-gated)

- **Phase 0 — Foundation (no marketplace UI):** `extensions`, `extension_versions`,
  `capabilities`, `installations`, `api_keys` tables + RLS; Capability Gateway; API-key
  auth middleware branch. *Zero customer-facing change.*
- **Phase 1 — Public API + API keys:** lowest risk, immediate partner value. (§7)
- **Phase 2 — Partner Directory + Developer onboarding + SDK v0.** (§11, §12)
- **Phase 3 — Marketplace storefront + install flow + reviews.** Connected model only. (§6, §13)
- **Phase 4 — Prompt / Playbook / Benchmark libraries** (mostly data, low risk). (items 5,9,10)
- **Phase 5 — Revenue sharing:** Razorpay Transfers + `payout_ledger` + cron reconciliation. (§8)
- **Phase 6 — Certification Academy + Certified Agency Program.** (§12)
- **Phase 7 — Enterprise Extensions + Hosted execution GA + Research Center.** (items 11,15)

Each phase: new migration(s), new route group, feature flag, and its own tests. No phase
modifies a prior phase's table semantics.

---

## 15. Testing

Reuse the existing vitest setup (`src/**/*.test.ts`, **relative imports only**, deterministic
parsers via `vi.stubGlobal("fetch", …)`):
- Capability Gateway unit tests — granted vs denied capability, org-boundary enforcement,
  revoked installation, token expiry (stub `fetch`/clock).
- Manifest validator + signature verification (mirror Razorpay webhook test).
- Review auto-screen — assert dangerous-API detection, dependency-block.
- Revenue ledger reconciliation — given capture events, assert split + ledger match.
- Extension execution isolation — one failing extension does not break the batch
  (`Promise.allSettled`, reuse engine pattern).
- E2E against a seeded test org (add to `supabase/reset.sql` reseed: a demo extension +
  test org + test API key).

---

## 16. Migration plan

Follow `CLAUDE.md`: *migrations sequential, `schema.sql` → `migration_002…011` (+`015`);
add new ones in order; never alter existing migrations.* New files:
`migration_016_platform_extensions`, `017_capabilities`, `018_installations`,
`019_api_keys`, `020_partners_revenue`, `021_certifications_playbooks`.
Update `supabase/reset.sql` to include new tables **with RLS**, and extend the reseed with a
demo extension + test org + test API key (so tests and dev have fixtures).
**Zero-downtime:** new tables are unused by existing queries; API-key auth is a *new*
middleware branch, not a change to cookie auth.

---

## 17. Documentation deliverables

- This file (`PLATFORM_ARCHITECTURE.md`) — the design of record.
- `INTEGRATION_GUIDE.md` (extend) — partner/extension authoring.
- `/docs` site + OpenAPI spec (§11).
- `@ansaraeo/sdk` README + examples + TypeDoc.
- `PLATFORM_RUNBOOK.md` — review queue ops, suspension, payout reconciliation, incident
  response (for `/admin` operators).
- Migration notes per phase in `BATCH*_SETUP_NOTES.md` (per repo convention).

---

## 18. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Malicious/hostile extension | Capability scope + sandbox + egress proxy + review + suspension |
| Revenue leakage / split errors | `payout_ledger` + monthly cron reconciliation vs Razorpay |
| Breaking core app | Additive-only; new auth branch; RLS funnel unchanged; feature flags |
| Low-quality community content | Ratings, moderation, certified tier, automated screen |
| Supply-chain CVEs | Dependency scan in CI pre-screen |
| Partner payout fraud | GSTIN KYC + Razorpay linked accounts + ledger audit |

---

### One-line summary
Turn `ENGINE_CALLERS` and the `org_members → brands` funnel into a **capability-scoped
Extension Framework**: one data model, one permission gateway, one SDK, one review pipeline,
and one Razorpay-based revenue split — so every one of the 15 ecosystem build items is
configuration on top of a single platform, not 15 separate subsystems, and the existing SaaS
keeps running untouched.

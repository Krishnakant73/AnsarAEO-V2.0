# Batch 26 — Third-Party Integrations Rollout

Date: 2026-07-20
Plan: `C:\Users\Krishna\.claude\plans\snappy-kindling-planet.md`

Wired 14 third-party services into AnsarAEO without breaking the existing pipeline (visibility runs, Postgres job queue, Zoho email, Razorpay). Every batch shipped with `npm run typecheck` + `npm test` (381 passing) + `npm run build` all green.

## What each service is for

| Service | Role | Where the code lives |
|---|---|---|
| **Sentry** | Error + performance tracking | `instrumentation.ts`, `sentry.{server,edge}.config.ts`, `instrumentation-client.ts`, `app/global-error.tsx` |
| **OpenTelemetry** | Trace export → Better Stack | `instrumentation.ts` (via `@vercel/otel`), `src/lib/otel.ts` |
| **Better Stack** | Uptime + telemetry ingest | Uptime = dashboard-only monitor for `/api/health`; telemetry = OTLP bearer token |
| **PostHog** | Session replay + autocapture + flags | `src/app/providers.tsx`, `src/lib/posthog-server.ts` |
| **Mixpanel** | Funnels + retention (dual-track w/ PostHog) | `src/app/providers.tsx`, `src/lib/mixpanel.ts` |
| **GrowthBook** | Feature flags via Vercel Flags SDK | `src/flags.ts`, `src/lib/identify.ts` |
| **Resend** | Transactional email (additive to Zoho) | `src/lib/email.ts` (unified wrapper) |
| **Inngest** | Event-driven workflows (additive to Postgres queue) | `src/inngest/client.ts`, `src/inngest/functions.ts`, `src/app/api/inngest/route.ts` |
| **OpenRouter** | New answer engine (7th) | `callOpenRouter` in `src/lib/visibility-engine.ts` + `supabase/migration_030_openrouter_engine.sql` |
| **Tavily** | Web search API | `src/lib/tavily.ts` |
| **Crawl4AI** | JS-rendered web crawling via sidecar | `src/lib/crawl.ts` (with fetch+cheerio fallback) |
| **DataForSEO** | Google AI Overview scraping (was already wired) | `src/lib/google-ai-overview.ts` — added missing env vars to example |
| **Zoho SMTP** | Email (existing, coexists w/ Resend) | Unchanged — `src/lib/onboarding-emails.ts` routes through unified wrapper w/ `provider: "zoho"` |

## Env vars — where each lives

Complete reference: `.env.all.example`. Memory index: [[integration-keys-map]] in `C:\Users\Krishna\.claude\projects\C--AEO\memory\`.

Typed getters (skip-not-throw pattern) in `src/lib/env.ts`:
```
getOpenRouterConfig()  getSentryConfig()  getPostHogConfig()
getMixpanelToken()     getGrowthBookConfig()  getBetterStackUptimeToken()
getBetterStackTelemetryToken()  getOtelConfig()  getInngestConfig()
getResendConfig()      getTavilyApiKey()  getCrawl4AIConfig()
```

Every getter returns `null` when required vars are missing — same discipline as the pre-existing `callGrok` / `callCopilot` engine skips in `src/lib/visibility-engine.ts`.

## Migration 030 — OpenRouter engine

File: `supabase/migration_030_openrouter_engine.sql`

Applied 2026-07-20 to production DB `hfibvuxiqnigwnraezga` via Supabase MCP. Row seeded with `is_active=true` per user request. Verified in DB:

```
select name, is_active from engines order by name;
chatgpt, copilot, gemini, google_ai_overview, grok, openrouter, perplexity
→ all is_active=true
```

Next `/api/cron/nightly-runs` fires all 7 engines automatically.

## What's live vs what needs your terminal

**Auto-enabled the moment their env var is populated:**
- PostHog, Mixpanel, GrowthBook, OpenTelemetry → Better Stack, Inngest, Resend, Tavily, OpenRouter, DataForSEO

**Requires you to run something interactive:**

1. **Sentry wizard** — the wizard opens a browser for OAuth. Files it would create are already written manually (`instrumentation.ts`, `sentry.{server,edge}.config.ts`, `instrumentation-client.ts`, `global-error.tsx` with `Sentry.captureException` hook, `next.config.ts` wrapped in `withSentryConfig`). Running the wizard adds `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, and `SENTRY_AUTH_TOKEN` to `.env.local`:
   ```
   npx @sentry/wizard@latest -i nextjs --saas --org ansaraeo --project javascript-nextjs
   ```
   Accept its updates when it detects existing files — the manual layer already matches the reference at `skills.sentry.dev/sentry-instrument/references/sdks/nextjs/index.md`.

2. **Inngest dev server** — long-running local dev harness, not a one-shot wizard:
   ```
   npx inngest-cli@latest dev
   ```
   Opens `http://localhost:8288` to introspect functions and trigger test events. Ctrl+C to stop.

3. **Crawl4AI sidecar** — deploy `unclecode/crawl4ai` to Modal/Fly/Render (Python service; can't run on Vercel). Once up, set `CRAWL4AI_API_URL` + `CRAWL4AI_API_KEY`. Until then, `crawl()` falls back to `fetch` + `cheerio` (same path `site-audit-engine.ts` uses today).

4. **Better Stack Uptime dashboard** — one-time dashboard config, no code. Point an HTTPS monitor at `https://ansaraeo.com/api/health`.

5. **GrowthBook dashboard** — create the `openrouter-engine-enabled` flag (default: `false`). Provides a kill switch for the OpenRouter engine if it needs to be disabled without a redeploy.

## Rules the rollout preserved

Per `CLAUDE.md`:
- Razorpay lazy-init pattern extended to all new clients (`getResend()`, `getMixpanel()`, `getPostHog()`, `getCrawl4AIConfig()`). No top-level `new X(...)` calls.
- Per-engine failure isolation — `callOpenRouter` returns `{skipped: true, skipReason: "OPENROUTER_API_KEY not configured"}` when unset; never throws into `Promise.allSettled`.
- No fake engine APIs. OpenRouter hits `https://openrouter.ai/api/v1/chat/completions` with a real key.
- Migrations sequential — `migration_030_openrouter_engine.sql` slots after 029.
- Shared report code path — no per-provider PDF logic added.
- Deterministic mention classification unchanged. OpenRouter output feeds the same `reconcileMentionSignal` reconciliation.
- Analytics/observability never throws into the caller path (`reportError`, `captureServerEvent`, `trackServerEvent`, `sendInngestEvent` all swallow errors internally).
- `EMAIL_DRY_RUN=true` + missing `ZOHO_SMTP_USER` still trigger implicit dry-run for the Zoho path (preserves pre-rollout behavior of `onboarding-emails.ts`).

## Verification

Ran end-to-end after every batch and once at the end:

```
npm run typecheck   # 0 errors
npm test            # 381 passed
npm run build       # green, all routes prerender/dynamic as expected
```

Confirmed the `engines` table in production DB has all 7 rows active.

## Rollback playbook

Per-service reversal, all reversible via a single commit each:

| Service | Rollback |
|---|---|
| Sentry | Remove `withSentryConfig` wrapper in `next.config.ts`, delete `sentry.*.config.ts` + `instrumentation-client.ts`. |
| OpenTelemetry | Remove `@vercel/otel` `registerOTel` call in `instrumentation.ts`. |
| PostHog / Mixpanel | Remove `AppProviders` wrap in `layout.tsx`. |
| GrowthBook | Delete `src/flags.ts` + `src/lib/identify.ts`. |
| Resend | Set caller `provider: "zoho"` (default already), then delete `src/lib/email.ts` Resend branch. |
| Inngest | Delete `src/app/api/inngest/route.ts` + `src/inngest/*` — Postgres queue is untouched, so no cascading effects. |
| OpenRouter | `update engines set is_active=false where name='openrouter'` in Supabase. |
| Tavily / Crawl4AI | Delete `src/lib/{tavily,crawl}.ts` — no callers reference them yet. |

## Files changed in this batch

**New:**
- `src/lib/env.ts`
- `src/lib/otel.ts`
- `src/lib/email.ts`
- `src/lib/mixpanel.ts`
- `src/lib/posthog-server.ts`
- `src/lib/identify.ts`
- `src/lib/tavily.ts`
- `src/lib/crawl.ts`
- `src/flags.ts`
- `src/app/providers.tsx`
- `src/inngest/client.ts`
- `src/inngest/functions.ts`
- `src/app/api/inngest/route.ts`
- `instrumentation.ts`
- `instrumentation-client.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `supabase/migration_030_openrouter_engine.sql`

**Modified:**
- `.env.all.example` — 14 new integration blocks
- `.env.local` — pasted integration keys (values gitignored, not committed)
- `next.config.ts` — wrapped in `withSentryConfig`
- `src/app/layout.tsx` — `<AppProviders>` mount
- `src/lib/monitoring.ts` — `reportError` also calls `Sentry.captureException`
- `src/lib/onboarding-emails.ts` — `sendEmail` delegates to unified wrapper
- `src/lib/visibility-engine.ts` — `callOpenRouter` added to `ENGINE_CALLERS`
- `src/app/global-error.tsx` — Sentry `captureException` hook

## Memory files created

Under `C:\Users\Krishna\.claude\projects\C--AEO\memory\`:
- `integration-keys-map.md` — env var names + purpose (no values)
- `env-lib.md` — pointer to `src/lib/env.ts` conventions
- `crawl4ai-hosting.md` — deployment decision (sidecar on Modal/Fly/Render)

Indexed in `MEMORY.md`.

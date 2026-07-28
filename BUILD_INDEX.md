# AnsarAEO — Master Build Index (Batches 1–20)

Merge order matters for a couple of files that got revised multiple times (noted below).
When in doubt, the HIGHEST batch number's version of a file is the correct/final one.

| Batch | What it added | Key new files |
|---|---|---|
| 1 | Supabase schema, auth (signup/login), core visibility-check API (single engine) | `schema.sql`, `supabase/*.ts`, `(auth)/*`, `/api/visibility-check` |
| 2 | Onboarding flow, real dashboard, prompts page | `onboarding/*`, `dashboard/page.tsx` (later revised), `dashboard/prompts/*` |
| 3 | Multi-engine tracking (ChatGPT + Perplexity + Gemini) | `visibility-check/route.ts` (later revised in Batch 4, 15) |
| 4 | Nightly scheduler, shared engine logic | `lib/visibility-engine.ts` (later revised in Batch 15), `/api/cron/nightly-runs` |
| 5 | Auth fixes, Google login, forgot password | `schema.sql` fix + `reset.sql`, updated `(auth)/*` |
| 6 | Legal pages, Contact form (Zoho SMTP), cookie consent, terms checkbox | `terms`, `privacy`, `refund-policy`, `about`, `contact`, `CookieConsent.tsx` |
| 7 | Resources hub, full blog, LinkedIn link | `resources/*`, updated `posts.ts`, `Footer.tsx` (later revised in Batch 13, 16) |
| 8 | Razorpay billing | `migration_002_billing.sql`, `/api/billing/*`, `settings/billing/*` |
| 9 | Agent chat (grounded) | `migration_003_agent.sql`, `lib/agent-context.ts`, `/api/agent/chat` (later revised in Batch 16) |
| 10 | Site Audit | `migration_004_site_audit.sql`, `lib/site-audit-engine.ts`, `site-audit/*` |
| 11 | Content Studio (E-E-A-T gated) | `migration_005_content_studio.sql`, `lib/content-engine.ts`, `content/*` |
| 12 | Citations page | `citations/page.tsx` (later revised in Batch 16) |
| 13 | WhatsApp automation | `migration_006_whatsapp.sql`, `lib/whatsapp.ts`, `/api/whatsapp/*`, `settings/integrations/*` |
| 14 | Production deployment checklist | `vercel.json` (later revised in Batch 18), `.env.all.example`, `PRODUCTION_DEPLOYMENT_CHECKLIST.md` |
| 15 | **Real charts + competitor mention tracking + auto-discovery** | `migration_007_competitors.sql`, `lib/visibility-engine.ts` (rewrite), `competitors/*`, chart components |
| 16 | **Multi-brand support (agency fix)** | `lib/selected-brand.ts`, `BrandSwitcher.tsx`, `/api/brands/*` — updated nearly every dashboard page |
| 17 | Reports page (PDF + portfolio view) | `lib/report-document.tsx`, `/api/reports/generate` |
| 18 | Weekly automated email reports | `lib/reports.ts`, `/api/cron/weekly-reports`, `vercel.json` (final version) |
| 19 | Revenue attribution (GA4 + Shopify) | `migration_008_revenue_attribution.sql`, `lib/revenue-attribution.ts`, `revenue/*` |
| 20 | **Credential encryption fix** | `lib/crypto.ts` — updated Batch 19's analytics routes |

## Files revised more than once — use the LATEST version
- `src/app/dashboard/page.tsx` — final version in Batch 16
- `src/lib/visibility-engine.ts` — final version in Batch 15
- `src/app/dashboard/layout.tsx` — final version in Batch 19
- `src/app/api/agent/chat/route.ts` — final version in Batch 16
- `src/app/dashboard/prompts/page.tsx`, `competitors/page.tsx`, `citations/page.tsx`, `site-audit/page.tsx`, `content/page.tsx` — final versions in Batch 16
- `vercel.json` — final version in Batch 18
- `src/app/api/settings/analytics/route.ts`, `/api/analytics/revenue/route.ts` — final versions in Batch 20
- `src/components/footer/Footer.tsx` — final version in Batch 13

## What genuinely has NOT been built yet (being honest, not padding this list)
- Automated tests for any of the new API routes (only the original `utils.test.ts` exists)
- Multi-language prompt tracking beyond English/Hindi toggle (Tamil/Bengali/Marathi from the original roadmap)
- Marketplace visibility (Amazon Rufus, Flipkart AI assistant) — these don't have public APIs suitable for this yet, genuinely hard to build regardless of time spent
- WordPress auto-publish integration for Content Studio's approved drafts
- A queue-based job runner (BullMQ/Trigger.dev) — the nightly cron and weekly reports still loop sequentially, fine at current scale, not fine at hundreds of customers

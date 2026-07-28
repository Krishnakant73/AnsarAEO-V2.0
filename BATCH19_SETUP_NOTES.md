# Batch 19 — Revenue Attribution (GA4 + Shopify)

This is the biggest external-integration batch after WhatsApp — it connects to the
BRAND's OWN Google Analytics and Shopify accounts (not your SaaS's own analytics), which
is what makes the "AI search → sessions → orders → revenue" claim from
`04-feature-spec.md` and your own `cfo-ready-aeo-reports` blog post real instead of
aspirational.

## 1. Install new dependencies
```bash
npm install jsonwebtoken
npm install -D @types/jsonwebtoken
```

## 2. Run the migration
Supabase Dashboard → SQL Editor → run **`supabase/migration_008_revenue_attribution.sql`**.

## 3. Files in this batch

| File | What it does |
|---|---|
| `src/lib/revenue-attribution.ts` | Fetches GA4 sessions (filtered to AI-referral sources) and Shopify orders |
| `src/app/api/settings/analytics/route.ts` | Saves a brand's GA4/Shopify credentials |
| `src/app/dashboard/settings/analytics/page.tsx` + `AnalyticsConnect.tsx` | UI to connect both |
| `src/app/api/analytics/revenue/route.ts` | Combines both data sources by date |
| `src/app/dashboard/revenue/page.tsx` + `RevenueAttributionClient.tsx` | The actual Revenue Attribution dashboard page |
| `src/app/dashboard/layout.tsx` | Added "Revenue" to the sidebar |

## 4. Why service-account auth instead of full OAuth (an honest tradeoff)
A "Connect your Google account" OAuth consent-screen flow is the more polished UX, but
it's meaningfully more setup work (Google app verification, consent screen review,
handling token refresh). The lighter alternative — the brand owner creates a Google
Cloud service account, downloads its JSON key, and adds that service account's email as
a **Viewer** on their own GA4 property — is a well-established pattern for server-to-
server analytics access and is genuinely faster to ship. If this becomes a core, heavily-
used feature later, upgrading to full OAuth is the natural next step for a smoother
setup experience.

## 5. CRITICAL security note (read this before any real customer uses this)
Credentials (GA4 service account JSON, Shopify access tokens) are currently stored as
**plaintext JSONB** in the `integrations` table. This is acceptable to get the feature
working and tested, but before real customers connect real business accounts:
- Encrypt this column — either with **Supabase Vault** (built for exactly this) or
  application-level encryption before insert / decryption on read
- These are live credentials to a customer's real business systems — treat this with the
  same seriousness as the `SUPABASE_SERVICE_ROLE_KEY` guidance from the deployment
  checklist

## 6. How to actually get test credentials

**GA4:**
1. [console.cloud.google.com](https://console.cloud.google.com) → IAM & Admin → Service
   Accounts → Create Service Account
2. Create a JSON key for it, download it
3. In Google Analytics → Admin → Property Access Management → add the service account's
   email (looks like `xxx@yyy.iam.gserviceaccount.com`) as a **Viewer**
4. Find your GA4 Property ID: Admin → Property Settings (a numeric ID)
5. Paste both into `/dashboard/settings/analytics`

**Shopify:**
1. Any Shopify store (a free development store works for testing) → Settings → Apps →
   Develop apps → Create an app
2. Configure Admin API scopes → at least `read_orders`
3. Install the app → copy the Admin API access token (starts `shpat_`)

## 7. Test it
```bash
npm run dev
```
1. Connect GA4 and/or Shopify at `/dashboard/settings/analytics`
2. Go to `/dashboard/revenue` — you should see real AI-referral session counts (if any
   exist in the connected GA4 property's last 30 days) and/or real Shopify order/revenue
   numbers
3. If a brand has no AI-referred traffic yet (realistic for a new/test GA4 property), the
   session count will honestly show 0 — that's correct behavior, not a bug

## 8. Honest scope note
This links GA4 sessions and Shopify orders by **date only** (not by session, since GA4's
standard reporting API doesn't expose session-to-transaction-level joins without GA4's
more complex BigQuery export setup). This means the chart shows "AI sessions this day"
next to "orders/revenue this day" as a correlation, not a guaranteed one-to-one causal
link. That's an honest limitation to communicate to any customer using this — it's
directionally useful (a CFO can see "AI traffic and revenue trend together"), not a
literal per-order attribution model. A deeper implementation would use GA4's BigQuery
export (event-level data) to join AI-session users to their actual purchase events — a
real Phase 3+ upgrade if this feature proves valuable enough to invest further in.

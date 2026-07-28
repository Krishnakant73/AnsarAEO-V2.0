# Production Deployment Checklist — AnsarAEO

Go through this in order. Don't skip the security section to save time — the two items
marked **CRITICAL** are genuinely not optional.

---

## 1. Deploy to Vercel

1. Push your full repo (all 14 batches merged) to GitHub
2. [vercel.com](https://vercel.com) → New Project → import the repo
3. Framework preset: Next.js (auto-detected)
4. Before the first deploy, add every variable from **`.env.all.example`** in
   Project Settings → Environment Variables (use your real production values, not test
   ones — see Section 3 for which ones need to change from test to live)
5. Deploy
6. Add your custom domain (`ansaraeo.com`) in Project Settings → Domains, and update your
   domain registrar's DNS records as Vercel instructs

## 2. Set up Vercel Cron (nightly runs + WhatsApp digest)

`vercel.json` (included in this batch) is already configured with:
- `/api/cron/nightly-runs` at 20:30 UTC = ~2:00 AM IST
- `/api/whatsapp/send-digest` at 03:00 UTC = ~8:30 AM IST

**Important:** Vercel's free "Hobby" plan only allows cron jobs to run **once per day**,
which both of these already respect. If you upgrade to Pro later and want more frequent
runs (e.g., high-priority prompts checked every few hours per Part 3's volatility
segmentation), you can add additional cron entries then.

## 3. Switch every "test mode" credential to live/production

Go through each of these — using test keys in production is the single most common
"why isn't this working for real customers" mistake:

| Service | Test → Live change |
|---|---|
| Razorpay | Toggle Dashboard to Live Mode, generate Live API keys, create a **second** webhook for Live Mode, update `RAZORPAY_KEY_ID`/`SECRET`/`WEBHOOK_SECRET` |
| WhatsApp | Complete Business Verification, get a production phone number, generate a permanent System User token (not the 24-hour temporary one) |
| Supabase | Confirm you're on at least the Pro plan before real customer data volume (free tier has project pause-after-inactivity and lower resource limits) |
| Email confirmation | Re-enable "Confirm email" in Supabase Auth settings if you turned it off for local testing (Batch 5) |

## 4. CRITICAL — Security review

- [ ] **Never** commit `.env.local` or any real API key to git — confirm `.gitignore`
  still has `.env*` (it does by default in this project)
- [ ] **CRITICAL:** Confirm `SUPABASE_SERVICE_ROLE_KEY` is only ever used in files under
  `src/lib/supabase/server.ts`'s `createServiceClient()` and API routes — never in a
  client component, never sent to the browser. This key bypasses all Row Level Security;
  if it leaks, anyone can read/write every customer's data.
- [ ] **CRITICAL:** Confirm the Razorpay webhook (`/api/billing/webhook`) still verifies
  the signature before trusting any payload — never remove that check, even temporarily
  for debugging
- [ ] Rotate `CRON_SECRET` and `WHATSAPP_WEBHOOK_VERIFY_TOKEN` to strong random values
  (not anything you typed casually while testing)
- [ ] Confirm Row Level Security is enabled on every table (`schema.sql` + all
  migrations already do this — just double check in Supabase Dashboard → Authentication
  → Policies that nothing shows "RLS disabled")

## 5. Legal & compliance (from Batch 6)

- [ ] Have an actual lawyer review Terms, Privacy Policy, and Refund Policy before
  accepting real payments — these were built as a solid starting template, not final
  legal documents (said before, saying again because it matters)
- [ ] Update the Grievance Officer contact in the Privacy Policy if it's not you personally
- [ ] Confirm the cookie consent banner is working and blocks non-essential
  analytics/tracking scripts until "Accept" is clicked, if/when you add any (PostHog,
  GA4, etc.)

## 6. Cost & rate-limit sanity check (Part 3 principles, applied)

- [ ] Set a spending limit / usage alert in your OpenAI, Perplexity, and Google AI
  dashboards — a bug in the nightly cron looping forever is a realistic way to get an
  unexpectedly large bill in week one
- [ ] Test what happens when a customer adds 100+ prompts — does the nightly cron
  finish in a reasonable time, or does it need the queue-based upgrade mentioned in
  `02-tech-stack-architecture.md`? At real scale (hundreds of customers), replace the
  sequential loop in `/api/cron/nightly-runs` with a proper job queue (BullMQ/Trigger.dev)

## 7. Monitoring (not yet built — do this before real customers rely on the product)

`02-tech-stack-architecture.md` recommended Sentry (errors) and PostHog (product
analytics) from day one. Neither has been added yet in these 14 batches — add at least
Sentry before launch, so a broken signup flow or failing cron job surfaces to you
immediately instead of silently failing for days.

## 8. Final smoke test (do this on the live production URL, not localhost)

- [ ] Sign up with a fresh email → confirm the email → log in
- [ ] Complete onboarding → confirm starter prompts appear
- [ ] Run a manual visibility check → confirm real results appear (not errors)
- [ ] Try an actual ₹ payment on Razorpay Live Mode with a real card for a small amount,
  refund it to yourself, confirm the `organizations.plan` updated correctly
- [ ] Send yourself a WhatsApp digest and reply APPROVE, confirm it works end-to-end
- [ ] Submit the contact form, confirm the email arrives at admin@ansaraeo.com
- [ ] Check `/sitemap.xml` and `/robots.txt` resolve correctly on the live domain

## 9. Soft launch

Per `06-india-gtm-plan.md`'s First 90 Days plan — don't do a big public launch yet.
Manually onboard your first 5-10 pilot customers yourself, watch for real bugs and
real usage patterns, then move to self-serve signup once you've fixed what breaks.

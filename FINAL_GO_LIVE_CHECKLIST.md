# FINAL Go-Live Checklist (Updated Through Batch 20)

Good news: the core app runs. This checklist is what's left between "runs on my
machine" and "safe to put in front of real paying customers with real money and real
customer data." Go through it in order — don't skip to the bottom.

---

## 1. Confirm ALL migrations ran, in order
```
schema.sql → reset.sql (only if you re-ran schema) → migration_002_billing.sql →
migration_003_agent.sql → migration_004_site_audit.sql → migration_005_content_studio.sql →
migration_006_whatsapp.sql → migration_007_competitors.sql → migration_008_revenue_attribution.sql
```
Since you confirmed it's running, double check specifically: does `/dashboard/competitors`
work (needs migration_007)? Does `/dashboard/revenue` at least load without a database
error (needs migration_008)? If either errors, that migration didn't run.

## 2. CRITICAL — Set `ENCRYPTION_KEY` (Batch 20)
If you tested Batch 19 (GA4/Shopify) before Batch 20 existed, run `delete from
integrations;` and reconnect, per Batch 20's notes — otherwise decryption will fail with
garbled old data.

## 3. Confirm every env var is real, not a placeholder
Go through `.env.all.example` (Batch 14) line by line, PLUS these two added after it:
```
ENCRYPTION_KEY=            # Batch 20
```
(GA4/Shopify credentials are entered per-brand through the UI, not env vars — nothing
extra needed there beyond what's already in `.env.all.example`.)

## 4. Switch every test-mode credential to live (Batch 14, Section 3 — still applies exactly as written)
Razorpay Live Mode + KYC, WhatsApp Business Verification, re-enable email confirmation.
**These take real calendar time — start them now even if nothing else is ready yet.**

## 5. Security — re-confirm all of Batch 14's CRITICAL items, PLUS:
- [ ] `ENCRYPTION_KEY` is stored in Vercel's env vars, never committed, never logged
- [ ] Confirm `integrations.credentials` in Supabase Table Editor shows encrypted gibberish,
  not readable JSON (proves Batch 20 actually took effect)
- [ ] Confirm RLS is enabled on the 4 newest tables too: `automation_actions`,
  `content_items`, `payments`, `integrations` (Supabase Dashboard → Authentication → Policies)

## 6. Legal — still not done, still matters
Terms/Privacy/Refund need real lawyer review before real payments. This hasn't changed
since Batch 14 — don't skip it just because more features got built since.

## 7. Monitoring — still not built (flagged in Batch 14, still true)
No Sentry, no error tracking. With this much surface area now (20 batches of API routes),
add this before real customers rely on the product — a silent failure in, say, the nightly
cron or the Razorpay webhook could go unnoticed for days otherwise.

## 8. Smoke test the NEWEST features specifically (not covered in Batch 14's original checklist)
- [ ] Add a second brand, switch between them, confirm each page shows the right brand's data
- [ ] Auto-discover competitors, confirm the Share of Voice chart populates after a run
- [ ] Download a PDF report, confirm it opens correctly and shows real numbers
- [ ] If using WhatsApp: confirm the reference-code limitation (Batch 13, Section 8) isn't
  going to cause a wrong-approval mix-up with your actual current usage pattern

## 9. THEN — soft launch, not public launch (Part 6's plan, repeating because it's still correct)
Manually onboard 5-10 real pilot users yourself. Watch what breaks under real usage
(not your own testing patterns) for 1-2 weeks. Fix what surfaces. Only then open
self-serve signup broadly.

---

## Honest bottom line
"Runs on my machine" is real, necessary progress — but it's step 1 of this list, not the
finish line. Nothing above should take more than a few focused days if you go through it
systematically, except the two genuinely external-dependency items (Razorpay KYC,
WhatsApp verification) which run on their own clock — start those today regardless of
where the rest of the checklist stands.

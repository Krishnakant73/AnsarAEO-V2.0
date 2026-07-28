# Batch 13 — WhatsApp Automation (Part 7's Biggest Differentiator)

Being upfront: **this is the most manual-setup-heavy batch so far.** The code is ready,
but WhatsApp requires real business verification with Meta before you can send messages
to real customers — there's no way around this, it's how the platform works. Budget a
few days to a couple of weeks for the verification step specifically.

## 1. Run the migration
Supabase Dashboard → SQL Editor → run **`supabase/migration_006_whatsapp.sql`**.

## 2. Set up WhatsApp Business API access (manual, one-time)

1. Create a **Meta Business Account** at [business.facebook.com](https://business.facebook.com)
   if you don't have one
2. Go to [developers.facebook.com](https://developers.facebook.com) → My Apps → Create App
   → choose "Business" type
3. In your app dashboard, add the **WhatsApp** product
4. Meta gives you a **free test phone number** immediately — good enough to fully test
   this batch before doing real business verification. Note down:
   - **Phone Number ID** (shown in WhatsApp > API Setup)
   - **Temporary access token** (also shown there — expires in 24 hours; you'll generate
     a permanent one via a System User once you're ready for production)
5. Add up to 5 **test recipient numbers** in the same screen (your own phone works) — the
   test number can only message these until you complete business verification

## 3. Add to `.env.local`
```
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=any-random-string-you-choose
```

## 4. Create and submit the message template
WhatsApp requires pre-approved templates for any message sent outside a 24-hour customer
reply window (which covers your daily/weekly digest use case entirely).

1. Meta App Dashboard → WhatsApp → Message Templates → Create Template
2. Category: **Utility** (not Marketing — utility templates get approved faster and this
   is genuinely a utility/account notification, not promotional content)
3. Name it exactly: `visibility_digest`
4. Body text:
   ```
   Hi! Your {{1}} visibility score is {{2}}%. Biggest gap: {{3}}. Reply APPROVE to publish a ready draft, or check your dashboard.
   ```
5. Submit for review — approval usually takes minutes to a few hours, occasionally up to
   24 hours

## 5. Set up the webhook
1. Meta App Dashboard → WhatsApp → Configuration → Webhook
2. Callback URL: `https://yourdomain.com/api/whatsapp/webhook`
   (use an [ngrok](https://ngrok.com) tunnel for local testing, same as the Razorpay batch)
3. Verify Token: paste the same value you put in `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
4. Click **Verify and Save** — this triggers the GET request your webhook route handles
5. Subscribe to the **messages** field

## 6. Connect a number in your dashboard
1. Go to `/dashboard/settings/integrations`
2. Enter a WhatsApp number (use one of your 5 test recipient numbers from Step 2)
3. Since automatic verification isn't built yet at MVP stage, manually mark it verified
   for testing: Supabase Table Editor → `organizations` → find your org →
   set `whatsapp_verified` to `true`

## 7. Test the full loop
1. Trigger the digest manually (bypassing the cron secret check temporarily, or send the
   real header):
   ```bash
   curl https://yourdomain.com/api/whatsapp/send-digest \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
2. You should receive a WhatsApp message on your test recipient number
3. Reply **APPROVE** — check the `automation_actions` table; the most recent pending row
   should flip to `approved`, and you should get a confirmation reply on WhatsApp

## 8. Known MVP simplification (read this before relying on it heavily)
The approval webhook currently approves the **most recent pending `automation_action`**
for the matching organization — it doesn't yet track "which specific digest/draft is this
reply about." This is fine at low volume (one org, occasional digests) but will need a
real fix once:
- An org has multiple pending approvals at once (e.g., two content drafts awaiting
  approval simultaneously) — the reply could approve the wrong one
- The fix: include a short reference code in the WhatsApp message itself (e.g., "Reply
  APPROVE 4F2A") and match on that code instead of "most recent pending," which the
  webhook handler in `route.ts` can be extended to parse.

## 9. Going live (real customers, not just your 5 test numbers)
1. Meta Business Manager → complete **Business Verification** (legal business name,
   address, phone, sometimes a document upload) — this is the step that takes the longest
2. Once verified, request a real **production phone number** (or migrate your existing
   business WhatsApp number into the API, if you already use one)
3. Generate a permanent access token via a **System User** (Business Settings > Users >
   System Users) instead of the 24-hour temporary token
4. Update your hosting provider's env vars with the production token/phone number ID

# Batch 8 — Razorpay Billing

## 1. Install the dependency
```bash
npm install razorpay
```

## 2. Get your Razorpay keys
1. Sign up / log in at [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Start in **Test Mode** (toggle top-right) — test with fake cards before going live
3. Settings → API Keys → Generate Test Key → copy the Key ID and Key Secret

## 3. Add to `.env.local`
```
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your-key-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret   # from Step 4 below
```

## 4. Set up the webhook (required — this is how payments actually get confirmed)
1. Razorpay Dashboard → Settings → Webhooks → Add New Webhook
2. Webhook URL: `https://yourdomain.com/api/billing/webhook`
   - **For local testing**, Razorpay can't reach `localhost` directly — use a tunnel tool
     like [ngrok](https://ngrok.com) (`ngrok http 3000`) and use the ngrok URL instead
3. Active events: check **payment.captured** and **payment.failed**
4. Set a webhook secret (any strong random string) — paste the same value into
   `RAZORPAY_WEBHOOK_SECRET` in `.env.local`
5. Save

## 5. Run the database migration
Supabase Dashboard → SQL Editor → paste and run **`supabase/migration_002_billing.sql`**.
This only adds new tables (`payments`, `plan_limits`) — it does NOT touch your existing
data, no reset needed.

## 6. Test the full flow
```bash
npm run dev
```
1. Go to `/dashboard/settings/billing`
2. Click "Upgrade to Starter"
3. Razorpay's checkout popup opens — use a [Razorpay test card](https://razorpay.com/docs/payments/payments/test-card-upi-details/)
   (e.g., card number `4111 1111 1111 1111`, any future expiry, any CVV)
4. Complete the fake payment
5. Check the `payments` table in Supabase — you should see a row with `status: paid`
6. Check the `organizations` table — the `plan` column should now say `starter`

## Important — how this is designed to be safe

The Razorpay Checkout popup finishing does **not** by itself upgrade anyone's plan. The
`handler` callback in `CheckoutButton.tsx` only redirects the page — the actual plan
upgrade happens in `/api/billing/webhook`, which verifies Razorpay's cryptographic
signature before trusting the payment. This matters: without signature verification, a
technically savvy user could fake a "payment succeeded" browser call and get a paid plan
for free. Never skip webhook signature verification, here or in any payment integration.

## Going live later
1. Complete Razorpay's KYC/business verification (required before Live Mode processes
   real payments — this can take a few days, start it early)
2. Switch the dashboard toggle to Live Mode, generate Live API keys, and set up a
   **second** webhook pointing at the same URL but using Live Mode credentials
3. Update `.env.local` (or your hosting provider's env vars, e.g. Vercel) with the Live
   keys before accepting real customer payments

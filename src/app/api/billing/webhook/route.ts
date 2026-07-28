import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hmacVerify } from "@/lib/platform/signing";
import { applyPaidPayment } from "@/lib/billing";

// ============================================================
// POST /api/billing/webhook
//
// Configure this URL in Razorpay Dashboard > Settings > Webhooks:
//   https://yourdomain.com/api/billing/webhook
// Subscribe to at least the "payment.captured" event.
//
// SECURITY: this route verifies Razorpay's HMAC signature before trusting
// anything in the payload. Never update plan/payment status based on a
// client-side "success" callback alone — a malicious user could fake that
// call. The webhook, with a verified signature, is the only source of truth.
// ============================================================

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Constant-time HMAC verification via the shared signing helper.
  // Rejects missing signatures/secrets outright — no signature = spoofed request.
  if (!signature || !secret || !hmacVerify(secret, rawBody, signature)) {
    console.error("Razorpay webhook: signature mismatch — possible spoofed request");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "payment.captured") {
    const payment = event.payload.payment.entity;
    // Shared with /api/billing/verify-payment so the two confirmation paths
    // can't diverge. Idempotent if the client-return verify already ran.
    await applyPaidPayment(payment.order_id as string, payment.id as string);
  }

  if (event.event === "payment.failed") {
    const payment = event.payload.payment.entity;
    const supabase = createServiceClient();
    await supabase
      .from("payments")
      .update({ status: "failed" })
      .eq("razorpay_order_id", payment.order_id);
  }

  // Always return 200 quickly — Razorpay retries on non-2xx responses.
  return NextResponse.json({ received: true });
}

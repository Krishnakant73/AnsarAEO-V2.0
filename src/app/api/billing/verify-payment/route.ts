import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hmacVerify } from "@/lib/platform/signing";
import { applyPaidPayment } from "@/lib/billing";

// ============================================================
// POST /api/billing/verify-payment
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
//
// The Razorpay Standard Checkout `handler` callback returns these three
// fields to the browser. We verify the signature SERVER-SIDE before trusting
// the payment — the signature is HMAC-SHA256("order_id|payment_id",
// KEY_SECRET) in hex. Only Razorpay can produce it (KEY_SECRET never leaves
// the server), so a valid signature is cryptographic proof the payment on
// this order succeeded.
//
// This gives instant confirmation without waiting for the async webhook.
// Both paths funnel through applyPaidPayment(), so they stay consistent and
// are idempotent if both fire for the same order.
// ============================================================

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    console.error("verify-payment: RAZORPAY_KEY_SECRET is not configured");
    return NextResponse.json({ error: "Payment verification unavailable" }, { status: 500 });
  }

  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing payment fields" }, { status: 400 });
  }

  // Razorpay signs `order_id|payment_id` with KEY_SECRET (hex HMAC-SHA256).
  const isValid = hmacVerify(
    secret,
    `${razorpay_order_id}|${razorpay_payment_id}`,
    razorpay_signature,
  );
  if (!isValid) {
    // Do NOT mark anything paid on a signature mismatch.
    console.error("verify-payment: signature mismatch for order", razorpay_order_id);
    return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  // Signature valid → flip the pending order to paid + upgrade the plan.
  const applied = await applyPaidPayment(razorpay_order_id, razorpay_payment_id);
  if (!applied) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

import { createServiceClient } from "@/lib/supabase/server";

// ============================================================
// Shared "mark this order paid" transition, used by BOTH confirmation
// paths so they can never diverge:
//   1. /api/billing/webhook          — Razorpay's signed server->server event
//   2. /api/billing/verify-payment   — the client-returned checkout signature
//
// Both are cryptographically authenticated before this runs (webhook HMAC /
// checkout-signature HMAC), so this is the single place that flips a pending
// `payments` row to paid and upgrades the org's plan. Idempotent: running it
// twice for the same order lands on the same final state.
// ============================================================

export async function applyPaidPayment(
  orderId: string,
  paymentId: string,
): Promise<boolean> {
  const supabase = createServiceClient();

  // The pending row was created in /api/billing/create-order (status:created).
  const { data: paymentRow } = await supabase
    .from("payments")
    .select("id, org_id, plan")
    .eq("razorpay_order_id", orderId)
    .single();

  if (!paymentRow) return false;

  await supabase
    .from("payments")
    .update({ status: "paid", razorpay_payment_id: paymentId })
    .eq("id", paymentRow.id);

  // The moment the org becomes a paying customer.
  await supabase
    .from("organizations")
    .update({
      plan: paymentRow.plan,
      billing_provider: "razorpay",
      billing_customer_id: paymentId,
    })
    .eq("id", paymentRow.org_id);

  return true;
}

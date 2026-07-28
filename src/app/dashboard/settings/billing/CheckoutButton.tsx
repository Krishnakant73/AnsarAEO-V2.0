"use client";

import { useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";

type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", handler: (resp: unknown) => void) => void;
};

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

export default function CheckoutButton({
  plan,
  cycle,
  label,
  userEmail,
}: {
  plan: string;
  cycle: "monthly" | "yearly";
  label: string;
  userEmail: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);

    let order: { orderId: string; amount: number; currency: string; keyId?: string; error?: string } | null = null;
    try {
      const res = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, cycle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start checkout. Please try again.");
        setLoading(false);
        return;
      }
      order = data;
    } catch {
      setError("Network error starting checkout. Please try again.");
      setLoading(false);
      return;
    }
    setLoading(false);

    if (!order) return;
    if (typeof window === "undefined" || !window.Razorpay) {
      setError("Checkout is still loading. Please try again in a moment.");
      return;
    }

    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "AnsarAEO",
      description: `${label} plan — ${cycle}`,
      prefill: { email: userEmail },
      theme: { color: "#D66A38" },
      modal: {
        // User closed the popup without paying — not an error, just reset.
        ondismiss: () => {
          setLoading(false);
        },
      },
      // Razorpay returns the signed payment fields here. We verify the
      // signature server-side before treating the payment as successful.
      handler: async (resp: RazorpaySuccess) => {
        setLoading(true);
        try {
          const verifyRes = await fetch("/api/billing/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            }),
          });
          if (!verifyRes.ok) {
            const data = await verifyRes.json().catch(() => ({}));
            setError(data.error ?? "We could not verify your payment. If you were charged, contact support.");
            setLoading(false);
            return;
          }
          router.push("/dashboard/settings/billing?success=1");
          router.refresh();
        } catch {
          setError("Payment verification failed. If you were charged, contact support.");
          setLoading(false);
        }
      },
    });

    rzp.on("payment.failed", (resp: unknown) => {
      const reason = (resp as { error?: { description?: string } })?.error?.description;
      setError(reason ? `Payment failed: ${reason}` : "Payment failed. Please try again.");
      setLoading(false);
    });

    rzp.open();
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <button onClick={handleClick} disabled={loading} className="btn-primary w-full disabled:opacity-60">
        {loading ? "Preparing checkout…" : `Upgrade to ${label}`}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-600">
          {error}
        </p>
      )}
    </>
  );
}

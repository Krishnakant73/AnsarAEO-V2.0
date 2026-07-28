// Client-safe industry constants for the onboarding industry picker.
//
// These live in their own module — separate from starter-prompts.ts — because
// starter-prompts.ts imports the server-only LLM stack (`@/lib/llm` → model
// router → `@/db/client` → the `postgres` driver, which needs Node built-ins
// like fs/net/tls). The onboarding page is a "use client" component and only
// needs this list, so importing it from here keeps `postgres` out of the
// browser bundle (Turbopack does not tree-shake side-effecting module imports).
//
// starter-prompts.ts re-exports these so existing server-side importers keep
// working unchanged.

export type IndustryKey =
  | "d2c_fashion"
  | "d2c_beauty"
  | "d2c_food"
  | "saas"
  | "local_service"
  | "other";

export const INDUSTRIES: { value: IndustryKey; label: string }[] = [
  { value: "d2c_fashion", label: "D2C Fashion / Apparel" },
  { value: "d2c_beauty", label: "D2C Beauty / Skincare" },
  { value: "d2c_food", label: "D2C Food / Beverage" },
  { value: "saas", label: "SaaS / B2B Software" },
  { value: "local_service", label: "Local Service Business" },
  { value: "other", label: "Other" },
];

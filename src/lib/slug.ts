// ============================================================
// Brand slug generation.
//
// Mirrors the logic in supabase/migration_025_brand_slug.sql so
// runtime-created brands slug the same way the backfill did:
//   • lowercased, non-alphanumeric runs collapsed to "-"
//   • leading/trailing dashes trimmed
//   • empty result falls back to "brand"
//
// Slugs are unique WITHIN an org (enforced by brands_org_slug_idx).
// `uniqueSlug` resolves collisions with -2, -3, … suffixes, matching
// the migration's numbering strategy.
// ============================================================

export function slugify(input: string): string {
  const base = (input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return base === "" ? "brand" : base;
}

/**
 * Given a base name and the set of slugs already taken in the org,
 * return the first free slug: `base`, then `base-2`, `base-3`, …
 */
export function uniqueSlug(name: string, taken: Iterable<string>): string {
  const base = slugify(name);
  const takenSet = new Set(taken);
  if (!takenSet.has(base)) return base;
  let n = 2;
  while (takenSet.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

# Batch 10 — Site Audit

## 1. Install the one new dependency
```bash
npm install cheerio
```

## 2. Run the migration
Supabase Dashboard → SQL Editor → run **`supabase/migration_004_site_audit.sql`**.

## 3. Files in this batch

| File | What it does |
|---|---|
| `src/lib/site-audit-engine.ts` | The actual audit logic — fetches the brand's live site, robots.txt, and llms.txt, and checks them |
| `src/app/api/site-audit/route.ts` | Runs the audit and stores the result |
| `src/app/dashboard/site-audit/page.tsx` + `SiteAuditClient.tsx` | The scorecard UI |
| `src/app/dashboard/layout.tsx` | Updated — added "Site Audit" to the sidebar nav |

## 4. What it actually checks, and why in this order

1. **AI-bot crawlability (robots.txt)** — checked first because it's the most damaging
   and most commonly *accidental* issue. Many sites block GPTBot, PerplexityBot, or
   ClaudeBot without realizing it — often because a security plugin, CDN, or "block all
   bots" setting did it as a side effect. If an AI crawler is blocked, nothing else on
   this list matters; the site is invisible to that engine entirely.
2. **llms.txt** — the emerging standard from `llms-txt-explained` (your own blog post from
   Batch 7!) — cheap to add, no downside.
3. **Schema markup (JSON-LD)** — parsed with `cheerio` (a real HTML parser, not fragile
   regex) to detect actual `@type` values like `Organization`, `Product`, `FAQPage`.
4. **Basic page structure** — H1 presence and meta description, the lowest-effort,
   highest-baseline SEO/AEO hygiene checks.

## 5. A known limitation, stated honestly
The robots.txt parser here is a reasonable simplification (regex-based block matching),
not a full robots.txt specification parser. It correctly catches the common case (`User-
agent: GPTBot` followed by `Disallow: /`), but complex robots.txt files with multiple
overlapping rules, wildcards, or `Allow` overrides after a `Disallow` may not be parsed
perfectly. For an MVP this is a reasonable tradeoff; if this becomes a heavily-relied-on
feature later, consider swapping in a dedicated robots.txt parsing library.

## 6. Test it
```bash
npm run dev
```
Go to `/dashboard/site-audit`, click "Run first audit". Try it against your own domain —
you'll likely see genuinely useful, real findings (many sites have gaps here).

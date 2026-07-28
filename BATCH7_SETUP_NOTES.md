# Batch 7 — Resources Section, Full Blog, LinkedIn Link

## What's new

| File | Status |
|---|---|
| `src/components/footer/Footer.tsx` | Updated — LinkedIn now points to your real profile (opens in new tab), Resources links point to real sub-pages instead of all pointing at `/resources` |
| `src/app/(marketing)/resources/page.tsx` | New — Resources hub page |
| `src/app/(marketing)/resources/blog/page.tsx` | New — full blog listing with category filter |
| `src/app/(marketing)/resources/blog/[slug]/page.tsx` | New — individual blog post pages (statically generated for all 11 existing posts) |
| `src/components/resources/BlogList.tsx` | New — the filterable blog grid component |
| `src/app/(marketing)/resources/guide/page.tsx` | New — the AEO Guide (evergreen educational content) |
| `src/app/(marketing)/resources/docs/page.tsx` | New — honest docs describing what's actually built so far |
| `src/app/(marketing)/resources/changelog/page.tsx` | New — real, dated changelog entries (build-in-public asset) |
| `src/types/index.ts` | Updated — `Post` type now has a `content: string[]` field |
| `src/lib/posts.ts` | Updated — every existing post now has full body content, not just an excerpt |
| `src/app/sitemap.ts` | Updated — includes all new resources pages + every blog post individually |

## About "Product" — no action needed

You mentioned the Product footer column too, but I checked: "Prompt Tracking," "Visibility Score," etc.
already link to `#features` and `#agent` anchors that genuinely exist on your homepage
(`FeatureSection.tsx` has `id="features"`, `AISearch.tsx` has `id="agent"`) — those links already work
correctly, nothing was missing there.

## About the LinkedIn link

Good instinct connecting your personal profile now rather than waiting for a company page — this is
exactly the founder-led distribution approach from `06-india-gtm-plan.md` (Part 6). When you do
incorporate a company later, just swap the URL in `Footer.tsx`'s `SOCIALS` array to the company page,
and consider keeping a personal link too — founder-led content tends to outperform brand-account content
for B2B SaaS in the early years regardless of company stage.

## About blog post content

Since your `posts.ts` only had excerpts before (no full body text existed anywhere in the codebase), I
wrote full body content for all 11 existing posts so `/resources/blog/[slug]` isn't a broken/empty page.
This is genuinely useful educational content (how AEO works, technical explainers), consistent with the
placeholder case-study numbers already used elsewhere in your site (e.g., Lumora's "+303%" already
appears in `CustomerSuccess.tsx`). Before you actually publish this site live, go through each post and
replace anything you want to make more specific to your real product/customers once you have them —
treat these as solid first drafts, not final copy.

## Test it
```bash
npm run dev
```
Visit `/resources`, click through to `/resources/blog`, open any post, then check `/resources/guide`,
`/resources/docs`, and `/resources/changelog`. All should render with real content, no dead links.

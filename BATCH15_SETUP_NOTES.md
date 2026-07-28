# Batch 15 — Real Charts + Competitor Tracking (Fixing a Genuine Gap)

You were right to push on this — here's an honest account of what was actually missing
and how this batch fixes it, benchmarked directly against what GetCito (the open-source
tool you linked) actually has.

## What GetCito has (confirmed by reading their actual implementation docs, not just the README)
- A `useCompetitors` hook and dedicated `/dashboard/competitors` page (Firebase-backed)
- A separate `/dashboard/analytics` page with "dual analytics" (session-based +
  historical, merged from Firestore)
- Multi-brand switching via a `BrandContext`

## What was genuinely missing from our build before this batch
1. **Zero charts anywhere.** Every number was a plain text stat. No trend line, no bar
   chart, nothing visual — a real gap against Part 5's own design spec ("numbers need a
   story") and against what GetCito ships.
2. **Competitor mentions were never actually detected.** The classification step only
   ever checked "was OUR brand mentioned" — it never checked whether a tracked competitor
   was mentioned in the same response. That means a "Share of Voice" chart was
   structurally impossible before this batch, even though the UI mockup on your original
   marketing site (`DashboardPreview.tsx`) has always shown one.
3. **No auto-discovery.** Competitors had to be typed in by hand. GetCito doesn't appear
   to auto-discover them either based on their docs — so this is a genuine improvement
   beyond what they have, not just catching up.

## What this batch adds

| File | What it does |
|---|---|
| `supabase/migration_007_competitors.sql` | Adds `competitor_mentions` (JSONB) to every run, and `source`/`confirmed` to competitors |
| `src/lib/visibility-engine.ts` | **Rewritten** — the classifier now checks for every tracked competitor's mention/position in the SAME AI response, not just yours |
| `src/app/api/competitors/discover/route.ts` | AI suggests real competitors based on brand name/domain/industry — inserted as `confirmed: false` until you approve |
| `src/app/api/competitors/[action]/route.ts` | Confirm or reject a suggestion |
| `src/app/api/competitors/route.ts` | Manually add a competitor |
| `src/app/dashboard/competitors/page.tsx` + `ShareOfVoiceChart.tsx` + `CompetitorsManager.tsx` | Real Share of Voice bar chart (your brand highlighted in orange, competitors in gray) + suggestion review UI |
| `src/app/dashboard/page.tsx` + `VisibilityTrendChart.tsx` | Main dashboard now has a real area/trend chart of visibility score over time, not just a static number |
| `src/app/dashboard/layout.tsx` | Added "Competitors" to the sidebar |

## 1. Install the new dependency
```bash
npm install recharts
```

## 2. Run the migration
Supabase Dashboard → SQL Editor → run **`supabase/migration_007_competitors.sql`**.

## 3. Important — this changes what future visibility checks return
Because `visibility-engine.ts` was rewritten, any NEW runs (via "Run check now" or the
nightly cron) will now include competitor data automatically, IF you have confirmed
competitors on the brand. Old runs from before this migration won't have
`competitor_mentions` data (it'll just be an empty array) — that's expected, the chart
will just show 0% for competitors until new runs accumulate.

## 4. Test it
```bash
npm run dev
```
1. Go to `/dashboard/competitors` → click "Auto-discover competitors" (needs
   `OPENAI_API_KEY`) → you should see 3-5 suggested competitors appear
2. Confirm a couple of them
3. Go to `/dashboard/prompts` and run a check on any prompt — the classifier will now
   also check for your confirmed competitors in that same response
4. Go back to `/dashboard/competitors` — the Share of Voice chart should now show real
   percentages for both you and your competitors
5. Go to `/dashboard` — the main visibility score card should now show a real trend area
   chart once you have runs across more than one day

## 5. Honest remaining gap (being upfront, same as always)
The daily trend chart groups by calendar day using each run's timestamp — with low
volume (a handful of manual test runs), the chart will look sparse/blocky rather than
smooth. It becomes genuinely useful once the nightly cron has been running for at least
a week of real data. This is expected behavior, not a bug.

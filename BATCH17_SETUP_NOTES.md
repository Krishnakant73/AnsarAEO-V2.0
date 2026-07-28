# Batch 17 — Reports Page (Portfolio View + Branded PDF)

This closes the last item that was a dead link in the dashboard nav since Batch 2.

## 1. Install the new dependency
```bash
npm install @react-pdf/renderer
```

## 2. No schema changes needed — this batch only reads existing data.

## 3. Files in this batch

| File | What it does |
|---|---|
| `src/lib/report-document.tsx` | The actual PDF layout, built with `@react-pdf/renderer` |
| `src/app/api/reports/generate/route.ts` | Pulls real data for one brand and renders it to a PDF buffer |
| `src/app/dashboard/reports/page.tsx` | Portfolio table (all brands, if you manage more than one) + download section |
| `src/app/dashboard/reports/DownloadReportButton.tsx` | Triggers the download client-side |

## 4. Why `@react-pdf/renderer` instead of a headless browser
A common way to generate PDFs is to screenshot a real webpage with Puppeteer/Playwright.
That gives pixel-perfect fidelity to your dashboard's charts, but requires bundling a
Chromium binary, which is heavy and finicky on Vercel's serverless functions (cold starts,
size limits). `@react-pdf/renderer` builds the PDF directly from React-like components —
no browser needed, fast, reliable in serverless. The tradeoff: your PDF report has its own
simpler layout rather than literally being a screenshot of the dashboard, which is
actually the norm for "reports you forward to a client" (text/tables, not full app UI).

## 5. The portfolio view — only possible after Batch 16
`ReportsPage` loops over every brand the org manages and computes each one's visibility
score, prompt count, and run count in parallel. This table only shows up if the org has
more than one brand — exactly the multi-client view Part 5's UI spec (Screen G) called
for, and it only became buildable once Batch 16 fixed the single-brand assumption.

## 6. Test it
```bash
npm run dev
```
1. Go to `/dashboard/reports`
2. If you added a second brand in Batch 16's testing, you'll see the portfolio table
3. Click "Download PDF report" — a real PDF should download with your brand's actual
   visibility score, engine breakdown, and prompt results

## 7. Natural next step (not built yet, noted honestly)
This report is currently generated on-demand (button click). The "weekly automated
report" version — where this same PDF gets emailed out automatically every Monday
morning, per `04-feature-spec.md`'s Tier 5 — just needs a small cron route (same pattern
as `/api/cron/nightly-runs`) that loops over brands, calls the same generation logic, and
emails the result via the Zoho SMTP setup from Batch 6. Say the word if you want that
wired up next.

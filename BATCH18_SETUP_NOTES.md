# Batch 18 — Weekly Automated Email Reports

Closes the last item in `04-feature-spec.md`'s Tier 5 (Reporting & Alerts): "Weekly
summary report (PDF/branded for agencies)."

## No new npm packages — reuses `@react-pdf/renderer` (Batch 17) and `nodemailer` (Batch 6).

## Files in this batch

| File | What it does |
|---|---|
| `src/lib/reports.ts` | **New** — the report-generation logic extracted out of Batch 17's route, so both the manual download and this new weekly cron produce byte-for-byte identical reports |
| `src/app/api/reports/generate/route.ts` | Simplified — now just calls the shared function |
| `src/app/api/cron/weekly-reports/route.ts` | **New** — loops every brand, emails its owner a PDF |
| `vercel.json` | Updated — added the weekly cron entry (Mondays, 8:30 AM IST) |

## How it finds who to email
Each brand belongs to an organization; each organization has an owner in `org_members`.
This route looks up that owner's `user_id`, then uses Supabase's **Admin API**
(`supabase.auth.admin.getUserById`) to get their email — this only works with the
service-role client (which this cron already uses), since `auth.users` isn't a normal
queryable table through the regular client for privacy/security reasons.

## Test it
```bash
curl https://yourdomain.com/api/cron/weekly-reports \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
Check the inbox of whichever email you signed up with — you should receive one email per
brand you own, each with a real PDF attachment matching what the dashboard's "Download
PDF report" button produces.

## Honest scaling note
Like `/api/cron/nightly-runs`, this loops sequentially, brand by brand. Fine for the
number of brands you'll have during early access; once you have real scale (hundreds of
brands), this is another candidate for the queue-based upgrade mentioned throughout
`02-tech-stack-architecture.md` rather than a single long-running cron invocation.

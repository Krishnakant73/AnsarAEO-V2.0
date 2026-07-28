# Batch 11 — Content Studio (the "Auto-Fix" differentiator)

## 1. Run the migration
Supabase Dashboard → SQL Editor → run **`supabase/migration_005_content_studio.sql`**.

## 2. No new npm packages needed for this batch.

## 3. Files in this batch

| File | What it does |
|---|---|
| `src/lib/content-engine.ts` | Generates a draft — deliberately leaves `[ADD ...]` placeholders instead of inventing facts |
| `src/app/api/content/generate/route.ts` | Creates a draft for a specific gap prompt |
| `src/app/api/content/approve/route.ts` | **Server-side enforced** E-E-A-T gate — see below |
| `src/app/dashboard/content/page.tsx` + `ContentStudioClient.tsx` | Main Content Studio: gap list + drafts list |
| `src/app/dashboard/content/[id]/page.tsx` + `ContentEditor.tsx` | Edit a draft, check off E-E-A-T items, approve |
| `src/app/dashboard/layout.tsx` | Updated — added "Content Studio" to the sidebar |

## 4. The most important design decision in this batch

The E-E-A-T checklist isn't just a UI nicety — **`/api/content/approve` enforces it
server-side**, and separately checks that no `[ADD ...]` placeholder text remains in the
content. Both checks exist because a client-side-only checkbox can always be bypassed by
calling the API directly. This matches the Part 7 principle exactly: AI drafts, humans
review and add real specifics, nothing ships without both.

The content generator is also deliberately instructed to **never invent** a customer
example, a statistic, or an author name — it inserts a placeholder marker instead and
leaves that entirely to the real human reviewing it. This is the actual mechanism behind
the "Google-safe, human-reviewed AI content" claim from Part 7 and your About page.

## 5. How gap detection works
`ContentStudioPage` computes "gap prompts" the same way `agent-context.ts` does for the
Agent: a prompt counts as a gap if it has at least one visibility run and the brand was
never mentioned in any of them. Both features independently converge on the same
definition of "opportunity" — worth keeping in sync if you change this logic later.

## 6. Test it
```bash
npm run dev
```
1. Go to `/dashboard/content` — you should see any prompts where your brand isn't
   mentioned (run a few visibility checks first if the list is empty)
2. Click "Generate draft" on one — this calls OpenAI, so `OPENAI_API_KEY` must be set
3. On the draft page, try clicking "Approve" immediately — it should be disabled/blocked
   because of the remaining `[ADD ...]` placeholders and unchecked boxes
4. Edit the placeholders out, check all three boxes, then approve successfully

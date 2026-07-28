# Batch 21 — Findings From Reading GetCito's Actual Source Code

I downloaded and read through their real repo (130 TypeScript files, not just docs this
time). Here's exactly what I found, what was genuinely worth adopting, and what wasn't.

## What I found and DID adopt (this batch)

### 1. Domain autofill for onboarding (`get-company-info.ts` in their repo)
Their onboarding only asks for a domain — an LLM (already knowing about many companies)
fills in name, description, category, and competitors. Ours required manually typing all
of that. **Added:** `src/lib/domain-autofill.ts` + `/api/onboarding/autofill`.
**Improvement over their version:** theirs silently falls back to a generic guess with no
warning when the model doesn't actually know the domain. Ours returns an honest
`confidence: "low"` flag instead of pretending to know.

**Not yet wired into the onboarding form UI** — the API endpoint is ready, but I didn't
rewrite `OnboardingPage.tsx` in this batch to keep it focused. To wire it in: call
`fetch('/api/onboarding/autofill', {method:'POST', body: JSON.stringify({domain})})` when
the domain field loses focus, then pre-fill `brandName`/`category`/`competitor` with the
response (still editable, not auto-submitted). Say the word if you want me to do this
wiring directly next.

### 2. Deterministic mention verification (`competitor-matching.ts` in their repo)
**This was the most important find.** Their competitor detection uses actual string/fuzzy
matching (the `fuzzysort` library) against the raw response text — not just asking the
same LLM to self-report. Our original approach only ever trusted the LLM's own claim
about whether it mentioned a brand, which has a real reliability risk (self-report can be
wrong, especially on longer responses).

**Added:** `src/lib/mention-matcher.ts` — a lightweight Levenshtein-based deterministic
check (no new dependency needed, unlike their `fuzzysort` approach) that cross-verifies
every LLM mention claim. `visibility-engine.ts` now stores whether the two signals agreed
in a new `mention_verification` column — so you can actually measure how often the LLM's
self-report was right, instead of blindly trusting it forever.

### 3. Real Google AI Overview tracking — fixing a genuine mislabeling
**This is the finding you should care about most.** Their `google-ai-overview-provider.ts`
uses DataForSEO's SERP API to capture the actual Google AI Overview box content. I
realized our "gemini" engine (calling Google's standalone Gemini chatbot API) is **not
the same product** as Google AI Overviews (the AI box inside real Google Search results).
Our original Part 3 roadmap listed them as one line item — that was wrong. They're
different Google products with different APIs and different content.

**Added:** `src/lib/google-ai-overview.ts` (real SERP-based tracking) + a new
`google_ai_overview` engine, alongside the existing (correctly-labeled) `gemini` engine.

**A security lesson from their code, explicitly NOT copied:** their
`google-ai-overview-provider.ts` has a real hardcoded fallback credential
(`Basic dGVhbUBnZXRhaW1vbml0b3IuY29tOjA2YjZjYzAwYTEyZTU0ZGI=` — base64-decodes to a
DataForSEO account email:password) committed directly into their public repo. That's a
real, live credential leak in a public MIT-licensed project. Never do this — always
`process.env`, no exceptions, no "test credentials for now."

## What I found and deliberately did NOT adopt
- Their `ProviderManager` uses an abstract-class OOP hierarchy (`BaseAPIProvider` with
  subclasses). Ours uses a flat function registry (`ENGINE_CALLERS`). Both work fine —
  this is a style preference, not a missing capability, so I didn't change it.
- Multi-step onboarding wizard (`add-brand/step-1/2/3`) — nice polish, not a functional
  gap. Our single-page onboarding covers the same fields.
- A "leaderboard" data concept in their `useDashboardData.ts` — unclear from the code
  alone what this actually ranks; not confidently worth copying without understanding it
  better first.
- Separate `citations/all-domains` and `citations/all-searches` sub-pages — our single
  Citations page (Batch 12) already covers this data, just not split into two URLs.

## 1. Install — no new npm packages for this batch
(The deterministic matcher intentionally avoids adding `fuzzysort` as a dependency.)

## 2. Run the migration
Supabase Dashboard → SQL Editor → run **`supabase/migration_009_mention_verification.sql`**.

## 3. Optional — enable real Google AI Overview tracking
This engine is optional; if you don't configure it, it fails gracefully (per-engine, via
the existing `Promise.allSettled` pattern) and every other engine still works.
1. Sign up at [dataforseo.com](https://dataforseo.com) (has a free trial credit)
2. Get your login/password from their dashboard
3. Add to `.env.local`:
   ```
   DATAFORSEO_LOGIN=your-login
   DATAFORSEO_PASSWORD=your-password
   ```

## 4. Test it
```bash
npm run dev
```
1. Run a visibility check on any prompt
2. Check the `visibility_runs` table — the new `mention_verification` column should show
   `{"brand": {"agreed": true, ...}, "competitors": [...]}`
3. If you configured DataForSEO, you should also see a `google_ai_overview` result appear
   alongside chatgpt/perplexity/gemini in the check results — note it will legitimately
   skip for many queries ("no AI Overview shown"), which is correct, honest behavior, not
   a bug

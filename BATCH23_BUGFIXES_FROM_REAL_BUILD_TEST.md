# Batch 23 — Real Bugs Found and Fixed via Actual Build Testing

I merged all 22 batches into a real Next.js project in my own sandbox, ran `npm install`,
`tsc --noEmit`, and a full `next build` — genuinely compiling and bundling the code,
not just reading it. This is different from every previous batch, where I wrote code
without ever executing it. **6 real, confirmed bugs were found and fixed.** These 8 files
replace their same-path counterparts from earlier batches — this is a pure bugfix batch,
no new features.

## What I actually did
1. Reconstructed a minimal base project (package.json with all 22 batches' combined
   dependencies, configs, and the couple of original shared components your new pages
   import — Navbar, Footer, SectionWrapper)
2. Copied all 22 batches into one tree, in order, later batches overwriting earlier
   revisions of the same file (exactly like I've been asking you to do)
3. `npm install` — succeeded clean
4. `npx tsc --noEmit` — found 5 real type errors, fixed all of them
5. `npx next build` — found 2 more real bugs that only surface at actual build time
   (type-checking alone doesn't catch these), fixed both
6. Re-ran the full build — **all 69 routes compiled and bundled successfully**

## The 6 real bugs, explained

### 1. `src/app/api/analytics/revenue/route.ts` — type inference gap
`Promise.resolve({})` as a fallback had no type annotation, so TypeScript inferred an
empty object type instead of `Record<string, number>`, breaking the later `sessionsByDay[date]`
indexing. **Fix:** explicit type annotations on both fallback promises.

### 2. `src/app/api/reports/generate/route.ts` — Buffer/BodyInit mismatch
`new NextResponse(buffer, ...)` — a Node `Buffer` isn't directly assignable to the
`BodyInit` type `NextResponse` expects in this TypeScript/Next.js version combination.
**Fix:** wrap it as `new Uint8Array(buffer)`.

### 3 & 5. `src/lib/supabase/server.ts` + `src/middleware.ts` — implicit `any` on cookie callbacks
The `setAll(cookiesToSet)` callback parameter from `@supabase/ssr`'s cookie interface
wasn't explicitly typed, so TypeScript's strict mode flagged every destructured property
inside it. **Fix:** explicit `{ name: string; value: string; options?: CookieOptions }[]`
type annotation on the parameter, using `CookieOptions` imported from `@supabase/ssr`.

### 4. `src/lib/visibility-engine.ts` — discriminated union type mismatch
The inner `Promise.allSettled` map callback returned two different object shapes (a
"skipped" result and a full result) without an explicit return type, so TypeScript
inferred an overly-loose union that didn't match the exported `EngineOutcome` type used
elsewhere. **Fix:** added an explicit `InnerResult` type annotation on the callback's
return type, and explicitly typed the `engines` query result with `.returns<...>()`
(Supabase queries without generated DB types return `any` by default, which was silently
widening other inferred types too).

### 6. `src/app/(marketing)/resources/blog/[slug]/page.tsx` — Next.js 15 params API
This page used the Next.js 14 style `{ params: { slug: string } }` instead of Next.js
15's `{ params: Promise<{ slug: string }> }` — every OTHER dynamic route I built (e.g.
`content/[id]/page.tsx`) used the correct newer pattern; this one file was missed.
**Fix:** made the component async and awaits `params` before use, matching the pattern
used correctly everywhere else.

### 7 (the most important one). `src/lib/razorpay.ts` — build-blocking eager initialization
**This one would have blocked your deployment entirely, not just shown a warning.** The
Razorpay client was created at module load time (`export const razorpay = new
Razorpay(...)`), which Next.js evaluates during `next build`'s page-data-collection step
— meaning **`next build` itself failed** with `key_id or oauthToken is mandatory` unless
live Razorpay credentials were present in the build environment. This would have broken
CI/CD pipelines or any build run before secrets were fully configured. **Fix:** lazy
initialization via a `getRazorpay()` function, only constructing the client when an
actual request needs it. Updated `src/app/api/billing/create-order/route.ts` to call
`getRazorpay()` instead of importing a pre-built instance.

## A non-blocking warning worth knowing about (not fixed, not urgent)
The build shows: `A Node.js API is used (process.version...) which is not supported in
the Edge Runtime`, traced through `@supabase/ssr` → `@supabase/supabase-js`. This is a
known, common warning in Supabase + Next.js Middleware setups and does not fail the
build or break functionality in practice — Vercel's Edge Runtime tolerates it. Flagging
it so you're not alarmed if you see it in your own build output, not because it needs
action right now.

## How to apply this batch
These 8 files should **replace** the same-path files from their original batches (2, 8,
17, 19, and the visibility-engine.ts lineage from Batch 15/21). If you've been merging
sequentially per `BUILD_INDEX.md`, just copy these 8 over whatever's currently there —
they're strict fixes, not redesigns.

## What this proves, and what it doesn't
This proves the code **compiles and bundles correctly** end-to-end — a genuinely
meaningful milestone that removes a whole category of risk ("does this even build"). It
does **not** prove runtime correctness against a real Supabase database, real LLM API
responses, or real user interactions — that still requires you running it with real
credentials, which is why `FINAL_GO_LIVE_CHECKLIST.md`'s remaining items (migrations,
live credentials, smoke-testing actual features) still matter just as much as before.

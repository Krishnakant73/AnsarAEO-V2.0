# Universal Workspace Engine — Design

Status: **Step 1 (core scaffold) implemented 2026-07-18.** No user-visible changes; the runway is built. See `src/workspace/` and `src/app/dashboard/w/`.

## What UWE is

A framework that turns any first-class object into a workspace by declaring what it *is*, not by hand-building layouts. Every workspace inherits the same shell, tabs, sidebar, timeline, feed, and command surface. Only the tabs' inner content is object-specific.

## The Object Descriptor

Every workspace is defined by one `defineWorkspace()` call exporting a `WorkspaceDescriptor`:
- `kind: ObjectKind` — the URL segment ("brand", "prompt", …)
- `loader(ctx) → object | null` — cookie-scoped fetch; `null` → framework calls `notFound()`
- `header(o) → HeaderProps` — title, chips, status, health
- `summary(o) → KPI[]` — ExecutiveSummary tiles
- `tabs: TabDef<T>[]` — first is default; `render()` returns a ReactNode
- `timeline / activity / related` — optional shared components
- `copilotContext(o) → CopilotContext` — what Copilot Dock reads via `data-copilot-context`
- `quickActions(o) → QuickAction[]` — with `keyboard` letters
- `capabilities` — gates share/export/delete/api

## Folder structure

```
src/workspace/
  core/               types, defineWorkspace, registry
  shell/              WorkspaceShell (server), TabNavigation, Sidebar, Timeline, ActivityFeed
  primitives/         KpiCard, MetricsGrid, InsightCard, HealthIndicator, Skeleton*
  hooks/              useTabKeyboard, useSidebarState, useCopilotContext
  workspaces.ts       side-effect registrations

src/app/dashboard/w/
  page.tsx            workspace picker (empty until Step 2)
  [kind]/[slug]/
    layout.tsx        resolves descriptor, renders shell
    page.tsx          renders first tab
    [tab]/page.tsx    renders named tab
```

## State layers

1. **Server data** — RSC + cookie-scoped Supabase; per request.
2. **URL state** — active tab, filters, sort, timerange live in search params.
3. **Ephemeral client** — sidebar collapse, keyboard focus, optimistic action state.

No global store. Copilot reads `data-copilot-context` off the shell root, so it stays decoupled from UWE's tree.

## Route grammar

`/dashboard/w/[kind]/[slug]/[tab]` is the canonical URL. Unknown kinds and unknown tabs → `notFound()`. Layout resolves the descriptor and object once; tab pages consume both via nested route params.

## Migration plan

1. **Step 1 — core scaffold (DONE).** Empty registry, /dashboard/w routes 404 today. Runway built.
2. **Step 2 — register Brand.** Extract Phase-2b page bodies into tab files under `w/brand/`. `/dashboard/b/[slug]/*` becomes redirect stubs to `/dashboard/w/brand/[slug]/*`.
3. **Step 3 — fold module pages into Brand tabs** (33 pages in waves of 5).
4. **Step 4 — register Competitor.**
5. **Step 5 — register Prompt.**
6. **Step 6 — retire redirect stubs** after <1% traffic on old paths for 30 days.

## Design tokens

Additive; no color/type changes. `--ws-header-h`, `--ws-summary-h`, `--ws-tab-h`, `--ws-sidebar-w-lg`, `--ws-gutter`, `--ws-easing`, `--ws-motion-{fast,med,slow}`.

## Keyboard map

`g w` picker, `[` / `]` prev/next tab, `1..9` jump-to-tab, `.` toggle sidebar, `t` toggle timeline, `f` focus feed, `?` shortcuts, `⌘K` palette, `e` primary action, `Shift+E` export, `Esc` collapse-or-back.

## Contracts (linted in CI later)

- Loader uses cookie client, never service.
- Loader returns `null` → framework 404s; never render a "not found" body.
- One `<h1>` per workspace (the shell renders it).
- Client-only tabs live in `.client.tsx` and are dynamically imported.

## Copilot Dock coupling

Zero import from UWE. Copilot reads the JSON on `data-copilot-context` at the shell root and updates on `workspace:tab-switched` events fired by TabNavigation.client. UWE doesn't know Copilot exists; Copilot doesn't know UWE exists.

## What's next (post Step 1)

- Step 2 (register Brand) is the toughest test of the descriptor contract.
- Add ExecutiveSummary streaming and MetricsGrid primitives before Step 3.
- ActivityFeed inside WorkspaceShell should share `/api/feed/stream` — already shipped.

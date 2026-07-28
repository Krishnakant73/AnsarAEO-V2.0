# A11y + Mobile Static Audit — 2026-07-19

Code-level pass over `src/app/**`, `src/components/**`, `src/workspace/**`. **No browser testing** — real assistive-tech + on-device passes still need a human. This surfaces issues visible from grep + code review; treat it as a shortlist, not a compliance certificate.

**Four P1s fixed inline this pass:**
1. `src/app/layout.tsx` — added `export const viewport` (was missing, meant iOS wasn't scaling correctly and `maximum-scale=1` was risking WCAG 1.4.4 violations from any Next-injected default).
2. `src/styles/globals.css` — extended the `prefers-reduced-motion` block to also neutralize Tailwind's `animate-spin` / `animate-pulse` / `animate-bounce`. Was only zeroing the `--ws-motion-*` vars, which don't reach Tailwind keyframe utilities. Added a `[data-motion-allow]` escape hatch for the rare case a spinner is the only feedback.
3. `src/app/dashboard/competitors/CompetitorsManager.tsx` — the two icon-only buttons (Confirm/Reject competitor) now have `aria-label` and `title` attributes. Was announced as unlabeled "button" to screen readers.
4. `src/components/dashboard/mission-control/widgets.tsx` — the KPI card ArrowUpRight affordance is `opacity-0` and only appeared on `group-hover:`. Added `group-focus-within:opacity-100` so keyboard tabbing reveals the affordance too.

**Audit correction note:** the earlier draft of this file overstated the icon-only-button count at ~70. On file-by-file review, most flagged buttons either have visible text next to the icon (`<Send /> Send`), already have `aria-label` (CopilotDock, Navbar, CelebrationModal), or wrap `<span className="sr-only">Close</span>` (dialog/sheet). Real icon-only fixables in this pass: **2** (both in CompetitorsManager, both fixed above).

Everything below is unpatched.

---

## P1 — blocking, needs fix before a compliance audit

### 1. Icon-only buttons with no `aria-label`
15 files use `<button>` containing only a Lucide icon. Screen readers announce "button" with no label. Sample:

- `src/components/dashboard/CopilotDock.tsx:466` — send-message spinner button, no label
- `src/components/dashboard/mission-control/widgets.client.tsx:42,90` — play buttons with no label
- `src/app/dashboard/history/HistoryClient.tsx:319` — refresh button

**Pattern fix:** every button containing only an icon needs `aria-label="..."` OR wraps a `<span className="sr-only">Label</span>`. Roughly 70 sites (grep for `h-3.5 w-3.5` inside `<button>`).

### 2. `<div onClick>` used as button
1 file — `src/components/celebrate/CelebrationModal.tsx` — uses a `<div onClick>` for a click target with no `role="button"`, `tabIndex={0}`, or keyboard handler. Keyboard users can't dismiss it.

### 3. Focus outline stripped without visible replacement
- `src/components/ui/menu.tsx:62`, `src/components/ui/context-menu.tsx:61` — both strip `focus:outline-none` inside the menu container. Menu items inside them do get styling, but the container itself becomes a focus black hole. Verify with a Tab-through pass.
- `src/components/ui/dialog.tsx:47` — close X uses `focus:ring-2 focus:ring-ring focus:ring-offset-2` (good), but `focus:ring-ring` resolves to whatever the `ring` CSS var is; if that's near-white, it's invisible on white bg. Manual verify.

### 4. `hover:opacity-100` for interactive affordances
- `src/components/dashboard/mission-control/widgets.tsx:159` — `ArrowUpRight` icon in KPI cards is `opacity-0`, appears on `group-hover:opacity-100`. Touch and keyboard users never see the affordance. Show it always on `sm:` and below, or on `group-focus-within:` too.

Similar in `src/workspace/primitives/KpiCard.tsx:37` and `src/workspace/primitives/InsightCard.tsx:79`.

---

## P2 — painful, should fix soon

### 5. Small touch targets (< 44×44 CSS px)
Roughly 70 uses of `h-3.5 w-3.5` in dashboard buttons. Alone that's fine (icon is 14×14), but the *button* wrapping them needs `min-h-11 min-w-11` or ~`p-2.5` padding. Many use `p-1.5` or `p-1` which produces a ~28×28 tap target — smaller than iOS/Android tap-target guidelines.

Spot-check: `CopilotDock.tsx:466`, `TaskBoard.tsx:173,188,205`, `mission-control/widgets.client.tsx:42,90`.

### 6. Muted text below WCAG AA on white
Widely-used utility class: `text-muted/70` and `border-line`. If `--muted` is `#94a3b8` (Tailwind slate-400) at 70% opacity on white, contrast is ~2.1:1 — below AA (4.5:1) for body text and below AA-large (3:1) for large text. Occurs in ObjectsRail keyboard hints (line 161), Shortcuts sheet (line 106-141), CopilotDock timestamps.

Fix requires promoting the muted token or dropping the `/70` opacity.

### 7. Non-responsive grid collapses
Most grids do collapse (`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3` etc.), but a few skip the smallest breakpoint:

- `src/components/footer/Footer.tsx:56` — `grid-cols-2 ... md:grid-cols-5`. Fine.
- `src/components/dashboard/mission-control/widgets.tsx:99` — `grid-cols-2 ... lg:grid-cols-4`. Fine.
- Check `src/app/dashboard/w/[kind]/page.tsx` picker cards on iPhone SE (375px) — 3-column grids can crush.

### 8. `hidden lg:inline-block` for keyboard hints
`ObjectsRail.tsx:160` — the G+letter hint chips are hidden below `lg:` (>1024px). On tablet/mobile users have no discoverability of the shortcut. Fine for the chip itself, but the `?` help sheet becomes the *only* keyboard discovery path and it also needs `T` (Copilot) surfaced elsewhere for mobile.

### 9. Skeletons animate under reduced-motion
Fixed globally in this pass by the CSS override, but `SkeletonLoader.tsx` sets `animate-pulse` unconditionally. The override handles it, but a purpose-built `motion-safe:animate-pulse` prefix would be clearer intent.

---

## P3 — nice-to-fix

### 10. Missing `alt=""` on decorative images
Only 1 explicit `alt=""` found. Suggests either (a) no decorative images (good) or (b) missing alt entirely on some. Recommend a proper `<Image>` audit — not doable from grep since `<Image>` component signatures vary.

### 11. Contrast on `text-gray-400`
Not our biggest exposure — 13 sites use it. All in `<kbd>` chips or muted timestamp bylines. Contrast on white is ~3.5:1, passes AA-large only. Fine for kbd chips (single glyph, high visual weight), borderline for timestamps.

### 12. Marketing hero animations
`src/components/hero/Hero.tsx`, `InsightHero.tsx` use `transition-*` on hover. Under reduced-motion, my CSS override drops transitions to 0.01ms — visually correct but the hover states now snap. That's fine (reduced-motion users explicitly asked for this), but note it in QA.

### 13. Marketing content vs dashboard
Marketing pages (`(marketing)/**`) tend to have looser tap targets (`text-xs` on `<a>` inside `p-2` containers). Not compliance-fatal but worth a pass if you plan to run marketing through a proper audit.

---

## What I couldn't verify without a browser

- **Focus order** — the DOM order matches visual order in most files, but a real Tab-through would confirm.
- **Screen reader announcements** — icon buttons above surface as bugs; the fix is aria-labels, but the actual VoiceOver/JAWS run is what matters.
- **Reduced-motion behavior** — my CSS is theoretically correct, but confirm on macOS System Settings → Accessibility → Reduce Motion + Chrome.
- **Real touch targets** — inspecting live layout gives real px sizes; grep gives class names, which vary by theme config.
- **Color contrast at runtime** — depends on the actual computed color of `--muted`, `--line`, `--ink`. My guesses are Tailwind default slates; the tokens might override.
- **Hindi/Hinglish rendering** — no way to know without a device.
- **iOS Safari-specific bugs** (safe area, sticky headers, 100vh) — need a device.

---

## Fix pipeline (if you want me to do them one by one)

Order by impact × cost:

1. **Sweep icon-only buttons for aria-label** — mechanical, safe, ~70 sites. `sed`-able if patterns match. Est. 30min.
2. **Fix `<div onClick>` in CelebrationModal** — 5min.
3. **`group-focus-within:opacity-100` on KPI/Insight cards** — 3 files, additive. 10min.
4. **`min-h-11 min-w-11` on dashboard icon buttons** — 70 sites, risk of visual layout shift. Do behind a linter rule not blind sed. Est. 45min.
5. **Muted contrast bump** — one token change, cascades everywhere. Needs design sign-off (visual regression risk).

Say the word if you want any of these; #1 is the easy win and I can queue it right now.

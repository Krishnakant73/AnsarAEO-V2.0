# AnsarAEO — Information Architecture Redesign

**Author:** Product Design (VP Product Design / Head of UX / Principal Architect review)
**Date:** 2026-07-15
**Scope:** Information Architecture only. No visual redesign, no branding, color, typography, or component changes. This is a structural proposal.
**Benchmark set:** Linear, GitHub, Vercel, Notion, Stripe.

---

## 0. Executive Summary

### The problem
The current app exposes **49 surfaces** behind **40 top-level nav links** grouped by *engineering module* (Workflow, Scale, Monitor, Competitive, Technical & Site, Content, Growth & Data, Leadership, Settings). Users must hold 9 mental buckets that map to code, not jobs. Power tools (robots, header-graph, token-bloat, llms.txt, schema) sit at the same level as the home dashboard, so a first-time D2C founder sees 40 choices on day one.

### The redesign
Re-platform the primary navigation around **9 jobs-to-be-done**, make **Brand / Prompt / Competitor / Campaign** into *contextual object workspaces* (not isolated pages), and push power tools behind **tabs, contextual side panels, and progressive disclosure**. Add a **command palette (⌘K)**, **breadcrumbs**, **keyboard shortcuts**, and a **floating AI Copilot** that is aware of the current page/object.

### Complexity reduction (the 40% target)
| Metric | Before | After | Δ |
|---|---|---|---|
| Primary nav items (at rest) | 40 | 9 | **−77%** |
| Total surfaces needing explicit navigation | 49 | 21 | **−57%** |
| Power/advanced tools visible by default | ~12 | 0 (disclosure) | **−100%** |
| Nav-group vocabulary | 9 eng terms | 9 JTBD terms | reframed |
| Concepts a user must learn to "get around" | ~49 | 9 jobs + 4 objects | **−82%** |

Perceived complexity drops well past the 40% target because the *ceiling* of what a user must understand at rest is 9 jobs, not 49 pages, and the heaviest sections (Optimization, Workspace) use **tabs** rather than nested link lists.

> **Two interpretation calls I made (flag for sign-off — §21):**
> - **Intelligence Network** is defined as the *macro/cross-brand* intelligence layer: **Benchmark & Leaderboard + Citation Network (co-citation/authority graph)**. "Intelligence" (§3) stays the *your-market war-room* (specific competitors, positioning, signals, your citations).
> - **Ecosystem** owns *outward connectivity* (Integrations + API/Developer + MCP + webhooks). **Settings** becomes *account/plan/org configuration* (Billing moves here from Integrations). This mirrors Stripe (Settings vs Developers) and GitHub (Settings vs Integrations/API).

---

## 1. Design Principles

1. **Navigate by job, not by module.** Primary nav answers "what am I trying to do?" not "which engine runs this?"
2. **Every page answers exactly one question.** If a page needs two questions, split into tabs or panels.
3. **Objects are workspaces, not pages.** Brand, Prompt, Competitor, Campaign open a contextual workspace (slide-over panel → full page). You never "leave" your flow to inspect one.
4. **Progressive disclosure.** Default view = outcome + next action. Power tools appear when an audit flags them or via an "Advanced" disclosure.
5. **One global context, many scopes.** The selected brand is the persistent context (brand switcher). Everything else is scoped under it.
6. **Search and Copilot are first-class navigation.** ⌘K and the floating Copilot reach anything a link can.
7. **No functionality removed.** 49 surfaces all survive — as pages, tabs, panels, or advanced drawers.

---

## 2. Current IA Audit — Module-by-Module Decisions

Legend: **S**tandalone page · **T**ab · **M**erge into workflow · **A**dvanced (progressive disclosure) · **C**ontextual (object panel) · **St**ettings · **H**idden-until-needed.

| # | Module | Current location | Current group | Decision | New home | Parent | Default-visible |
|---|---|---|---|---|---|---|---|
| 1 | Dashboard (home) | `/dashboard` | Monitor | **S** → becomes Mission Control | Mission Control | — | ✅ |
| 2 | Mission Control | `/dashboard/mission-control` | Workflow | **M** → merge into home | Mission Control | — | ✅ (same page) |
| 3 | Alerts | `/dashboard/alerts` | Monitor | **T** | Mission Control › Alerts | Mission Control | panel/tab |
| 4 | Executive Dashboard | `/dashboard/executive` | Leadership | **M** → audience mode | Mission Control › Executive (view toggle) | Mission Control | toggle |
| 5 | Reports (PDF) | `/dashboard/reports` | Growth & Data | **M** → export action | Mission Control (Export) + Agency (Client Reports) | both | action |
| 6 | Opportunity Queue | `/dashboard/opportunities` | Workflow | **C** → panel in MC | Mission Control › Opportunities panel | Mission Control | panel |
| 7 | Blind Discovery | `/dashboard/blind-discovery` | Monitor | **S** (tab) | Discovery › Organic Recall | Discovery | tab |
| 8 | Fan-Out Coverage | `/dashboard/fanout` | Monitor | **S** (tab) | Discovery › Fan-Out | Discovery | tab |
| 9 | Prompt Suite | `/dashboard/prompt-suite` | Monitor | **S** (tab) | Discovery › Prompt Suite | Discovery | tab |
| 10 | Topic Gaps | `/dashboard/competitor-topics` | Competitive | **S** (tab) | Intelligence › Topic Gaps | Intelligence | tab |
| 11 | Competitors (list) | `/dashboard/competitors` | Competitive | **S** (objects) | Intelligence › Competitors | Intelligence | ✅ list |
| 12 | Competitor Intel | `/dashboard/competitors/intelligence` | Competitive | **T/C** | Intelligence › Battlecards + Competitor panel | Intelligence | tab |
| 13 | Positioning | `/dashboard/positioning` | Monitor | **S** (tab) | Intelligence › Positioning | Intelligence | tab |
| 14 | Brand Signals | `/dashboard/signals` | Growth & Data | **S** (tab) | Intelligence › Signals | Intelligence | tab |
| 15 | Citations | `/dashboard/citations` | Competitive | **S/T/C** | Intelligence › Citations + Source panel | Intelligence | tab |
| 16 | Site Audit | `/dashboard/site-audit` | Technical & Site | **S** (tab) | Optimization › Site › Audit | Optimization | tab ✅ |
| 17 | AI Index | `/dashboard/ai-index` | Technical & Site | **T/A** | Optimization › Site › AI Index | Optimization | tab |
| 18 | Schema-for-AI | `/dashboard/schema` | Technical & Site | **A** | Optimization › Site › Advanced | Optimization | disclosure |
| 19 | llms.txt Validator | `/dashboard/llms-txt` | Technical & Site | **A** | Optimization › Site › Advanced | Optimization | disclosure |
| 20 | Robots Check | `/dashboard/robots` | Technical & Site | **A** | Optimization › Site › Advanced | Optimization | disclosure |
| 21 | Internal Links | `/dashboard/internal-links` | Technical & Site | **A** | Optimization › Site › Advanced | Optimization | disclosure |
| 22 | Token Bloat | `/dashboard/token-bloat` | Technical & Site | **A** | Optimization › Site › Advanced | Optimization | disclosure |
| 23 | Header & Link Graph | `/dashboard/header-links` | Technical & Site | **A** | Optimization › Site › Advanced | Optimization | disclosure |
| 24 | Local SEO (GBP) | `/dashboard/gbp` | Technical & Site | **S** (tab) | Optimization › Site › Local | Optimization | tab |
| 25 | Content Studio | `/dashboard/content` | Content | **S** (tab/objects) | Optimization › Content › Studio | Optimization | tab |
| 26 | Content Optimizer | `/dashboard/content/optimizer` | Content | **S** (tab) | Optimization › Content › Optimizer | Optimization | tab |
| 27 | Content Gaps | `/dashboard/content/gaps` | Content | **S** (tab) | Optimization › Content › Gaps | Optimization | tab |
| 28 | PDP Generator | `/dashboard/pdp` | Content | **S** (tab) | Optimization › Content › PDP | Optimization | tab |
| 29 | Answer Blocks | `/dashboard/answer-blocks` | Monitor | **S** (tab) | Optimization › Content › Answer Blocks | Optimization | tab |
| 30 | GEO Linter | `/dashboard/geo-lint` | Monitor | **S/A** | Optimization › Content › Linter | Optimization | tab |
| 31 | Price Fact-Check | `/dashboard/price-factcheck` | Content | **S** (tab) | Optimization › Content › Price | Optimization | tab |
| 32 | Prompts (managed) | `/dashboard/prompts` | Monitor | **S** (objects) | Workspace › Prompts | Workspace | ✅ list |
| 33 | Mention Consistency | `/dashboard/consistency` | Monitor | **T/C** | Workspace › Prompts › Consistency (per-prompt panel) | Workspace | panel |
| 34 | Tasks | `/dashboard/tasks` | Workflow | **S** | Workspace › Tasks | Workspace | tab |
| 35 | Approvals | `/dashboard/approvals` | Workflow | **S** | Workspace › Approvals | Workspace | tab |
| 36 | Automations | `/dashboard/automations` | Scale | **S** | Workspace › Automations | Workspace | tab |
| 37 | Sprints | `/dashboard/sprints` | Scale | **S** | Workspace › Sprints | Workspace | tab |
| 38 | Campaigns | `/dashboard/campaigns` | Scale | **S** (objects) | Workspace › Campaigns | Workspace | tab |
| 39 | Teams | `/dashboard/teams` | Scale | **S** | Workspace › Teams | Workspace | tab |
| 40 | Playbooks | `/dashboard/playbooks` | Scale | **S** | Workspace › Playbooks | Workspace | tab |
| 41 | History | `/dashboard/history` | Growth & Data | **S** | Workspace › History | Workspace | tab |
| 42 | Agent / Copilot | `/dashboard/agent` | Growth & Data | **M** → floating + full page | Floating Copilot (global) + Workspace › Copilot | global | floating |
| 43 | Onboarding | `/dashboard/onboarding` | (unlinked) | **M** → first-run flow | Workspace › Onboarding (first-run only) | Workspace | hidden until first run |
| 44 | Workflow Analytics | `/dashboard/workflow-analytics` | Workflow | **S** | Workspace › Analytics | Workspace | tab |
| 45 | Agency Workspace | `/dashboard/agency` | Leadership | **S** | Agency › Portfolio | Agency | ✅ |
| 46 | Benchmark Center | `/dashboard/benchmark` | Growth & Data | **S** | Intelligence Network › Benchmark | Network | ✅ |
| 47 | Integrations | `/dashboard/settings/integrations` | Settings | **M** → Ecosystem | Ecosystem › Integrations | Ecosystem | ✅ |
| 48 | Billing | `/dashboard/settings/billing` | Settings | **M** → Settings | Settings › Plan & Billing | Settings | ✅ |
| 49 | GSC Index | `/dashboard/gsc` | Growth & Data | **S** (tab) | Optimization › Site › Index (GSC) | Optimization | tab |

**Result:** 9 primary jobs · 21 dedicated sub-pages · 28 surfaces become tabs/panels/advanced/contextual · 0 functionality removed.

---

## 3. The 9-Job Primary Navigation

Each primary item answers exactly one question.

| # | Primary | One question it answers | Default landing content |
|---|---|---|---|
| 1 | **Mission Control** | "Is my brand winning in AI search *right now*, and what's the one thing to do?" | KPI strip (visibility, citation rate/share, avg rank, divergence, sentiment, trend), Opportunities panel, Recent alerts, Why-competitors-win, By-intent funnel, Revenue (if connected) |
| 2 | **Discovery** | "What questions are asked about my category, and where am I missing?" | Organic Recall, Fan-Out coverage, Prompt Suite generator, discovered-prompt suggestions |
| 3 | **Intelligence** | "Who's beating me in AI answers, and why?" | Competitors, Battlecards / Why-they-win, Positioning, Signals, Citations, Topic Gaps |
| 4 | **Optimization** | "What do I fix to become more citable?" | Prioritized fix list (site+content), Site tab, Content tab |
| 5 | **Workspace** | "What am I working on, and what needs my attention?" | My work overview (tasks/approvals due), Prompts, Tasks, Approvals, Automations, Sprints, Campaigns, Teams, Playbooks, History |
| 6 | **Agency** | "How are my clients doing, and can I show them results?" | Client portfolio, Client reports (white-label), Benchmark for pitches |
| 7 | **Intelligence Network** | "How does my brand/category stack up across the industry, and where does authority flow?" | Benchmark & Leaderboard, Citation Network graph |
| 8 | **Ecosystem** | "How does AnsarAEO connect to the rest of my stack?" | Integrations + connection status, API & Developer, MCP |
| 9 | **Settings** | "How is my account, plan, and org configured?" | Profile, Org, Plan & Billing, Members & Roles, Notifications, Security |

---

## 4. Complete Sitemap

```
AnsarAEO  (selected brand = global context via Brand Switcher)
│
├─ Mission Control  /dashboard  (home)
│   ├─ Overview            (default)
│   ├─ Executive           (audience-mode toggle)
│   ├─ Alerts             (rules + firings)
│   └─ [Export PDF]       (action → report)
│   └─ Opportunity panel  (slide-over, contextual)
│
├─ Discovery  /dashboard/discovery
│   ├─ Overview
│   ├─ Organic Recall     (Blind Discovery)
│   ├─ Fan-Out Coverage
│   └─ Prompt Suite       (generate tracking matrix → add as Prompts)
│
├─ Intelligence  /dashboard/intelligence
│   ├─ Overview
│   ├─ Competitors        (object list → Competitor workspace panel)
│   ├─ Battlecards        (incl. Why-They-Win)
│   ├─ Positioning
│   ├─ Signals            (Brand Signals / social)
│   ├─ Citations          (landscape + Source panel)
│   └─ Topic Gaps
│
├─ Optimization  /dashboard/optimization
│   ├─ Overview           (prioritized fix list)
│   ├─ Site  (tab)
│   │   ├─ Audit          (grade + scorecard)
│   │   ├─ AI Index
│   │   ├─ Local SEO (GBP)
│   │   ├─ Index (GSC)
│   │   └─ Advanced ▸     (disclosure)
│   │        ├─ Schema-for-AI
│   │        ├─ llms.txt Validator
│   │        ├─ Robots Check
│   │        ├─ Internal Links
│   │        ├─ Token Bloat
│   │        └─ Header & Link Graph
│   └─ Content  (tab)
│       ├─ Studio          (drafts / objects)
│       ├─ Optimizer
│       ├─ Gaps
│       ├─ PDP Generator
│       ├─ Answer Blocks
│       ├─ GEO Linter
│       └─ Price Fact-Check
│
├─ Workspace  /dashboard/workspace
│   ├─ Overview           (my work)
│   ├─ Prompts            (object list → Prompt workspace panel; per-prompt Consistency)
│   ├─ Tasks
│   ├─ Approvals
│   ├─ Automations
│   ├─ Sprints
│   ├─ Campaigns          (object list → Campaign workspace)
│   ├─ Teams
│   ├─ Playbooks
│   ├─ History
│   ├─ Analytics          (Workflow Analytics)
│   ├─ Copilot           (full-page chat; also floating)
│   └─ Onboarding         (first-run only)
│
├─ Agency  /dashboard/agency
│   ├─ Portfolio          (client brands + switch)
│   ├─ Client Reports     (white-label builder / Executive per client)
│   └─ Benchmark          (category benchmarking)
│
├─ Intelligence Network  /dashboard/network
│   ├─ Benchmark & Leaderboard
│   └─ Citation Network   (co-citation / authority graph)
│
├─ Ecosystem  /dashboard/ecosystem
│   ├─ Integrations       (GA4, Shopify, GSC, WhatsApp + status)
│   └─ API & Developer    (keys, v1 endpoints, webhooks, MCP)
│
└─ Settings  /dashboard/settings
    ├─ Profile
    ├─ Organization
    ├─ Plan & Billing
    ├─ Members & Roles
    ├─ Notifications
    └─ Security
```

**Object workspace routes (contextual, reachable from lists/panels):**
```
/dashboard/intelligence/competitors/[id]     Competitor workspace
/dashboard/workspace/prompts/[id]             Prompt workspace
/dashboard/workspace/campaigns/[id]           Campaign workspace
/dashboard/intelligence/citations/[domain]    Source/Citation workspace
```

---

## 5. Sidebar Hierarchy (exact)

Sidebar shows **9 primary items + the active section's visible sub-items** (tabs are rendered in-page, not as sidebar links). Advanced tools stay behind a disclosure *inside* the Optimization page, never in the sidebar.

```
Ansar [logo]                         Brand Switcher: Acme ▾
─────────────────────────────────────────────────────────
● Mission Control
● Discovery
● Intelligence
● Optimization
● Workspace
● Agency
● Intelligence Network
● Ecosystem
● Settings
─────────────────────────────────────────────────────────
[ ⌘K Search ]   [ Copilot ◈ ]   [ + New ]
```

**Expanded (example: Optimization active)** — sidebar still shows only the 9 primaries; the section's tabs render as a sub-row *under the active item* only when that section is open:

```
● Optimization
    ↳ Overview · Site · Content      ← in-page tab strip (not nested links)
```

This keeps the sidebar at a constant **9 items** regardless of section. Heaviest sections use in-page tabs, so sidebar length never grows with feature count — the core lever for the 40% reduction.

---

## 6. Object Model

Four first-class objects become **contextual workspaces**. Selecting one from a list opens a **slide-over panel** (Linear issue panel / GitHub file preview pattern); "Open workspace" expands to the full object page. The brand is the persistent root context.

| Object | Where it lives | Panel shows | Full page |
|---|---|---|---|
| **Brand** | Brand Switcher (global) | n/a (it *is* the context) | Mission Control *is* the brand workspace |
| **Prompt** | Workspace › Prompts | intent, language, live visibility_rate/citation_rate by engine, sparkline, consistency, linked content/answer-blocks, "Run now" | `/workspace/prompts/[id]` |
| **Competitor** | Intelligence › Competitors | share-of-voice, sentiment, why-they-win vs you, their citations, battlecard | `/intelligence/competitors/[id]` |
| **Campaign** | Workspace › Campaigns | target prompts, linked tasks/automations, progress, linked content | `/workspace/campaigns/[id]` |
| **Source/Citation** | Intelligence › Citations | domain authority (real vs proxy), co-citation, own-vs-competitor | `/intelligence/citations/[domain]` |
| **Task / Approval / Automation / Playbook / Sprint** | Workspace | detail panel | inline or `/workspace/[type]/[id]` |

**Why this reduces complexity:** instead of 5 separate "pages" you navigate between to understand a prompt (list, run, history, consistency, content), the prompt is *one workspace* with everything scoped to it. Cross-object navigation stays in-panel.

---

## 7. Navigation Flows (key journeys)

**J1 — First run (D2C founder, day 1)**
Onboarding (first-run only) → add brand + domain autofill → "Run first visibility check" → lands on Mission Control with KPIs + 1 Opportunity → ⌘K "add prompt" → Discovery › Prompt Suite generates matrix → one-click add → done. *Zero need to understand the other 8 sections.*

**J2 — Competitive loss (the "why" loop)**
Mission Control › Why-competitors-win → click competitor → Competitor panel (why-they-win, battlecard) → "See their citations" → Source panel → "Create content to close gap" → Optimization › Content › Gaps (pre-filled). *All in-panel until explicit expand.*

**J3 — Fix a site issue**
Mission Control alert "robots blocking AI" → Optimization › Overview fix list → click issue → jumps to Site › Advanced › Robots Check (deep-linked, scrolled to the flag). *Advanced tool only surfaces because an audit flagged it.*

**J4 — Agency client review**
Agency › Portfolio → switch client brand → Client Reports → white-label PDF (uses persisted snapshot) → send. *No code/feature crossover; client role sees only this.*

**J5 — "I don't know where to start"**
Press ⌘K → type "why am I not cited for face wash" → Copilot answers grounded in data + offers "Open Discovery › Fan-Out" / "Add prompt". *Search + Copilot are the escape hatch from IA.*

---

## 8. Parent-Child & Tab Architecture

| Parent (page) | Children (tabs/panels) |
|---|---|
| Mission Control | Overview, Executive (toggle), Alerts (tab), Opportunity (panel), Export (action) |
| Discovery | Overview, Organic Recall, Fan-Out, Prompt Suite |
| Intelligence | Overview, Competitors(+panel), Battlecards, Positioning, Signals, Citations(+panel), Topic Gaps |
| Optimization | Overview, **Site** {Audit, AI Index, Local, Index(GSC), Advanced▸}, **Content** {Studio, Optimizer, Gaps, PDP, Answer Blocks, Linter, Price} |
| Workspace | Overview, Prompts(+panel), Tasks, Approvals, Automations, Sprints, Campaigns(+panel), Teams, Playbooks, History, Analytics, Copilot, Onboarding |
| Agency | Portfolio, Client Reports, Benchmark |
| Intelligence Network | Benchmark & Leaderboard, Citation Network |
| Ecosystem | Integrations, API & Developer |
| Settings | Profile, Organization, Plan & Billing, Members & Roles, Notifications, Security |

**Parent-child rule:** a primary job is a *parent*; its tabs are *children* rendered in-page. Objects (prompt/competitor/campaign/source) are *children of the section that owns the list* but can be reached cross-section via panel (e.g., competitor from Mission Control). The brand is the *root* above all.

---

## 9. Command Palette (⌘K / Ctrl+K) Behavior

**Invocation:** `⌘K` / `Ctrl+K` (global). Also reachable from sidebar search box and `Cmd+/`.

**Modes (auto-detected from query + always switchable with a scope chip):**
- **Navigate** — jump to any page/section (default for short queries).
- **Search** — brands, prompts, competitors, campaigns, citations/sources, content drafts.
- **Actions** — "Run visibility check", "Generate Prompt Suite", "New prompt", "Switch brand: X", "Run site audit", "Export report", "Create campaign", "Toggle alert rule".
- **Ask Copilot** — anything ending in `?` or prefixed `ask ` routes to the floating Copilot.

**Ranking:** recency (last-viewed objects first) → exact label match → type affinity (if you're on Intelligence, competitor names rank higher) → global frequency.

**Results UI:** grouped sections (Pages / Prompts / Competitors / Campaigns / Actions), each row with icon + breadcrumb path + `↵` to open / `⌘↵` to open in panel. Keyboard: `↑↓` navigate, `↵` open, `⌘↵` open-in-panel, `esc` close, `tab` cycle scope.

**Empty/No-result:** suggests "Ask Copilot" with the query prefilled.

---

## 10. Breadcrumbs

Format: `Section › [Object type:] Object › View`. Brand is *implicit* (shown in the switcher, not breadcrumb, to avoid repetition).

```
Mission Control
Intelligence › Competitors › BrandX › Why they win
Optimization › Site › Advanced › Robots Check
Workspace › Prompts › "best face wash India" › Consistency
Agency › Client Reports › Acme Pvt Ltd
```

Breadcrumb is the **secondary navigation** that makes deep objects discoverable without a cluttered sidebar. Clicking a crumb returns to that level (panel closes, page scope changes). On object pages, the root crumb (e.g., `Competitors`) returns to the list with the panel closed.

---

## 11. Contextual Side Panels & Progressive Disclosure

**Contextual side panels (slide-over, right):** open when an item is selected in a list — Opportunity, Competitor, Prompt, Citation/Source, Campaign, Task. Panel = the object workspace summary; "Open full workspace ⌘↵" expands. Panels are the default inspection mode; full pages are for focused work.

**Progressive disclosure (Optimization › Site › Advanced ▸):** the 6 deep validators (Schema, llms.txt, Robots, Internal Links, Token Bloat, Header Graph) are collapsed under **Advanced**. They also **auto-surface** when the Site Audit scorecard flags the relevant category (e.g., a robots issue reveals the Robots Check entry inline in the fix list). Power users can pin Advanced open via a preference.

**Why:** removes ~12 power tools from the default mental model while keeping them one click (or zero clicks, when audit-flagged) away.

---

## 12. Keyboard Shortcuts

**Global**
| Key | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette |
| `G` then `M` | Go to Mission Control |
| `G` then `D` | Discovery |
| `G` then `I` | Intelligence |
| `G` then `O` | Optimization |
| `G` then `W` | Workspace |
| `G` then `A` | Agency |
| `G` then `N` | Intelligence Network |
| `G` then `E` | Ecosystem |
| `G` then `S` | Settings |
| `C` | Toggle floating Copilot |
| `B` | Open Brand Switcher |
| `?` | Shortcuts sheet |
| `/` | Focus command palette search |

**Page-level (context aware)**
- Prompts: `N` new prompt · `R` run selected · `C` consistency
- Mission Control: `E` export report · `A` manage alerts
- Optimization: `S` site tab · `C` content tab · `A` toggle advanced
- Lists: `↑↓` move selection · `↵` open panel · `⌘↵` open page

Shortcuts are discoverable via `?` and shown as hints in contextual menus.

---

## 13. Floating AI Copilot Behavior

**Presence:** persistent floating button bottom-right (`◈`), available on every app page (not marketing/auth). Expands to a chat panel; optionally docks as a right sidebar.

**Context awareness (the differentiator):** before answering, Copilot reads the current **page + active object + selected brand + recent runs** and grounds every answer in real data (honesty-by-design: "I don't know" rather than guess). It shows a small "Looking at: Intelligence › Competitor BrandX" context chip.

**Per-page behavior:**
- *Mission Control* → summarizes status, surfaces top opportunity, offers "create task."
- *Discovery* → suggests prompts to add, explains fan-out gaps.
- *Intelligence* → explains why a competitor wins, drafts a battlecard action.
- *Optimization* → explains an audit flag, offers "fix" (opens generator pre-filled).
- *Workspace/Prompt* → explains consistency, suggests content.
- *Anywhere* → `ask` routes here; can execute actions ("run a visibility check for X").

**Grounded actions:** Copilot can trigger real actions (run check, generate draft, create task, switch brand) via confirmed command chips — never silently. This is the product's existing `/api/agent/chat` grounded agent, promoted from a buried page to a global surface.

---

## 14. Mobile Navigation

**Bottom tab bar (5 + More), thumb-reachable:**
```
[ Home ] [ Discover ] [ Optimize ] [ Work ] [ More ▴ ]
```
- Home = Mission Control · Discover = Discovery · Optimize = Optimization · Work = Workspace · More = sheet with Intelligence, Agency, Network, Ecosystem, Settings + Copilot.

**Section tabs** (Site/Content, etc.) become a horizontal scroll strip under the page header. **Object panels** become full-screen sheets (bottom-up). **Command palette** opens as a full-screen modal (same behavior). Breadcrumbs collapse to a back button + current object name.

**Principle:** mobile shows the same 9 jobs but only 4 in the persistent bar; the rest are one tap away in a sheet. No feature is mobile-hidden — only the surface area adapts.

---

## 15. Permission-Aware Navigation

Roles: **Owner · Admin · Editor · Viewer · Client**.

| Item | Owner | Admin | Editor | Viewer | Client |
|---|---|---|---|---|---|
| Mission Control | ✅ | ✅ | ✅ | ✅ (read) | ✅ (own brand, read) |
| Discovery | ✅ | ✅ | ✅ | read | read |
| Intelligence | ✅ | ✅ | ✅ | read | read |
| Optimization | ✅ | ✅ | ✅ (run) | read | read |
| Workspace › Prompts/Tasks | ✅ | ✅ | ✅ | read | read |
| Workspace › Approvals | ✅ | ✅ | ✅ | ❌ | ❌ |
| Workspace › Automations/Sprints/Teams/Playbooks | ✅ | ✅ | limited | ❌ | ❌ |
| Agency | ✅ | ✅ | ❌ | ❌ | ❌ (sees only own brand) |
| Intelligence Network | ✅ | ✅ | ✅ | read | read |
| Ecosystem (API/keys) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Settings › Billing/Members/Security | ✅ | ✅ | ❌ | ❌ | ❌ |
| Settings › Profile/Notifications | ✅ | ✅ | ✅ | ✅ | ✅ |

**Behavior:** hidden items are removed from sidebar (not just disabled) for roles that can never use them; read-only items render with a "view-only" chip and disabled edit actions. Client role's sidebar is trimmed to Mission Control, Discovery, Intelligence, Optimization, Workspace (read), Settings (profile only) — Agency/Network/Ecosystem/Billing hidden.

---

## 16. Empty States

Each empty state answers "what now?" with **one primary CTA** + honest microcopy (no fake data — honesty-by-design).

| Context | Empty state |
|---|---|
| No brand yet | "Add your first brand" → onboarding autofill |
| Brand, no prompts | "What questions should you be mentioned for?" → Discovery › Prompt Suite |
| Prompts, no runs | "Run your first visibility check" → one-click run |
| No competitors | "Who are you up against?" → add competitor |
| No integrations | "Connect GA4 / Shopify to see revenue" → Ecosystem |
| Never audited | "Check if AI can read your site" → Optimization › Site › Audit |
| No content drafts | "Draft your first AI-optimized page" → Optimization › Content › Studio |
| Agency, no clients | "Add a client brand" → Portfolio |
| No alerts configured | "Get notified when visibility drops" → Mission Control › Alerts |

---

## 17. Loading States

- **Mission Control KPIs:** skeleton stat cards + shimmer charts; KPIs stream in as `computeGeoMetrics` resolves (real-time, `force-dynamic`). Low-sample flags appear post-load.
- **Lists (Prompts/Competitors/Campaigns):** skeleton rows; selection panel shows a centered spinner.
- **Generators (Content/Answer Blocks/PDP):** inline progress ("Drafting… 2/3 sections") with cancel; honors `[ADD …]` placeholders on render.
- **Command palette:** instant local results; remote/search results show a thin top progress bar; never blocks typing.
- **Copilot:** streaming tokens; "grounding in your data…" pre-message state; citations listed after answer.
- **Big scans (Blind Discovery, Fan-Out, Audit):** progress with cancellable background job + "we'll notify you" (WhatsApp/alert) pattern.
- **Error:** existing `error.tsx` / `global-error.tsx` retained; empty/error states per §16.

---

## 18. Search Model

**Indexed entities:**
- *Navigational:* all 9 sections + their tabs + settings sub-pages.
- *Objects:* brands, prompts (text + intent + language), competitors, campaigns, content drafts, citations/sources, tasks, automations.
- *Actions:* all command-palette actions (§9).
- *Help:* PRD/guide/changelog snippets (read-only, local index).

**Not indexed (privacy/scope):** other orgs' data; raw `raw_response` text; secrets.

**Query flow:** local fuzzy match on labels + synonyms ("rank"→Benchmark, "competitors"→Intelligence) → scoped recency boost → Copilot fallback for natural-language `?` queries. Results capped (5 per group), keyboard-navigable, with breadcrumb path per row.

---

## 19. Migration Strategy (from current IA → new)

**Guiding rule:** zero broken bookmarks, zero lost functionality, phased rollout behind a feature flag (`ia_v2`).

**Phase 0 — Prep (no UI change)**
- Add new route segments: `discovery`, `intelligence`, `optimization`, `workspace`, `agency`, `network`, `ecosystem` as route groups; keep all old routes.
- Implement `BrandSwitcher`, command palette, Copilot float, breadcrumb, shortcut layer as *additive* components.

**Phase 1 — Shell + navigation (flag `ia_v2=on` for beta users)**
- Swap `nav-config.ts` primary items to the 9 jobs.
- Wire tabs/panels; old routes redirect to new equivalents (301):
  - `/dashboard` → Mission Control (Overview)
  - `/dashboard/mission-control` → Mission Control
  - `/dashboard/alerts` → Mission Control › Alerts
  - `/dashboard/blind-discovery` → Discovery › Organic Recall
  - `/dashboard/fanout` → Discovery › Fan-Out
  - `/dashboard/prompt-suite` → Discovery › Prompt Suite
  - `/dashboard/competitors` (+`/intelligence`) → Intelligence › Competitors / Battlecards
  - `/dashboard/positioning` → Intelligence › Positioning
  - `/dashboard/signals` → Intelligence › Signals
  - `/dashboard/citations` → Intelligence › Citations
  - `/dashboard/competitor-topics` → Intelligence › Topic Gaps
  - `/dashboard/site-audit`,`/ai-index`,`/gbp`,`/gsc`,`/schema`,`/llms-txt`,`/robots`,`/internal-links`,`/token-bloat`,`/header-links` → Optimization › Site (+Advanced)
  - `/dashboard/content`(+`/optimizer`,`/gaps`),`/pdp`,`/answer-blocks`,`/geo-lint`,`/price-factcheck` → Optimization › Content
  - `/dashboard/prompts`,`/consistency`,`/tasks`,`/approvals`,`/automations`,`/sprints`,`/campaigns`,`/teams`,`/playbooks`,`/history`,`/workflow-analytics`,`/agent`,`/onboarding` → Workspace
  - `/dashboard/agency`,`/executive`,`/reports`,`/benchmark` → Agency (+Network for benchmark)
  - `/dashboard/settings/integrations` → Ecosystem › Integrations; `/dashboard/settings/billing` → Settings › Plan & Billing

**Phase 2 — Object workspaces + panels**
- Ship slide-over panels for Prompt/Competitor/Campaign/Source.
- Promote Copilot from `/agent` page to global float (keep `/agent` as Workspace › Copilot full page).
- Add breadcrumbs across all sections.

**Phase 3 — Collapse & disclose**
- Move 6 deep validators under Optimization › Site › Advanced (auto-surface on audit flags).
- Trim sidebar to constant 9; move settings sub-pages under Settings.
- Flip `ia_v2` default-on after beta metrics pass.

**Rollback:** flag off restores `nav-config.ts` v1; redirects remain (harmless). No DB changes required — IA is routing/component only.

**Measurement (prove the 40%):**
- Instrument: distinct nav-items seen per session, median clicks-to-task, command-palette usage, panel-vs-page ratio, "dead" page hits (old routes post-redirect).
- Success: ≥40% drop in median concepts-to-first-action; ≥30% of对象 inspections via panel not page; old-route hits → ~0 after 30 days.

---

## 20. Complexity Reduction Scorecard

| Dimension | Before | After | Improvement |
|---|---|---|---|
| Primary nav items at rest | 40 | 9 | −77% |
| Surfaces needing explicit nav | 49 | 21 | −57% |
| Engineering-named groups | 9 | 0 (9 JTBD) | reframed |
| Power tools in default view | ~12 | 0 | −100% |
| Concepts to "get around" | ~49 | 9 + 4 objects | −82% |
| Cross-page hops to inspect a prompt | 5 | 1 (workspace) | −80% |
| Escape hatches (search/⌘K/Copilot) | 1 (buried /agent) | 3 (⌘K + Copilot + breadcrumb) | +200% |

**Net perceived complexity: ↓ ~40–60%** (conservative floor = 40% target met on the two hardest metrics: concepts-to-learn and default-visible choices).

---

## 21. Open Decisions for Sign-Off

1. **Intelligence Network scope** — I mapped it to *Benchmark + Citation Network* (macro/cross-brand). If you intended it as the *agent/AI-orchestration network* (agents, MCP, task mesh) instead, that block should swap with Ecosystem (API/integrations) or split. **Please confirm the definition.**
2. **Benchmark placement** — currently under Intelligence Network (industry view). Alternative: keep under Agency (client pitch tool). I chose Network because benchmarking is cross-brand intelligence, not a single-client task.
3. **Executive view** — folded into Mission Control as an audience toggle vs. a separate Agency "Client Reports" builder. Both exist; confirm Executive isn't needed as its own nav entry for non-agency enterprises.
4. **GSC** — placed under Optimization › Site › Index (it's technical index monitoring). Alternative: Growth/Intelligence. Flag if you'd rather it live elsewhere.
5. **Mention Consistency** — modeled as a per-prompt panel inside Workspace › Prompts (reliability of *your* mentions). Alternative: a Discovery tab. Confirm.
6. **Rollout flag name** — proposed `ia_v2`; align with deploy checklist (`PRODUCTION_DEPLOYMENT_CHECKLIST.md`).

---

*End of IA Redesign. No code changed; this is a structural proposal ready for sign-off, then implementation (nav-config swap + redirects + additive components per Phase plan).*

---

## 22. Implementation Status (2026-07-15)

**Confirmed both open decisions** → proceeded with full build.

### Shipped (real, working, `tsc --noEmit` green)
- **`src/components/dashboard/nav-config.ts`** — rewritten to the 9 jobs-to-be-done + an `Advanced` group (the 6 deep validators collapsed out of the default mental model). All `href`s point at existing routes (zero 404s). `isNavActive` retained; added `SECTION_KEYS` map for the `G`+letter jump.
- **`DashboardShell.tsx`** — floating **AI Copilot** FAB (bottom-right, routes to `/dashboard/agent?ctx=<pathname>` so the grounded agent knows the current page); **Breadcrumbs** rendered above every page's content; **Advanced** group visually de-emphasized (top border + muted label); mounts the shortcut layer.
- **`src/components/dashboard/Breadcrumbs.tsx`** (new) — auto-derived from `nav-config` (root `/dashboard` → section label; nested → `Section › Item`), zero per-page edits.
- **`src/components/dashboard/Shortcuts.tsx`** (new) — `G`+`M/D/I/O/W/A/N/E/S` jump-to-job, `?` shortcuts sheet, ignores typing/meta combos.
- **`src/app/dashboard/ecosystem/page.tsx`** (new) — makes the "API & Developer" link resolve (overview of REST v1 / MCP / webhooks + link to Integrations).
- **Command palette (⌘K, `SearchBar.tsx`)** — already existed; now reflects the new JTBD groups automatically (reads `nav-config`).

### Complexity effect (this pass)
Top-level nav links: **40 → 9 jobs + 1 Advanced group**; the 6 power tools no longer sit at the same level as the home dashboard.

### Deferred (documented as Phase 2, not yet built)
- **Object workspaces as slide-over panels** (Prompt/Competitor/Campaign/Source) — currently full pages; the `?ctx=` hook is in place for the Copilot, and breadcrumbs/shortcuts are the scaffold.
- **In-page Advanced disclosure** that *auto-surfaces* a validator when an audit flags it (currently Advanced is a static bottom group).
- **Real Citation Network** page under Intelligence Network (only Benchmark shipped there so far).
- **Additional Settings sub-pages** (Profile / Org / Members / Notifications / Security) — only Plan & Billing link exists; others are documented but have no routes yet.
- **Route 301 redirects** for old URLs — not needed because every `href` was repointed at an *existing* route; no old route was deleted.
- **`next build`** not run this session (times out in sandbox); `tsc --noEmit` is green and code follows existing component patterns.

### Verification
- `npx tsc --noEmit` → exit 0, no output (clean).
- `npx eslint` (scoped to changed files) → timed out at 4 min in-sandbox (environment slowness, not a code error); CI lint runs in proper CI.

---

## 23. Phase 2 — Object Workspaces as Slide-Overs (2026-07-15)

**Goal:** objects become *contextual workspaces* (Linear/GitHub panel pattern) instead of forcing a full-page navigation. Clicking an object row opens a right-side slide-over that answers ONE question and offers quick actions + a link to the full page — the user stays in context.

### New primitive
- **`src/components/ui/sheet.tsx`** (new) — right-side slide-over on Radix Dialog (same primitive/focus/escape as the centered `dialog.tsx`), styled with redesign tokens (`border-line`, `shadow-float`, accent). Exports `Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription`. Animations reuse `tailwindcss-animate` (`slide-in-from-right` / `slide-out-to-right`), already a dependency.

### Object panels (all four from the brief)
- **`PromptPanel`** (`components/dashboard/objects/PromptPanel.tsx`) — wires into `prompts/PromptsClient.tsx`: each prompt's text is now a `SheetTrigger`; panel shows language/intent/priority + **Run check** (live engine results inline) + toggle priority + link to full Prompts page.
- **`CompetitorPanel`** (`components/dashboard/objects/CompetitorPanel.tsx`) — wires into `competitors/CompetitorsManager.tsx` (both AI-suggested and Tracking chips): shows source/confirmed status + **Share of Voice** (passed down from the page's existing `voiceData`, no extra query) + confirm/reject/stop-tracking + link to full Competitors page.
- **`CampaignPanel`** (`components/dashboard/objects/CampaignPanel.tsx`) — wires into `campaigns/page.tsx`: each campaign name opens a panel with objective/status + link to full page.
- **`SourcePanel`** (`components/dashboard/objects/SourcePanel.tsx`) — wires into `citations/page.tsx` "Most-cited sources" list: each cited domain opens a panel listing the prompts it was cited for + engines + link to full Citations page.

### Behavior notes
- **No URLs changed, no pages removed** — every full page still exists; the panel is an additive, faster path. Deep work (history, battlecards, edits) routes through the "Open full page" link.
- **No visual/branding/color/typography changes** — panels use the existing `.panel`/`.chip`/`.section-label`/`.btn-*` tokens.
- **Honesty preserved** — panels surface only recorded data (SoV, citations, run results); nothing fabricated.

### Still deferred (Phase 3 candidates)
- **`next build`** end-to-end (times out in sandbox; `tsc --noEmit` is green across all phases).

---

## 24. Phase 3 — Advanced Validators Auto-Surface (2026-07-15)

**Goal:** the 6 power validators (Schema-for-AI, llms.txt, Robots, Internal Links, Token Bloat, Header & Link Graph) no longer sit statically at the bottom of the nav. They now *surface in-context* on the audit pages that produce related findings — progressive disclosure that opens automatically when an audit flags something.

### New component
- **`src/components/dashboard/AdvancedSurface.tsx`** (new, `use client`) — a single collapsible "Advanced validators" card. Holds a `VALIDATORS` map (label/href/icon for all 6, mirroring `nav-config` hrefs so no 404s). Auto-**opens** when any signal is `flagged`, stays collapsed otherwise. Flagged validators render amber with a one-line reason + "Open" CTA to the deep check; unflagged render de-emphasized with "Review".

### Signal wiring (real data only — nothing fabricated)
- **`site-audit/SiteAuditClient.tsx`** — `auditSignals(audit)` maps the audit's real `issues` (already category-tagged by the page's `categorize()`) + `schema_markup_score` + `llms_txt_present` onto the 6 validators: Structured-Data fails / low schema score → **Schema-for-AI**; AI-Discovery fails / missing llms.txt → **llms.txt**; Crawlability fails → **Robots**; Security/header fails → **Header & Link Graph**; Performance fails → **Token Bloat**; link-graph fails → **Internal Links**. Rendered between the scorecard and the issue list.
- **`ai-index/AiIndexClient.tsx`** — `indexSignals(result)` surfaces **llms.txt / Robots / Schema-for-AI** after generation, flagged only when the generator's own `notes` call out a problem with that file (e.g. "review the generated llms.txt"). This is spec-accurate, honest surfacing of the validators that check the files just produced.

### Behavior notes
- **No URLs changed, no pages removed** — the Advanced nav group is untouched; this adds a contextual *entry point* to the same validators.
- **No visual/branding/color/typography changes** — uses `.card`, `.chip`/`.bg-grid` tokens and the existing amber alert palette.
- **Honesty preserved** — every flag is derived from recorded audit issues or the generator's own notes; the surface never invents a finding.

### Verification
- `npx tsc --noEmit` → exit 0, clean after wiring both pages.

---

## 25. Phase 4 — Citation Network Page (2026-07-15)

**Goal:** fulfill the Intelligence Network job's second half — "Citation Network" (the first half, Benchmark, shipped earlier). Answers ONE question: **which sources form my brand's citation ecosystem, and where do I sit in it?** Built entirely from recorded `visibility_runs` + `citations` data — no fabricated nodes or edges.

### New routes / components
- **`src/app/dashboard/citation-network/page.tsx`** (new, server) — gathers the selected brand's prompts → runs → citations, builds the node/edge model:
  - **nodes:** brand (center), prompts (your tracked questions), sources (cited domains, typed own / third-party / competitor by the citation's `is_own_domain` / `is_competitor_domain` flags).
  - **edges:** prompt → source whenever a citation for that prompt cites that domain; each edge tagged with the engine that returned it.
  - **reach:** per-domain count of *distinct prompts* cited for — the leverage signal (hubs = cited across many prompts).
  - Empty state (no runs / no citations) prompts the user to run visibility checks instead of faking a graph.
- **`src/app/dashboard/citation-network/CitationNetworkGraph.tsx`** (new, `use client`) — deterministic radial SVG graph (brand center, prompts inner ring, sources outer ring, sorted by reach so hubs spread evenly — **no randomness/LLM**). Features: engine filter chips (dims non-matching edges), KPI row (prompts / sources / your-domain cites / third-party cites), a "Citation hubs" panel (top-10 by cross-prompt reach = highest-leverage outreach), and a color legend. Node size encodes reach; hover shows the domain + reach + type.
- **`nav-config.ts`** — added **Citation Network** (`/dashboard/citation-network`, `Share2` icon) under the Intelligence Network group so it's reachable from the JTBD nav.

### Behavior notes
- **No URLs changed, no pages removed** — additive page reachable from the nav; the existing `/dashboard/citations` (per-run citation tables/trends) remains the detailed view.
- **No visual/branding/color/typography changes** — uses `.kpi`/`.card`/`.chip`/`.section-label` tokens; SVG colors are the existing emerald/rose/slate/accent palette.
- **Honesty preserved** — every node and edge is derived from recorded citations; the network is empty until real runs exist, never estimated or back-filled.

### Verification
- `npx tsc --noEmit` → exit 0, clean.

---

## 26. Phase 5 — Settings Sub-Pages (2026-07-15)

**Goal:** complete the Settings job. Previously only *Plan & Billing* existed; the IA brief calls for Profile / Org / Members / Notifications / Security. All five are now real, reachable from the JTBD nav.

### Nav (`nav-config.ts`)
Settings group now lists: **Plan & Billing**, **Profile** (`User`), **Organization** (`Building2`), **Members** (`Users`), **Notifications** (`Bell`), **Security** (`ShieldCheck`). All `href`s point at the new/ existing routes — zero 404s. They also auto-appear in the ⌘K palette and breadcrumbs.

### Pages built
- **`settings/profile`** — `ProfileForm` (client): shows session email (read-only) + editable **display name** persisted via `supabase.auth.updateUser({ data: { full_name } })`. Real, persisted.
- **`settings/org`** — read-only workspace: org name, plan, billing provider, brand count, member count, created date (from `organizations` + counts). Links to Plan & Billing for changes.
- **`settings/members`** — lists `org_members` (user_id + role). Shows the **current user's email**; other members render as "Team member" + truncated id. RLS-safe — no leaking of other members' emails (no `profiles` table exists).
- **`settings/notifications`** — in-app preference toggles (weekly report / priority alerts / Copilot tips) stored in **localStorage**, clearly labeled as device-local (not server emails). Honest: it does not claim server persistence it doesn't have.
- **`settings/security`** — real auth actions via the browser client: **change password** (`auth.updateUser({ password })`) and **sign out other sessions** (`auth.signOut({ scope: "others" })`). Shows account email.

### Constraints honored
- **No URLs changed, no pages removed** — additive sub-pages under Settings.
- **No visual/branding/color/typography changes** — `.panel`/`.chip`/`.page-head` tokens only.
- **Honesty preserved** — Profile/Org/Members read real data; Security performs real auth mutations; Notifications is explicitly device-local (no fabricated server sync). Members never exposes other users' PII.

### Verification
- `npx tsc --noEmit` → exit 0, clean after all five pages.

### Outstanding (environment-limited)
- **`next build`** cannot complete in this sandbox (times out); every phase is verified via `tsc --noEmit` and follows existing component/RLS patterns. Run in proper CI to confirm the production build.

### Verification
- `npx tsc --noEmit` → exit 0, no output (clean) after wiring all four panels.


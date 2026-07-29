# AnsarAEO

AnsarAEO is an AI Search and Answer Engine Optimization platform for Indian brands. It helps teams monitor brand visibility across AI answer engines, audit their website for AI-citable content, and generate draft content with evidence-backed insights.

## What it does

- Tracks brand mentions across ChatGPT, Perplexity, Gemini, Google AI Overviews, Copilot, and Grok
- Scores visibility and surfaces competitor mentions
- Audits websites for AI-readiness, schema, robots, llms.txt, and topical coverage
- Generates draft content blocks, answer blocks, reports, and localized SEO assets
- Supports billing, WhatsApp notifications, and multi-brand workflows

## Tech stack

- Next.js 16 with the App Router and TypeScript
- Supabase for authentication, Postgres, and row-level security
- Tailwind CSS for UI styling
- Vitest, ESLint, and TypeScript for testing and quality checks
- Vercel for deployment and scheduled cron jobs

## Project structure

- src/app: application routes and pages
- src/components: reusable UI components
- src/lib: core business logic, integrations, and utilities
- src/services and src/repositories: backend and data access layers
- supabase: database migrations and schema
- scripts: maintenance and deployment helpers

## Getting started

### Prerequisites

- Node.js 22+
- npm

### Install and run

```bash
npm install
npm run dev
```

### Useful commands

```bash
npm run build
npm run lint
npm run test
npm run typecheck
npm run db:migrate
```

## Environment setup

Create your local environment file from the provided example and fill in the required secrets before running the app.

## Notes

This repository is structured around a secure, org-scoped data model and uses Supabase RLS for user isolation. Sensitive credentials should remain in environment variables and never be committed to the repo.

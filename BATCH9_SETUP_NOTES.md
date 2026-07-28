# Batch 9 — Agent Chat (Grounded, Not a Generic Wrapper)

## 1. Run the migration
Supabase Dashboard → SQL Editor → run **`supabase/migration_003_agent.sql`** (adds
`agent_conversations` and `agent_messages`, doesn't touch existing data).

## 2. Files in this batch

| File | What it does |
|---|---|
| `src/lib/agent-context.ts` | Pulls real numbers from your Supabase data — visibility score, per-engine breakdown, and (most useful) which tracked prompts NEVER mention the brand |
| `src/app/api/agent/chat/route.ts` | The chat endpoint — rebuilds real context on every message, stores conversation history |
| `src/app/dashboard/agent/page.tsx` | The chat UI, with starter question suggestions |

## 3. Why this design matters (worth understanding, not just copying)

A lot of "AI agent" features in this category are really just a chat box wired to a
generic LLM call with no real connection to the user's data — which produces confident-
sounding but hollow answers. This implementation is different: **every single message
rebuilds a fresh summary of the brand's actual visibility_runs, prompts, and engine
breakdown from Supabase**, and that real data is placed directly in the system prompt.
The model is explicitly instructed to say "I don't have that data" rather than guess.

This is also why the "prompts where the brand is never mentioned" list in
`agent-context.ts` matters — it's computed with real SQL logic, not asked of the LLM to
guess at. Ask the agent "what should I fix first?" and it will answer using that real,
computed list.

## 4. Test it
```bash
npm run dev
```
Go to `/dashboard/agent`, click one of the starter questions (or type your own). Since
this calls OpenAI, make sure `OPENAI_API_KEY` is set in `.env.local`. Try asking about a
brand with zero visibility_runs yet — you should see it honestly say there's no run data,
not make something up.

## 5. Natural upgrade path later (not needed now)
Once you're generating real content (blog posts, site audit results) that's too long or
unstructured for a clean SQL query, that's the moment to add the `knowledge_chunks` +
pgvector table from `02-tech-stack-architecture.md` and do real RAG retrieval over it.
For now, structured data + direct SQL queries are actually more reliable for the kind of
questions ("how many runs", "which prompts") this agent handles.

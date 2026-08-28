<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Dashboard Jawa Timur

## 1. Project purpose

This repository contains a production-oriented dashboard for Jawa Timur revenue operations and student/school analytics.

Primary areas:
- Executive summary
- Revenue / branch performance
- Product performance
- Agent productivity
- Student growth
- Loyal students
- School partner analytics
- Settings / user administration

The application is in Indonesian-language business context. Preserve existing business terminology unless the task explicitly requests copy changes.

## 2. Stack and runtime

- Next.js `16.3.1`
- React `19.2.3`
- TypeScript `5.9.x`
- Tailwind CSS `4.x`
- Supabase JS / SSR (`@supabase/supabase-js`, `@supabase/ssr`)
- Recharts `3.x`
- Lucide React
- `csv-parse` / `csv-stringify`
- ESLint with `eslint-config-next`
- Deployment target: Vercel-compatible Next.js runtime

Path alias:
- `@/*` → `./src/*`

## 3. Repository structure

Important locations:

- `src/app/` — Next.js App Router pages, layouts, auth, API routes
- `src/components/` — reusable UI and dashboard components
- `src/lib/` — data access, transformations, filters, auth helpers, formatting and types
- `supabase/migrations/` — database schema/RPC migrations; treat as production data-contract changes
- `scripts/` — data/import/helper scripts
- `csv_samples/` — small CSV fixtures/examples
- `Master Data Jawa Timur - Raw Data Txn.csv` — large raw transaction dataset; do not edit casually
- `proxy.ts` — request/proxy behavior
- `AGENTS.md` — persistent coding instructions
- `CLAUDE.md` — points to this file; keep instructions compatible

Do NOT spend time inspecting `node_modules/` unless a dependency implementation or Next.js documentation is specifically required.

## 4. Architecture rules

### Next.js

- Prefer App Router patterns already used in the repository.
- Server Components are the default.
- Add `"use client"` only when browser state, event handlers, or client-only APIs are actually needed.
- Respect Next.js 16 behavior and read the local Next.js docs under `node_modules/next/dist/docs/` before changing framework-sensitive code.
- Keep page-level data fetching on the server when possible.
- Avoid introducing client-side fetching of large datasets when the existing server/RPC approach can be reused.

### Data access

Supabase is the primary application data backend.

Existing conventions:
- `src/lib/supabase-server.ts` handles server-side REST/RPC access with the service-role key.
- `src/lib/supabase.ts` creates the browser client.
- `src/lib/supabase-auth.ts` handles authenticated server-side Supabase sessions.
- `src/lib/admin-auth.ts` contains admin access checks.

Prefer the existing helpers (`supabaseRestFetch`, `supabaseRpcFetch`, existing data modules) over creating new ad-hoc Supabase clients.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to client components or browser bundles.

### Database and RPCs

The dashboard relies on Supabase RPC functions for several analytics workloads. Existing files under `supabase/migrations/` are part of the application contract.

Before changing a query/RPC-backed feature:
1. Inspect the current TypeScript caller.
2. Inspect the relevant migration/RPC definition.
3. Preserve existing parameter names and null semantics unless the task explicitly changes the contract.
4. Keep filters consistent across the caller, RPC, and UI.

When a schema/RPC change is required, create a new migration rather than rewriting an old migration.

### Large datasets / performance

This project works with datasets that can contain 10,000+ transaction/student rows. Performance is a first-class concern.

Default rules:
- Do not load an entire large table into a client component.
- Prefer server-side aggregation/RPCs for dashboards.
- Avoid duplicate full scans of the same dataset in a single page request.
- Use `Promise.all` when independent server-side reads can safely run concurrently.
- Reuse existing caching/revalidation patterns where appropriate.
- Do not add N+1 queries inside loops.
- Preserve pagination/batching logic when it already exists.
- For CSV imports, validate and transform on the server; do not move large parsing work into the browser unless specifically required.

Any performance optimization should preserve the correctness of the existing business calculations.

## 5. Business/data conventions

Revenue data is represented with fields such as:
- payment date
- month
- invoice
- academic year
- grade/product/agent/branch identifiers
- revenue
- new transaction flag
- full payment flag
- bulk buying flag
- school/NPSN

Important analytical concepts already present in the codebase:
- Current academic year vs previous academic year / last two years
- AYtD / same-period comparisons
- Cumulative revenue
- Retail / non-bulk vs bulk buying
- Revenue targets and achievement
- Student growth and renewal / repeat students
- Branch, region, product and agent dimensions

Do not silently change the meaning of these metrics. When modifying a calculation, locate and preserve the existing source-of-truth logic.

## 6. UI / UX conventions

The existing UI uses:
- Tailwind CSS
- Slate-based neutral palette with teal accents
- Recharts for charts
- Lucide icons
- Responsive layouts with desktop sidebar and mobile-friendly content

Rules:
- Reuse existing components before creating duplicates.
- Reuse existing formatting helpers such as `formatCurrency`, `formatNumber`, and `formatPercent`.
- Preserve responsive behavior.
- Keep chart labels, tooltips, legends, units, and comparison semantics consistent with existing charts.
- Avoid introducing a new design system or component library unless explicitly requested.
- Keep Indonesian business labels consistent unless the task asks for English or another language.

## 7. Authentication and authorization

The dashboard is protected by Supabase authentication.

Current conventions include:
- Dashboard routes redirect unauthenticated users to `/login`.
- Dashboard access can be controlled through `t_app_user.access_revenue_dashboard` and admin email rules.
- Admin-only actions use `requireAdmin()` / `isAdminEmail()` where appropriate.

Never weaken authorization checks merely to make a feature work.

Never move privileged service-role operations into client components.

## 8. File and code-change discipline

For every task:

1. Identify the smallest relevant set of files.
2. Read only the files and directly related dependencies needed to implement the task.
3. Reuse existing abstractions before creating new ones.
4. Make the smallest safe change that fully satisfies the request.
5. Do not refactor unrelated code while implementing a feature or bug fix.
6. Do not rename/move files without a clear reason.
7. Do not install new packages unless the existing stack cannot reasonably solve the problem.
8. Do not edit generated/build artifacts such as `.next/` or `tsconfig.tsbuildinfo`.
9. Do not edit `node_modules/`.
10. Do not modify raw production-like CSV data unless the task explicitly concerns the dataset.

If a task can be solved in 1–3 files, do not expand the scope to the whole repository.

## 9. Debugging workflow

When a bug is reported:

- Start from the exact route/component/function named in the report.
- Reproduce from the provided error message or code path before making broad changes.
- Inspect the immediate caller/callee chain.
- Fix the root cause rather than adding defensive code everywhere.
- Preserve existing behavior outside the reported problem.

Do not perform a repository-wide refactor just to fix a localized issue.

## 10. Validation commands

Preferred checks after code changes:

```bash
npm run lint
npm run build
```

Run the narrowest useful validation first when possible. If a change affects TypeScript, data access, routing, or build configuration, a full build is preferred before declaring the task complete.

If validation cannot be run, state that clearly rather than assuming success.

## 11. Git / change management

Keep changes easy to review and revert.

Recommended commit granularity:
- one focused feature/fix per commit
- descriptive commit message
- avoid mixing formatting-only refactors with functional changes

Before a commit, inspect:

```bash
git status
git diff --stat
git diff
```

Do not overwrite unrelated user changes that are already present in the working tree.

## 12. CSV / import rules

CSV-related functionality is sensitive because transaction imports can affect downstream analytics.

Before changing import logic:
- inspect the expected CSV headers in `csv_samples/`
- inspect `src/lib/revenue-transform.ts`
- understand lookup mappings (grade, product, agent, branch, academic year, school)
- preserve the transformation/reporting behavior
- validate numeric/date fields explicitly
- preserve business-specific overrides already encoded in transformation logic

Never assume CSV column names, month formats, or academic-year formats. Read the actual fixtures and transformation code.

## 13. API route rules

Current API routes include revenue/raw-data upload and revenue-target upload.

For API changes:
- validate request input on the server
- enforce authorization before privileged operations
- return useful HTTP status codes
- avoid leaking secrets or internal stack traces
- preserve existing response shapes when possible

## 14. Environment variables

Expected categories include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS`

Never hardcode credentials, tokens, or service-role keys.

Never print secret environment variables into logs, UI, commits, or generated files.

## 15. Prompt/task scoping guidance for Codex

Optimize for focused tasks. Before editing, determine:
- route/page involved
- component(s) involved
- data module/RPC involved
- whether a migration is actually necessary

Use narrow task scope when possible, for example:

> Fix the edit-state bug in `src/components/student-table.tsx`. Keep API/database behavior unchanged. Only inspect directly related student components/data helpers. Run `npm run lint` afterward.

Avoid broad instructions such as “refactor the entire dashboard” unless that is explicitly the objective.

## 16. Completion report

After making changes, report briefly:

- what changed
- files changed
- validation performed and result
- any remaining limitation or follow-up needed

Do not claim that a test/build/deployment succeeded unless it was actually run and succeeded.

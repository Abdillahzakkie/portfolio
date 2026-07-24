# Portfolio + Blog — HANDOFF

The single source of truth for this build. Every agent reads this first and appends
to the **Status log** at the bottom when it finishes.

## What we're building
A distinctive personal portfolio **and** an integrated blog for Abdullah Zakariyya,
showcasing ~20 real projects across Web3, Security, and Commerce, with a companion
blog post per project discussing the engineering intricacies.

## Decisions (locked at the gate)
1. **Blog engine:** full CMS + admin (authenticated authoring, draft→publish). Built
   on the `blog-system-builder` skill — do not hand-roll the data model or REST contract.
2. **Scope:** feature everything real, in full detail. Client/security posts are drafted
   in full but default to `draft` status so the owner publishes them manually.
3. **Design:** interactive, zoomable **domain-graph home** — projects as a clustered
   constellation grouped by *Web3 · Security · Commerce · Tools/Labs*. Node → project
   case study → linked blog post(s). This is the "unique" hook.
4. **Deploy:** Vercel (public site + `/admin` + API route handlers as serverless), DB external.

## Stack (follows the owner's own managerenta/golden_bite/chekka reference architecture)
- **Next.js (App Router) + TypeScript**, single app.
- **Model → Service → Route triad in `src/server/`**.
- **MongoDB** — dev: shared Docker on `localhost:27018` (give this app its own DB name
  `portfolio`); prod: Atlas. Redis optional (skip unless needed).
- Package manager: **pnpm** (v9). Node 24.
- Styling: owner favors styled-components / Tailwind across repos — designer picks; state it.

## Builder slice map — STAY INSIDE YOUR SLICE. Two builders never touch the same file.
| Builder | Owns (only these paths) |
|---|---|
| ui-ux-designer (contract, first) | `docs/design/**` |
| database-engineer (contract, first) | `src/server/models/**`, `src/server/db/**` |
| backend-dev | `src/app/api/**`, `src/server/services/**`, `src/server/repositories/**`, `src/server/auth/**`, `src/server/seed/**` |
| frontend-dev (public) | `src/app/(public)/**`, `src/components/public/**`, `src/lib/**`, root `src/app/layout.tsx` + `globals` |
| frontend-dev (admin) | `src/app/admin/**`, `src/components/admin/**` |
| tech-writer | `content/**` |
| devops | `Dockerfile`, `vercel.json`, `.github/**`, `docker-compose.yml`, root config (`package.json`, `tsconfig`, `next.config`, `.env.example`, `.gitignore`) |
| qa-engineer | `tests/**`, `e2e/**` |

If you need a file outside your slice, DO NOT touch it — record it under HANDOFF below and stop.

## Content authenticity rule
Blog/project copy must be grounded in what each repo actually contains (its README,
ARCHITECTURE.md, RUNBOOK, CHANGELOG, SECURITY docs). Do NOT invent benchmarks, dates,
or design rationale the repos don't support. Uncertain claims → phrase as draft / omit.
See `docs/PROJECT-INVENTORY.md` for the factual source material.

## Absolute guard
No secrets, tokens, `.env` values, private keys, or credentials in content, seed data,
or committed files. `.env` is gitignored; only `.env.example` is committed.

---
## Status log (append your entry when done)
- (orchestrator) Repo scaffolded, HANDOFF + ACCEPTANCE + INVENTORY written. Dispatching contract agents.
- (ui-ux-designer) Design contract written to docs/design/00-04. Committed styling: Tailwind CSS v4 + CSS-variable tokens (justified over styled-components for App Router/RSC + Lighthouse). Concept: "Constellation of Work" — 18 real projects as stars in 4 domain clusters, static positioned (no force sim), SSR <nav> backbone + card fallback <768px, roving-tabindex keyboard nav, reduced-motion static mount. Fonts self-hosted via next/font (no runtime CDN). Backend TODO — define contracts for the [API] shapes listed in docs/design/04-components.md §[API]: ProjectNodeData, EdgeData (or accept static edges), PostRow/PostDraft (post.projectSlug is a REQUIRED link per ACCEPTANCE #3), slug-uniqueness check, and published-only sitemap/RSS. Frontend TODO — freeze exact node px positions per the anchors+phyllotaxis rule (02-graph-home §1); globals.css owns the token layer. Devops TODO — decide next/font/google (build-time self-host) vs next/font/local (.woff2 committed).
- (orchestrator) ⏸ PAUSED after Phase 2a at owner's request. Resume point + ready-to-dispatch
  builder briefs are in **CONTINUE-HERE.md**. Next action: Phase 2b builders (devops first,
  then backend + 2×frontend + tech-writer + qa in parallel). No processes running; nothing committed.
- (database-engineer) Data contract landed: `src/server/db/connect.ts` (cached serverless-safe conn), `src/server/models/{types,Project,Post,User,index}.ts`, `docs/DATA-MODEL.md`. Body=Markdown/MDX. Indexes: unique slug (Project/Post) + unique email (User); Post{status,publishedAt} + {projectSlug,status} + tags; Project{domain,order} + {featured,order}. Verified: strict `tsc --noEmit` clean + live Mongo (27018) integration on a throwaway db (indexes built, constraints/enum/slug enforce, publish-list query hits IXSCAN not COLLSCAN). Types are import-ready for backend/frontend.

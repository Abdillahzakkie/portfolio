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
- (devops) App config + locked dependency set landed. Files created (my slice only): `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.gitignore`, `.env.example`, `next-env.d.ts`, `vercel.json`, `Dockerfile`, `.dockerignore`, `.nvmrc`, `.node-version`, `.github/workflows/ci.yml`. Did NOT touch any `src/**`.
  - **Versions installed (EXACT-pinned, no carets — lockfile authoritative).** Toolchain deliberately held at the majors Next 15.5 supports even though newer majors have shipped (registry offers next 16.2.11, mongoose 9.8, typescript 7.0.2, eslint 10.7, @types/node 26 — NOT used; they would break the mongoose-8 models / Next-15 plugin and were never part of the team's locked decisions).
    - deps: `next 15.5.21`, `react 19.2.8`, `react-dom 19.2.8`, `mongoose 8.24.1`, `jose 6.2.4`, `bcryptjs 3.0.3`, `zod 4.4.3`, `react-markdown 10.1.0`, `remark-gfm 4.0.1`, `rehype-sanitize 6.0.0`, `rehype-slug 6.0.0`, `rehype-highlight 7.0.2`.
    - devDeps: `typescript 5.9.3`, `@types/node 24.13.3`, `@types/react 19.2.17`, `@types/react-dom 19.2.3`, `@types/bcryptjs 3.0.0`, `eslint 9.39.5`, `eslint-config-next 15.5.21`, `@eslint/eslintrc 3.3.6`, `tailwindcss 4.3.3`, `@tailwindcss/postcss 4.3.3`, `postcss 8.5.23`, `vitest 4.1.10`, `@vitejs/plugin-react 6.0.4`, `jsdom 26.1.0`, `@testing-library/react 16.3.2`, `@testing-library/jest-dom 7.0.0`, `@playwright/test 1.61.1`, `tsx 4.23.1`.
  - **Auth approach (for backend-dev):** `jose` signs/verifies a JWT stored in an httpOnly session cookie; cookie name from env `AUTH_COOKIE_NAME` (default `az_session`), signing key from env `AUTH_SECRET`. `bcryptjs` hashes/verifies passwords (User.passwordHash). NO next-auth. Note `@types/bcryptjs` is installed but now deprecated (bcryptjs 3.x self-types) — harmless, safe to drop later.
  - **Markdown render stack (for frontend + backend):** render Post.body / Project.longDescription with `react-markdown` + `remark-gfm`, sanitize server-side with `rehype-sanitize`, plus `rehype-slug` (heading anchors) + `rehype-highlight` (code highlighting). rehype-highlight needs a highlight.js CSS theme imported in `globals.css` (frontend owns that file). All pure runtime — `next.config.ts` needs no extra wiring.
  - **Scripts:** `dev`=next dev, `build`=next build, `start`=next start, `lint`=`eslint .`, `typecheck`=`tsc --noEmit`, `test`=`vitest run`, `test:watch`=vitest, `test:e2e`=`playwright test`, `seed`=`tsx src/server/seed/index.ts`. `packageManager: pnpm@9.15.9`, `engines.node >=24`.
  - **Config facts:** tsconfig strict + `moduleResolution: bundler` + path alias `@/*`→`src/*` + Next plugin + `jsx: preserve`. Tailwind v4 wired CSS-first via `@tailwindcss/postcss` (NO tailwind.config.js — the `@theme`/`@import "tailwindcss"` lives in frontend's `globals.css`). `next.config.ts` sets `output: 'standalone'` (for the optional Dockerfile; Vercel ignores it). `.env` + `.env*.local` gitignored, only `.env.example` committed (ACCEPTANCE #7 verified via `git check-ignore`).
  - **Verified:** `pnpm install` clean (2m11s) + `pnpm install --frozen-lockfile` reproducible (lockfile authoritative). `pnpm exec tsc --noEmit` → exit 0 on existing `src/server/**` (no model file edited). `pnpm lint` → exit 0. `pnpm build` correctly fails ONLY with "Couldn't find any `pages` or `app` directory" — expected until frontend lands, not a config error.
  - **CI gate (`.github/workflows/ci.yml`):** on push(main/master)+PR → pnpm install `--frozen-lockfile`, typecheck, lint are HARD gates (no continue-on-error). `pnpm build` runs as a hard gate too but is conditionally skipped until `src/app/layout.tsx` exists (auto-activates when frontend lands — never a masked pass).
  - **TODO / ownership for other builders — READ THIS:**
    - **frontend-dev (public) owns `src/app/layout.tsx` + `src/app/globals.css`** (both do NOT exist yet — I intentionally did not create them). `globals.css` must `@import "tailwindcss"`, carry the `@theme` token layer from `docs/design/01-tokens.md`, and import a highlight.js theme for `rehype-highlight`. **Fonts:** use `next/font/google` in `layout.tsx` for Space Grotesk + Inter + JetBrains Mono (build-time self-host, no runtime CDN) — no package needed; decision is next/font/google (not next/font/local). A full `pnpm build` stays red until this lands — expected.
    - **backend-dev owns `src/middleware.ts`** (auth guard for `/admin/*` + mutating `/api/*`; ACCEPTANCE #4). It lives at `src/middleware.ts` (Next reads it there because `src/` is the app root). It does NOT exist yet — devops did not create it. Backend also owns `src/server/seed/index.ts` (the `seed` script points at it) — hash passwords with bcryptjs, never commit plaintext.
    - **qa-engineer:** vitest + @vitejs/plugin-react + jsdom + @testing-library/* + @playwright/test are installed; write configs/tests in your `tests/**` + `e2e/**` slice (no test config committed by devops — it's your slice).

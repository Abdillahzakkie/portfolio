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
# ✅ FINAL STATE — build complete & verified (2026-07-25)

**Status: all 8 acceptance criteria MET.** 18 atomic commits on `master`, clean working
tree. `pnpm build` ✓ (BUILD_ID present, 17 routes, real prod artifact — no dev artifact) ·
`tsc --noEmit` 0 · `eslint` 0 · `pnpm audit --prod` clean · **vitest 26/26** · **Playwright
e2e 20/20**. The detailed per-agent audit trail is in the Status log below; this section is
the consolidated summary.

## What was built
A Next.js 15 (App Router) + TypeScript single app: a "Constellation of Work" domain-graph
portfolio home + integrated blog with a full authenticated CMS. MongoDB via Mongoose
(dev: shared Docker `localhost:27018` db `portfolio`; prod: Atlas). Tailwind v4 +
CSS-variable token layer, self-hosted fonts (`next/font`). Deploy target: Vercel.

- **Data/models** (`src/server/models`, `src/server/db`) — Project/Post/User, Markdown body, indexes.
- **Backend** (`src/server/services`, `src/server/auth`, `src/app/api`, `src/middleware.ts`) —
  Model→Service→Route triad, access/refresh auth, published-only sitemap/robots/RSS, seed.
- **Public site** (`src/app/(public)`, `src/components/public`, `src/lib`, `src/app/layout.tsx`,
  `globals.css`) — SVG constellation + SSR `<nav>` fallback, case studies, blog index/post.
- **Admin CMS** (`src/app/admin`, `src/components/admin`) — login, dashboard, draft→publish editor.
- **Content** (`content/`) — 18 projects + 18 posts (11 published / 7 draft), grounded in real repos.
- **Tests** (`tests/`, `e2e/`) — vitest unit/integration + Playwright e2e.
- **Config** — `package.json`, `tsconfig`, `next.config.ts`, `.env.example`, CI, `vercel.json`.

## Acceptance criteria — all MET (evidence)
1. **Builds clean** — `pnpm build` ✓, `tsc` 0, `eslint` 0.
2. **Projects reachable** — e2e: 18 SVG nodes + 18 SSR links → `/projects/[slug]`, pointer+keyboard.
3. **Post per project + sitemap + draft 404** — backlink renders; sitemap/RSS published-only; draft → real HTTP **404** (curl + e2e).
4. **CMS end-to-end + auth** — e2e drives create→draft(private)→publish(public); unauth `/admin`→redirect, mutating `/api`→401.
5. **Responsive** — 0 horizontal overflow @375 & @1440 (home/project/post).
6. **Quality gates** — Lighthouse **SEO 100 / A11y 100**; axe **0 color-contrast** across 6 routes × light+dark.
7. **No leakage** — blue-hat: `.env` gitignored, placeholders only, admin pw hashed from env, no secrets in build/content.
8. **Graph home** — 18 clustered nodes, roving-tabindex + arrows + live-region, every node → real page; **respaced so labels don't overlap**.

## Key decisions finalized (superseding earlier notes)
- **Auth = access + refresh tokens** (owner-directed, replaces the original single 7-day session):
  `az_session` access **1h** + `az_refresh` **6h absolute**, HS256, `typ`-discriminated, httpOnly.
  Middleware silently mints a fresh access token from a valid refresh (forwarded same-request);
  `POST /api/auth/refresh` for client retry; logout clears both; `AUTH_SECRET` ≥32-char floor;
  role claim rejected if missing/invalid (least-privilege). Stateless (no revocation store).
- **Styling** = Tailwind v4 + CSS-variable tokens (designer's call).
- **Graph geometry** = viewBox **1280×860**, corner anchors, phyllotaxis **k=62**, frozen
  `NODE_POSITIONS` relaxed against label boxes (0 overlaps). `next.config` `output:'standalone'`
  removed (Windows build-trace bug; Vercel doesn't need it). Security headers added.
- **Dependencies** patched via pnpm `overrides` (sharp ≥0.35, postcss ≥8.5.18) → audit clean.

## Bugs found by verifiers & FIXED (all re-verified)
- Admin API `{post}` envelope mis-unwrap → duplicate creates / publish-404 (`components/admin/api.ts`).
- Editor `domain:""` → 400 on Save (client strips it + server coerces `''`→null).
- `notFound()` soft-404 (HTTP 200) → real 404 by removing streaming `loading.tsx` boundaries.
- WCAG-AA contrast (both themes): `--text-faint` darkened/lightened; new `--text-on-accent` token
  replaces white-on-light-accent (was 1.99:1) in public + admin Button, ProjectBacklink, about CTA.
- Inverted prev/next post-nav labels; dep CVEs; missing security headers; AUTH_SECRET floor; role fail-open.

## ⏳ What's LEFT (non-blocking — owner decisions / deploy prep)
1. **Prod env vars (required before deploy):** set on Vercel — `AUTH_SECRET` (real ≥32-char,
   `openssl rand -base64 48`), `MONGODB_URI` (Atlas SRV), `MONGODB_DB=portfolio`,
   `NEXT_PUBLIC_SITE_URL` (real domain), `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (for seeding),
   `AUTH_COOKIE_NAME`/`AUTH_REFRESH_COOKIE_NAME` (optional, have defaults). `.env` stays gitignored.
2. **Project links (content):** all 18 projects have empty `links` (external repo/live URLs were
   NOT invented, per the content-authenticity guard). Owner adds real repo/live URLs via the CMS
   (or in `content/projects.ts`). #2 is met via name+stack+write-up link; external links are additive.
3. **Publish gated write-ups:** 7 client/security posts are `draft` by policy (decision #2) — owner
   publishes manually when ready.
4. **Compliance decision (compliance-privacy):** the Sentova / Sentova-MTD **project case-study
   pages** are public and disclose detection internals (within the letter of the policy, but their
   *posts* are draft-gated). Decide whether those two project pages should also be gated.
5. **Auth hardening (optional, for higher assurance):** stateless refresh has no revocation (a leaked
   refresh is valid ≤6h) — add `jti` + a denylist (Vercel KV / Upstash Redis) if wanted. Login
   rate-limit is in-memory/per-instance on Vercel — back with a shared store for durable protection.
6. **SEO/social:** add a 1200×630 `og:image` asset + wire it (canonical + og:url already done).
7. **Media uploads:** editor Cover is a URL field — add `POST /api/media` for a real uploader (optional).
8. **A11y polish (optional):** some inline nav/footer links are <44px tall (pre-existing design
   pattern; not an axe WCAG-AA failure) — give them ≥44px min-height if desired.

## Run/deploy quick reference
```bash
docker ps | grep 27018                                   # shared Mongo up
pnpm install
SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… pnpm seed       # 18 projects + 18 posts + admin
pnpm build && pnpm start                                 # or: pnpm dev
pnpm test            # vitest 26/26
pnpm test:e2e        # Playwright 20/20 (needs a prior pnpm build)
# Deploy: push to GitHub → Vercel (set the env vars in #1 above); DB = Atlas.
```

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
- (frontend-dev · ADMIN) Authenticated admin UI landed (ACCEPTANCE #4, UI side). Slice only: `src/app/admin/**` + `src/components/admin/**`. Did NOT touch public/root/globals/api/server/middleware/content/config.
- (frontend-dev · PUBLIC) Public site landed — carries ACCEPTANCE #2/#3(render)/#5/#6/#8. Slice only: root `src/app/layout.tsx`, `src/app/globals.css`, `src/app/not-found.tsx`, `src/app/(public)/**`, `src/components/public/**`, `src/lib/**`. Did NOT touch admin/api/server(except type imports)/content/config/sitemap/robots/rss.
  - **Files created.** Routes: `(public)/{layout,page,error}.tsx`, `(public)/projects/[slug]/{page,loading}.tsx`, `(public)/blog/{page,loading}.tsx`, `(public)/blog/[slug]/{page,loading}.tsx`, `(public)/about/page.tsx`, root `layout.tsx`+`globals.css`+`not-found.tsx`. Lib: `lib/{graph,types,domain,format,services}.ts`. Components `components/public/**`: Button, ThemeToggle, TagBadge, StatusPill, Feedback(Skeleton/EmptyState/ErrorState), Header, Footer, BackLink, ProjectCard, PostCard, ProjectBacklink, CaseStudyHeader, AtAGlance, Markdown, PostBody, BlogIndexClient, and `graph/`{Constellation, DomainCluster, ProjectNode, NodePopover, ClusterCardList, ZoomControls, ConstellationHome}.
  - **Token layer.** `globals.css` = `@import "tailwindcss"` + `@custom-variant dark` (class-based) + full primitive/semantic token vars in `:root`/`.dark` EXACTLY per `01-tokens.md` (colors, type scale, spacing, radii, elevation, motion) + `@theme` mapping semantic tokens to utilities (`bg-surface`, `text-muted`, `border-default`, `ring-focus`, `text-web3`…) + `.prose` typographic scale + a **self-contained highlight.js `.hljs` theme** built from the design tokens (no CDN/vendor CSS — `highlight.js` is only in the pnpm store, not hoisted, so I themed the lowlight token classes myself). Fonts via `next/font/google` (Space Grotesk/Inter/JetBrains Mono → `--font-display/body/mono`, build-time self-host). Inline pre-hydration theme script + `<meta theme-color>` swap in root `layout.tsx` (no FOUC).
  - **Frozen NODE_POSITIONS + edges (mine, static — `lib/graph.ts`).** Computed once via phyllotaxis (angle=i·137.5°, r=44·√i around the 4 quadrant anchors) then relaxed so no two node circles (r by prominence 26/19/13) overlap (min gap = r_a+r_b+14), rounded to 0.1, and FROZEN into a `Object.freeze`d map — deterministic for Playwright. Zero residual overlaps; all coords inside viewBox `0 0 1000 700`. `GRAPH_EDGES` = the exact 10 edges (8 kinship + 2 bridge) from `00-concept.md §4`. Node radius by prominence + 22px-min hit radius for the 44px touch target.
  - **Label-overlap fix (approved) applied.** Non-overlapping frozen coords + prominence-1 node labels render ONLY on hover/focus (`showLabel = prominence!==1 || active`); the name is ALWAYS in `aria-label`, so AT never loses it. Popover is offset ±20px from the node centre so it never covers the focused star.
  - **Progressive-enhancement ladder.** SSR/no-JS/<768px/coarse-pointer → `ClusterCardList` = a real `<nav aria-label> ` of 4 `<section>`s each a `<ul><li><a href="/projects/[slug]">` (satisfies #2/#8 links with zero JS). ≥768px+fine-pointer after mount → SVG `Constellation` mounts over it, the card list stays in the a11y tree (`sr-only`) as the semantic backbone, and a persistent "View as list" toggle switches back. Roving-tabindex keyboard model (one tab stop; ←/→ within cluster, ↑/↓ across clusters, Home/End, PageUp/Down flagship jump, Enter/Space navigate, Esc closes popover/exits), pan/zoom on a single viewport `<g>` transform with real `+`/`−`/`Fit` buttons, polite `aria-live` cluster announcements, `role="application"`+`aria-roledescription`, static mount (no entrance anim → reduced-motion honoured + CLS≈0). React error boundary swaps the SVG for the card list on failure.
  - **data-testids exposed for QA:** `constellation` (the SVG host), `project-list` (the nav/fallback, present in BOTH graph and list modes), `node-[slug]` per star (with `data-href="/projects/[slug]"`), and `post-project-backlink` (banner + footer on every post, → `/projects/[projectSlug]`).
  - **Backend integration — CLEAN, no drift.** `lib/types.ts` re-exports the real view types from `@/server/services/contracts` (type-only, no mongoose in client bundles); pages call the 4 server fns via the single seam `lib/services.ts`. Verified `getConstellation/getProjectView/listPublishedPosts/getPublishedPost` signatures match. Handled contract nullability: `PostListItem.domain` and `publishedAt` are nullable (standalone essays) → PostCard falls back to a neutral `--info` accent + omits the domain eyebrow.
  - **Assumption / small gap flagged to backend:** `getPublishedPost` returns `project:{slug,name,tagline}` with **no domain**, and `IPost` has no domain column, so the single blog-post view can't tint to its project's domain — it currently falls back to the neutral `--info` accent (glyph ◆, no domain eyebrow). If you want post pages tinted to their project's cluster color, add `domain` (the project's) to the `getPublishedPost` return (or to the returned `project`). Blog **index** is unaffected (PostListItem already carries derived `domain`). Non-blocking — flagged.
  - **Verified (evidence).** `pnpm exec tsc --noEmit` → **0 errors repo-wide** (my slice included; integrates with the landed services). `pnpm exec eslint` my slice → clean. `pnpm build` → **"Compiled successfully" + type/lint pass + "Generating static pages (17/17)"**, then FAILS only at "Collecting build traces" with `ENOENT … _not-found/page.js.nft.json` — a known **Next 15 + Windows + `output:'standalone'`** file-tracing bug (does not occur on the Linux/Vercel deploy target). → **DEVOPS action:** this is `next.config.ts` (`output:'standalone'`) config, not app code; either drop standalone for Vercel or build on Linux/CI. It blocks a local `next start`, so I verified against `next dev` instead. Playwright (chromium, real browser) at **375px AND 1280px**: 27/28 checks PASS — constellation mounts @1280 with ≥9 `role=link` nodes + SSR list ≥9 links; **zero console errors** on home & project; pointer click node → `/projects/settleo`; keyboard focus→ArrowRight→Enter → a project page; project H1+stack(Solidity)+repo link render; blog index shows published & **hides the draft**; post backlink → `/projects/settleo`; **no horizontal overflow (scrollWidth−innerWidth = 0)** on home/project/post at both widths; @375 the card fallback is the visible layer (no SVG). The 1 non-pass: a **draft** and a random bad slug both render the "Nothing here" not-found UI (draft title/body NEVER served — confirmed) but return HTTP **200 in `next dev`** — the documented Next App-Router dev streaming behaviour; `notFound()` emits a real **404 in production**. Draft *visibility* (the security-critical half of #3) is met; the literal 404 status needs the production build (blocked locally only by the devops standalone-trace bug above). Verification data was inserted into and then fully removed from the dev `portfolio` DB (left empty as found); dev server stopped.
  - **For qa-engineer:** stable hooks are `[data-testid=constellation|project-list|node-<slug>|post-project-backlink]`. When asserting the draft-404 status, run against a **production build** (`next build && next start` on Linux/CI) — dev returns 200 for `notFound()`. #6 (Lighthouse a11y/SEO ≥90) needs the running app + seeded data; the SSR `<nav>` backbone, single-H1 per page, focus rings, labelled controls, and reduced-motion handling are all in place.
  - **Files created — pages** (`src/app/admin/`): `layout.tsx` (noindex admin frame, opts out of public Header), `login/page.tsx` (server; `getSession()`→redirect if already authed; `?next=` sanitized against open-redirect), `page.tsx` (dashboard; `listPostsForAdmin('all')` SSR → `PostTable`), `posts/new/page.tsx` (`listProjectOptions()` → `PostEditor`), `posts/[id]/page.tsx` (`getPostForEditor(id)`→`notFound()` if null → `PostEditor` with initial), `error.tsx` (role=alert + retry), `not-found.tsx`, `posts/[id]/loading.tsx` (editor skeleton).
  - **Files created — components** (`src/components/admin/`): `AdminShell.tsx` (sidebar + sticky topbar + drawer <lg), `AdminSidebar.tsx`, `UserMenu.tsx` (Sign out → `POST /api/auth/logout`), `LoginForm.tsx`, `PostTable.tsx` (filter tabs, table+mobile cards, optimistic publish/unpublish w/ rollback, delete-confirm, empty/filter-empty states), `RowMenu.tsx`, `PostEditor.tsx` (two-pane, toolbar, live preview, validation, autosave, slug-check, submittedRef guard), `RichTextToolbar.tsx`, `MarkdownPreview.tsx`, `ConfirmDialog.tsx` (focus-trapped), `Toast.tsx`, `Button.tsx`, `StatusPill.tsx` (dot+text, never color-only), `icons.tsx`, `types.ts`, `api.ts` (client fetch wrappers for the mutation routes).
  - **data-testids exposed** (for qa): `admin-login-form`, `post-table`, `new-post`, `editor-title`, `editor-body`, `editor-project`, `editor-save`, `editor-publish`.
  - **Mutations → API routes:** all writes go through the client `api.ts` (same-origin fetch, httpOnly cookie rides along): login/logout, `POST /api/posts`, `PATCH|DELETE /api/posts/[id]`, `POST /api/posts/[id]/publish|unpublish`, `GET /api/posts/slug-check?slug=&exceptId=`. Server pages call services directly for initial reads only. `router.refresh()` after each mutation reconciles SSR.
  - **submittedRef guard:** `submittedRef` set `true` immediately BEFORE any intentional save/publish/unpublish/nav so `beforeunload` (and the crumb route-guard) never false-fires right after a successful async save; reset to `false` in the catch so the guard re-arms and edits are kept. Dirty is derived from a serialized snapshot updated on each successful persist. Autosave = 20s interval + on blur (only when dirty & titled).
  - **Consumed contracts as-shipped:** `getSession` (`@/server/auth`), `listPostsForAdmin('all')`, `getPostForEditor`, `listProjectOptions`, and public `Markdown` (children:string) — all present; `tsc --noEmit` = exit 0 across the project, admin webpack + RSC boundaries compiled clean. `listProjectOptions()` returns `{slug,name}[]` with NO `domain` — so the editor's Domain select defaults to "Auto from project" unless the loaded post already carries a derived domain (it does, from `getPostForEditor`). If you want project-select to auto-fill Domain on change, add `domain` to the `listProjectOptions` projection (optional; backend ignores post.domain on write anyway).
  - **Styling:** admin styles reference the CSS-variable tokens directly (`var(--surface)`, `var(--info)`, status tokens for domain accents per tokens §2.4) rather than `@theme` utility names, so admin is robust to however frontend-public names its Tailwind utilities. Mobile-first; sidebar → drawer, table → cards, editor two-pane → stacked.
  - **Assumptions / needs (not my slice):** (1) root `src/app/layout.tsx` (frontend-public) must NOT render the public Header — admin relies on the Header living in the `(public)` route-group layout; confirm. (2) **Cover image upload** has no backend media endpoint in the contract, so the editor ships a Cover image URL field (no client-side upload hack) — backend-dev: a `POST /api/media` upload endpoint would let this become a real uploader. (3) devops/backend: `src/server/seed/index.ts` imports `@/content` (= `src/content`) which does not resolve — `pnpm build` type-check fails ONLY there (tech-writer's `content/**` is at repo root, not `src/content`); my admin code compiled clean. Fix the seed import path or content location.
  - **Verified:** `pnpm exec tsc --noEmit` exit 0; `eslint src/components/admin src/app/admin` exit 0; `next build` "Compiled successfully" (fails only in backend's seed `@/content` import, above). Live dev-server + Playwright drive: `/admin/login` (no session) and — with a forged same-secret session cookie against the shared Docker Mongo (27018) — `/admin`, `/admin/posts/new`, `/admin/posts/[id]` all render at **375px and 1280px**: HTTP 200, not redirected to login (middleware admitted the session), every data-testid present, **zero horizontal overflow**, **zero console errors**, ≥44px tap targets; screenshots matched the approved mockups (dashboard table w/ dot+text StatusPills, editor two-pane w/ loaded draft + derived Domain=Web3). Throwaway `admin_verify-*` seed docs purged from Mongo afterward (all-DB scan clean); dev server stopped; no temp files left in the repo.
- (tech-writer) Content slice landed (`content/**` only): `content/projects.ts` (18 projects — all registry nodes, exact slugs/domains/prominence→graph.weight), `content/posts.ts` (18 companion posts, one per project), `content/index.ts` (barrel the seed imports as `@/content`). All copy grounded in `docs/PROJECT-INVENTORY.md` + each repo's real docs (nftmixer-go rewrite spec, settleo THREAT_MODEL/ledger, sentova PLATFORM-TRACKER, sentova-mtd data-model) — no invented benchmarks/dates/metrics.
  - **Post status split (HANDOFF decision #2):** 11 `published` (neutral engineering: nftmixer-go, nftmixer-net, managerenta, chekka, golden-bite, prechop, adverta, mogadget, aisolver, fivestick, labs) + 7 `draft` (client/security-internals: settleo, settleo-escrow, gkoi-platform, gkoi-contracts, gkoi-apps, sentova, sentova-mtd). Every post's `projectSlug` equals a registry project slug (ACCEPTANCE #3); each project's `relatedPostSlugs` points back at its companion post.
  - **Decision — `links` omitted on all 18 projects.** The inventory lists local repo folders (e.g. `exedos_corp/nftmixer-go`), not verified public GitHub/live URLs. Per the authoring rule (omit rather than invent), I left `links` unset. `backend-dev`/owner can populate `ProjectLinks` in the admin once canonical URLs exist. `links` is optional in `ProjectSeedInput`, so this type-checks.
  - **VERIFICATION GAP — `pnpm exec tsc --noEmit` NOT executed by me.** My environment exposes only file tools (Read/Grep/Glob/Write/Edit), no shell/Bash, so I could not run the type-check. I manually verified both files against `ProjectSeedInput`/`PostSeedInput` in `src/server/models/types.ts`: only contract keys used, `domain` uses exact enum literals, `status` uses `draft|published`, all 18+18 template literals balanced with every inline/fenced backtick escaped and no `${}` interpolation. **ACTION for orchestrator/qa/backend (anyone with a shell): run `pnpm exec tsc --noEmit` to confirm before wiring the seed.**
- (backend-dev) API + auth + services + SEO + seed landed (my slice only). `pnpm exec tsc --noEmit` → 0 errors; `pnpm exec eslint <slice>` → 0 problems. Also ran a 34-assertion service/auth smoke test AND the real seed twice, both against a throwaway `portfolio_test_<pid>` db (dropped after) — evidence in my delivery report. Verified tech-writer's content seeds cleanly: 18 projects / 18 posts (11 published, 7 draft) / 1 admin; idempotent re-run; relatedPostSlugs rebuilt.
  - **Files created (all inside slice):** `src/server/services/{errors,contracts,projects,posts,seo,index}.ts`; `src/server/auth/{jwt,session,password,index}.ts`; `src/middleware.ts`; `src/app/api/_lib/{responses,guard,validation,rate-limit}.ts`; `src/app/api/auth/{login,logout}/route.ts`; `src/app/api/posts/route.ts` + `posts/[id]/route.ts` + `posts/[id]/{publish,unpublish}/route.ts` + `posts/slug-check/route.ts`; `src/app/api/projects/route.ts`; `src/app/{sitemap.ts,robots.ts}`; `src/app/rss.xml/route.ts`; `src/server/seed/index.ts`.
  - **Service surface (frontend + qa build against these — import from `@/server/services`, types via `import type`):** contract types `ProjectNodeData, PostListItem, PostRow, PostDraft, ProjectView, RssItem, SitemapData` (in `contracts.ts`). NOTE: **a Post has no `domain` column** — `domain` is DERIVED from the linked project and is ignored on write. Functions: `getConstellation()`, `getProjectView(slug)`, `listPublishedPosts({domain?})`, `getPublishedPost(slug)`→`{post,project,prevSlug,nextSlug}` (null for drafts→404), `listProjectOptions()`, `listPostsForAdmin('all'|'published'|'drafts')`, `getPostForEditor(id)`, `createPost(draft)` (always creates a DRAFT — publishing is separate), `updatePost(id,draft)` (content only; does NOT change status), `publishPost(id)`, `unpublishPost(id)` (retains publishedAt), `deletePost(id)`, `isSlugAvailable(slug,exceptId?)`, `getSitemapData()`, `getRssItems()`. Errors thrown as `ValidationError|NotFoundError|ConflictError|UnauthorizedError` (mapped to 400/404/409/401 by the routes).
  - **API routes** are thin (zod-validated, delegate to services, never emit passwordHash). Admin GET routes (`GET /api/posts`, `/api/posts/[id]`, `/api/posts/slug-check`, `/api/projects`) **self-guard** via `getSession()` since the middleware only gates *mutating* methods. RSS is served at **`/rss.xml`** (per my slice path) — **frontend Footer should link `/rss.xml`**, not `/blog/rss.xml`.
  - **Auth:** `jose` HS256 JWT in an httpOnly+sameSite=lax cookie (secure in prod), 7-day TTL; `bcryptjs` (cost 12) only in the login route (node runtime). Edge-safe primitives are isolated in `src/server/auth/jwt.ts` — **middleware imports `@/server/auth/jwt` ONLY** (never the `@/server/auth` barrel, which pulls bcrypt/next-headers into the edge bundle). Login is generic ("Invalid email or password") + a constant-time dummy-hash compare + a best-effort in-memory login rate-limit (per-instance only — noted as non-durable; back with Redis/KV for prod).
  - **⛔ BLOCKER for `pnpm seed` — belongs to database-engineer (model files), NOT me.** `pnpm seed` runs via bare `tsx`, and with `package.json "type":"module"` Node's native ESM loader **cannot resolve `import { models } from 'mongoose'`** (mongoose exports `Schema`/`model` as ESM named exports but NOT `models`). All three models (`Project.ts`, `Post.ts`, `User.ts`) use that import → seed dies at module link with `SyntaxError: ... does not provide an export named 'models'`. This does NOT affect the API routes (Next's bundler handles the interop) — only bare-tsx execution. **FIX (verified working under tsx):** change each model's mongoose import to `import mongoose, { Schema, model, type Model, type HydratedDocument, type InferSchemaType } from 'mongoose';` then `const { models } = mongoose;` (same default-import pattern `connect.ts` already uses). I proved the seed LOGIC is correct by bundling it with esbuild (bundler interop) and running it twice against a throwaway db; it will run under `pnpm seed` as-is the moment the model import is fixed. **Requesting database-engineer apply the 1-line-per-file change.**
  - **`@/content` alias does NOT resolve** (`@/*`→`src/*`, but content lives at repo-root `content/`). My seed imports it relatively (`../../../content`) so it type-checks + runs today without a cross-slice dependency. If the team wants the `@/content` alias, **devops** must add a tsconfig path `"@/content": ["./content"]`.
  - **ENV the seed needs (devops must add to `.env.example` — I did not edit it, not my slice):** `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. When unset the seed uses a clearly-marked DEV default (`admin@local.test` / `dev-admin-change-me`) and PRINTS it — never written to any committed file. Admin upsert uses `$setOnInsert`, so re-seeding never resets an existing admin's password (delete the user to force a reset). `AUTH_SECRET`, `AUTH_COOKIE_NAME`, `NEXT_PUBLIC_SITE_URL`, `MONGODB_URI`, `MONGODB_DB` already exist in `.env.example`. ✅
- (qa-engineer) Test suite landed in my slice only (`tests/**`, `e2e/**`, `vitest.config.ts`, `playwright.config.ts`). No app source touched. **VERDICT: fail** — 3 real bugs block ACCEPTANCE #4 (CMS via UI) + the status clause of #3; #2/#5/#8 met, #3 draft-invisibility met.
  - **Vitest (integration+unit): 26/26 pass** against a throwaway `portfolio_vitest_<pid>` db (asserts db name ≠ `portfolio` before writing; drops db + disconnects in afterAll). Proves: create→draft/invisible, publish stamps `publishedAt` once (not overwritten on re-publish), unpublish, slug-uniqueness→ConflictError, projectSlug referential-integrity→ValidationError, `listPublishedPosts`/sitemap/RSS exclude drafts, `getPublishedPost(draftSlug)`→null, `getConstellation` derives `hasPublishedPost`, `updatePost` preserves publish state, reading-time, session-JWT round-trip + tamper→null, `verifyLogin` never returns `passwordHash`. Verified failability (temporarily inverted an assertion → red for the right reason, reverted).
  - **Playwright (production build on :3200): 20/20 pass** (18 real + 2 documented `test.fail` known-bugs). Proves #8 (18 nodes + 18 SSR links, pointer click + keyboard ArrowRight/Enter navigate), #2 (project H1+stack, zero console errors), #3 (published post renders + backlink; sitemap includes published, excludes drafts; **draft content never served** — renders not-found UI), #5 (no h-overflow at 375/1440 on home/project/post), #4 auth (unauth `/admin`→login redirect, unauth `POST /api/posts`→401), and the create→draft(private)→publish(public) **lifecycle via the authenticated session API**.
  - **🐞 BUG 1 (blocks #4, HIGH) — admin editor cannot save a post in the default flow.** `emptyDraft().domain === ''` (`src/components/admin/types.ts:68`) and `listProjectOptions()` returns no `domain`, so picking a project never fills it → the editor POSTs `domain: ""`, which `postDraftSchema` (`src/app/api/_lib/validation.ts:62`, `z.enum(DOMAINS).nullable()`) rejects → **HTTP 400 on Save**. Fix: send `null` for the "Auto from project" option (map `'' → null` before POST) or widen the schema to accept `''`.
  - **🐞 BUG 2 (blocks #4, HIGH) — admin API client mis-unwraps the response.** Routes return `{ post: {...} }` (`src/app/api/posts/route.ts:40`, `.../[id]/publish/route.ts:21`, `.../[id]/route.ts:47`) but `src/components/admin/api.ts` (`createPost`/`updatePost`/`publishPost`/`unpublishPost`) types the body as `SavedPost` and reads `.id`/`.slug` directly → both `undefined`. Result: after Save the editor URL becomes `/admin/posts/undefined` and the in-UI **Publish** button calls `POST /api/posts/undefined/publish` → 404. Fix: unwrap `.post` in those wrappers (slug-check already returns `{available}` and is read correctly). Confirmed at runtime: create returns `{"post":{"id":"…"}}`; publish with the real id → 200 + public; with `undefined` → 404.
  - **🐞 BUG 3 (blocks #3 status clause + hurts #6 SEO, MEDIUM) — `notFound()` returns HTTP 200, not 404, in the prod build.** `/blog/<draft-or-missing-slug>` and `/projects/<missing-slug>` render the shared not-found UI (`NEXT_HTTP_ERROR_FALLBACK;404` in the RSC payload) but respond **200 OK**; an unrouted path (`/xyz`) correctly returns 404, so the not-found status path IS reachable. Soft-404 → search engines index dead post/project URLs. The security half of #3 IS met (draft title/body never served). Likely root cause: no `not-found.tsx` inside the `(public)` route group so `notFound()` bubbles oddly; add `src/app/(public)/not-found.tsx` (frontend-public slice) and re-verify status.
  - **⚠️ #2 links gap (LOW, content):** all 18 projects have empty `links` (`links.repo` absent on every project — tech-writer omitted URLs per the no-invent rule), so the case-study "repo/live" link region renders empty. ACCEPTANCE #2 says "repo/links render". Stack renders on every project. Populate `ProjectLinks` when canonical URLs exist.
  - **Isolation/teardown verified:** post-run scan shows **no leaked `portfolio_vitest_*`/`portfolio_test_*` dbs**, app `portfolio` db intact at 18/18/11/7, **no `qa-e2e-*`/`qa-probe-*` docs left**, and no servers listening on 3200/3207/3208. Scripts wired: `pnpm test` (vitest) + `pnpm test:e2e` (playwright, prod build via webServer on :3200). Playwright needs a prior `pnpm build`; login uses `admin@local.test` / env `SEED_ADMIN_PASSWORD` (default `LocalDev!2026`, confirmed working).
- (backend-dev · AUTH REWORK) Owner-directed access+refresh split landed + 4 verifier fixes. Slice only: `src/server/auth/**`, `src/middleware.ts`, `src/app/api/**`, `src/server/services/posts.ts`. Did NOT touch components/config/models/content. `pnpm exec tsc --noEmit` → 0 errors; `pnpm exec eslint src/server/auth src/middleware.ts src/app/api` → 0 problems.
  - **Auth model (REPLACES the single 7-day session).** Two HS256 cookies: **ACCESS** `az_session` (`AUTH_COOKIE_NAME`), 1h TTL, `typ:'access'`; **REFRESH** `az_refresh` (`AUTH_REFRESH_COOKIE_NAME`, env-overridable), 6h ABSOLUTE TTL, `typ:'refresh'`. Both carry the same identity (`sub/email/role/name`) so the edge can re-mint access with NO DB lookup. Both httpOnly, `secure` in prod, `sameSite=lax`, `path=/`; maxAge = respective TTL.
  - **`src/server/auth/jwt.ts` surface (edge-safe, jose only):** `signAccessToken`/`signRefreshToken`, `verifyAccessToken`/`verifyRefreshToken` (each REJECTS the other's `typ`; fail-closed→null on expired/tampered/wrong-secret), `refreshAccessToken(refreshToken)→{token,claims}|null` (middleware helper), `accessCookieOptions()`/`refreshCookieOptions()` (shared flags, DRY across node+edge). **Back-compat aliases preserved:** `signSession`=`signAccessToken`, `verifySession`=`verifyAccessToken`, `AUTH_COOKIE_NAME`, `SESSION_TTL_SECONDS`=3600 (=access TTL), plus new `AUTH_REFRESH_COOKIE_NAME`, `ACCESS_TTL_SECONDS`=3600, `REFRESH_TTL_SECONDS`=21600, `SessionClaims`. Barrel `index.ts` re-exports all. Existing `tests/unit/auth.jwt.test.ts` (imports `signSession`/`verifySession`/`SessionClaims`) stays valid.
  - **`session.ts`:** `createSession(user)` signs+sets BOTH cookies; `destroySession()` deletes BOTH (so `POST /api/auth/logout` clears both); `getSession()` reads+verifies the ACCESS cookie only (middleware refreshed it upstream).
  - **`src/middleware.ts` silent reauth:** verify access cookie; if missing/expired/invalid but refresh cookie verifies → mint fresh 1h access, `req.cookies.set(AUTH_COOKIE_NAME, minted)` then `NextResponse.next({ request: req })` (forwards the new cookie so THIS request's RSC/handlers see it) AND `res.cookies.set(...)` (browser stores it). If BOTH invalid → unchanged behavior (`/admin/*`→`/admin/login?next=…`, mutating `/api/*`→401). Redirects also carry the minted cookie. `/api/auth/login` + `/api/auth/refresh` are the ungated bootstrap routes. Still jose-only (no mongoose/bcrypt in the edge bundle).
  - **New `POST /api/auth/refresh`** (`src/app/api/auth/refresh/route.ts`, node): reads refresh cookie → if valid sets a fresh access cookie + returns 200 `{ok:true}`, else 401. For client retry-on-401.
  - **BLUE-HAT floor:** `getSecretKey()` now throws if `AUTH_SECRET` < 32 chars (still throws when unset). Both test secrets (vitest/playwright configs) are already ≥32 — unaffected. **NOTE for devops/owner:** `.env.example` placeholder `AUTH_SECRET=change-me-in-prod` (17 chars) will now (correctly) fail closed — set a real ≥32-char secret in `.env.local` (`openssl rand -base64 48`).
  - **qa BUG-B (server half) FIXED — `src/app/api/_lib/validation.ts`:** `postDraftSchema.domain` now `z.preprocess('' | undefined → null, z.enum(DOMAINS).nullable())`, so an empty editor selection is accepted as "no domain" (400→200); a bad enum still rejects. (Frontend BUG 1/2 in components/api.ts are NOT my slice — still open for frontend-dev.)
  - **Revalidate on publish/unpublish (`src/app/api/_lib/revalidate.ts` helper):** both routes call `revalidatePublicPost(slug, projectSlug)` after a successful transition → `revalidatePath` for `/`, `/blog`, `/sitemap.xml`, `/rss.xml`, `/blog/<slug>`, and (if linked) `/projects/<projectSlug>`. Statically-prerendered public surfaces now reflect CMS publishes without a rebuild.
  - **prev/next note (`posts.ts`, comment only, no behavior change):** list is `publishedAt:-1` (newest→oldest), so `prevSlug`=the NEWER neighbour, `nextSlug`=the OLDER neighbour — documented for the frontend to label; labels unchanged (frontend-owned).
  - **Evidence:** 18/18 token smoke checks pass (TTLs 3600/21600; both cookie flag sets; access↔refresh cross-use both rejected; `refreshAccessToken` mints valid access from refresh & rejects an access token; expired access + valid refresh → new access; wrong-secret→null; `signSession`/`verifySession` aliases behave as access; `<32`-char and unset secret both throw). 5/5 domain-coercion checks (`''`/null/undefined→null 200; `web3`→ok; bad→reject). Throwaway-script only (no repo files left, no Mongo writes — token logic needs no DB). Full HTTP login/refresh round-trip not booted (Next server); verified via direct token simulation per the task's sanctioned path.
- (frontend-dev · SOFT-404 + PREV/NEXT FIX) Fixed qa BUG 3 (soft-404) and the inverted prev/next labels. Slice only: `src/app/(public)/**`. Did NOT touch admin/api/server/config/content. `pnpm exec tsc --noEmit` → 0 errors; `pnpm exec eslint src/app/(public) src/components/public src/lib src/app/not-found.tsx` → 0 problems.
  - **FIX 1 — soft-404 root cause was STREAMING, not the not-found boundary.** In a prod build, `/blog/<draft|missing>` and `/projects/<missing>` returned **HTTP 200** with 404 content. Root cause proven empirically (prod `next start`, `curl -w %{http_code}`): a `loading.tsx` at the dynamic segment **or any ancestor segment** opens a Suspense/streaming boundary that flushes a `200` HTML shell BEFORE the async page resolves `notFound()` — so the status is already committed (response was `Transfer-Encoding: chunked`). Projects had only `projects/[slug]/loading.tsx`; blog *also* had a parent **`blog/loading.tsx`** (the index skeleton) that wrapped `blog/[slug]` too — which is why blog stayed 200 even after its own `[slug]/loading.tsx` was removed. Verified that adding a segment `not-found.tsx` and/or calling `notFound()` in `generateMetadata` did **NOT** change the status while any streaming boundary remained (metadata is itself streamed in Next 15).
  - **Fix mechanism:** removed the streaming boundary from the two dynamic detail routes so Next resolves the RSC tree (incl. `notFound()`) before committing the status → real 404. Deleted `blog/[slug]/loading.tsx` and `projects/[slug]/loading.tsx`. To keep the blog **index** skeleton (which is static and can't 404) without its boundary re-wrapping `[slug]`, moved the index into a route group: `blog/(index)/page.tsx` + `blog/(index)/loading.tsx` (deleted old `blog/page.tsx` + `blog/loading.tsx`). No `not-found.tsx` added — the existing root `app/not-found.tsx` already renders the correct 404 UI (full chrome) with the now-correct status. Detail pages carry a comment explaining why they must not have a `loading.tsx`. `/blog` stays `○ (Static)`; `/blog/[slug]` + `/projects/[slug]` stay `ƒ (Dynamic)`. **Trade-off:** the two detail routes lose their per-request loading skeleton (streaming ⟺ hard-404 are mutually exclusive for a route that calls `notFound()`); no blank screen results — SSR sends full HTML, and on client nav Next holds the prior page until ready.
  - **CURL STATUS EVIDENCE (prod `next start -p 3210`, 3× each, deterministic):** `/blog/adverta-monorepo-shared-api` **200**; `/blog/settleo-single-writer-ledger-tigerbeetle` (draft) **404**; `/blog/sentova-signed-directive-enforcement` (draft) **404**; `/blog/this-slug-does-not-exist-xyz` **404**; `/projects/adverta` **200**; `/projects/this-project-missing-xyz` **404**; `/blog` **200**; `/` **200**; `/xyz-unrouted` **404**. 404 body confirmed to render full chrome (skip-link, header, footer, "Nothing here", home + blog CTAs).
  - **FIX 2 — inverted prev/next labels (`blog/[slug]/page.tsx`).** Service returns `prevSlug`=NEWER neighbour / `nextSlug`=OLDER neighbour (from a `publishedAt:-1` list). Remapped in the page (service untouched) to the reverse-chronological convention: `olderSlug=nextSlug` → "← Previous post", `newerSlug=prevSlug` → "Next post →". `<nav aria-label="Post navigation">` unchanged. Verified on middle post `golden-bite-per-operation-iam`: "← Previous post" → `nftmixer-net-to-go-parity-rewrite` (older), "Next post →" → `chekka-spec-driven-build` (newer).
  - **Responsive (Playwright, prod):** blog index, blog post (nav I changed), project page, and 404 all render with **zero horizontal overflow at 375px AND 1280px**, correct status at both. (Pre-existing: the inline prev/next text links are ~20px tall — below the 44px touch guidance; that's the original design pattern, not introduced here — left for a future a11y pass.)
  - **Cleanup:** prod server stopped, port 3210 free (only OS `TIME_WAIT` sockets remain); no orphaned processes from this work; temp Playwright script removed from the repo; DB left as-seeded (18/18, 11 published / 7 draft).
- (frontend-dev · PUBLIC A11Y/SEO CONTRAST FIXES) Fixed the light-theme WCAG 1.4.3 AA contrast failures (FIX 1+2) plus SEO canonical (FIX 3) and the logo aria-label (FIX 4). Slice only: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/(public)/projects/[slug]/page.tsx`, `src/app/(public)/blog/[slug]/page.tsx`, `src/components/public/Header.tsx`. Did NOT touch admin/api/server/config/content. `pnpm exec tsc --noEmit` → 0 errors; `pnpm lint` (eslint .) → 0 problems. Final `pnpm build` OK, `.next/BUILD_ID` = `1w9yb1nPdXGzVz4UmcchG`.
  - **FIX 1 (SERIOUS, WCAG 1.4.3) — light `--text-faint` darkened `#7c7c86` → `#6a6a72`** (`globals.css:23`). Computed ratios (WCAG formula): old `#7c7c86` = **3.957:1 on #FBFAF7 / 4.130:1 on #FFFFFF** (real AA fail). New `#6a6a72` = **5.136:1 on #FBFAF7 / 5.361:1 on #FFFFFF / 4.704:1 on surface-2 #F2F0EA** — all ≥4.5. Dark-theme value untouched. Verified live from rendered DOM: post-date element resolves to `rgb(106,106,114)` on `#fff` → 5.361.
  - **FIX 2 (SERIOUS) — the failing "warning chip" is the public `StatusPill` "Draft" (and the tools-domain `TagBadge`), NOT `AtAGlance` as the brief stated.** `#F2E6DA` = `--warning`/`--cluster-tools-text` `#b45309` mixed 12% over `--bg` #FBFAF7 (StatusPill/TagBadge tint pattern); text `#b45309` on it = **4.091:1** (fail). Because `--warning` and `--cluster-tools-text` are the SAME hue and both feed 12%-tint chips, I darkened BOTH (light theme only) `#b45309` → `#9a4708` (`globals.css:34` + `:39`), preserving the documented "status hues reuse the 4 domain text hues" relationship. New ratios: text `#9a4708` on its 12% chip = **5.151:1 over #FBFAF7 / 5.354:1 over #FFFFFF / 4.738:1 over surface-2** — all ≥4.5. Dark-theme `--warning`/tools-text untouched.
  - **FIX 3 (SEO) — canonical + og:url.** Root `layout.tsx` already had `metadataBase` (from `NEXT_PUBLIC_SITE_URL`); added `alternates.canonical='/'` + `openGraph.url='/'`. `projects/[slug]` + `blog/[slug]` `generateMetadata` now emit `alternates.canonical` + `openGraph.url` = `/projects/<slug>` / `/blog/<slug>` (relative → resolved against metadataBase). **og:image intentionally SKIPPED** — needs a 1200×630 design asset (→ ui-ux-designer / owner).
  - **FIX 4 (a11y) — logo aria-label** now `"AZ — Abdullah Zakariyya, home"` (was `"Abdullah Zakariyya — home"`), so the accessible name contains the visible text "AZ" → clears axe `label-content-name-mismatch`.
  - **AXE EVIDENCE (`@axe-core/playwright`, tags wcag2a/2aa/21a/21aa, prod build `next start -p 3213`, 6 routes × 2 themes):** LIGHT theme = **0 color-contrast violations on ALL 6 routes** (`/`, `/blog`, `/projects/settleo`, `/blog/managerenta-reference-architecture`, `/about`, `/admin/login`) and 0 other serious/critical. The two fixed tokens' live-DOM ratios printed above. FIX 1+2 CONFIRMED resolved.
  - **⚠️ BLOCKER for the "zero contrast in BOTH themes" acceptance — the brief's premise "dark had 0 violations" is FALSE.** The same axe run found **36 PRE-EXISTING dark-theme `color-contrast` violations** (my edits changed light-theme values ONLY — none affect dark). Two buckets: **(A ~30 nodes) dark `--text-faint` `#6b7280`** measures **3.7 on #14171f (bg-elevated) / 4.02 on #0b0d12 (bg)** — fails on post dates, "min read", dt labels, kicker, About para, admin-login footer (`globals.css:97`). Fix = LIGHTEN dark `--text-faint` to ≥4.5 on the lightest surface it lands on (surface-2 #1e232e). **(B ~6 nodes) hardcoded white `#fff` on the LIGHT dark-mode accent `--info` #a5b4fc = 1.99** — `Button.tsx:45` primary variant (drives the `/admin/login` submit button + `/about` contact CTA) and `ProjectBacklink.tsx:111` "View project" pill. Fix needs a dark-mode "on-accent" text color (dark text on the light accent) — a design decision (→ ui-ux-designer) and it touches an admin-facing surface via the shared Button, so I did NOT unilaterally change it. I left dark as the brief instructed ("keep dark as-is") and am surfacing this for an orchestrator scope decision. **Recommend a follow-up frontend task** (globals.css dark `--text-faint` + an `--on-accent`/`--text-on-info` token consumed by `Button` primary/`ProjectBacklink` pill) to close dark-theme AA.
  - **Cleanup:** prod server on :3213 stopped, port freed; `.next` holds a REAL production build (final `pnpm build`, BUILD_ID `1w9yb1nPdXGzVz4UmcchG`); no `next dev` run; temp axe script kept out of the repo. DB left as-seeded.
- (frontend-dev · PUBLIC — CONSTELLATION SPACING + AXE VERIFY) Task 1 (space out nodes) done; Task 2 (contrast) verified. Slice only: `src/lib/graph.ts`, `src/components/public/graph/{DomainCluster,ZoomControls}.tsx`, `src/app/(public)/about/page.tsx`, and a factual coordinate sync of `docs/design/02-graph-home.md §1.1`. Did NOT touch admin/api/server/config/content. `pnpm exec tsc --noEmit` → 0 errors; `pnpm lint` (eslint .) → 0 problems. Final `pnpm build` OK, `.next/BUILD_ID` = `bjU9Jrn43aiH4jK0ogkVf`; no `next dev`.
  - **TASK 1 — geometry re-frozen for label legibility.** viewBox **1000×700 → 1280×860**; anchors pushed toward the corners: web3 (270,210)→**(330,250)**, security (730,210)→**(950,250)**, commerce (270,490)→**(330,610)**, tools (730,490)→**(950,610)** (≈620px apart horizontally, ≈360px vertically). Phyllotaxis **k 44 → 62**. NODE_POSITIONS **re-frozen** via a deterministic generator: phyllotaxis seed then AABB relaxation against each node's *label box* (name width + 22px label height below the circle, min gap 8), rounded to 0.1 — so neither circles NOR text labels collide at the default fit. All 18 nodes / 10 edges / halos / glow / roving-tabindex+keyboard model kept intact; `data-testid` hooks (`constellation`, `project-list`, `node-<slug>` w/ `data-href="/projects/<slug>"`) unchanged. Cluster halo r 132→165 (fits the wider spread); `CLUSTER_LABEL_POS` moved to the new corners. **ZoomControls moved bottom-right → top-right** so they no longer overlap the bottom-right "Tools / Labs" cluster label (they sit clear above the Security label). `docs/design/02 §1.1` coordinate numbers synced (factual).
  - **TASK 1 evidence (Playwright, chromium, prod `next start -p 3215`, matchMedia patched so `(pointer:fine)` matches in headless).** @1440×900 DARK: SVG mounts, **18** node `role=link`s, every `data-href` matches `/projects/[slug]` and **all 18 resolve HTTP 200**, **11 visible labels, ZERO label-bbox overlaps** (computed pairwise DOMRect intersections = none), **0 horizontal overflow**, 0 console errors, dark theme applied. @375 (coarse pointer): **no SVG** (card fallback owns <768px per docs/02 §7), **18** `/projects/` links in `project-list`, **0 overflow**. Screenshot of the spaced graph saved to `…/scratchpad/shots/graph-after.png`.
  - **TASK 2 — contrast verified + one in-slice fix.** Re-ran `@axe-core/playwright` (wcag2a/2aa/21a/21aa) on the 6 routes × BOTH themes. Confirmed the prior token edits hold: **LIGHT = 0 color-contrast on all 6 routes; DARK = 0 on `/`, `/blog`, `/projects/settleo`, `/blog/managerenta-reference-architecture`, `/about`, and (after my fix) `/about`.** Found + FIXED one in-slice miss the prior pass left: the About page "Email me" mailto pill hardcoded `color:#fff` on `var(--info)` (fails 1.99:1 in dark) → now `var(--text-on-accent)` (`src/app/(public)/about/page.tsx`).
  - **⚠️ ONE remaining dark contrast violation is OUTSIDE MY SLICE → HANDOFF for frontend-dev · ADMIN.** `/admin/login` (dark) still shows **1** color-contrast node: the submit button, from `src/components/admin/Button.tsx:21` `primary: 'bg-[var(--info)] text-white …'` — white on the light dark-mode `--info` #a5b4fc = **1.99:1**. Same class also on `danger: 'bg-[var(--danger)] text-white'` (dark `--danger` #fda4af is light too → likely also fails when a danger button renders in dark). **Fix (admin slice, one line each):** `text-white` → `text-[var(--text-on-accent)]` on the `primary` (and `danger`) variants — the `--text-on-accent` token already exists (#fff light / #0b0d12 dark) and Button-public/ProjectBacklink/About already consume it. I did NOT touch admin. So: **11/12 route-theme combos = 0 contrast; the 1 remaining is admin-owned.**
  - **Cleanup:** prod server on :3215 stopped, port freed; `.next` holds a REAL production build (BUILD_ID `bjU9Jrn43aiH4jK0ogkVf`); no `next dev`; all temp `__verify-*.mjs`/`__axe-detail.mjs` scripts removed from the repo (generator + screenshot live only in the scratchpad). DB left as-seeded (18/18).

---
# ✅ MILESTONE — Admin "Projects" + "Settings" sections (2026-07-27)

**Status: all 12 acceptance criteria MET.** Delivered via the `team` skill (intake → gate →
parallel builders → 7 read-only verifiers → fix routing → re-verify). `tsc --noEmit` 0 ·
`eslint .` 0 warnings · `pnpm build` ✓ · **vitest 77/77**. Committed as **7 atomic commits**
`cadd3d5..8d4713e` on `master` and pushed to `origin/master`; a `develop` branch was then
created from that HEAD. This turns the two previously-"Soon" admin sidebar items into real
sections. **Media was explicitly out of scope** (owner decision — deferred).

## What was built
- **Projects CRUD** — the `Project` model + read services already existed (graph home /
  case-study). Added the admin write surface, mirroring the Posts slice 1:1:
  - Service: `listProjectsForAdmin`, `getProjectForEditor`, `isProjectSlugAvailable`,
    `createProject`, `updateProject` (**slug immutable after creation**), `deleteProject`
    (**blocked with HTTP 409 `{code:'linked_posts',count}` when posts link it**).
  - API: `POST /api/projects`, `GET|PATCH|DELETE /api/projects/[id]`, `GET /api/projects/slug-check`.
  - UI (`src/app/admin/projects/**`, `src/components/admin/{ProjectTable,ProjectRowMenu,ProjectEditor}.tsx`):
    list w/ domain filters + delete-blocked toast; full editor (immutable slug on edit, stack
    tags, extra-links repeater, collapsible graph placement, featured switch, markdown preview).
- **Settings — account + site** (`src/app/admin/settings/page.tsx`, `src/components/admin/SettingsForm.tsx`):
  - **Account:** rename (`PATCH /api/settings/account` → re-issues the session so the JWT `name`
    claim tracks) + **change password** (`POST /api/settings/password`, rate-limited, verifies the
    current password, generic failure, never reveals which check failed; `changePassword` in `auth/password.ts`).
  - **Site:** new `SiteSettings` **singleton** model (`src/server/models/SiteSettings.ts`,
    `src/server/services/settings.ts`) holding siteName / siteDescription / githubUrl /
    contactEmail / defaultOgImage. Read is **cached** (`unstable_cache` tag `site-settings` +
    React `cache`) and **resilient** (returns hardcoded defaults on any DB error, so public RSC
    never crashes). Writes `revalidateTag` + `revalidatePath('/', 'layout')`.
  - **Public consumption:** root-layout `generateMetadata`, `Footer`, and `/about` now read
    `getSiteSettings()` instead of hardcoded constants (fallback identical to the old defaults).
    `NEXT_PUBLIC_SITE_URL` intentionally stays env (metadataBase needs it at build).

## Acceptance criteria — all 12 MET (evidence)
Verified LIVE by the tester (auth'd HTTP + direct DB reads + public HTML) and corroborated by the
pentester: 1–4 projects list/create/edit/delete persist; 5 delete-blocked `409 count:1`; 6 sidebar
Projects/Settings active (`aria-current`), not "Soon"; 7 public `/projects/[slug]` reflects edits;
8–9 settings render + display-name persists (+ session re-issued); 10 password wrong→fail-no-change,
correct→works & old rejected, stored as `$2` bcrypt; 11 site settings reflect on `/`+`/about`+footer+
`<title>`/OG; 12 all 6 mutating endpoints 401 unauth (+ IDOR/mass-assignment/NoSQL rejected).

## Verifiers (7, read-only, code + criteria only) & fixes applied
- **PASS:** code-reviewer, tester, pentester, compliance-privacy, blue-hat*.
- **FAIL→FIXED & re-verified:**
  - **[perf HIGH]** the whole Mongoose lib (~573 kB) shipped to the browser on `/admin/projects/*`
    (barrel import). Fixed by importing constants from `@/server/models/types`. Confirmed by build:
    `/admin/projects/[id]` **358 kB → 215 kB** (== posts editor), list **257 → 114 kB**.
  - **[a11y moderate]** RowMenu focus-restore + focus ring; immutable slug `readOnly`+described-by;
    field errors wired to `aria-describedby`; `aria-required`; 24px tag-remove targets; password
    error as `role="alert"`.
  - **[security Med, blue-hat+pentester]** URL fields accepted `javascript:`/`data:` schemes (latent
    stored-XSS — React 19 currently neutralizes `javascript:` hrefs, but it persists). Fixed with an
    http(s) allowlist at the validation boundary.
  - Backend polish: broadened settings revalidation, removed a redundant DELETE read, delete-message
    grammar, `requireAdmin` now asserts `role==='admin'`, seed loads `.env.local`.

## ⏳ LEFT / recommendations (non-blocking — owner/deploy decisions)
1. **Rate-limit `X-Forwarded-For` spoofing (pentester Med):** the login/password throttle keys off a
   client-controlled header → a rotating XFF bypasses it. Correct fix is deploy-topology-dependent
   (trusted proxy hop) + a shared store (Redis/KV). Pre-existing helper; feature reused it.
2. **`MarkdownPreview` eager-loads highlight.js (~100 kB)** behind a preview tab — pre-existing,
   affects the Posts editor equally; a repo-wide dynamic-import follow-up.
3. **`.next` AV/file-locking on this Windows box** intermittently breaks `next build`/`dev` and the
   in-browser e2e (ChunkLoadError; the bundle fix should relieve it). SSR is clean; the settings e2e
   passed 3/3. Run e2e in Docker/CI or exclude the repo `.next` from real-time AV scanning.
4. **Home hero `<h1>`** still hardcodes the name (criterion 11 passes via footer+metadata) — wire to
   `settings.siteName` if you want it settings-driven too. Low priority.
5. **Media section** remains "Soon" (out of scope this pass, owner decision).

## Housekeeping notes for the next agent
- A pre-step's git operation **destroyed the uncommitted `LoginForm.tsx`** login-redirect change
  mid-run; the orchestrator reconstructed it from the captured diff (verified safe — `next` is
  sanitized by `safeNext`, no open-redirect) and committed it (`ea763fb`). Every builder brief
  thereafter **forbade destructive git**.
- `src/app/rss.xml/route.ts` + `src/app/sitemap.ts` gained `force-dynamic` + DB-outage fallbacks
  (deploy resilience) — committed as `a6f5a6d`; they were unattributed in-tree at close, owner-confirmed
  to keep.
- Zero new dependencies (bcryptjs/jose/mongoose/zod reused); `pnpm audit --prod` clean.

## Status log (append your entry when done)
- (orchestrator · TEAM — Projects CRUD + Settings) Ran the full `team` pipeline on "build the Soon
  sections". Gate decisions: build **Projects** + **Settings (account + site)**, **skip Media**;
  project slug **immutable** after creation; deleting a project with linked posts **blocked (409)**.
  Contract pre-steps: database-engineer wrote the `SiteSettings` singleton model; ui-ux-designer
  wrote the field-layout spec (scratchpad). Builders (parallel, disjoint slices): backend-dev
  (models/services/API/validation/revalidate/guard + `changePassword`), frontend-dev·ADMIN
  (`src/app/admin/{projects,settings}/**` + `src/components/admin/{ProjectTable,ProjectRowMenu,ProjectEditor,SettingsForm,types,api,AdminSidebar}`),
  frontend-dev·PUBLIC (`layout.tsx`+`Footer`+`about` read `getSiteSettings`), qa-engineer
  (`tests/unit/{projects.crud,settings,validation.projects-settings}.test.ts` + `e2e/admin-{projects,settings}.spec.ts`,
  isolated `portfolio_vitest_<pid>` db, teardown verified). 7 read-only verifiers dispatched with
  ONLY code+criteria (no builder reasoning). All 12 acceptance criteria MET; two quality FAILs
  (client-bundle Mongoose, a11y moderates) + one Med security (URL scheme) routed back to the owning
  builders and re-verified. Final gates green (`tsc` 0, `eslint .` 0, `pnpm build` ✓, vitest 77/77;
  bundle 358→215 kB). 7 atomic commits `cadd3d5..8d4713e` pushed to `origin/master`; `develop`
  branch created from that HEAD. No orphaned processes (port 3200 free; 3000 is the owner's separate
  `adverta` app, untouched).

# ▶ CONTINUE HERE — Portfolio + Blog build (resume point)

This file lets a fresh session pick up exactly where we stopped. Read it top-to-bottom,
then read `HANDOFF.md`, `docs/ACCEPTANCE.md`, `docs/PROJECT-INVENTORY.md`,
`docs/DATA-MODEL.md`, and `docs/design/00-04`.

**Project root:** `C:\Users\DragonLord\Desktop\projects\personal\portfolio`
**Method:** the `/team` skill (orchestrator + parallel builders + adversarial verifiers).
**To resume the orchestrated way:** run `/team continue the portfolio build from CONTINUE-HERE.md`.
Or just follow "Remaining work" below manually.

---

## Where we are

- **Phase 1 — Intake & gate:** ✅ DONE. Plan approved. Decisions locked in `HANDOFF.md`:
  full CMS+admin (via `blog-system-builder`), feature everything in full detail (client/
  security posts default to `draft`), interactive domain-graph home, deploy to Vercel.
- **Phase 2a — Contract agents:** ✅ DONE, both passed.
  - **ui-ux-designer** → `docs/design/00-concept.md … 04-components.md`. Committed to
    **Tailwind CSS v4 + CSS-variable tokens**. Concept **"Constellation of Work"**: 18 real
    projects as size-ranked stars in 4 domain clusters (Web3 · Security · Commerce · Tools/
    Labs), **static pre-computed positions** (no runtime force sim → SSR-able + deterministic
    to test), glow = has a published post. SSR `<nav>` backbone, card fallback <768px,
    roving-tabindex keyboard nav, reduced-motion static mount. Self-hosted fonts (next/font).
  - **database-engineer** → `src/server/db/connect.ts`, `src/server/models/{types,Project,
    Post,User,index}.ts`, `docs/DATA-MODEL.md`. Body = **Markdown/MDX string**. Mongo on
    `localhost:27018`, db `portfolio`. Verified with strict `tsc` + live Mongo integration
    (indexes build, constraints enforce, published query hits IXSCAN). Types import-ready:
    models from `@/server/models` (server only), types anywhere (`IProject`, `IPost`, `IUser`,
    `PublicUser`, `Domain`, `PostStatus`, `*SeedInput`), conn via `connectToDatabase()`.
- **Phase 2b — Builders:** ⬜ NOT STARTED (this is the next action).
- **Phase 3 — Verifiers:** ⬜ NOT STARTED.
- **Phase 4 — Verdict:** ⬜ NOT STARTED.

## What exists on disk right now
```
portfolio/
  HANDOFF.md                 # source of truth + status log
  CONTINUE-HERE.md           # this file
  docs/
    ACCEPTANCE.md            # 8 falsifiable criteria (pass to verifiers verbatim)
    PROJECT-INVENTORY.md     # factual content source for all copy
    DATA-MODEL.md            # DB contract
    design/00-04.md          # design contract
  src/server/
    db/connect.ts
    models/{types,Project,Post,User,index}.ts
```
Nothing else yet — **no root `package.json`, `tsconfig`, `next.config`, or `.env.example`**
(devops owns those; see gotcha below). Git initialised, nothing committed. No processes running.

---

## Remaining work — Phase 2b builders (dispatch these; slices are disjoint = safe in parallel)

Each builder MUST read HANDOFF.md + ACCEPTANCE.md + the design/data contracts, and stay
strictly inside its slice. Slice map (from HANDOFF.md):

| Builder | Owns (only these) | Job |
|---|---|---|
| **devops** (do FIRST — unblocks build) | `package.json`, `tsconfig.json`, `next.config.*`, `.env.example`, `.gitignore`, `Dockerfile`, `vercel.json`, `.github/**`, `docker-compose.yml`, `postcss/tailwind config` | Scaffold the Next.js+TS+Tailwind v4 app config. Add deps: `mongoose`, auth libs, MDX. Add TS path alias `@/*`→`src/*`. `.env.example`: `MONGODB_URI=mongodb://localhost:27018/portfolio`, session secret. Wire Tailwind v4 + next/font. Vercel config. |
| **backend-dev** | `src/app/api/**`, `src/server/services/**`, `src/server/repositories/**`, `src/server/auth/**`, `src/server/seed/**` | Invoke `blog-system-builder`. CRUD API for Project+Post against existing models, admin auth (session/JWT), draft→publish endpoint (stamp publishedAt if null), slug-uniqueness check, published-only sitemap.xml + RSS, referential-integrity check on Post.projectSlug. Seed script that loads `content/**` (hash passwords, never commit plaintext). Define the `[API]` response shapes the designer flagged (ProjectNodeData, EdgeData, PostRow/PostDraft). |
| **frontend-dev (public)** | `src/app/(public)/**`, `src/components/public/**`, `src/lib/**`, `src/app/layout.tsx`, `globals.css` | Build the graph home (freeze exact node px positions per `02-graph-home.md §1` anchors+phyllotaxis), project case-study pages (name+stack+links+backlink), blog index + post pages (link back to project). `globals.css` implements the token layer from `01-tokens.md`. Keyboard + mobile fallback per design. |
| **frontend-dev (admin)** | `src/app/admin/**`, `src/components/admin/**` | Admin login, post list, MDX editor, draft→publish control. Use the **`submittedRef` pattern** for the unsaved-changes guard (owner MEMORY: async-save discard-guard race) to avoid a false discard prompt after save. |
| **tech-writer** | `content/**` | Draft one case-study + one blog post per featured project, grounded in `PROJECT-INVENTORY.md` and each repo's real docs. Client (GKOI/Settleo) + Sentova security-internals posts → `status: draft`. No invented benchmarks/dates. As Markdown/MDX matching the seed shape in DATA-MODEL.md. |
| **qa-engineer** | `tests/**`, `e2e/**` | Unit/integration + Playwright e2e covering every ACCEPTANCE criterion (esp. #2 reachability, #3 posts+sitemap, #4 CMS draft→publish+auth, #5 responsive, #8 graph). |

**Sequencing note:** run **devops first** (or first-in-batch) — it produces `package.json`/config
everything else needs to install & build. backend-dev + both frontend-devs + tech-writer can then
go in parallel; qa-engineer can start alongside but finishes last (needs the app runnable).

### Contract-agent TODOs to honor (from their handoffs)
- **devops:** add `mongoose`, TS path alias `@/*`→`src/*`, `.env.example` (`MONGODB_URI`,
  `MONGODB_DB=portfolio`). Decide `next/font/google` (build-time self-host) vs `next/font/local`
  (.woff2 committed) — either satisfies no-runtime-CDN.
- **backend-dev:** enforce `Post.projectSlug` references an existing Project (service layer —
  Mongo has no FK). On publish, stamp `publishedAt` only if null. Login must `.select('+passwordHash')`
  and return `PublicUser`. Keep `Project.relatedPostSlugs` in sync or treat as rebuildable cache.
- **frontend (public):** node positions are static/deterministic — freeze them.
- **frontend (admin):** `submittedRef` unsaved-guard pattern.

## Phase 3 — Verifiers (after 2b; pass ONLY the code + `docs/ACCEPTANCE.md`, never builder reasoning)
`code-reviewer` (always), `tester` (drives every route + CMS flow), `accessibility-auditor`
(graph a11y, #6/#8), `blue-hat` (always — leakage scan #7 + dep/supply-chain),
`performance-engineer` (Lighthouse #6, graph render), `compliance-privacy` (publishes personal/
client data). Dispatch in one message, each spawned clean.

## Phase 4 — Verdict
Reconcile reports → route each fix to the file's Phase-2b owner (slice map is the routing table)
→ re-dispatch the verifier that raised it to confirm closed → report every ACCEPTANCE criterion
met|unmet with evidence → kill any processes started.

---

## Fast resume commands
```bash
cd C:\Users\DragonLord\Desktop\projects\personal\portfolio
git status                       # nothing committed yet
docker ps | grep mongo           # shared Mongo must be up on 27018
# after devops scaffolds:
pnpm install && pnpm build && pnpm lint && pnpm typecheck
pnpm dev                         # then drive routes / e2e
```

## Guards (do not violate)
- No secrets/tokens/.env values/keys/credentials in any committed file or content. `.env`
  gitignored; only `.env.example` committed.
- Content grounded in real repo docs — no invented benchmarks, dates, or rationale.
- Client/security posts default to `draft`; owner publishes manually.
- Two builders never touch the same file — respect the slice map.

# DATA-MODEL — the database contract

This is the stable contract the backend services and both frontends code against.
It is derived from the `blog-system-builder` skill (flat entity, binary
`draft ⇄ published` lifecycle, slug-based canonical URLs, derived tags) and
adapted for this project, which has **Projects** and **Posts** plus a
**domain-graph** home.

- **Store:** MongoDB via Mongoose (dev: shared Docker Mongo `localhost:27018`,
  db `portfolio`; prod: Atlas, same code).
- **Layering:** models are the **data layer only** — no business logic, no HTTP.
  Slug generation, publish transitions, reading-time computation, auth, and
  access control live in the service layer (`backend-dev`).
- **Import surface (do not reach past this):**
  - Models (server only): `import { Project, Post, User } from '@/server/models'`
  - Types (anywhere, incl. client/admin bundles — runtime-free, erased at build):
    `import type { IProject, IPost, IUser, Domain, PostStatus } from '@/server/models'`
  - Connection: `import { connectToDatabase } from '@/server/db/connect'`

Files:
- `src/server/db/connect.ts` — cached, serverless-safe Mongoose connection.
- `src/server/models/types.ts` — all enums + interfaces (no mongoose import).
- `src/server/models/Project.ts`, `Post.ts`, `User.ts` — schemas.
- `src/server/models/index.ts` — barrel.

---

## Enums (single source of truth — `types.ts`)

| Export | Values | Used by |
|---|---|---|
| `Domain` / `DOMAINS` | `web3` \| `security` \| `commerce` \| `tools-labs` | Project cluster grouping on the graph home |
| `DOMAIN_LABELS` | `{web3:'Web3', security:'Security', commerce:'Commerce', 'tools-labs':'Tools / Labs'}` | headings / graph cluster titles |
| `PostStatus` / `POST_STATUSES` | `draft` \| `published` (default `draft`) | publish lifecycle + public read filter |
| `UserRole` / `USER_ROLES` | `admin` \| `editor` (default `admin`) | auth |
| `SLUG_REGEX`, `SLUG_MIN` (3), `SLUG_MAX` (100) | `^[a-z0-9]+(?:-[a-z0-9]+)*$` | slug validation, shared with services/UI |

Enums are `as const` arrays **and** derived union types, so you get a runtime
value list (for Zod schemas / `<select>` options / seed validation) and a
compile-time type from the same declaration.

---

## Body storage decision — Markdown/MDX string

`Post.body` and `Project.longDescription` are stored as **Markdown (MDX-compatible)
strings**, NOT the blog-system-builder's default HTML and not block-JSON.

**Why (this is the exact case the skill's `decisions.md` §1 says to deviate for):**
- Content is **developer-authored** by one person (Abdullah), grounded in each
  repo's real README/ARCHITECTURE/SECURITY docs (HANDOFF "content authenticity
  rule").
- It is **diffable and portable** and **lives in git** — `tech-writer` owns
  `content/**`, so posts are reviewed as text diffs, not opaque HTML blobs.
- MDX lets a case-study embed the domain-graph / code components later without a
  schema change.

**Boundary this creates:** the public renderer must render Markdown/MDX and
**sanitize** the output (the render/sanitize step is `frontend-dev (public)` +
`backend-dev`, not the DB). The DB stores the raw source string verbatim.
Reading time is derived from this string by the service layer and cached in
`Post.readingTime`.

---

## Model: Project — `src/server/models/Project.ts`

Portfolio entry. Powers the graph home (nodes) and the case-study page.

| Field | Type | Req | Default | Rules / purpose |
|---|---|---|---|---|
| `_id` | string (ObjectId) | auto | — | serialized to string in `toJSON` |
| `title` | string | **yes** | — | trimmed |
| `slug` | string | **yes** | — | **unique**, lowercase, trimmed, `SLUG_REGEX`, len 3–100. Canonical URL key |
| `domain` | `Domain` | **yes** | — | enum; the graph cluster |
| `summary` | string | no | `''` | card / meta text |
| `role` | string | no | `''` | your role on the project |
| `stack` | string[] | no | `[]` | tech stack chips |
| `links` | `ProjectLinks` | no | `{}` | `{repo?, live?, docs?, extra?: {label,url}[]}` |
| `heroText` | string | no | `''` | one-line hook on the case-study hero |
| `longDescription` | string | no | `''` | **Markdown/MDX** case-study body |
| `graph` | `ProjectGraphMeta` | no | `{}` | `{cluster, x?, y?, weight?}`; `cluster` auto-defaults to `domain` on save; `x`/`y` ∈ [0,1] optional hand-placed coords; `weight` ≥ 0 (default 1) node size |
| `relatedPostSlugs` | string[] | no | `[]` | denormalized nav → Post.slug |
| `order` | number | no | `0` | ascending sort within a domain |
| `featured` | boolean | no | `false` | appears on the graph home |
| `createdAt` / `updatedAt` | Date | auto | — | `timestamps:true` |

TS: `IProject`, `ProjectLinks`, `ProjectLink`, `ProjectGraphMeta`,
`ProjectSeedInput`.

---

## Model: Post — `src/server/models/Post.ts`

Blog article. Flat entity, binary publish lifecycle.

| Field | Type | Req | Default | Rules / purpose |
|---|---|---|---|---|
| `_id` | string (ObjectId) | auto | — | string in `toJSON` |
| `title` | string | **yes** | — | trimmed |
| `slug` | string | **yes** | — | **unique**, lowercase, `SLUG_REGEX`, len 3–100. Canonical URL |
| `status` | `PostStatus` | **yes** | `draft` | public reads MUST filter `status:'published'` |
| `publishedAt` | Date \| null | no | `null` | set on first publish; drives sitemap + ordering. Null while draft |
| `excerpt` | string | no | `''` | meta description / card |
| `body` | string | no | `''` | **Markdown/MDX** source |
| `coverImage` | string | no | `''` | hero / OG image URL or key |
| `projectSlug` | string \| null | no | `null` | **FK → Project.slug** (ACCEPTANCE #3). Nullable = standalone essay. Lowercased/trimmed |
| `tags` | string[] | no | `[]` | free-text labels (derived tag list = aggregation, no tag table) |
| `seo` | `PostSeo` | no | `{}` | `{metaTitle?, metaDescription?, ogImage?}`; empty = derive from title/excerpt |
| `readingTime` | number | no | `0` | minutes, computed from body by the service |
| `createdAt` / `updatedAt` | Date | auto | — | `timestamps:true` |

TS: `IPost`, `PostSeo`, `PostSeedInput`.

### Draft / publish semantics (owned by the service layer)
- New post ⇒ `status:'draft'`, `publishedAt:null`. **Invisible to the public.**
- Publish ⇒ set `status:'published'` and stamp `publishedAt = now` **iff** it was
  null (don't overwrite the original publish date on re-publish). A dedicated
  status action, not a general update — so it's auditable + cache-busting.
- Unpublish ⇒ `status:'draft'`. (Keep or clear `publishedAt` per product call;
  the model allows either — it does not clear it for you.)
- **Every public read filters to exactly `status:'published'`.** Drafts must 404
  for anonymous users (ACCEPTANCE #3) and be excluded from `sitemap.xml`.

### Relationship: `Post.projectSlug → Project.slug`
Mongo has no cross-collection FK; integrity is by slug **value**, enforced in the
service layer (validate the referenced Project exists on create/update). The
reverse convenience list lives on `Project.relatedPostSlugs`. Keep both in sync
in the service, or treat `Project.relatedPostSlugs` as a cache rebuilt from Posts.

---

## Model: User — `src/server/models/User.ts`

Admin/author account backing CMS auth (ACCEPTANCE #4).

| Field | Type | Req | Default | Rules |
|---|---|---|---|---|
| `_id` | string (ObjectId) | auto | — | string in `toJSON` |
| `email` | string | **yes** | — | **unique**, lowercase, trimmed |
| `passwordHash` | string | **yes** | — | **`select:false`** — bcrypt/argon2 hash written by backend auth. NEVER plaintext. Omitted from reads unless `.select('+passwordHash')`. Also stripped in `toJSON` |
| `role` | `UserRole` | **yes** | `admin` | enum |
| `name` | string | no | — | display name |
| `createdAt` / `updatedAt` | Date | auto | — | `timestamps:true` |

TS: `IUser` (hash optional, server-only), `PublicUser` (hash omitted — return this).

> Login flow (backend): `User.findOne({ email }).select('+passwordHash')`, verify,
> then serialize as `PublicUser`. The hash never crosses a network boundary.

---

## Indexes — each with the query it serves (verified by `explain`)

| Model | Index | Query it serves |
|---|---|---|
| Project | `slug` **unique** | canonical lookup `findOne({slug})`; enforces URL uniqueness |
| Project | `{domain:1, order:1}` | graph home / domain page: "projects in domain X, in author order" — filter + sort from the index, no in-memory sort |
| Project | `{featured:1, order:1}` | "all featured projects, ordered" — the graph-home fetch |
| Post | `slug` **unique** | canonical post lookup + slug-uniqueness check |
| Post | `{status:1, publishedAt:-1}` | **public published list + `sitemap.xml`**: `find({status:'published'}).sort({publishedAt:-1})` — equality + sort served by one IXSCAN |
| Post | `{projectSlug:1, status:1}` | case-study cross-links: "published posts backing project X" |
| Post | `tags` (multikey) | tag landing / related-by-tag |
| User | `email` **unique** | login `findOne({email})`; one account per email |

Verified `explain('queryPlanner')` for the hot published-list query resolves to
`IXSCAN` on `status_1_publishedAt_-1` (no `COLLSCAN`). See EVIDENCE in the
delivery report.

**Derived tags/categories (no tag table)** — per the skill: the tag list is an
aggregation over published posts (`$match {status:'published'}` → `$unwind $tags`
→ `$group {_id:'$tags', totalCount:{$sum:1}}`), not a modeled collection. Same
for project domains, which are a fixed enum.

---

## Seed-data shape (backend owns `src/server/seed/**`; this is the contract)

Seed input types are exported so the seed script is type-checked against them.

**Project** (`ProjectSeedInput`) — required: `title`, `slug`, `domain`,
`summary`. Optional: `role`, `stack`, `links`, `heroText`, `longDescription`,
`graph`, `relatedPostSlugs`, `order`, `featured`. Example:

```ts
{ title: 'NFTMixer (Go)', slug: 'nftmixer-go', domain: 'web3',
  summary: 'C#/.NET generative-NFT builder rewritten in Go + Next.js at parity.',
  role: 'Solo engineer', stack: ['Go','Next.js','MongoDB','S3/MinIO'],
  links: { repo: 'https://github.com/…', live: 'https://…' },
  graph: { cluster: 'web3', weight: 1.4 }, order: 1, featured: true }
```

**Post** (`PostSeedInput`) — required: `title`, `slug`, `body` (Markdown).
Optional: `status` (default `draft`), `publishedAt`, `excerpt`, `coverImage`,
`projectSlug`, `tags`, `seo`, `readingTime`. Client/security posts must seed with
`status:'draft'` (HANDOFF decision #2). `projectSlug` must match a seeded Project
slug. Example:

```ts
{ title: 'Rewriting a .NET app in Go without losing parity', slug: 'net-to-go',
  status: 'draft', excerpt: 'What survived the port and what didn’t.',
  body: '# …markdown…', projectSlug: 'nftmixer-go',
  tags: ['go','dotnet','rewrite'], seo: { metaTitle: '…' } }
```

**User** — seed at least one admin: `{ email, passwordHash, role:'admin' }`.
The seed script must **hash** the password (never commit plaintext; see
ACCEPTANCE #7 / HANDOFF absolute guard). `passwordHash` is a hash string only.

---

## Connection — `src/server/db/connect.ts`

`connectToDatabase()` returns a **cached** Mongoose connection, safe for Next.js
hot-reload and serverless warm reuse (cache stored on `globalThis`, in-flight
promise shared so concurrent callers await one connect; a failed connect resets
the promise so the next call retries). Reads `process.env.MONGODB_URI`
(default `mongodb://localhost:27018/portfolio`) and forces db name from
`process.env.MONGODB_DB` (default `portfolio`) so this app never collides on the
shared instance. `bufferCommands:false` so "not connected" surfaces as an error
instead of hanging. `disconnectFromDatabase()` is provided for tests/shutdown.
Every handler/service must `await connectToDatabase()` before touching a model.

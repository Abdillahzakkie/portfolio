import type { ProjectSeedInput } from '@/server/models';

/**
 * Portfolio project registry — the 18 real projects that populate the
 * domain-graph home and the case-study pages.
 *
 * Source of truth for identity/cluster/prominence: `docs/design/00-concept.md §3`.
 * Every claim here is grounded in `docs/PROJECT-INVENTORY.md` and each repo's own
 * README/ARCHITECTURE/SECURITY docs — no invented benchmarks, dates, or metrics.
 *
 * `graph.weight` mirrors the registry prominence tier (3 = flagship, 2, 1).
 * `graph.cluster` mirrors `domain`. `order` sorts within a domain cluster.
 *
 * Links are intentionally OMITTED where a real, public URL is not known: the
 * inventory lists local repo folders (e.g. `exedos_corp/nftmixer-go`), not
 * verified public GitHub/live URLs. Per the authoring rule, we omit rather than
 * invent. The owner can fill `links` in the admin once canonical URLs exist.
 */
export const projects: ProjectSeedInput[] = [
  // ───────────────────────────── Web3 ─────────────────────────────
  {
    title: 'Settleo',
    slug: 'settleo',
    domain: 'web3',
    summary:
      'Non-custodial P2P / OTC crypto-settlement platform built as ~24 independent services around a single authoritative ledger.',
    role: 'Architect & platform engineer',
    stack: [
      'TypeScript',
      'Node.js',
      'gRPC',
      'TigerBeetle',
      'Redis',
      'MongoDB',
      'Solidity',
      'Next.js 15',
      'React 19',
      'styled-components',
    ],
    heroText:
      'A settlement platform where exactly one service is allowed to move money.',
    longDescription: `## What it is

Settleo is a non-custodial peer-to-peer and OTC crypto-settlement platform,
built as roughly two dozen independently deployable services. Retail users
trade through the consumer app, desks trade through the business app, and
operators watch it all from an internal console — but every one of those
surfaces is downstream of the same rule: value only moves in one place.

## The problem

When money is on the line, "a bunch of services that each touch balances" is a
recipe for double-spends and irreconcilable state. The hard part isn't building
one service — it's building sixteen-plus of them without letting any two of them
disagree about how much money exists.

## The architecture

Settleo is organised around a small set of load-bearing decisions:

- **A single-writer ledger.** \`settleo-ledger\` is the *sole* writer to
  TigerBeetle and exposes double-entry settlement over gRPC. No other service
  writes balances.
- **A deny-by-default gateway/BFF.** \`settleo-gateway\` terminates the internet:
  HMAC + token auth, deny-by-default authorization, rate limiting, idempotency,
  signed routing, and WebSocket fan-out — backed by a Redis-only store.
- **AWS-IAM-style authz.** \`settleo-iam\` issues and introspects tokens and
  evaluates policies with **deny-wins** semantics.
- **Reorg-safe indexing.** \`settleo-indexer\` ingests per-chain EVM events and
  credits the ledger reorg-safely, so a rolled-back block never leaves a phantom
  balance.
- **A shared, hardened foundation.** The \`@settleo/*\` libraries (config,
  validation, auth/HMAC, events, ledger-client) carry the cross-cutting controls,
  targeting OWASP ASVS L2+ platform-wide and L3 for the auth/events/ledger-client
  packages.

## Highlights

- Money is modelled as **integer minor units** (u128-safe), never floats.
- Every inbound byte — HTTP, gRPC, events, webhooks, chain data — is treated as
  *untrusted data, never instructions*, and validated at the boundary.
- A STRIDE threat model was produced before code, mapping every threat to a
  mitigation and at least one security test.`,
    graph: { cluster: 'web3', weight: 3 },
    order: 1,
    featured: true,
    relatedPostSlugs: [
      'settleo-single-writer-ledger-tigerbeetle',
    ],
  },
  {
    title: 'NFTMixer (Go)',
    slug: 'nftmixer-go',
    domain: 'web3',
    summary:
      'A C# / .NET 6 Blazor generative-NFT builder rewritten as a Go API + Next.js frontend, targeting functional parity.',
    role: 'Rewrite author (solo)',
    stack: [
      'Go',
      'chi',
      'Next.js',
      'TypeScript',
      'MongoDB',
      'S3 / MinIO',
      'SIWE',
      'go-ethereum',
      'Playwright',
    ],
    heroText:
      'Porting a stateful Blazor app to Go + Next.js — and fixing what was broken on the way.',
    longDescription: `## What it is

NFTMixer (Go) is a web app for building generative NFT collections: upload
layered art, organise it into layers and variants with traits and rarity
weights, wire a node graph describing how layers combine, generate thousands of
unique combinations, review them, then render final PNGs plus metadata to S3 (or
download a zip). It is a ground-up rewrite of an existing C# / .NET 6 Blazor
Server application.

## The problem

The owner wanted full long-term ownership of the stack and does not read C#.
Blazor Server *is* the UI — the \`.razor\` files aren't templates, they're a
stateful framework pushing DOM diffs over a websocket — so roughly 70% of the
"rewrite in Go" was actually frontend work in Next.js.

## The architecture

A monorepo with two deployables: a Go service (\`net/http\` + \`chi\`, a pure
\`domain\` package, an \`engine\` for path-tracing/compositing, Mongo
repositories, and an S3/MinIO blob interface) and a Next.js App Router frontend.
Art lives in S3 so the service stays stateless and horizontally scalable.

## Highlights

The rewrite deliberately did *not* carry over the original's defects:

- **Auth that actually authenticates.** The C# app believed whatever wallet the
  browser named. The Go version implements real **SIWE**: server nonce, MetaMask
  signature, address recovered from the signature via \`go-ethereum\`.
- **Ownership from the session, never the URL** — closing endpoints that let
  anyone download anyone's output.
- **Sessions that expire** via a TTL index, replacing an in-memory map that was
  never cleaned.
- Deliberate parity *breaks* where the original was wrong: OpenSea-standard
  metadata instead of a flat dictionary, and every layer resized to output
  dimensions so non-uniform art composites correctly.`,
    graph: { cluster: 'web3', weight: 3 },
    order: 2,
    featured: true,
    relatedPostSlugs: ['nftmixer-net-to-go-parity-rewrite'],
  },
  {
    title: 'GKOI Platform',
    slug: 'gkoi-platform',
    domain: 'web3',
    summary:
      'The backend for a Web3 fighting-game NFT platform — auth, whitelist, and core services split across independent repos.',
    role: 'Backend engineer',
    stack: [
      'Node.js',
      'TypeScript',
      'Express',
      'MongoDB',
      'Redis',
      'migrate-mongo',
      'Merkle proofs',
      'IPFS',
    ],
    heroText:
      'Microservice backend for a fighting-game NFT drop: auth, whitelist, chain ops.',
    longDescription: `## What it is

GKOI ("New Worlds New Powers") is a Web3 fighting-game NFT platform. The
platform layer is a set of independently deployed Node/TypeScript services, each
in its own repo.

## The architecture

- **\`gkoi-server\`** — the core Express + MongoDB + Redis backend, with schema
  migrations managed by \`migrate-mongo\`.
- **\`gkoi-authentications\`** — a dedicated auth service, shipped with its own
  \`SECURITY.md\` and a security-audit document.
- **\`gkoi-whitelist\`** — a Merkle-proof whitelist API that also serves contract
  metadata and pins to IPFS.

## Highlights

Splitting authentication and whitelisting into their own services keeps the
mint-critical trust boundaries small and separately auditable, and lets the
whitelist's Merkle-proof verification scale independently of the main API.`,
    graph: { cluster: 'web3', weight: 2 },
    order: 3,
    featured: true,
    relatedPostSlugs: ['gkoi-merkle-whitelist'],
  },
  {
    title: 'GKOI Contracts',
    slug: 'gkoi-contracts',
    domain: 'web3',
    summary:
      'The Foundry/Solidity smart contracts behind GKOI — an ERC721-AC creator collection, a collection factory, and Conduit.',
    role: 'Smart-contract engineer',
    stack: [
      'Solidity',
      'Foundry',
      'Hardhat',
      'ERC721-AC',
      'LimitBreak SeaDrop',
      'OpenZeppelin upgradeable',
    ],
    heroText:
      'On-chain creator collections with enforceable royalties, factory-deployed.',
    longDescription: `## What it is

The on-chain half of the GKOI platform: a set of Foundry/Solidity contracts for
the fighting-game NFT collections.

## The architecture

- **\`gkoi-erc721AC\`** — an ERC721-AC creator collection (LimitBreak SeaDrop),
  upgradeable, built and tested with both Foundry and Hardhat.
- **\`NftCollectionFactory\`** — deploys new collections from a template.
- **\`Conduit\`** — routing/approvals plumbing shared across the collections.

## Highlights

ERC721-AC (Creator) enforces programmable transfer/royalty policy at the token
level, which is the point of the whole design: royalties that survive
secondary-market transfers rather than relying on marketplace goodwill.`,
    graph: { cluster: 'web3', weight: 2 },
    order: 4,
    featured: true,
    relatedPostSlugs: ['erc721ac-enforceable-royalties'],
  },
  {
    title: 'Settleo Escrow',
    slug: 'settleo-escrow',
    domain: 'web3',
    summary:
      'The non-custodial 2-of-3 trade-escrow layer of Settleo: Foundry/Solidity contracts plus the orchestrator that drives them.',
    role: 'Protocol & backend engineer',
    stack: [
      'Solidity',
      'Foundry',
      'TypeScript',
      'gRPC',
      'EVM',
      'TigerBeetle (via ledger)',
    ],
    heroText:
      'A 2-of-3 escrow where no single party — including the platform — can move funds alone.',
    longDescription: `## What it is

Settleo Escrow is the piece of Settleo that actually holds funds during a trade:
a non-custodial **2-of-3** escrow made of two parts — the on-chain
\`settleo-escrow-contracts\` (Foundry/Solidity) and the off-chain
\`settleo-escrow-orchestrator\` that drives fund / release / refund / dispute
and settles the result against the ledger.

## The problem

In a P2P trade, neither counterparty trusts the other, and a good design also
means neither of them has to fully trust the platform. Custodial escrow makes
the operator a single point of theft and a single point of failure.

## The architecture

Funds sit behind a 2-of-3 signature scheme (buyer, seller, platform), so a
release requires agreement between two independent parties and no one party can
unilaterally move money. The orchestrator translates trade lifecycle events into
escrow actions and, once an outcome is final, asks \`settleo-ledger\` to record
the settlement — it never writes balances itself.

## Highlights

- Disputes route to \`settleo-dispute\`, which resolves them with the same
  2-of-3 discipline (arbitration, evidence bundling, SLA timers).
- Because release is on-chain and multi-party, the platform's own compromise is
  not sufficient to drain an escrow.`,
    graph: { cluster: 'web3', weight: 2 },
    order: 5,
    featured: true,
    relatedPostSlugs: ['settleo-2-of-3-escrow'],
  },
  {
    title: 'NFTMixer (.NET)',
    slug: 'nftmixer-net',
    domain: 'web3',
    summary:
      'The original generative-NFT builder — C# / .NET 6, Blazor Server — and the predecessor that motivated the Go rewrite.',
    role: 'Predecessor codebase (rewritten as nftmixer-go)',
    stack: ['C#', '.NET 6', 'Blazor Server', 'Docker'],
    heroText:
      'The stateful Blazor app that came first — and the reference the Go rewrite was measured against.',
    longDescription: `## What it is

NFTMixer (.NET) is the original generative-NFT builder: a C# / .NET 6 Blazor
Server application, structured as a multi-project Dockerized solution. Layered
art flows through sources → assets → variants → a node graph, then generates
PNGs plus metadata.

## Why it matters here

This is the predecessor to \`nftmixer-go\`. It defined the product and the
domain model, and it served as the read-only reference implementation the Go +
Next.js rewrite was measured against for functional parity.

## Highlights (and honest limits)

The original proved the concept but carried real defects that the rewrite was
explicitly designed to *not* reproduce — spoofable wallet "authentication",
unauthorized download endpoints, a committed API key, and non-expiring sessions.
Keeping it in the constellation is deliberate: the interesting engineering story
is the delta between the two, not either one alone.`,
    graph: { cluster: 'web3', weight: 1 },
    order: 6,
    featured: true,
    relatedPostSlugs: ['nftmixer-net-blazor-predecessor'],
  },
  {
    title: 'GKOI Apps',
    slug: 'gkoi-apps',
    domain: 'web3',
    summary:
      'The GKOI frontends — a Next.js admin dashboard, the public site, and an NFT gallery/marketplace.',
    role: 'Frontend engineer',
    stack: ['Next.js', 'TypeScript', 'React'],
    heroText: 'Admin, public site, and gallery for the GKOI platform.',
    longDescription: `## What it is

The user-facing surfaces of the GKOI platform, each a Next.js / TypeScript app:

- **\`gkoi-admin-v2\`** — an admin dashboard for collections, contests, users,
  and on-chain operations.
- **\`gkoi-client-v3\`** — the public marketing/mint site.
- **\`gkoi-gallery\`** — an NFT gallery / marketplace view.

## Highlights

These apps consume the GKOI Platform services and the GKOI Contracts, so the
front-of-house work is mostly about turning chain operations and whitelist state
into something a non-technical operator (and a hyped collector) can drive
safely.`,
    graph: { cluster: 'web3', weight: 1 },
    order: 7,
    featured: true,
    relatedPostSlugs: ['gkoi-admin-chain-ops-ui'],
  },

  // ─────────────────────────── Security ───────────────────────────
  {
    title: 'Sentova',
    slug: 'sentova',
    domain: 'security',
    summary:
      'Cross-device active protection — installable desktop/mobile agents that filter malicious traffic, detect spyware/ransomware, and score hardening.',
    role: 'Solo engineer',
    stack: [
      'Go',
      'go.work monolith',
      'Wails',
      'Windows WFP',
      'ETW',
      'DPAPI',
      'Named-pipe IPC',
    ],
    heroText:
      'Active endpoint protection with a privileged Windows service and a signed directive path.',
    longDescription: `## What it is

Sentova is cross-device active protection: installable desktop (Wails) and
mobile apps that block malicious traffic, detect spyware and ransomware, and
score a device's hardening posture. It is backed by a single Go service — a
\`go.work\` four-module monolith — and ships a privileged Windows service
(\`serviced.exe\`).

## The architecture

Protection is organised into five modules — \`network_filter\`, \`ioc_scan\`,
\`posture\`, \`behavior_monitor\`, and \`ransomware_guard\` — across six
platform targets. The decision logic and the enforcement path (verified
directives driven through kill / quarantine / network-filter ports by a shared
enforcer, with a bounded at-most-once replay guard and an autonomous
canary → correlate → kill/quarantine loop) are implemented in Go and unit-tested
with fake ports.

## Highlights

- On Windows, live enforcement uses **WFP** filtering, **ETW** telemetry, and a
  \`TerminateProcess\` kill primitive — all elevation-gated.
- Client/service communication is an authenticated **named-pipe** round-trip
  with an integrity-gated mutating path.
- At-rest secrets are sealed with **DPAPI** and the data directory is
  ACL-hardened.

*A tracker matrix keeps the docs honest about exactly which module ships real
enforcement on which platform, so the product never claims more than it does.*`,
    graph: { cluster: 'security', weight: 3 },
    order: 1,
    featured: true,
    relatedPostSlugs: ['sentova-signed-directive-enforcement'],
  },
  {
    title: 'Sentova MTD',
    slug: 'sentova-mtd',
    domain: 'security',
    summary:
      'Anti-spyware / Mobile Threat Defense for high-risk users — a Device Defense engine that matches iOS/Android forensic artifacts against STIX 2.1 spyware IOCs.',
    role: 'Solo engineer',
    stack: [
      'Go',
      'MongoDB',
      'gRPC',
      'STIX 2.1',
      'AES-256-GCM',
      'pnpm frontends',
    ],
    heroText:
      'Forensic mobile threat defense: STIX 2.1 IOC matching as an index seek, not a pattern parse.',
    longDescription: `## What it is

Sentova MTD is an anti-spyware / Mobile Threat Defense platform aimed at
high-risk users. Its flagship "Device Defense" analyses iOS and Android forensic
artifacts against a curated set of STIX 2.1 spyware indicators. It's built as a
set of Go microservices (agents, assets, audit, billing, breach, brokers,
gateway, iam, mtd, notifications) plus pnpm frontends.

## The problem

Mercenary spyware (the Pegasus / Predator class) hides in forensic traces that
are expensive to scan naively. Matching artifacts against raw STIX patterns at
request time doesn't scale.

## The architecture

The \`sentova-mtd\` service (its own \`sentova_mtd\` database, per the platform's
DB-per-service rule) stores STIX 2.1 \`indicator\` objects with a **denormalized,
indexed observable array**, so the artifact-match hot path is an index seek
rather than a STIX pattern parse. Indicators carry a malware-family label and a
shared \`low|medium|high|critical\` severity vocabulary; mercenary-spyware IOCs
default to \`critical\`.

## Highlights

- **Tenant isolation by construction** — every account-facing document carries an
  \`accountId\` and every query filters on it, on top of gateway/PDP authorization.
- **Field-level encryption** (AES-256-GCM) for sensitive artifacts, with
  encrypted fields never indexed.
- Verdicts and posture findings reuse the platform-wide severity ranking so they
  sort and render identically everywhere.`,
    graph: { cluster: 'security', weight: 2 },
    order: 2,
    featured: true,
    relatedPostSlugs: ['sentova-mtd-stix-index-seek'],
  },

  // ─────────────────────────── Commerce ───────────────────────────
  {
    title: 'Managerenta',
    slug: 'managerenta',
    domain: 'commerce',
    summary:
      'A property/rental management app — and the reference architecture the other commerce apps are cloned from.',
    role: 'Solo engineer',
    stack: [
      'Next.js',
      'TypeScript',
      'MongoDB',
      'Redis',
      'Docker',
      'AWS Amplify / CodeBuild',
      'Playwright',
    ],
    heroText:
      'The Next.js + Mongo + Redis reference architecture behind a family of commerce apps.',
    longDescription: `## What it is

Managerenta is a property/rental management application built on Next.js and
TypeScript, deployed via Docker and AWS Amplify/CodeBuild, and tested with
Playwright. Beyond the product itself, it is the **reference architecture** the
owner's other commerce apps are cloned from.

## The architecture

The pattern that propagated outward from here is a **Model → Service → Route**
triad: models are the data layer only, services hold business logic and access
control, and route handlers stay thin. It comes with a documented security
review (\`SECURITY_REVIEW.md\`) rather than being an afterthought.

## Highlights

Being "the template" is the interesting part: Golden Bite, Chekka, Mogadget and
others inherit this layering, its per-operation database/service discipline, and
its testing setup. Getting the reference right once paid off many times — and any
architectural lesson learned in a clone flows back here.`,
    graph: { cluster: 'commerce', weight: 2 },
    order: 1,
    featured: true,
    relatedPostSlugs: ['managerenta-reference-architecture'],
  },
  {
    title: 'Chekka',
    slug: 'chekka',
    domain: 'commerce',
    summary:
      'Professional car inspection & verification — "Before you buy, Chekka" — as a Next.js monolith with a detailed spec.',
    role: 'Solo engineer',
    stack: [
      'Next.js 16',
      'TypeScript',
      'Mongoose',
      'Redis',
      'S3',
      'Playwright',
    ],
    heroText: 'Book a professional car inspection before you buy the car.',
    longDescription: `## What it is

Chekka ("Before you buy — Chekka") is a professional car inspection and
verification service. A buyer books an inspection; a professional verifies the
vehicle; the buyer gets a report they can trust before handing over money.

## The architecture

It's a Next.js 16 monolith over Mongoose + Redis + S3, in TypeScript, tested
with Playwright — a direct descendant of the Managerenta reference architecture
(Model → Service → Route). The product is backed by a large (~37k-word)
specification, so the build follows a written contract rather than ad-hoc scope.

## Highlights

The domain is trust: the whole value proposition is that an independent,
professional inspection de-risks a high-value used-car purchase. That puts the
weight on report integrity, media handling (S3), and a booking flow that
schedules real humans.`,
    graph: { cluster: 'commerce', weight: 2 },
    order: 2,
    featured: true,
    relatedPostSlugs: ['chekka-spec-driven-build'],
  },
  {
    title: 'Golden Bite',
    slug: 'golden-bite',
    domain: 'commerce',
    summary:
      'A premium treats/catering storefront plus an ops dashboard and a staff mobile app, for an Abuja business.',
    role: 'Solo engineer',
    stack: [
      'Next.js',
      'TypeScript',
      'ioredis',
      'Prometheus',
      'Zod',
      'SWR',
      'axios',
    ],
    heroText:
      'Storefront, back-office, and staff app for a premium catering business.',
    longDescription: `## What it is

Golden Bite is a premium treats and catering business in Abuja, built as three
surfaces: a customer storefront, an operations dashboard, and a staff mobile app.

## The architecture

It follows the owner's commerce reference architecture with a distinctive
twist — a **per-operation database/service and IAM** discipline (the pattern the
inventory nicknames the "Golden Bite arch"): validation with Zod, data fetching
with SWR + axios, caching with ioredis, and operational metrics via Prometheus.

## Highlights

Splitting concerns per operation (rather than one god-service) keeps blast radius
small and makes each capability independently observable — the same principle
that shows up, scaled up, in the owner's larger platforms.`,
    graph: { cluster: 'commerce', weight: 2 },
    order: 3,
    featured: true,
    relatedPostSlugs: ['golden-bite-per-operation-iam'],
  },
  {
    title: 'Prechop',
    slug: 'prechop',
    domain: 'commerce',
    summary:
      'A campus food pre-order marketplace — "order before they cook" — with dated listings, cutoff times, and Paystack prepay.',
    role: 'Solo engineer',
    stack: [
      'Next.js',
      'TypeScript',
      'Node.js',
      'Prisma',
      'Paystack',
      'Vitest',
      'Playwright',
    ],
    heroText: 'Order campus food before it is cooked — pay upfront, beat the queue.',
    longDescription: `## What it is

Prechop is a campus food pre-order marketplace: vendors post **dated listings**
with **cutoff times**, students pre-order and prepay via Paystack, and the food
gets cooked to actual demand. The tagline — "order before they cook" — is the
whole model.

## The architecture

Two pieces: a Next.js / TypeScript frontend (tested with Vitest + Playwright)
and a Node/TypeScript API over Prisma.

## Highlights

The interesting constraint is time. A listing is only orderable until its
cutoff, after which it locks for the kitchen. That turns an ordinary catalog into
a scheduling problem — inventory that expires — and makes prepayment (Paystack)
the mechanism that lets a vendor commit to cooking a known quantity.`,
    graph: { cluster: 'commerce', weight: 1 },
    order: 4,
    featured: true,
    relatedPostSlugs: ['prechop-cutoff-scheduling'],
  },
  {
    title: 'Adverta',
    slug: 'adverta',
    domain: 'commerce',
    summary:
      'A Nigeria business advertising/marketplace: free listings, paid boosts, in-app chat, a campaign builder, and agency white-label.',
    role: 'Solo engineer',
    stack: [
      'Turborepo',
      'Next.js',
      'React Native',
      'TypeScript',
      'Redis',
      'Prometheus',
    ],
    heroText:
      'Listings, boosts, chat, and campaigns across web and native — one shared API.',
    longDescription: `## What it is

Adverta is a Nigeria-focused business advertising and marketplace product: free
listings, paid boosts, in-app chat, a campaign builder, and an agency
white-label mode.

## The architecture

It's a Turborepo monorepo with a web app, a native mobile app, and a shared HTTP
API — so web and native speak to the same backend contract. Redis backs the fast
paths and Prometheus provides metrics, with a **per-operation database/service
and IAM** model (the "Golden Bite arch") applied to keep capabilities isolated.

## Highlights

The monetization surface (boosts, campaigns, white-label agencies) is what makes
this more than a classifieds clone — it needs a billing-aware campaign model and
a multi-tenant story for agencies reselling the platform.`,
    graph: { cluster: 'commerce', weight: 1 },
    order: 5,
    featured: true,
    relatedPostSlugs: ['adverta-monorepo-shared-api'],
  },
  {
    title: 'Mogadget',
    slug: 'mogadget',
    domain: 'commerce',
    summary:
      'A single-owner gadget catalog for a Lagos retailer — browse, then order via WhatsApp/Instagram. No cart.',
    role: 'Solo engineer',
    stack: ['Next.js', 'TypeScript', 'MongoDB', 'Redis', 'Vitest', 'Playwright'],
    heroText: 'A gadget catalog that hands off to WhatsApp instead of a checkout.',
    longDescription: `## What it is

Mogadget is a single-owner gadget catalog for a Lagos retailer. Customers browse
the catalog and then order via WhatsApp or Instagram — there is deliberately **no
cart and no checkout**.

## The architecture

Next.js + MongoDB + Redis, following the owner's **Model → Service → Route**
triad, tested with Vitest + Playwright.

## Highlights

Dropping the cart is a product decision, not a missing feature: for a single
retailer whose sales already happen over chat, the site's job is to be a fast,
trustworthy catalog that funnels an intent into a WhatsApp/Instagram
conversation. Less surface, less to break, and it matches how the business
actually closes sales.`,
    graph: { cluster: 'commerce', weight: 1 },
    order: 6,
    featured: true,
    relatedPostSlugs: ['mogadget-catalog-without-cart'],
  },

  // ────────────────────────── Tools / Labs ─────────────────────────
  {
    title: 'Aisolver',
    slug: 'aisolver',
    domain: 'tools-labs',
    summary:
      'A modern rebuild of a task/list manager — lists, nested tasks, groups, drag-drop, calendar, alarms — as a pnpm monorepo.',
    role: 'Solo engineer',
    stack: [
      'React 19',
      'Vite',
      'TypeScript',
      'Tailwind v4',
      'Fastify 5',
      'node-pg',
      'Zod',
      'PostgreSQL 17',
      'WebSocket',
    ],
    heroText:
      'A task manager rebuilt as a clean pnpm monorepo with an architecture lint that fails the build.',
    longDescription: `## What it is

Aisolver (package \`taskwise-v2\`) is a modern rebuild of a task/list manager:
lists, nested tasks, groups, drag-and-drop, a calendar, alarms, a trash bin, an
admin area, and invite-code registration.

## The architecture

A pnpm monorepo split into a web app (React 19 + Vite + TypeScript + Tailwind v4)
and an API (Fastify 5 + \`node-pg\` + Zod), over PostgreSQL 17, with WebSockets
for live updates. It ships real engineering docs — \`ARCHITECTURE.md\` and a
\`RUNBOOK.md\` — and an \`arch-check.ts\` lint that enforces the intended module
boundaries.

## Highlights

The stand-out is discipline: an architecture-check script that *fails the build*
when a boundary is violated turns "please respect the layering" from a code-review
plea into an automated gate. It's a small tool with a grown-up spine.`,
    graph: { cluster: 'tools-labs', weight: 2 },
    order: 1,
    featured: true,
    relatedPostSlugs: ['aisolver-architecture-lint'],
  },
  {
    title: 'Fivestick',
    slug: 'fivestick',
    domain: 'tools-labs',
    summary:
      'A marketing/landing site for Fivestick, an AI automation consultancy — static Next.js + Tailwind (shadcn).',
    role: 'Solo engineer',
    stack: ['Next.js', 'TypeScript', 'Tailwind', 'shadcn/ui'],
    heroText: 'A fast static marketing site for an AI automation consultancy.',
    longDescription: `## What it is

Fivestick is the marketing/landing site for an AI automation consultancy of the
same name. It's a static Next.js + TypeScript site styled with Tailwind and
shadcn/ui.

## Highlights

A landing site's job is narrow and honest: load fast, read clearly, and convert.
Building it static (rather than reaching for a CMS or a heavy app shell) keeps it
cheap to host, trivial to cache, and quick to iterate — the right amount of
engineering for the problem.`,
    graph: { cluster: 'tools-labs', weight: 1 },
    order: 2,
    featured: true,
    relatedPostSlugs: ['fivestick-static-landing'],
  },
  {
    title: 'Labs',
    slug: 'labs',
    domain: 'tools-labs',
    summary:
      'A small cluster of learning/sandbox repos — a C++23 template, DSA/TypeScript interview practice, and a Terraform local-provider sandbox.',
    role: 'Solo / learning',
    stack: ['C++23', 'TypeScript', 'Terraform', 'CMake'],
    heroText: 'The sandbox corner: language features, algorithms, and infra practice.',
    longDescription: `## What it is

Labs is a deliberately low-key cluster grouping the owner's learning and sandbox
repos rather than shipped products:

- a **C++23** project template (exercising the spaceship \`<=>\` operator),
- a **hello-interview** DSA collection in TypeScript, and
- a **Terraform** sandbox using the local provider.

## Why it's here

Keeping the labs visible — but small — is honest. Not everything is a platform;
some of the work is sharpening tools: a modern C++ baseline, algorithm reps, and
infrastructure-as-code practice. Grouping them as one node avoids padding the
constellation with three tiny stars while still crediting the work.`,
    graph: { cluster: 'tools-labs', weight: 1 },
    order: 3,
    featured: true,
    relatedPostSlugs: ['labs-cpp23-spaceship'],
  },
];

import type { PostSeedInput } from '@/server/models';

/**
 * Companion blog posts — one per featured project.
 *
 * Every post's `projectSlug` is the EXACT slug of a project in `./projects.ts`
 * (which mirrors the registry in `docs/design/00-concept.md §3`). This is the
 * required post → project link (ACCEPTANCE #3).
 *
 * `status` policy (HANDOFF decision #2 + authoring rule):
 *   - `published` — neutral engineering write-ups of the owner's own products.
 *   - `draft`     — anything about CLIENT platforms (GKOI, Settleo) or SECURITY
 *                   detection internals (Sentova / Sentova MTD). The owner
 *                   publishes these manually.
 *
 * `readingTime` is intentionally omitted — the service computes it from `body`.
 * `publishedAt` is set only on published posts (drafts stay null by default).
 * Content is grounded in each repo's real docs; no invented benchmarks or dates.
 */
export const posts: PostSeedInput[] = [
  // ─────────────────── Settleo (client / fintech → draft) ───────────────────
  {
    title: 'Building a double-entry ledger on TigerBeetle',
    slug: 'settleo-single-writer-ledger-tigerbeetle',
    status: 'draft',
    projectSlug: 'settleo',
    excerpt:
      'In Settleo, exactly one service is allowed to move money. Here is why that single-writer rule is the whole reason balances can be trusted.',
    tags: ['go', 'tigerbeetle', 'grpc', 'ledger', 'fintech'],
    seo: {
      metaTitle: 'Building a double-entry ledger on TigerBeetle — Settleo',
      metaDescription:
        'Why Settleo makes one service the sole writer to a TigerBeetle double-entry ledger, and how every other service settles through it over gRPC.',
    },
    body: `In Settleo, exactly one service is allowed to move money: the ledger. Every
other service — the gateway, the indexer, the escrow orchestrator — describes an
intent, but only the ledger records the debits and credits that make it real.
That single-writer rule is the whole reason balances can be trusted.

## Why double-entry, and why TigerBeetle

Double-entry accounting is old, boring, and exactly the property you want when
funds are involved: every transfer touches two accounts and the sum is always
conserved. TigerBeetle is a database built specifically for that shape — accounts
and transfers as first-class primitives — so the ledger service is the sole
writer to it and speaks gRPC to everyone else.

A transfer, then, is not an \`UPDATE\` against a balances table. It is a
two-sided, all-or-nothing entry:

\`\`\`go
// A settlement is one atomic double-entry transfer.
func (l *Ledger) Post(ctx context.Context, m Move) error {
    t := tigerbeetle.Transfer{
        DebitAccountID:  m.From,
        CreditAccountID: m.To,
        Amount:          m.Amount, // integer minor units, u128-safe
        Ledger:          m.Asset,
        Code:            CODE_SETTLEMENT,
    }
    return l.client.CreateTransfer(ctx, t) // conserved or rejected
}
\`\`\`

> If more than one service can write to the ledger, you no longer have a
> ledger — you have a race.

## Money is never a float

Amounts move as **integer minor units**, bounds-checked and u128-safe — there is
no floating-point path anywhere near a balance. This is a threat-modelled control
(precision loss and overflow are explicit line items), not a stylistic
preference.

## The indexer never writes balances

The ledger does not talk to a chain directly. The indexer confirms on-chain
events and *asks* the ledger to credit — reorg-safely — so a rolled-back block
can never leave a phantom balance. Keeping the single writer behind gRPC keeps
the trust boundary small enough that a reviewer can audit one service to answer
the question that actually matters: can money be created or destroyed here?

Everything else in the platform is downstream of that discipline. The escrow
orchestrator settles against the ledger, compliance reads from it, the console
reports on it — but none of them writes.`,
  },

  // ─────────────────── NFTMixer (Go) — neutral → published ───────────────────
  {
    title: 'Rewriting a .NET Blazor app in Go without losing parity',
    slug: 'nftmixer-net-to-go-parity-rewrite',
    status: 'published',
    publishedAt: '2026-07-10T09:00:00.000Z',
    projectSlug: 'nftmixer-go',
    excerpt:
      'Porting a stateful Blazor Server app to Go + Next.js meant confronting an uncomfortable truth: most of the rewrite was not Go at all.',
    tags: ['go', 'dotnet', 'nextjs', 'rewrite', 'siwe'],
    seo: {
      metaTitle: 'Rewriting a .NET Blazor app in Go without losing parity',
      metaDescription:
        'What survived the port from C#/.NET 6 Blazor Server to Go + Next.js, what deliberately did not, and why 70% of a "Go rewrite" was frontend work.',
    },
    body: `"Rewrite it in Go" is a satisfying sentence. It is also, in this case, mostly a
lie — and noticing that early is what made the rewrite tractable.

## Blazor Server *is* the UI

The original NFTMixer is a C#/.NET 6 Blazor Server app. Its \`.razor\` files are
not templates — Blazor Server is a stateful framework that renders on the server
and pushes DOM diffs to the browser over a websocket. Go has no equivalent. So
while the generation engine, compositing, database access, S3, and wallet auth
all port to Go cleanly, roughly **70% of the work was frontend**, rebuilt from
scratch in Next.js. Budgeting for that up front is the difference between a plan
and a surprise.

## Parity means behaviour, not files

Full parity does not mean porting every file. Several things were deliberately
left behind because they were dead or dangerous:

- an unauthenticated full-database-dump endpoint,
- unfinished IPFS publishing that never actually uploaded,
- entire generations of superseded components that were referenced but
  unreachable.

Porting those would have been faithfully reproducing debt.

## Fixing the things that were simply broken

The most interesting part of a rewrite is the bugs you refuse to carry over.
The original's "authentication" believed whatever wallet the browser claimed —
no signature, anywhere:

\`\`\`text
Old flow:  browser says "I am 0xADMIN…"  →  server believes it.
New flow:  server issues nonce  →  wallet signs  →  server RECOVERS the address
           from the signature (go-ethereum).  Same effort, actually secure.
\`\`\`

Alongside real **SIWE**, ownership is now derived from the session rather than a
URL parameter, and sessions expire via a Mongo TTL index instead of living
forever in an in-memory map.

## Deliberate parity *breaks*

A rewrite is also a chance to be correct where the original was wrong: metadata
now follows the OpenSea standard instead of a flat dictionary, and every layer
is resized to the output dimensions so non-uniform art composites without
misalignment. Those are intentional divergences — parity with the *intent*, not
the mistake.`,
  },

  // ─────────────────── GKOI Platform (client → draft) ───────────────────
  {
    title: 'A Merkle-proof whitelist that scales apart from the mint',
    slug: 'gkoi-merkle-whitelist',
    status: 'draft',
    projectSlug: 'gkoi-platform',
    excerpt:
      'Why GKOI splits its whitelist into a dedicated service, and how Merkle proofs keep an allowlist cheap on-chain.',
    tags: ['web3', 'merkle', 'nft', 'nodejs', 'ipfs'],
    seo: {
      metaTitle: 'A Merkle-proof whitelist that scales apart from the mint',
      metaDescription:
        'How the GKOI platform isolates whitelisting into its own service, using Merkle proofs and IPFS-pinned metadata.',
    },
    body: `A mint is a stampede. The worst place to discover a bottleneck is in the one
request path that also decides who is allowed to pay you. GKOI keeps its
allowlist logic in a service of its own — \`gkoi-whitelist\` — precisely so it
can scale, fail, and be audited independently of the core API.

## Why Merkle proofs

Storing thousands of allowlisted addresses on-chain is expensive. A Merkle tree
collapses the whole set into a single root the contract stores, while each user
carries only the small proof that their address is a leaf. The contract verifies
the proof at mint time; the off-chain service's job is to build the tree, serve
each address its proof, and pin the associated contract metadata to IPFS.

## Small, separately-auditable boundaries

Authentication (\`gkoi-authentications\`, which ships with its own security and
audit docs) and whitelisting live apart from \`gkoi-server\`. Splitting the
mint-critical trust boundaries into their own services keeps each one small
enough to reason about — and lets the whitelist's proof-serving scale under drop
load without dragging the rest of the platform with it.`,
  },

  // ─────────────────── GKOI Contracts (client → draft) ───────────────────
  {
    title: 'Royalties that survive the secondary market: ERC721-AC',
    slug: 'erc721ac-enforceable-royalties',
    status: 'draft',
    projectSlug: 'gkoi-contracts',
    excerpt:
      'ERC721-AC enforces transfer and royalty policy at the token level. Here is why the GKOI collections are built on it.',
    tags: ['solidity', 'foundry', 'erc721', 'royalties', 'nft'],
    seo: {
      metaTitle: 'Royalties that survive the secondary market: ERC721-AC',
      metaDescription:
        'Why the GKOI collections use LimitBreak ERC721-AC (Creator) for enforceable royalties, deployed from a factory and built with Foundry + Hardhat.',
    },
    body: `Marketplace-honoured royalties are a promise, not a mechanism — and promises
break the moment a venue decides to compete on fees. The GKOI collections are
built on **ERC721-AC** (LimitBreak's Creator standard) so that transfer and
royalty policy is enforced *at the token level*, not left to a marketplace's good
behaviour.

## The design

- **\`gkoi-erc721AC\`** — the creator collection: ERC721-AC, upgradeable, and
  built/tested with both Foundry and Hardhat.
- **\`NftCollectionFactory\`** — deploys new collections from a template, so a
  new drop is a factory call rather than a fresh deploy-and-pray.
- **\`Conduit\`** — the shared routing/approvals plumbing.

## Why enforce at the token

If the policy lives in the token, it travels with the token. A secondary sale
that would sidestep the creator's royalty simply does not satisfy the transfer
policy. That is the entire reason to reach for a creator standard instead of
plain ERC-721: the royalty is a property of the asset, not a courtesy of whoever
happens to be reselling it.`,
  },

  // ─────────────────── Settleo Escrow (client → draft) ───────────────────
  {
    title: 'A 2-of-3 non-custodial escrow (the platform is not enough)',
    slug: 'settleo-2-of-3-escrow',
    status: 'draft',
    projectSlug: 'settleo-escrow',
    excerpt:
      'In Settleo, releasing an escrow takes two of three signatures — buyer, seller, platform — so no single party can move the funds alone.',
    tags: ['solidity', 'escrow', 'web3', 'non-custodial', 'p2p'],
    seo: {
      metaTitle: 'A 2-of-3 non-custodial escrow (the platform is not enough)',
      metaDescription:
        'How Settleo escrows funds with a 2-of-3 signature scheme so a compromised platform cannot drain a trade, and how the orchestrator settles through the ledger.',
    },
    body: `The strongest thing you can say about an escrow is what it *cannot* do. Settleo's
escrow cannot be drained by any single party — not the buyer, not the seller, and
importantly, not the platform.

## Two of three

Funds sit behind a **2-of-3** signature scheme across the buyer, the seller, and
the platform. Releasing requires agreement between any two of them, so:

- a dishonest counterparty can't unilaterally take the funds,
- and a compromised *platform* isn't sufficient to move them either.

Custodial escrow makes the operator a single point of theft. A 2-of-3 design
removes that by construction — the operator is one key among three, never a
master key.

## The orchestrator drives, the ledger records

On-chain, \`settleo-escrow-contracts\` (Foundry/Solidity) hold the funds. Off
chain, \`settleo-escrow-orchestrator\` translates the trade lifecycle — fund,
release, refund, dispute — into escrow actions. When an outcome is final, it asks
\`settleo-ledger\` to record the settlement. It never writes balances itself;
that stays the ledger's sole job.

## When it goes wrong

Disputes hand off to \`settleo-dispute\`, which resolves with the same 2-of-3
discipline: arbitration, evidence bundling, and SLA timers. The escrow's safety
property holds all the way through the unhappy path, which is the only path that
actually matters when trust breaks down.`,
  },

  // ─────────────────── NFTMixer (.NET) — neutral → published ───────────────────
  {
    title: 'The Blazor app that came first (and why we left it)',
    slug: 'nftmixer-net-blazor-predecessor',
    status: 'published',
    publishedAt: '2026-07-08T09:00:00.000Z',
    projectSlug: 'nftmixer-net',
    excerpt:
      'A short retrospective on the original C#/.NET 6 Blazor Server generative-NFT builder — what it got right, and the defects that justified a rewrite.',
    tags: ['dotnet', 'blazor', 'csharp', 'retrospective'],
    seo: {
      metaTitle: 'The Blazor app that came first (and why we left it)',
      metaDescription:
        'A retrospective on NFTMixer (.NET) — the C#/.NET 6 Blazor Server generative-NFT builder that defined the product and motivated the Go rewrite.',
    },
    body: `Before there was a Go rewrite, there was a working product. NFTMixer (.NET) is
the original generative-NFT builder — C#/.NET 6, Blazor Server, a multi-project
Dockerized solution — and it is worth keeping in the story precisely because the
rewrite only makes sense against it.

## What it got right

It nailed the domain model: layered art flows through sources → assets →
variants → a node graph, then generates PNGs plus metadata. That pipeline was
sound enough that the rewrite kept it wholesale. The product worked; people used
it.

## Where it fell short

The interesting engineering lesson is in the defects, catalogued honestly rather
than swept aside:

- **"Authentication" that didn't authenticate** — the server trusted whatever
  wallet the browser named.
- **An unauthenticated database-dump endpoint.**
- **A live API key committed to the repository.**
- **Sessions that never expired**, held in an in-memory map with an empty
  cleanup method.

None of those are exotic; they're the ordinary erosion that accumulates in a
shipping app. Naming them is what turned "rewrite for the language" into "rewrite
for correctness." The successor, \`nftmixer-go\`, exists to keep the model and
drop the debt.`,
  },

  // ─────────────────── GKOI Apps (client → draft) ───────────────────
  {
    title: 'Turning chain operations into an admin a human can drive',
    slug: 'gkoi-admin-chain-ops-ui',
    status: 'draft',
    projectSlug: 'gkoi-apps',
    excerpt:
      'The GKOI admin, public site, and gallery all consume the same platform and contracts. The hard part is making on-chain ops safe to click.',
    tags: ['nextjs', 'react', 'web3', 'admin', 'ux'],
    seo: {
      metaTitle: 'Turning chain operations into an admin a human can drive',
      metaDescription:
        'How the GKOI Next.js frontends — admin, public site, and gallery — turn platform state and on-chain operations into something operators and collectors can use.',
    },
    body: `Three Next.js apps sit in front of the GKOI platform: an admin dashboard
(\`gkoi-admin-v2\`), the public mint site (\`gkoi-client-v3\`), and a gallery /
marketplace (\`gkoi-gallery\`). They share a backend contract, but they answer to
very different users.

## The admin's real job

Collections, contests, users, and *on-chain operations* all funnel through the
admin. The engineering challenge there isn't rendering a table — it's making a
chain operation legible and reversible-feeling to a non-technical operator.
Irreversible actions need to look irreversible; whitelist and contest state need
to read at a glance.

## Consuming, not duplicating

These apps deliberately hold no source of truth. They consume the platform
services and the contracts, so the front-of-house work is translation: turning
whitelist proofs, mint windows, and contest results into UI, and turning an
operator's click back into a well-formed platform call. Keeping the frontends
thin is what lets the mint-critical logic stay concentrated — and audited — in
the services underneath.`,
  },

  // ─────────────────── Sentova (security internals → draft) ───────────────────
  {
    title: 'A signed directive path for an endpoint agent',
    slug: 'sentova-signed-directive-enforcement',
    status: 'draft',
    projectSlug: 'sentova',
    excerpt:
      'Sentova will kill and quarantine processes on a machine. That is exactly why every enforcement directive has to be verified before it runs.',
    tags: ['go', 'security', 'windows', 'wfp', 'edr'],
    seo: {
      metaTitle: 'A signed directive path for an endpoint agent — Sentova',
      metaDescription:
        'How Sentova verifies enforcement directives before driving kill/quarantine/network-filter actions, with a replay guard and elevation-gated live execution.',
    },
    body: `An agent that can terminate processes and filter traffic is a loaded weapon
pointed at the machine it protects. Sentova's design treats the *directive path*
— how an enforcement decision reaches the privileged code that acts on it — as
the most safety-critical thing in the product.

## Verify, then enforce

Enforcement flows through a shared enforcer that only acts on **verified**
directives, driving them through the real kill / quarantine / network-filter
ports. Two safety properties ride along:

- a **bounded, at-most-once replay guard**, so a re-delivered directive cannot
  fire twice, and
- an autonomous **canary → correlate → kill/quarantine** loop that can act on its
  own detections rather than waiting to be told.

This decision logic and the enforcement wiring are Go, and they're unit-tested
against *fake* ports so the tests run anywhere.

## The privileged edge is gated

The genuinely dangerous primitives — **WFP** network filtering, **ETW**
telemetry, and a \`TerminateProcess\` kill — only execute on an elevated Windows
run behind an explicit integration flag. At-rest secrets are sealed with
**DPAPI** and the data directory is ACL-hardened. Client/service messages ride an
authenticated **named-pipe** round-trip with an integrity gate on mutating ops.

## Honesty as a feature

A capability matrix in the repo states exactly which of the five modules ships
real enforcement on which of the six platforms — and marks the live privileged
path as "authored and compiles, proven only on an elevated run." Refusing to
overstate what a security product does is part of the security posture, not
marketing copy.`,
  },

  // ─────────────────── Sentova MTD (security internals → draft) ───────────────────
  {
    title: 'STIX 2.1 IOC matching as an index seek, not a pattern parse',
    slug: 'sentova-mtd-stix-index-seek',
    status: 'draft',
    projectSlug: 'sentova-mtd',
    excerpt:
      'Matching mobile forensic artifacts against STIX spyware indicators is a hot path. Sentova MTD denormalizes it into an index seek.',
    tags: ['go', 'stix', 'mtd', 'forensics', 'mongodb'],
    seo: {
      metaTitle: 'STIX 2.1 IOC matching as an index seek — Sentova MTD',
      metaDescription:
        'How Sentova MTD stores STIX 2.1 indicators with a denormalized observable array so the artifact-match hot path is an index seek, with tenant isolation and field encryption.',
    },
    body: `Sentova MTD's flagship "Device Defense" analyses iOS and Android forensic
artifacts against known spyware indicators. Do that naively and every scan
becomes a parade of STIX pattern parses. The fix is to move the work from request
time to write time.

## Denormalize the observable

STIX 2.1 \`indicator\` objects carry patterns like
\`[domain-name:value = 'x.badness.com']\`. Parsing that at match time is the slow
path. Instead, \`sentova-mtd\` stores each indicator with a **denormalized,
indexed observable array** — the extracted match keys — so checking an artifact
is an **index seek**, not a pattern parse. The raw STIX pattern is still kept for
provenance and audit; it just isn't the thing you query.

Indicators carry a malware-family label (the Pegasus / Predator / Reign class)
and the platform-wide \`low|medium|high|critical\` severity vocabulary, with
mercenary-spyware IOCs defaulting to \`critical\` so they sort to the top
everywhere.

## Isolation is not optional

Because this is Mobile Threat Defense for high-risk users, the data model treats
tenant isolation as a construction rule, not a filter you remember to add:

- every account-facing document carries an \`accountId\`, and **every** query
  filters on it, on top of the gateway/PDP authorization;
- identity arrives as an explicit argument from the service-to-service context —
  never from a request body;
- sensitive artifacts are **field-encrypted** (AES-256-GCM), and encrypted fields
  are **never** indexed.

The result is a match path that's fast enough to run on every scan and a storage
model where a query simply *cannot* reach across tenants by accident.`,
  },

  // ─────────────────── Managerenta — neutral → published ───────────────────
  {
    title: 'The reference architecture I clone across every commerce app',
    slug: 'managerenta-reference-architecture',
    status: 'published',
    publishedAt: '2026-07-14T09:00:00.000Z',
    projectSlug: 'managerenta',
    excerpt:
      'Managerenta is a rental-management app, but its more useful output is a Next.js + Mongo + Redis template the other apps are built from.',
    tags: ['nextjs', 'architecture', 'mongodb', 'redis', 'patterns'],
    seo: {
      metaTitle: 'The reference architecture I clone across every commerce app',
      metaDescription:
        'How Managerenta became the Model → Service → Route reference architecture that Golden Bite, Chekka, Mogadget and others are cloned from.',
    },
    body: `Managerenta is a property/rental management app. It is also, quietly, the most
reused thing I've built — because its layering became the template every other
commerce app inherits.

## The triad

The pattern is a **Model → Service → Route** triad:

- **Models** are the data layer only — schema and persistence, no business logic
  and no HTTP.
- **Services** hold the business logic and access control.
- **Route handlers** stay thin: parse, call a service, serialize.

It sounds obvious written down. The value is in holding the line: models never
reach for a request, routes never reach for the database, and business rules have
exactly one home.

## Why "reference" is the real feature

Once this was solid — deployed with Docker and AWS Amplify/CodeBuild, tested with
Playwright, and reviewed in a \`SECURITY_REVIEW.md\` rather than by vibes — it
became cheaper to start the next app by cloning the pattern than by improvising.
Golden Bite, Chekka, and Mogadget all carry this shape. A lesson learned in any
one of them flows back to the reference, so the whole family improves together.

## The payoff

Getting the skeleton right once and reusing it is boring in the best way: new
products spend their novelty budget on the actual problem, not on re-litigating
how a request becomes a database write.`,
  },

  // ─────────────────── Chekka — neutral → published ───────────────────
  {
    title: 'Building to a 37k-word spec instead of a vibe',
    slug: 'chekka-spec-driven-build',
    status: 'published',
    publishedAt: '2026-07-12T09:00:00.000Z',
    projectSlug: 'chekka',
    excerpt:
      'Chekka sells trust in a used-car purchase. Writing the spec first is how the build stayed honest about what "verified" means.',
    tags: ['nextjs', 'spec-driven', 'mongodb', 'product'],
    seo: {
      metaTitle: 'Building Chekka to a 37k-word spec instead of a vibe',
      metaDescription:
        'How Chekka — a professional car inspection and verification product — was built as a Next.js 16 monolith against a large written specification.',
    },
    body: `Chekka's whole pitch — "Before you buy, Chekka" — is that an independent
professional inspects a used car so the buyer doesn't have to gamble. When the
product *is* trust, you can't improvise the definition of "verified" halfway
through the build.

## Spec first

So Chekka started as a specification — a large one, around 37k words — that
pins down the inspection flow, the report, and the booking lifecycle before the
first route exists. The build follows the written contract rather than
rediscovering scope in code review.

## The stack is deliberately ordinary

It's a Next.js 16 monolith over Mongoose + Redis + S3, in TypeScript, tested with
Playwright — a direct descendant of the Managerenta reference architecture. The
boring stack is the point: nothing about the infrastructure should be surprising,
because all the surprise budget belongs to the domain.

## Where the weight actually sits

Three things carry the product: **report integrity** (the artifact a buyer pays
to trust), **media handling** on S3 (the evidence behind the report), and a
**booking flow** that schedules real humans to show up and inspect a real car.
Everything else is plumbing in service of those three.`,
  },

  // ─────────────────── Golden Bite — neutral → published ───────────────────
  {
    title: 'Per-operation services and IAM for a small business',
    slug: 'golden-bite-per-operation-iam',
    status: 'published',
    publishedAt: '2026-07-11T09:00:00.000Z',
    projectSlug: 'golden-bite',
    excerpt:
      'Golden Bite runs a storefront, a back-office, and a staff app on a per-operation database/service model — the same isolation idea, sized for a bakery.',
    tags: ['nextjs', 'architecture', 'iam', 'redis', 'observability'],
    seo: {
      metaTitle: 'Per-operation services and IAM for a small business',
      metaDescription:
        'How Golden Bite applies a per-operation database/service and IAM discipline across a storefront, ops dashboard, and staff mobile app.',
    },
    body: `Golden Bite is a premium treats and catering business in Abuja, served by three
surfaces: a customer storefront, an operations dashboard, and a staff mobile app.
The interesting decision is that a small business runs on an isolation model
usually reserved for much bigger systems.

## Per-operation, not one god-service

Rather than a single backend that can do everything, Golden Bite leans on a
**per-operation database/service and IAM** discipline (the pattern I nickname the
"Golden Bite arch"). Each capability gets its own narrow slice of authority, so a
bug or a compromise in one operation has a small blast radius instead of the run
of the whole system.

## The supporting cast

- **Zod** validates at the edges, so bad input dies early.
- **SWR + axios** handle data fetching on the client.
- **ioredis** caches the hot reads.
- **Prometheus** makes each operation independently observable — you can watch a
  single capability's health instead of guessing from an aggregate.

## Why bother at this size

Because the discipline is free once it's a habit, and it scales *down* as
gracefully as it scales up. The same instinct — isolate operations, give each the
least authority it needs, measure them separately — is what shows up, much
larger, in the platforms. Practising it on a bakery keeps it sharp.`,
  },

  // ─────────────────── Prechop — neutral → published ───────────────────
  {
    title: 'Inventory that expires: modelling cutoff times',
    slug: 'prechop-cutoff-scheduling',
    status: 'published',
    publishedAt: '2026-07-09T09:00:00.000Z',
    projectSlug: 'prechop',
    excerpt:
      'Prechop lets students order campus food before it is cooked. The cutoff time turns an ordinary catalog into a scheduling problem.',
    tags: ['nextjs', 'prisma', 'paystack', 'marketplace'],
    seo: {
      metaTitle: 'Inventory that expires: modelling cutoff times in Prechop',
      metaDescription:
        'How Prechop models dated listings with cutoff times and Paystack prepayment so vendors cook to committed demand.',
    },
    body: `Prechop's tagline is "order before they cook," and that preposition is the entire
product. A vendor posts a **dated listing** with a **cutoff time**; students
pre-order and prepay; the kitchen cooks to demand it can actually see.

## A catalog with a clock

Most marketplaces sell from standing inventory. Prechop sells from inventory that
doesn't exist yet and *expires*. A listing is orderable only until its cutoff,
after which it locks for the kitchen. That single constraint reframes the whole
thing: it isn't a store, it's a scheduling problem where each listing is a window
that opens and closes.

## Prepayment is the commitment device

Cutoffs only mean something if the demand behind them is real. Paystack
prepayment is what makes a pre-order binding — a vendor can commit to cooking a
known quantity because the orders are already paid, not just intended. The money
turns "maybe" into a number the kitchen can trust.

## The build

A Next.js / TypeScript frontend (tested with Vitest + Playwright) over a Node/
TypeScript API on Prisma. The relational model earns its place here: listings,
their cutoffs, and paid orders have clear, enforced relationships, and "is this
still orderable?" is a query, not a guess.`,
  },

  // ─────────────────── Adverta — neutral → published ───────────────────
  {
    title: 'One shared API behind web and native',
    slug: 'adverta-monorepo-shared-api',
    status: 'published',
    publishedAt: '2026-07-07T09:00:00.000Z',
    projectSlug: 'adverta',
    excerpt:
      'Adverta ships a web app and a native app against a single HTTP API in one Turborepo. Here is why the shared contract is the whole point.',
    tags: ['turborepo', 'nextjs', 'react-native', 'monorepo', 'marketplace'],
    seo: {
      metaTitle: 'One shared API behind web and native — Adverta',
      metaDescription:
        'How Adverta uses a Turborepo monorepo to serve a Next.js web app and a React Native app from one shared HTTP API, with per-operation IAM.',
    },
    body: `Adverta is a Nigeria-focused advertising and marketplace product: free listings,
paid boosts, in-app chat, a campaign builder, and an agency white-label mode.
Two clients, web and native, front all of that — and they speak to exactly one
backend.

## The monorepo is the contract

Adverta is a **Turborepo** with a web app, a native mobile app, and a **shared
HTTP API**. Keeping all three in one repo makes the API contract a first-class,
enforced boundary rather than a document that drifts. When the API changes, both
clients change against it in the same commit; there is no "the mobile app is two
versions behind the endpoint" class of bug.

## Where the product gets interesting

The monetization surface is what separates this from a classifieds clone:

- **Boosts and campaigns** need a billing-aware model — a listing's visibility is
  a paid, time-bound thing.
- **Agency white-label** needs a genuine multi-tenant story, because agencies
  resell the platform under their own brand.

## Keeping it isolated

Under the hood, a **per-operation database/service and IAM** model (the "Golden
Bite arch") keeps capabilities separated, Redis backs the fast paths, and
Prometheus supplies metrics. The shared-API discipline up top and the
per-operation isolation down below are the same instinct pointed in two
directions: one contract for clients, many small authorities for operations.`,
  },

  // ─────────────────── Mogadget — neutral → published ───────────────────
  {
    title: 'A catalog with no cart (on purpose)',
    slug: 'mogadget-catalog-without-cart',
    status: 'published',
    publishedAt: '2026-07-06T09:00:00.000Z',
    projectSlug: 'mogadget',
    excerpt:
      'Mogadget deliberately has no checkout. It hands a shopping intent to WhatsApp, because that is where the retailer actually closes.',
    tags: ['nextjs', 'mongodb', 'product', 'commerce'],
    seo: {
      metaTitle: 'A catalog with no cart (on purpose) — Mogadget',
      metaDescription:
        'Why Mogadget, a single-owner Lagos gadget catalog, ships without a cart or checkout and hands off to WhatsApp/Instagram instead.',
    },
    body: `Mogadget is a gadget catalog for a single Lagos retailer, and it ends where most
e-commerce sites begin: there is no cart and no checkout. A customer browses, then
orders over **WhatsApp or Instagram**.

## The missing feature is the feature

It's tempting to read "no cart" as unfinished. It isn't — it's a product
decision. This retailer already closes sales in chat. Bolting on a checkout would
add a payment integration, an order-state machine, and a fulfilment flow to
duplicate a conversation the owner would rather just have. So the site's only job
is to be a fast, trustworthy catalog that turns an intent into a well-framed
WhatsApp message.

## Less surface, less to break

The stack stays honest to that scope: Next.js + MongoDB + Redis, built on the
**Model → Service → Route** triad and tested with Vitest + Playwright. With no
checkout, there's no cart-abandonment edge case, no payment reconciliation, no
half-finished order to clean up. The complexity you don't ship is complexity you
never have to operate.

## The lesson

Matching software to how a business *actually* sells often means building less.
Mogadget is the small, clean proof of that: the right amount of app for the job,
and not one endpoint more.`,
  },

  // ─────────────────── Aisolver — neutral → published ───────────────────
  {
    title: 'An architecture lint that fails the build',
    slug: 'aisolver-architecture-lint',
    status: 'published',
    publishedAt: '2026-07-13T09:00:00.000Z',
    projectSlug: 'aisolver',
    excerpt:
      'Aisolver keeps its layers honest with an arch-check script that turns "please respect the boundaries" into an automated gate.',
    tags: ['typescript', 'fastify', 'monorepo', 'architecture', 'postgres'],
    seo: {
      metaTitle: 'An architecture lint that fails the build — Aisolver',
      metaDescription:
        'How Aisolver (taskwise-v2) enforces its module boundaries with an arch-check.ts lint, in a pnpm monorepo of React 19 + Fastify 5 over PostgreSQL 17.',
    },
    body: `Aisolver (package \`taskwise-v2\`) is a rebuilt task/list manager — lists, nested
tasks, groups, drag-and-drop, a calendar, alarms, a trash bin, admin, and
invite-code registration. For a "just a to-do app," it carries a surprisingly
grown-up spine.

## Boundaries you can't argue with

The centrepiece is discipline: an \`arch-check.ts\` lint that enforces the
intended module boundaries and **fails the build** when one is crossed. That's
the whole trick. "Please don't import the database from the UI layer" is a
code-review plea that erodes under deadline pressure; a script that turns the
same rule into a red CI check does not get tired, does not get talked out of it,
and does not forget.

## The shape

It's a pnpm monorepo:

- **web** — React 19 + Vite + TypeScript + Tailwind v4,
- **api** — Fastify 5 + \`node-pg\` + Zod,
- **db** — PostgreSQL 17,
- with WebSockets for live updates.

It ships real operational docs too — an \`ARCHITECTURE.md\` and a \`RUNBOOK.md\` —
so the boundaries the lint enforces are also *written down* for a human.

## Why it matters on a small project

Architecture rot doesn't wait for scale; it starts on day two of any codebase
with layers. Encoding the layering as an executable check is how a small tool
stays refactorable — the structure defends itself instead of relying on everyone
remembering the plan.`,
  },

  // ─────────────────── Fivestick — neutral → published ───────────────────
  {
    title: 'When a static site is the correct amount of engineering',
    slug: 'fivestick-static-landing',
    status: 'published',
    publishedAt: '2026-07-05T09:00:00.000Z',
    projectSlug: 'fivestick',
    excerpt:
      'Fivestick is a marketing site for an AI automation consultancy. Building it static — not as an app — is the whole design decision.',
    tags: ['nextjs', 'tailwind', 'static', 'marketing'],
    seo: {
      metaTitle: 'When a static site is the correct amount of engineering',
      metaDescription:
        'Why Fivestick, a consultancy landing site, is built as a static Next.js + Tailwind (shadcn) site rather than a heavier app.',
    },
    body: `Fivestick is the landing site for an AI automation consultancy. It is static
Next.js + TypeScript with Tailwind and shadcn/ui, and that restraint is the
interesting part.

## Match the tool to the job

A marketing page has a narrow, honest mandate: load fast, read clearly, convert.
None of that needs a database, a session, or a server round-trip. Building it
static keeps it cheap to host, trivial to cache at the edge, and quick to iterate
— and it sidesteps an entire category of runtime failure by simply not having a
runtime to fail.

## Restraint as a skill

It's easy to reach for the same heavy app shell you use everywhere. Choosing
*not* to — recognising that this problem is a document, not an application — is a
design decision worth naming. The right amount of engineering is sometimes
noticeably less than you're capable of, and knowing where that line sits is its
own kind of experience.`,
  },

  // ─────────────────── Labs — neutral → published ───────────────────
  {
    title: 'Keeping a labs corner: C++23, algorithms, and Terraform',
    slug: 'labs-cpp23-spaceship',
    status: 'published',
    publishedAt: '2026-07-04T09:00:00.000Z',
    projectSlug: 'labs',
    excerpt:
      'Not every repo is a product. The Labs cluster is where language features, DSA reps, and infra practice live — grouped honestly as one node.',
    tags: ['cpp', 'algorithms', 'terraform', 'learning'],
    seo: {
      metaTitle: 'Keeping a labs corner: C++23, algorithms, and Terraform',
      metaDescription:
        'A note on the Labs cluster — a C++23 template exercising the spaceship operator, a TypeScript DSA collection, and a Terraform local-provider sandbox.',
    },
    body: `Labs is the one node in the constellation that isn't trying to be a product. It
groups the sandbox and learning repos, and keeping it *small and visible* is the
honest move.

## What's in it

- a **C++23** project template, set up to exercise modern features like the
  three-way comparison ("spaceship") operator \`<=>\`,
- a **hello-interview** collection of data-structures-and-algorithms practice in
  TypeScript, and
- a **Terraform** sandbox built on the local provider, for infrastructure-as-code
  reps without touching a cloud bill.

## Why group them

Three tiny repos as three tiny stars would pad the map and imply more than
there is. One "Labs" node credits the work without inflating it. It's the
sharpening stone, not the blade: a modern C++ baseline to keep the language fresh,
algorithm reps to keep the fundamentals warm, and IaC practice to keep the ops
muscles from atrophying.

## The point of a labs corner

Shipping products is the visible work; staying sharp is the work that makes the
next product better. Naming a place for the second kind — and being upfront that
it's practice, not production — is just keeping the portfolio honest.`,
  },
];

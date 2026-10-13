import type { ProjectSeedInput } from '@/server/models';

/**
 * Portfolio project registry — the 20 real projects that populate the
 * domain-graph home and the case-study pages.
 *
 * Source of truth for identity/cluster/prominence: `docs/design/00-concept.md §3`.
 * Every technical claim in these case studies is grounded in read-only research
 * over each repo's real source — package manifests, schemas, contracts, route
 * tables, threat models and tests — not in the marketing brief. Where the brief
 * disagreed with the code, the code won (see the escrow "approval voting not
 * signatures" note, the ERC721-AC "delegated, not vendored" royalty note, the
 * Prechop dual-backend note, the Adverta Hono/Mongoose note, and the Fivestick
 * "static content, not static export" note). No invented versions, benchmarks,
 * dates, metrics, or capabilities; where a source is thin, the copy stays thin
 * and says so.
 *
 * `graph.weight` mirrors the registry prominence tier (3 = flagship, 2, 1).
 * `graph.cluster` mirrors `domain`. `order` sorts within a domain cluster.
 *
 * Links are intentionally OMITTED where a real, public URL is not known: the
 * inventory lists local repo folders, not verified public GitHub/live URLs. Per
 * the authoring rule, we omit rather than invent. The owner can fill `links` in
 * the admin once canonical URLs exist.
 */
export const projects: ProjectSeedInput[] = [
  // ───────────────────────────── Web3 ─────────────────────────────
  {
    title: 'Settleo',
    slug: 'settleo',
    domain: 'web3',
    summary:
      'A platform for settling peer-to-peer and over-the-counter (OTC) crypto trades where, by design, only one service is ever allowed to move money.',
    role: 'Architect & platform engineer',
    stack: [
      'TypeScript',
      'Node.js 22',
      'gRPC',
      'TigerBeetle',
      'Redis Streams',
      'MongoDB',
      'zod',
      'prom-client',
      'Next.js',
      'styled-components',
    ],
    heroText:
      'A settlement platform where exactly one service is allowed to move money.',
    longDescription: `## What it is

Settleo is a non-custodial platform for settling peer-to-peer and over-the-counter
(OTC) crypto trades — "non-custodial" meaning users keep control of their funds and
the platform never holds them. It's spread across many separate repositories (a
"polyrepo"): about eighteen small backend services plus the consumer, business and
operator apps and the Solidity escrow contracts. Every surface hangs off one rule:
**value moves in exactly one place.**

## Why it matters

When money is on the line, letting many services each touch balances is a recipe
for double-spends and books that don't add up. The hard part isn't building one
service — it's building eighteen without ever letting two of them disagree about
how much money exists. Settleo's answer is a single value authority, a
trust-nothing-by-default check on every hop, integer-only money (never floats,
which round badly), and unfinished integrations left honestly stubbed rather than
faked.

## How it works

The signature idea is the **single-writer ledger**. One service, \`settleo-ledger\`,
is the *only* thing allowed to write to the balance database; every other service
has to ask it to move money and can't reach the balances directly. It keeps books
by classic double-entry — every movement debits one account and credits another —
so the books always balance and an overdraft is impossible by construction. Money
is stored as whole integer units, never floating-point.

A trade settles as a chain of small, retry-safe steps, and the interesting
property is that no single step is trusted to be atomic across services: the
crypto leg is locked in escrow, mirrored into the ledger as a two-phase "hold,"
and on a 2-of-3 approval paid out as one all-or-nothing batch. Withdrawals are the
mirror image of trust — a risky one is *held*, not released, until a human
operator signs off in the console.

Services don't even trust the network between themselves: every internal call is
signed, and each request's one-time token is burned after use so a captured call
can't be replayed.

## Testing & honesty

Ledger rules are property-tested and integration-tested against the real
balance engine, and threat models were written before the feature code. The parts
that aren't built yet — the key-signing service, the payment processor, on-chain
balance reads — are **stubbed and fail closed** rather than faked, which the repo
states out loud instead of dressing up.`,
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
      'A tool for building generative NFT art collections, rebuilt from an older C# app into Go and Next.js — reaching feature parity while closing the original’s security holes.',
    role: 'Rewrite author (solo)',
    stack: [
      'Go 1.26',
      'chi',
      'MongoDB (v2 driver)',
      'AWS S3 / MinIO',
      'SIWE (EIP-4361)',
      'secp256k1',
      'Next.js 16',
      'React Flow',
      'Playwright',
    ],
    heroText:
      'Porting a stateful Blazor app to Go + Next.js — and fixing what was broken on the way.',
    longDescription: `## What it is

NFTMixer builds generative NFT art collections end to end: you upload layered PNG
art, describe how the layers combine and how rare each option is, generate
thousands of unique-but-weighted combinations, curate the survivors, then export
final images plus marketplace-standard metadata. It's a ground-up rewrite of an
older C#/.NET Blazor app into a Go backend and a Next.js frontend, and the design
doc records "C# functional parity reached."

## The honest part about "rewrite it in Go"

The owner wanted long-term ownership of the stack and doesn't read C#. But the old
app's UI framework (Blazor Server) has no Go equivalent, so the design doc says it
plainly: **"Roughly 70% of this rewrite is frontend work, and none of it is Go."**
The engine, image compositing and storage were the easy part; the entire
interface had to be rebuilt from scratch in TypeScript. Naming that up front is
the difference between a plan and a surprise. The migration also carried no cutover
risk by design — the old data was declared expendable and the schema starts fresh.

## Real authentication instead of believe-the-browser

The C# app trusted whatever wallet address the browser claimed, so anyone could
log in as anyone. The Go version does real **Sign-In-with-Ethereum**: the user
cryptographically signs a one-time challenge, and the server recovers the signing
address from that signature and verifies it — you can't claim an address you can't
sign for. The checks run in a fixed order so no forged field is trusted before the
signature is proven, and the one-time challenge is tied to the exact wallet it was
issued to.

## Ownership comes from the session, never the URL

No handler decides who you are by reading a wallet from the URL or request body; it
uses the *session's* wallet. And access isn't re-checked handler by handler — it's
folded into a single database query filter, so "a handler that forgot to check
cannot leak, because there is no unfiltered read to call by mistake." That closes a
real hole in the C# app, where ownership was read straight out of the URL.

## One correct generator

The C# app shipped two different "generate" buttons that produced different
collections, one of which could hang forever when the art couldn't yield enough
unique combinations. The Go rewrite folds them into a single weighted-and-unique
generator with a bounded retry that fails with a clear "not enough combinations"
error instead of spinning, and numbers the results with no gaps. Runs are
deterministic — the same seed reproduces the same collection exactly.

## Testing & honest limits

Tests sit beside nearly every source file, and storage tests run against a
throwaway database that's torn down afterward. The repo *defines* the quality
gates (format, vet, race tests, vulnerability scan) but — stated plainly — the CI
**workflow file itself is not committed** here, so these are gates as written, not
something proven to run on every push. Other limits come straight from the README:
graceful shutdown is verified on Linux but not the Windows dev host; the login
rate limiter is **per-process, so N replicas mean N× the limit**; and
refresh-token-theft revocation is only partial — the current schema catches the
same-instant double-use race but not after-the-fact theft.`,
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
      'The backend for an NFT platform, with the security-critical parts — wallet login and the presale allow-list — split into their own small services that can be audited on their own.',
    role: 'Backend engineer',
    stack: [
      'Node.js',
      'TypeScript',
      'Express 5',
      'Mongoose 9',
      'Redis (ioredis)',
      'merkletreejs',
      'ethers 6',
      'IPFS (Pinata)',
      'migrate-mongo',
      'Prometheus',
    ],
    heroText:
      'The parts that decide who can mint live in their own small, auditable services.',
    longDescription: `## What it is

GKOI is the backend for a Web3/NFT platform, deliberately split into three small
services instead of one monolith. The split follows a single question — *is this
code critical to minting?* — so everything that decides who is allowed to mint, or
who is an admin, lives in its own small service that can be audited on its own,
kept away from the large, fast-changing rest of the API.

## Wallet login without format drift

To log in, a user signs a login message with their wallet. A whole class of bugs
comes from the client and server each rebuilding that message slightly
differently. GKOI avoids it by building the message on the server, storing it, and
verifying the signature against the exact stored copy — the client signs it
verbatim and never reconstructs it. Each distinct failure returns its own reason,
so a slow or replayed login can be told apart from a wrong-key signature, and those
reasons feed an anomaly alert — the auth service watches itself.

## The Merkle whitelist — the presale gate

The presale allow-list uses a **Merkle tree**: a way to prove a wallet is on a
list without publishing the whole list. Only a single 32-byte fingerprint (the
"root") ever goes on-chain, so the list can be any size without inflating minting
cost or contract storage, and a wallet proves it belongs with a short proof the
contract can check cheaply. The service's own trick is that it caches the exact
sorted address snapshot the tree is built from, so a cached proof is byte-identical
to a fresh rebuild — and both are invalidated together on every add or remove.
Because this gate is its own service, it scales and fails independently of the core
API.

## Services that don't trust each other

The three services never rely on a shared secret or a shared database. Every
cross-service call is signed and carries a one-time token, checked against a
lopsided freshness window — generously into the past but barely into the future —
so a captured or far-future request can't be replayed. Each caller is granted
exactly the one permission it needs and nothing more.

## Testing & security posture

The services are covered by unit tests, and two of the three also have HTTP-level
tests (the whitelist service has unit coverage but no HTTP tests). The strongest
signal isn't a badge: the auth service ships its own \`SECURITY.md\` **and** a dated
\`SECURITY_AUDIT.md\` that tallies findings with file-and-line citations. The author
security-reviews his own mint-critical services and records the results — which is
exactly what splitting the trust boundaries small enough to audit was for.`,
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
      'The smart contracts behind GKOI, including an NFT collection whose royalty enforcement is handled by a swappable, creator-controlled rule rather than hard-coded into the token.',
    role: 'Smart-contract engineer',
    stack: [
      'Solidity',
      'Foundry',
      'Hardhat',
      'SeaDrop (ERC721A)',
      'ICreatorToken / ITransferValidator',
      'ERC-2981',
      'OpenZeppelin',
      'CREATE2 + EIP-1167',
    ],
    heroText:
      'Royalties that can actually be enforced on resale — through a swappable rule the creator controls, not code baked into the token.',
    longDescription: `## What it is

The on-chain half of GKOI: a set of Foundry/Solidity smart-contract repos. The
centrepiece is the NFT mint collection; around it sit a tool that creates new
collections at a predictable address, and a router that lets an approved marketplace
move tokens on a holder's behalf.

## Enforceable royalties — the accurate mechanism

NFT royalties are famously easy to dodge on secondary markets, so this collection's
approach is careful and worth stating precisely. The royalty itself is just an
on-chain *rate declaration* (the ERC-2981 standard) that a marketplace can choose
to honour. Actually *enforcing* payment is delegated to an external,
creator-controlled **validator**: on every transfer the token calls out to a
separate contract the owner points it at, which can allow or block the move.
Setting that address to zero means no enforcement at all.

So the honest framing is not "royalties are guaranteed on-chain," but "the policy
lives in a hook that *can* enforce, it travels with the token, and the creator can
swap it out." The rate is capped so a fee can't exceed 100%, and a zero-address
royalty receiver is rejected.

## Soulbound by default

A useful safety lever ships in one variant: transfers start **paused**, so
approvals and holder transfers revert until the owner explicitly turns them on.
Between mint and that flip the tokens are effectively soulbound — bound to their
owner and non-transferable. Sibling contracts cover permanently-soulbound and
randomized-reveal variants.

## Testing & security posture

Foundry unit and fuzz tests span eleven suites, including a mock validator built to
either succeed or always revert — so tests can prove the token really calls out to
the validator and that the validator can block a transfer. The security-relevant
defaults are all conservative: transfers paused by default, the royalty rate hard-
capped, validator enforcement opt-in and owner-gated, presale signatures single-use
with a five-minute deadline. One caveat is quoted straight from the router's own
code rather than hidden: a careless or malicious owner can authorise a channel that
lets approved tokens be moved.`,
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
      'Settleo’s trade escrow: a smart contract that only releases funds when two of the three parties agree — so no single party, not even the platform, can move the money alone.',
    role: 'Protocol & backend engineer',
    stack: [
      'Solidity 0.8.28',
      'Foundry',
      'OpenZeppelin v5',
      'TypeScript',
      '@noble/curves',
      'gRPC',
      'MongoDB',
      'TigerBeetle (via ledger)',
    ],
    heroText:
      'A 2-of-3 escrow where no single party — including the platform — can move funds alone.',
    longDescription: `## What it is

Settleo Escrow holds the crypto side of a peer-to-peer trade — an escrow is a
neutral holding place that only releases funds when agreed conditions are met. It
is two parts: an immutable smart contract that locks the funds, and an off-chain
service that drives the lifecycle and mirrors every settlement into Settleo's
ledger. The contract's own docstring states the thesis: **"2-of-3, never 1 … the
platform alone can never decide an outcome."**

## The mechanism, stated precisely

The "2-of-3" is **on-chain approval voting**: each of the three named parties
(buyer, seller, arbiter) calls the contract itself to cast a vote, and it settles
the instant two *distinct* parties back the same outcome. It is deliberately *not*
a multisig or an off-chain signature scheme — a subtle but honest correction to the
original brief. One party voting repeatedly can never reach the threshold.

## Why the platform can never decide alone

The platform's operator can open an escrow but **holds no vote**; moving funds
always needs two of the three party keys, and the arbiter is only a tie-breaker.
There are exactly two ways out: a 2-of-3 approval, or — so an absent or malicious
operator can never strand someone's money — a **permissionless, time-locked
auto-refund** to the seller that *anyone* can trigger once the clock runs out.
Raising a dispute freezes that clock, so a disputed escrow can only exit by a
2-of-3 ruling. Payouts follow a checks-then-transfer discipline with reentrancy
protection, and stray funds sent straight to the contract are rejected — money can
only enter through the proper deposit path.

## The off-chain half — settling through the ledger

A companion service submits the on-chain transactions and is safe to retry: before
acting it reads the chain and skips anything already done, so a duplicate delivery
never double-submits. It never moves balances itself — it settles *through* the
ledger, opening a hold on funding, committing it as one all-or-nothing payout on
release, and voiding it on refund. A separate dispute service runs arbitration
under the same 2-of-3 rule and is hardened so a caller's role is derived from a
verified identity, never claimed — one operator can't cast two votes to
self-resolve.

## Testing & honest caveats

The contract carries 46 unit, 5 fuzz and 3 invariant tests; the invariants prove
the contract stays solvent (it always holds exactly what it owes) and that finished
escrows hold nothing, and attacker mocks exercise the reentrancy and failed-payout
guards. A threat model catalogues sixteen threats, each mapped to a mitigation and
a named test. Two caveats are carried in plainly: the contract is **currently
unaudited** — mainnet is gated on a clean external report — and the secure
key-signing component for real party and operator keys is **not yet built**.`,
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
      'The original version of the NFT-art builder — a mature, feature-rich C# app whose security flaws are exactly what motivated the Go rewrite.',
    role: 'Predecessor codebase (rewritten as nftmixer-go)',
    stack: ['C#', '.NET 6', 'Blazor Server', 'EF Core 6 / PostgreSQL', 'SixLabors.ImageSharp', 'Docker'],
    heroText:
      'The app that came first — mature, feature-rich, and honestly unshippable.',
    longDescription: `## What it is

NFTMixer (.NET) is the original NFT-art builder and the predecessor the Go rewrite
replaces: a mature C#/.NET Blazor Server app over PostgreSQL, with a real feature
set — sources, assets, variants, traits, rarities, a node graph, generate, curate,
render, zip — and around 40 database migrations spanning 2022–2026. It's kept as a
read-only reference because the interesting story is the *delta* between a
mature-but-unshippable app and its disciplined rewrite.

## Why a rewrite, not a patch

Two things made it a rewrite. First, the UI framework (Blazor Server) has no Go
equivalent, so the entire interactive surface had to be rebuilt regardless of how
clean the engine port was — the honest reason the rewrite was ~70% frontend.
Second, the app stored everything to local disk on a volume that "must never be
lost," which is exactly what blocked safe containerization and drove the Go app's
stateless design.

## The honest defects that motivated it

All are real and citable, and each maps to a specific fix in the Go version:

- **Authentication that doesn't authenticate.** The server trusted whatever wallet
  address the browser named — no signature challenge anywhere — so anyone could log
  in as anyone, including an admin.
- **An unauthenticated database-dump endpoint** that streamed back the full data
  dump with no authorization check at all.
- **Ownership taken from the URL** — a download endpoint built its path straight
  from the URL with no membership check, so anyone could download anyone's output.
- **Sessions that never expire** — tokens lived in an in-memory map whose cleanup
  method was literally empty.
- **A committed live API key and secret**, hardcoded and committed to git; the
  values are treated as burned and never carried forward.
- **Unfinished IPFS publishing** that returned before uploading, so it never
  actually worked.

## The two-generators problem

The clearest sign a rewrite was the right call: the app shipped a "Process Paths"
button *and* a "Process Paths (Accurate)" button that produced *different*
collections — and the "accurate" one could hang forever when the art couldn't
produce enough unique combinations, and left gaps in the numbering. The Go rewrite
folds both into one correct generator.

## Why keep it in the constellation

It was not a toy — ~40 migrations, real generation, rarity tiers, rendered output.
That maturity is the point: the story worth telling isn't "an app was rewritten"
but "a working, feature-complete product had foundations that could not be kept,"
and what a disciplined rewrite does with that inheritance.`,
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
      'The GKOI web apps — an admin dashboard, the public mint site, and an NFT gallery — that turn blockchain operations into an interface a person can actually drive.',
    role: 'Frontend engineer',
    stack: ['Next.js 16', 'React 19', 'TypeScript', 'Privy + wagmi + viem', 'TanStack Query / SWR', 'Tailwind v4', 'Playwright'],
    heroText: 'Turning chain operations into an admin a human can actually drive.',
    longDescription: `## What it is

The user-facing side of GKOI: three Next.js apps — an operator dashboard, the
public mint site, and an NFT gallery — on a modern wallet stack. None of them owns
any data; they fetch everything from the platform services, and the server
re-checks every action, so the frontends are just projections.

## The design move that makes chain ops legible

The admin's core idea is counter-intuitive: for almost every privileged task, the
operator does **not** sign a raw blockchain transaction. Instead the action is a
clearly-labeled button that posts to a backend the operator is already logged into,
and the chain and indexing work happens server-side. Each action shows a live
loading-then-result toast and surfaces the server's own error message verbatim, so
the operator can add, reindex or remove an NFT collection without ever reasoning
about transaction data or gas. The login token is kept in an HttpOnly cookie, never
in JavaScript-readable storage — so a script on the page can't steal it.

## The one genuine chain write

There is exactly **one** real direct chain write in the whole admin — a token
redeem/claim that goes through the operator's own connected wallet, never a
server-held key. It's the deliberate exception that proves the rule that every
other privileged action is delegated to the authenticated backend. Contract state
that only needs *reading* is surfaced as plain dashboard values, no transaction
required.

## Testing & honest note

The admin ships end-to-end Playwright tests over the operator routes, and all three
apps run the same lint and type-check gates. One thing is stated plainly rather
than implied: on the public mint site the actual on-chain buy path is currently
**commented out behind a "SOLD OUT" state**, left in place so the presale can be
re-enabled without rebuilding it. So a live mint flow is *not* claimed as active
here — what ships today is the eligibility read, the claim plumbing, and a SOLD-OUT
UI.`,
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
      'A cross-device security agent that actively protects computers and phones, acting only on protection orders that are cryptographically signed and verified first.',
    role: 'Solo engineer',
    stack: [
      'Go 1.26',
      'go.work workspace',
      'Wails',
      'Windows WFP',
      'ETW',
      'DPAPI',
      'Ed25519 directives',
      'Named-pipe IPC',
    ],
    heroText:
      'Active device protection built around one rule: verify the signature before doing anything.',
    longDescription: `## What it is

Sentova is cross-device active protection: desktop and mobile apps backed by a
single Go service. Five detection modules run per device — network filtering,
scanning for known indicators of compromise, device-hardening (posture) scoring,
behaviour monitoring, and ransomware defence — and a server engine turns their
signals into one of three verdicts: protected, at-risk, or compromised.

Honesty is a stated product requirement. It does **not** claim to stop every
attack, and a per-platform tracker is the single source of truth for what actually
works today. In this build, **only the Windows desktop ships real, tested
enforcement across all five modules**; every other platform is a specified seam or
a roadmap item, and the mobile app renders that truthfully in its capability panel.

## One shared core, so the two sides can't drift

The repo is a single Go workspace where a \`core\` package is compiled into **both**
the server that *signs* protection orders and the agent that *verifies* them.
Because it's the exact same code on both sides, the wire and signature formats are
byte-for-byte identical and cannot silently drift apart.

## Signature before everything

An agent that can kill processes and quarantine files is a loaded weapon pointed at
the machine it protects, so the path from "a decision was made" to "the privileged
code acts" is the most safety-critical thing in the product. It's a sequence of
fail-closed gates. The connecting caller's identity is checked once at connect time
(closing a class of process-identity races), and mutating operations additionally
require a trusted integrity level.

Then, before an order is acted on, its signature is verified **first** — in a fixed
order, so no forged field is ever consulted before the signature is proven: check
the device binding, resolve the pinned signing key, verify the Ed25519 signature,
and *only then* check expiry and the allowed-action list. Checking expiry *after*
the signature means a forged expiry date can't help an attacker. Every verified
order runs through one shared enforcer bounded by an at-most-once replay guard, so
the same order can't be executed twice by choosing a different entry path, and a
re-seen order is rejected as a replay.

## Privilege separation

The desktop agent is two processes with a hard boundary. The UI app holds **no
privilege** — it can request, never enforce. A separate service runs as SYSTEM,
exposes **no network listener**, and is the only thing that can terminate or
quarantine. They talk over a local named pipe, and that privileged component's only
third-party dependencies are the pipe library and the OS bindings — a deliberately
tiny trusted surface for the piece that holds all the power. Every OS operation is
designed around an attack it must survive; the process killer, for instance,
re-confirms a process's identity right before acting, to close the window where an
old process ID gets reused.

## Local-first ransomware response

Ransomware defence responds **without a server round trip**: canary files plus
mass-encryption heuristics trip a local response that kills the attributed process
and quarantines the touched file. If the triggering event carries no process id, it
still quarantines the file and just skips the kill. And every "what Sentova did"
message reflects what *actually* happened — enforced by a grep over shipped strings
that bans a fixed success sentence, so the product can't claim an action it didn't
take.

## Testing & honest limits

The decision logic, IPC, verification, replay guard and scanning are all covered by
Go unit tests using fake OS ports, so they run anywhere. The split is stated as
plainly as the repo's own tracker states it: the **live** system-mutating execution
— real network filtering, the OS telemetry feed, the actual process-kill primitive
— is elevation-gated and was **not executed on this non-elevated build**. What
*was* exercised without elevation: the authenticated named-pipe round-trip
including an integrity-gated mutating operation, and the at-rest encryption
round-trip. A kernel-level or SYSTEM-equal attacker is explicitly out of scope for
this phase.`,
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
      'An anti-spyware service that checks a phone’s forensic data against a feed of known spyware fingerprints, using a fast database lookup instead of scanning every rule.',
    role: 'Solo engineer',
    stack: [
      'Go 1.26',
      'MongoDB',
      'Redis',
      'STIX 2.1',
      'AES-256-GCM field crypto',
      'HMAC S2S',
      'Next.js frontends',
    ],
    heroText:
      'Matching known-spyware fingerprints with a fast index lookup, not a slow scan.',
    longDescription: `## What it is

Sentova MTD (Mobile Threat Defense) is an anti-spyware service inside the larger
Sentova platform. It does server-side forensic analysis: you upload a phone's
diagnostic data — an iOS sysdiagnose or an Android bug report — and it checks that
data against a feed of known spyware fingerprints (IOCs, "indicators of
compromise") and returns a clear verdict. It owns its own isolated database and
follows the platform's established conventions.

## The core idea: index seek, not pattern parse

Threat-intel fingerprints ship as STIX patterns — a little grammar, not a lookup
key. Matching thousands of raw patterns against every observed value would be slow
and would get slower as the feed grows. So at ingest, MTD does the parsing *once*:
it lifts every concrete "this kind of thing equals this value" comparison out of
each pattern into a plain, indexed list. Matching then becomes a fast lookup on an
index rather than re-parsing patterns on every request. One mapping is deliberately
left incomplete — where the phone side can't supply a comparable value, mapping it
would risk silently reading a real infection as clean.

## Two-phase match, and the bug it avoids

The match runs in two phases, and its correctness turns on a subtle trap. First a
single database query pre-filters candidates by *value only*. Then an in-memory
step confirms an exact (value, kind) pairing. The tempting shortcut — asking the
database to match both value and kind at once — is quietly wrong on this kind of
index: it can match the value in one list entry and the kind in a *different* one, a
silent false positive. So the exact pairing is confirmed in memory, not in the
query. Feed updates are written as a new version and the "active" pointer is bumped
in one step, so a half-written feed is never matched.

## Privacy and tenancy, by construction

The people this protects may be under state-level threat, so isolation and erasure
are structural rules, not afterthoughts. Every record carries an account id and
every query filters on it; a tenant sees its own private indicators plus the shared
curated set, never another tenant's data. Identity comes **only from the verified
service-to-service context, never from a request body**, so body-tampering is
structurally impossible. Sensitive forensic fields — device identifiers, extracted
records, the raw artifact, matched values — are encrypted at the field level and
never indexed, while the threat *names* stay readable so they can be shown without
revealing device contents. Retention is first-class: per-document expiry indexes
auto-delete artifacts and verdicts, and a scoped delete covers erasure requests.

## Testing & honest scope

Unit tests cover the encryption, matching, STIX parsing, verdicts and feed
handling, driven by an offline fixture so they need no network, and re-ingesting the
same feed is idempotent. Two honest notes: the fast-lookup behaviour is a
*structural* property of the index, but there's no mechanical test that asserts the
query plan; and the platform's standing security review is scoped to an older set of
services and does **not** cover MTD — though the conventions MTD inherits (tenant
isolation, the verified trust boundary, default-deny access, typed queries, field
encryption) are the reviewed-good platform baseline.`,
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
      'A property and rental management app for landlords — and the reusable backend blueprint, with a real permissions engine, that several of the owner’s other business apps are built from.',
    role: 'Solo engineer',
    stack: [
      'Next.js 16',
      'TypeScript',
      'Mongoose 9',
      'Redis (ioredis)',
      'AWS S3 + sharp',
      'AWS-IAM-style policy engine',
      'Vitest',
      'Playwright',
    ],
    heroText:
      'The reusable backend blueprint behind a family of business apps.',
    longDescription: `## What it is

Managerenta is a multi-tenant property and rental management app for landlords —
"multi-tenant" meaning one deployment serves many separate customers whose data
never crosses. But its more durable output is a **reference architecture**: a clean
backend skeleton the owner's other business apps (Chekka, Mogadget, Golden Bite) are
cloned from. Get the skeleton right once, and every new product spends its effort on
the actual problem instead of re-litigating how a request becomes a database write.

## The Model → Service → Route triad

All server code is server-only — database handles, storage clients and secrets can
never leak into the browser bundle — and it's split into three layers, each with
exactly one job:

- **Model** owns the database schema and data access, with cross-cutting rules like
  soft-delete and signed image URLs pushed *into* the schema so every read inherits
  them for free.
- **Service** orchestrates: it combines models, cache and file storage, and owns
  the caching (read-through, short TTL) and the business rules.
- **Route** is thin by construction: authorize, validate the input, call the
  service, shape the response — nothing else.

A single wrapper composes the cross-cutting concerns in a deliberate order — the
cheap CSRF check runs *before* the rate limiter, so a rejected request never spends
a rate-limit token — then database readiness, the handler, and metrics that always
fire.

## Access control: deny-wins, not roles

Authorization is a real AWS-IAM-style policy engine, not role checks scattered
through the code. Its core decision function is pure — no database, no clock reads —
so it's deterministic and exhaustively testable, and it follows AWS's rules exactly:
deny by default, an explicit **Deny always wins**, and allow only on an explicit
matching Allow. Above that sits a hard tenant-isolation floor checked *before* any
policy — so even a wildcard "allow everything" policy can never reach another
customer's data. Personal users and organization members run through the *same*
evaluation path, so there's no special-case branch to get wrong. This engine
replaced ad-hoc role checks after an audit found org-admins could remove the owner.

## Testing & security posture

93 unit-test files mirror the server tree (each run drops the throwaway databases it
created), and 16 Playwright specs drive auth, 2FA, passkeys, properties, tenants,
organizations, the admin console and more. The receipts are a real three-pass
\`SECURITY_REVIEW.md\` with around 40 findings. The standout is honest: **2FA was
never actually enforced on login — the toggle was decorative** — found by audit and
fixed with a proper two-step flow. Others: a regex-injection in a user lookup,
stored-XSS via SVG upload, and an unauthenticated metrics endpoint in production.`,
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
      'A Nigerian platform for booking a professional car inspection before you buy — with tamper-proof, locked reports and a live inspection feed.',
    role: 'Solo engineer',
    stack: [
      'Next.js 16',
      'TypeScript',
      'Mongoose 9',
      'Redis (cache + pub/sub)',
      'AWS S3',
      'Zod',
      '@react-pdf/renderer',
      'Playwright',
    ],
    heroText: 'Book a professional car inspection before you buy the car.',
    longDescription: `## What it is

Chekka ("before you buy — Chekka") is a Nigerian car-inspection platform. A buyer
books an inspection; a professional inspector checks the vehicle and files a
structured report; the buyer gets a report they can trust before handing over
money. Five roles — buyer, inspector, consultant, manager, admin — live in one user
collection.

## Built on the reference architecture

Chekka is explicitly built on the same conventions as Managerenta — the same
server-only layering, the same route wrapper, the same model conventions. The
infrastructure is deliberately unsurprising so the whole surprise budget can go to
the domain instead.

## Report integrity is the product

A report a buyer paid to trust must be immutable once filed, and its numbers must be
the server's, not the client's. On submit, Chekka **recomputes the pass / minor /
serious summary counts** itself from the checklist items and refuses to touch a
report that's already locked. Locking also fires a live "report filed" event to the
admin channel and the buyer's "report ready" notification.

Sharing a finished report is a **read-only, self-expiring link**: an unguessable
token maps to the inspection for seven days, so the link grants unauthenticated read
access to *one* report and the inspection's real id never appears in the URL. A live
inspection feed streams the inspector's progress to the buyer and admin in real
time, and report PDFs are generated on the server.

## Testing & honest notes

15 Playwright specs cover auth-gating, booking, the inspection flow, photo upload,
the report UI, the live feed, share links and the admin queue. Unit coverage is
thinner than Managerenta's — **there's no unit-test runner configured here** — so
the safety story leans on the inherited spine: the shared handler (rate-limit +
CSRF), refresh-rotating auth, validation on every request body, and report-lock
immutability. One honest correction to the internal brief: its driving spec is
**4,728 words**, not the "37k" the brief claimed — a dense, well-structured
document, not an inflated one.`,
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
      'A premium treats and catering business in Abuja, delivered as three apps in one — a storefront, an operations dashboard, and a kitchen/delivery staff app.',
    role: 'Solo engineer',
    stack: [
      'Next.js 16',
      'TypeScript',
      'Mongoose 9',
      'ioredis',
      'Zod',
      'SWR + axios',
      'Prometheus',
      'Playwright',
    ],
    heroText:
      'Storefront, back-office, and staff app in one — each action its own narrow slice of authority.',
    longDescription: `## What it is

Golden Bite is a premium treats, platters and event-catering business in Abuja,
built as **three surfaces in one app**: a customer storefront, an operations/admin
dashboard, and a staff app for the kitchen and delivery. It's also the **origin of
the "per-operation" architecture** that the Adverta project later clones.

## One operation, one gate, one audit line

The name is literal: the backend is organised as **one file per operation**. Each
write is independently role-gated *and* audited, so the shape is always the same —
one operation → one service call → one role check → one audit entry. There are five
roles (customer, kitchen, delivery, manager, owner). The edge middleware only does a
cheap cookie-presence redirect and is explicitly **not a security boundary** — the
real role check is re-done inside every handler, where it counts.

## The cross-cutting spine

Every route runs through one wrapper with a fixed order of work: a Redis rate limit,
the handler, error handling into a consistent response shape, and metrics that
*always* fire. Reads are cache-first per operation with a short TTL. The Redis
connection runs a boot-time ping that **throws loudly rather than silently falling
back to memory**, so a misconfigured cache fails fast instead of pretending to work,
and the admin and user audit streams fire in a \`finally\` block so they survive an
error.

## Testing & honest flags

Coverage here is **Playwright end-to-end only** — auth, admin pages, the order
lifecycle, session persistence — run serially against a hermetic setup with no real
cloud credentials. Two honest flags are carried into the case study: there is **no
unit-test runner** (automated coverage is end-to-end plus type-checking only), and
the metrics endpoint plus a couple of dev-only helper routes are **unauthenticated**
and should be disabled or protected in production. Auth is signed httpOnly session
cookies with hashed passwords and time-limited one-time-password and reset flows.`,
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
      'A Nigerian campus food pre-order marketplace: vendors post dated menus with a cutoff time, and students reserve and pay upfront before the kitchen cooks.',
    role: 'Solo engineer',
    stack: [
      'Next.js 16',
      'TypeScript',
      'MongoDB / Mongoose 9',
      'Redis (ioredis)',
      'Paystack',
      'cron',
      'Vitest',
      'Playwright',
      'Fastify 5 + Prisma 7 + BullMQ (standalone API)',
    ],
    heroText: 'Inventory that expires — order campus food before the kitchen cooks.',
    longDescription: `## What it is

Prechop is a Nigerian campus food **pre-order** marketplace: vendors publish dated
daily menus with a **cutoff time**, and students reserve and pay **upfront** before
the kitchen cooks. The tagline — "order before they cook" — turns an ordinary catalog
into a scheduling problem: **inventory that expires.**

## Two backends, honestly

The repo carries **two backends**, and the one actually shipped is the Next.js +
MongoDB app — not the standalone Fastify + PostgreSQL/Prisma twin that also lives in
the repo. Both implement the same domain, so this case study draws the cleanest data
model from the Prisma twin and the *shipped* scheduling mechanics from the live app,
without pretending Postgres is the live store.

## Cutoff enforcement — the interesting part

Enforcement is layered. A **read-time guard** runs on every order attempt — a
"coming soon" check for a listing that isn't open yet, and a hard "cutoff has passed"
check — so no scheduling race can let a late order slip through. On top of that, a
scheduled job auto-closes each listing at its cutoff: the shipped app runs a
per-minute sweep where each job is wrapped in a Redis lock, so under horizontal
scaling only one instance does the work per tick. Several jobs pass the platform
timezone (Lagos) as a load-bearing argument — schedule in the server's local time on
a UTC host and the nightly reset fires at the wrong hour, leaving sold-out items dark
through the first trading hour.

Closing a listing isn't the same as "stop new orders." A separate job **auto-cancels
and refunds** every paid-but-unconfirmed order a vendor took money for and never
committed to cook. And the 30-minutes-before warning would fire dozens of texts from
a per-minute sweep, so it's deduped with a per-listing lock whose expiry *is* the
reset — and if that lock can't be taken (Redis down) it sends *no* warning rather
than a duplicate, the safe direction for a message that costs money to send.

## Money and oversell safety

Order placement is **server-authoritative**: the client sends only ids, and the
server prices the items and add-ons itself (rejecting an add-on that doesn't belong
to the item), computes the total, and **starts the payment before writing anything to
the database** — on failure it releases its slot reservations and stores nothing. The
payment webhook verifies its signature on the raw body with a constant-time compare
*before* doing anything, handles only a successful charge, checks it hasn't already
been processed, and confirms the paid amount matches the record. Limited-quantity
items are guarded by atomic Redis reservations that roll back cleanly when two orders
race.

## Testing & honest posture

Unit tests run against a **per-worker throwaway database** whose setup mints a unique
name and guarantees it's dropped even when a worker crashes — never the dev database.
The end-to-end config is instructive: it defaults to an obscure port and *refuses* to
reuse an already-running server after a real incident where the suite silently ran
against another app on a shared port, and it boots in production mode so the prod
startup guard is actually exercised. Security: server-authoritative pricing,
idempotency keys, encrypted vendor bank details, and a health check that only reports
healthy when both the database and Redis answer.`,
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
      'A Nigerian advertising marketplace where businesses list free and pay to boost — one shared API serving both a web app and a phone app, with paid campaigns and per-request permissions.',
    role: 'Solo engineer',
    stack: [
      'Turborepo',
      'Hono 4',
      'Next.js 16',
      'Expo / React Native',
      'TypeScript',
      'MongoDB / Mongoose 8',
      'Redis (ioredis)',
      'zod contracts',
      'Prometheus',
      'Paystack',
    ],
    heroText:
      'One shared, typed API contract behind both web and native.',
    longDescription: `## What it is

Adverta is "Nigeria's business advertising platform — list free, boost from
₦500/day, chat with buyers in-app": a self-serve marketplace, campaign builder,
advertiser dashboard, agency white-label, and trust-&-safety tooling, delivered as
**three apps over one shared API** (a web app, a phone app, and the API itself).

An honest correction to the internal brief: the backend is Hono + MongoDB, *not*
Fastify/Prisma, and "per-operation" means the code structure plus
application-level permissions — **not** separate database credentials.

## The shared, typed API contract

Neither the web app nor the phone app talks to the database directly — both call the
one API over HTTP, sharing the *same* typed request/response schemas. Because those
schemas are a single shared package with no build step, a contract change breaks the
*compile* of both apps in the same commit rather than surfacing as a runtime
surprise — there's simply no "the mobile app is two versions behind the endpoint"
class of bug. The phone app also collapses a burst of expired-login retries into a
single refresh, so its one-time refresh token is spent exactly once.

## Billing-aware campaigns and money safety

A campaign models visibility as a paid, time-bound thing: a format, a budget, spend,
targeting, and metrics. The load-bearing move is an **atomic budget draw** — spend
and a lead are booked only while the new total stays within budget, enforced inside
the database update itself so a check-then-book can't race into an overspend.
Attribution is derived server-side and **ignores any campaign id the client sends**;
billing fires only on a trusted path and totals are always recomputed, never
trusted. The payment webhook verifies its signature first, moves the ledger only on a
successful charge with an exact amount match, and is idempotent by unique charge
references.

## Agency white-label and per-request permissions

The multi-tenant agency layer takes the agency id **from the session, never the
request**, and holding a feature permission is never enough to reach another
tenant's data. Permissions themselves are AWS-flavoured with **no role layer** — a
flat catalog of \`resource:action\` grants where an explicit **Deny always wins** —
and a user's effective set is **re-resolved from the database on every request**
(briefly cached). So an admin's revocation or account deactivation bites within
seconds, not at next sign-in.

## Redis, metrics & testing posture

Redis is a single connection that pings on boot and fails loud, and read caches never
store empty results. Unit tests target a throwaway database whose setup **refuses any
database not prefixed \`adverta_vitest\`**, end-to-end tests cover the flows, and CI
type-checks, lints, and builds both Docker images (asserting non-root images with no
baked-in secrets). A production startup guard exits before serving if the signing
secret is missing or too short, and delivery credentials fail closed with an error
rather than lie.`,
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
      'A single-owner Lagos gadget catalog with no cart or checkout — you browse, then tap through to a prefilled WhatsApp or Instagram chat to order.',
    role: 'Solo engineer',
    stack: ['Next.js 16', 'TypeScript', 'MongoDB / Mongoose 9', 'Redis', 'Zod', 'pino', 'Vitest', 'Playwright'],
    heroText: 'A catalog that hands off to WhatsApp instead of a checkout.',
    longDescription: `## What it is

Mogadget is a single-owner gadget catalog for a Lagos store. Visitors browse and
filter, then order by tapping **"Chat on WhatsApp"** or **"DM on Instagram"** —
there is deliberately **no cart, no checkout, no online payment, and no customer
accounts**. The order flow *is* the hand-off: the chat link comes prefilled with the
exact product and price, so negotiation and payment happen in-chat, off-platform.

## Two product shapes, enforced

The interesting modelling is that a brand-new item and a pre-owned unit are genuinely
different kinds of record — a used unit has a cosmetic grade and is a one-of-a-kind
item that becomes "sold," while a new item is restockable and tracks a quantity. A
single invariant check rejects any mixture of the two on every write, so the data
can't drift into an inconsistent state. A companion rule auto-hides a restockable
listing the moment its quantity hits zero — but restocking never auto-unhides it, so
re-listing stays a deliberate choice.

## Analytics without a cron and without PII

Click tracking must never block the sale, so the browser fires the event **before**
navigating away (with a keepalive fallback), wrapped so a failure is swallowed —
"analytics are best-effort; never interrupt the sale." On the server, the click is an
atomic counter bump plus a best-effort append to an event log whose failure is logged
but never fails the click. That log stores **no personal data** and auto-expires
after 180 days via a database time-to-live index — no cron job to run or forget.

## An honest tension

The product doc argued for a single admin login and no permission framework — but the
shipped app actually carries a full permissions stack plus passkeys and 2FA. Rather
than pretend the plan never changed, the doc flags the pivot as a "historical note."
The public click endpoint stays unauthenticated by design — but it carries no
personal data.

## Testing & tooling

39 unit-test files sit right beside their subjects — the domain rules, the product
service, and the client API wrappers all have adjacent tests — giving strong
discipline over the invariants and the hand-off. Playwright covers the public
catalog, the admin, admin analytics, and settings.`,
    graph: { cluster: 'commerce', weight: 1 },
    order: 6,
    featured: true,
    relatedPostSlugs: ['mogadget-catalog-without-cart'],
  },
  {
    title: 'Humanz',
    slug: 'humanz',
    domain: 'commerce',
    summary:
      'The HR half of an Exedos two-product pair — it owns the employee record (identity, employment, pay reckoning) while its sister app Squaddy owns the shift floor.',
    role: 'Backend engineer — Exedos',
    stack: [
      'TypeScript',
      'Node.js 24',
      'Fastify 5',
      'React 19',
      'Vite 6',
      'PostgreSQL 17',
      'Redis 7',
      'Zod',
      'Vitest',
    ],
    heroText:
      'A machine credential passes a step-up check by construction — so the gate fences it off entirely.',
    longDescription: `## What it is

Humanz is the HR platform in a two-product pair built at Exedos. It owns the
*employee* — identity, employment, contract, role, department, documents,
compensation, joining and leaving — while its sister app Squaddy owns the shift
floor. It is a React 19 + Fastify 5 app over PostgreSQL; in this round only
administrators sign in, each behind a password and a mandatory authenticator
second factor. It is company work built by a small team, not a solo project.

## Authorization decided by the method and the URL

An API key's grant is a noun-by-verb matrix: a map of five data domains
(\`employees\`, \`organisation\`, \`access\`, \`audit\`, \`contact\`) to read-only or
read-write. Enforcement is structural — *the path is the domain*. The first URL
segment after \`/api/admin/\` selects the domain, and read-only versus read-write
is decided purely from the HTTP method before any request body is read, so no
per-route flag can be forgotten. It fails closed: an unmapped segment resolves to
nothing, which no grant includes, so it is refused until someone classifies it,
and a damaged grant blob grants *less*, never more.

The counter-intuitive part is the fence. An API key is not a human with an
authenticator, so it *passes every step-up check by construction*. Rather than
leave sensitive surfaces behind a second factor a key can't actually present, the
surfaces that mint credentials, touch pay rates, run destructive bulk operations,
or resurrect deleted records are closed to keys entirely. The thing that makes a
key convenient is exactly why it has to be fenced off.

## Pay reckoned on read

A leave balance is stored nowhere: it is computed on every read from the
company's default entitlement, pro-rated to the nearest half-day by the person's
share of full-time (or an override), plus an append-only adjustments ledger. Pay
rates are a three-rung inheritance ladder — company, then site, then person — in
whole integer cents, with dated entries where each rung inherits the one above,
and dated overtime and public-holiday multipliers fall through the same way.

## One restorable Bin

Everything deleted from any registry falls into a single Bin and restores at its
*original* id. A \`kind\`-to-handler registry maps eleven trash kinds (employee,
location, department, role, public holiday, rate entry and more) to typed capture
and restore handlers — with a hard rule that handlers must not import the
registry, to avoid an ES-module boot cycle.

## Testing & honest limits

209 Vitest files (101 server, ~108 SPA) sit beside the code, and the lint gate
runs eight custom static checkers with their own self-tests. The authenticator
second factor is a dependency-free RFC 6238 implementation that compares in
constant time and burns each step once. The honest flags come straight from the
repo: **nothing is deployed anywhere yet**; the employee-facing portal and the
time-off request-and-approval flow aren't built (the calendar and ledger they
would draw on are); and the Squaddy↔Humanz link is specified but unfinished.
Links are omitted because the repository is private.`,
    graph: { cluster: 'commerce', weight: 1 },
    order: 7,
    featured: true,
    relatedPostSlugs: ['humanz-api-key-step-up'],
  },
  {
    title: 'Squaddy',
    slug: 'squaddy',
    domain: 'commerce',
    summary:
      'The mobile-first employee self-service and shift portal in the Exedos pair — week schedule, clock in/out, timesheets, and time-off / swap / correction requests with scoped approvals.',
    role: 'Backend & platform engineer — Exedos',
    stack: [
      'TypeScript',
      'Fastify 5',
      'React 19',
      'Vite 6',
      'PostgreSQL 17',
      'Expo / React Native',
      'web-push',
      'Zod',
      'Vitest',
    ],
    heroText:
      'One decision core, so two racing approvers can never double someone’s pay.',
    longDescription: `## What it is

Squaddy (internally "Grabngo Collaborators") is the mobile-first employee
self-service and shift portal in the Exedos two-product pair. It carries the week
schedule, clock in/out and timesheets, and the time-off / shift-edit / swap /
timesheet-correction requests with scoped approvals, over its own PostgreSQL. It
was built by a two-engineer team and extracted from an earlier monorepo with its
git history preserved.

## One decision core

Every path that turns a pending request into a decision — the approver routes and
the admin panel both — funnels through one module, collapsed into one place after
an audit flagged the same payroll choreography drifting across two idioms. Its
single invariant: the \`pending\` → \`applied\`/\`denied\` compare-and-swap is the
*first* statement inside the same transaction as the decision's writes. So of two
deciders racing the same request, the loser's effects roll back together with its
lost compare-and-swap — an add-only timesheet correction can't apply twice and
double someone's hours. The core holds no authorization by design; authority is
settled at the route before the core ever runs.

## The path is the domain

Machine access uses the same fail-closed scoping as its sister app: an API key's
grant maps each data domain to read-only or read-write, enforced structurally off
the HTTP method. A new surface added without a registry row resolves to nothing —
which no grant includes — so it is refused to every scoped key until someone
classifies it.

## Standalone by construction

Squaddy runs with no warehouse client and no shared service key, on its own
database, and the browser app talks same-origin only. There are no \`VITE_\` build
arguments, so one image deploys to any environment, and the build commit is baked
into the image's last layer and reported by \`/healthz\` — a deploy check asks the
running server what it is, rather than inferring it from a bundle name. The repo
corrects its own earlier copy honestly: "no outbound HTTP of any kind" stopped
being literally true once web push existed, so the real posture is a small,
explicitly-ruled egress allowlist (an SMTP relay, AWS SMS, instance credentials,
the per-company Humanz origin, and the web-push services).

## Testing & honest limits

Hundreds of Vitest and Jest files cover the server, web, mobile and dashboard
apps; the PostgreSQL harness *fails rather than skips* when no database is
reachable, building a per-run template database and cloning it for each test
file. The honest caveats are the repo's own: dev CI runs lint only, so the test
suites aren't a merge gate and a red test can reach the dev branch; the suites
run on a dedicated box capped at two workers under a lock, after an uncapped
parallel run rebooted the machine; and sign-in deliberately resolves exactly one
employee record or refuses, a tradeoff that keeps no verification stamp. Links
are omitted because the repository is private.`,
    graph: { cluster: 'commerce', weight: 1 },
    order: 8,
    featured: true,
    relatedPostSlugs: ['squaddy-decision-core'],
  },
  {
    title: 'AiSolver CRM',
    slug: 'aisolver-crm',
    domain: 'commerce',
    summary:
      'A multi-tenant B2B sales CRM whose standout is a lawful-basis-documented enrichment pipeline — an open-web crawler that takes only what a well-behaved bot may and records where every fact came from.',
    role: 'Solo engineer',
    stack: [
      'TypeScript',
      'Node.js 24',
      'Fastify 5',
      'PostgreSQL 17 (raw pg, no ORM)',
      'React 19',
      'Vite 6',
      'BullMQ + Redis',
      'MinIO (S3)',
      'zod',
      'Vitest',
    ],
    heroText:
      'A CRM whose enrichment crawler takes only what a well-behaved bot may — and records where every fact came from.',
    longDescription: `## What it is

AiSolver CRM is a multi-tenant B2B sales CRM: accounts, contacts, leads,
opportunities with line items, products, activities, notes and attachments,
custom fields, automation rules, saved reports, an audit trail, CSV import, and
search. It is a pnpm monorepo of three parts — a Fastify 5 API, a React 19 +
Vite web app that uses an in-house component kit and a roughly thirty-line custom
router rather than a UI framework, and a shared package of zod schemas that
carries no React, DOM or Node so both sides compile against one contract.

## Tenancy is the security boundary

Every tenant-owned table carries a \`tenant_id\`, and the one function that reads it,
\`currentTenantId(req)\`, takes it from the authenticated request and *never* from a
client-supplied field — a route that read a tenant id from the body or query string
would be an isolation hole, so the convention is stated that bluntly in the code.
A dedicated isolation test earns it: org A seeds one row of every object, then org
B probes each id (expects 404) and every list and report (expects none of A's
rows). Email is unique per tenant, case-insensitively, so two tenants can each have
\`alice@acme.com\`.

## One query path, no ORM

Every query goes through a single raw \`pg\` pool and a \`sql\` tagged-template helper;
nothing imports \`pg\` directly. The session is pinned to UTC and three libpq
timeouts (connect, statement, idle-in-transaction) are set as startup parameters,
so one hung statement cannot pin a connection forever.

## The enrichment crawler — the distinctive part

A BullMQ worker enriches leads from the open web, and the crawler is deliberately
polite. It is public-GET only behind an SSRF guard that resolves each target and
rejects private, loopback and link-local addresses (IPv4 and IPv6) *before* any
fetch; it reads and honours \`robots.txt\` including \`crawl-delay\`, rate-limits per
domain, identifies itself with a declared bot user-agent, caps a page at 2 MiB, and
bounds redirects. There is no headless browser, no cookies or login, and no
anti-bot evasion; gated platforms like LinkedIn or X are reached only through a
public OpenGraph card or a licensed provider. Paid providers (Brave, Tavily, PDL,
Apollo) stay dormant until their key is set — a request for an unconfigured one
returns \`400 provider_not_configured\`.

Provenance is first-class: every discovered record writes an \`enrichment_sources\`
row (provider, \`source_url\`, \`fetched_at\`) and stores the untouched fetched page in
object storage, while the lead itself carries only the merged business fields and
no raw payload — so every fact can be traced to where it came from.

## Lawful basis and erasure

The feature processes business-contact data only, on a stated legitimate-interest
basis (GDPR Article 6(1)(f)) with a CCPA notice-at-collection, and does not build
consumer profiles or touch special-category data. Erasure is a real endpoint:
\`DELETE /api/leads/:id/enrichment\` hard-deletes that lead's provenance rows and
writes an audit entry recording how many were removed; a full right-to-erasure
response pairs it with deleting the lead.

## Testing & honest notes

Vitest runs against a throwaway per-run Postgres database — a unique name minted per
run, never the app database, migrated fresh, and dropped in a \`finally\` so a crash
still cleans up — driving the real Fastify app through \`app.inject()\`. Tenant
isolation, auth, CRUD, imports, reports and automation are covered. Two honest
flags: the repo still labels itself "Stage 0 foundation" in its manifest though the
full object model and the enrichment pipeline are built and tested; and links are
omitted because the repository is private.`,
    graph: { cluster: 'commerce', weight: 2 },
    order: 9,
    featured: true,
    relatedPostSlugs: ['aisolver-crm-open-web-enrichment'],
  },
  {
    title: 'Maitura',
    slug: 'maitura',
    domain: 'commerce',
    summary:
      'A Nigerian parcel-courier marketplace where the customer names the price and riders bid — a Go modular monolith whose ledger is the only module allowed to move money.',
    role: 'Solo engineer',
    stack: [
      'Go 1.26',
      'Protobuf / Connect (buf)',
      'MongoDB (replica set)',
      'Redis Streams',
      'Expo / React Native',
      'Next.js 16',
      'rapid (property tests)',
    ],
    heroText:
      'The customer names the price and riders bid — and one module, the ledger, is the only thing allowed to move money.',
    longDescription: `## What it is

Maitura (internally \`e-dispatch\`) is a parcel-courier marketplace for Nigeria —
not ride-hailing — on inDrive's model: the customer names a price and riders bid
for the job. It launches in Lagos and Kano together, "built for the tenth city":
a city is a configuration row with a lifecycle (the \`config\` module owns the
\`cities\` registry — vehicles, hours, pricing band), so expanding to a new city is
an operations task rather than a release.

## The architecture, as actually built

Maitura is a Go 1.26 modular monolith, service-shaped inside: twenty modules, each
in the same hexagonal layout — \`domain\` (pure rules), \`application\` (use cases),
\`ports\` (interfaces), \`adapters\` (Mongo, Redis, PSP) and \`transport\`. Contracts are
protobuf over Connect (generated with buf), state lives in MongoDB (database
\`edispatch\`, a replica set), and the event bus is Redis Streams. Five binaries run
the platform: \`api\`, \`realtime\` (driver presence and location fan-out),
\`reconcile\`, \`relay\` (the outbox publisher) and \`seed\`.

An honest note the repo forces: its own PLATFORM-TRACKER and ARCHITECTURE.md still
describe a planning-stage Express/TypeScript design and say "no code exists," but
the implemented backend is a substantial Go codebase — more than five hundred files
across the modules and roughly 180 Go test files. Where the documents disagree with
the code, the code is the truth, so this is a Go and protobuf platform, not the
TypeScript one the older brief imagined.

## Money is the spine

Every monetary field is an integer in kobo and carries a \`Kobo\` suffix, so a float
is visible on sight in review. The \`ledger\` module is the only one permitted to
write a monetary entry, and the \`wallet\` is a projection over it — the same
single-writer rule that keeps Settleo's books trustworthy. The invariant is pinned
by a property test named for exactly what it forbids: the projection cannot drift
from the journal.

## Modules that don't reach into each other

A module never reads another module's collections; it calls that module's
application layer through a port or consumes its events. Events travel over Redis
Streams behind a transactional outbox — a state change and its event commit in one
MongoDB transaction, and the \`relay\` process publishes them — so nothing is ever
emitted for a write that didn't commit and nothing committed is ever lost, with
consumers idempotent by event id.

## Security and compliance, designed in first

The threat model was written before implementation. It ranks the assets an attacker
wants and puts IAM itself at the top — the way to grant yourself the other seven,
quietly and durably — so the \`iam\` policy engine lands before the handlers it
protects, and revocation is a platform concern. Nigerian regulation is designed in:
NIPOST for courier licensing, the NDPC for data protection, and a wallet-and-payments
design shaped to stay off a CBN money-transmitter licence.

## Honest limits

The two Expo mobile apps (customer and driver) are scaffolded; the business
dashboard, operations console and public tracking web app are not built yet; nothing
is deployed; and links are omitted because the repository is private.`,
    graph: { cluster: 'commerce', weight: 2 },
    order: 10,
    featured: true,
    relatedPostSlugs: ['maitura-ledger-projection-invariant'],
  },

  // ────────────────────────── Tools / Labs ─────────────────────────
  {
    title: 'Aisolver',
    slug: 'aisolver',
    domain: 'tools-labs',
    summary:
      'A collaborative task and project platform with built-in AI agents that can actually do the work — kept honest by a custom architecture check that fails the build on any structural violation.',
    role: 'Solo engineer',
    stack: [
      'React 19',
      'Vite 5',
      'TypeScript',
      'Tailwind v4',
      'Fastify 5',
      'node-pg (no ORM)',
      'PostgreSQL 17',
      'WebSocket',
      'Zod',
    ],
    heroText:
      'A custom architecture check that fails the build — structural decay held at zero.',
    longDescription: `## What it is

Aisolver (internally "taskwise") undersells itself as "a rebuilt task manager." It's
really a collaborative task- and project-management platform with **built-in AI
agents that act on the user's own data** — its own doc frames it as "Todoist +
Notion + a team of AI assistants that can actually do the work." Every user gets a
personal assistant agent, can hire specialist agents, and share them with a team. The
familiar task-manager surface — lists, drag-drop, a calendar, files, contacts — is
the *substrate* the agents operate on, not the whole product.

## The architecture check that fails the build

My favourite piece is a small, zero-dependency tool that guards the codebase's shape
and **exits with an error on any violation**, so CI and the pre-push hook fail.
"Please don't import the database from the route layer" is a code-review plea that
erodes under deadline; a red check does not get tired. It forbids a handful of
specific kinds of decay — an upper layer being imported by a lower one, one route
importing another — and, most interestingly, it holds the number of **circular
imports at exactly zero**. A comment records the burn-down as each cycle was cut:
106 → 43 → 13 → 10 → 0. Only *static* imports count, because a deliberately deferred
(dynamic) import is the sanctioned way to break a cycle and creates no load-order
hazard.

## SQL injection made a compile error

Every database query platform-wide goes through a tagged-template helper, and the
plain-string version was deliberately deleted — so raw-string SQL simply **doesn't
compile**. The type-checker is the gate. Parameterizing queries stops being a habit
you can forget and becomes a property the compiler enforces; there's one audited
escape hatch for the rare unavoidable case.

## Live updates that survive a reconnect

Real-time updates run over WebSockets, behind a small swappable interface. Per user
it keeps a ring buffer of recent messages, so a client that briefly drops can
reconnect and replay what it missed; if the server restarted in the meantime, the
client is told the buffer is gone and falls back to a full refetch — an
at-least-once design with explicit gap detection rather than silent loss.

## Testing, deploy & security posture

Web unit tests run in a headless DOM; the API has two test harnesses — a fast,
deterministic one with no LLM that's the everyday gate, and a slower,
non-deterministic one for agent behaviour — under a "no flaky tests" policy, and the
architecture check is a hard CI gate. Security: invite-only signup, admin pinned to a
single account plus 2FA, HTML sanitisation on inbound mail, and parameterized SQL
enforced by the type system. Deploy is AWS/EKS via ordered Terraform stacks, a
private-only cluster API, a managed Postgres database, and a CDN-fronted single-page
app.`,
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
      'A single-page marketing site for an AI-automation consultancy — static content, no backend, one interactive animation, and full SEO.',
    role: 'Solo engineer',
    stack: ['Next.js 16', 'TypeScript', 'Tailwind v4 (CSS-first)', '@base-ui/react', 'lucide-react'],
    heroText: 'When a static site is the correct amount of engineering.',
    longDescription: `## What it is

Fivestick is the marketing site for an AI-automation consultancy. It's a single-page
Next.js site whose main call-to-action pushes visitors to WhatsApp or a free
30-minute audit call.

## Static content — but not a static export (the honest distinction)

The site is fully static in *content* — **no backend at all**: no API routes, no
server actions, no database, no auth. But it's worth being precise: the config does
*not* turn on Next's static-export mode, so the build is still a standard server
bundle that assumes a Node runtime, not a folder of plain HTML. The case study says
"static content / no backend," not "static export." There's exactly one interactive
piece — a dependency-free SVG animation. Conversions go to a third-party WhatsApp
link, so there's no form handler or lead database to secure.

## SEO, styling & an honest finding

Crawler discoverability comes purely from static metadata — sitemap, robots, social
images, a web manifest, and JSON-LD. One honest finding: a component library was
scaffolded but never used — its folder doesn't exist and its helpers are never
imported; the page uses hand-written components. There's no test runner (a defensible
scope for a static brochure) and no environment files to leak.

## Why it's here

It's the "right amount of engineering" counterpoint: a landing page's job is narrow —
load fast, read clearly, convert — and a CMS or heavy app shell would be over-building.
The interesting decision is knowing where to stop.`,
    graph: { cluster: 'tools-labs', weight: 1 },
    order: 2,
    featured: true,
    relatedPostSlugs: ['fivestick-static-landing'],
  },
];

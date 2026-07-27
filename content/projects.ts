import type { ProjectSeedInput } from '@/server/models';

/**
 * Portfolio project registry — the 18 real projects that populate the
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
 * dates, metrics, or capabilities; where the source was thin (Labs), the copy
 * stays thin and says so.
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
      'Non-custodial P2P/OTC crypto-settlement platform — a ~24-repo polyrepo of hexagonal TypeScript services around a single-writer TigerBeetle ledger.',
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

Settleo is a non-custodial peer-to-peer and OTC crypto-settlement platform,
built as a ~24-repo polyrepo — about eighteen hexagonal (ports-and-adapters)
TypeScript backend services, plus the consumer/business/console apps, the
Solidity escrow contracts and a shared library. Retail users trade through a consumer app, desks through a
business app, and operators watch it all from an internal console — but every
surface is downstream of one rule: **value moves in exactly one place.**

## The problem

When money is on the line, "a bunch of services that each touch balances" is a
recipe for double-spends and irreconcilable state. The hard part isn't building
one service — it's building eighteen of them without letting any two of them
disagree about how much money exists.

## The architecture

Traffic enters through \`settleo-gateway\` (:8080), a stateless edge/BFF with no
database and no domain logic — its only store is Redis (rate-limit, nonce,
idempotency). It recognises three credential shapes (integrator HMAC keys,
developer bearer keys, end-user tokens introspected at IAM) and denies
everything else with a uniform 401. Its route table **is** the allow-list: an
unmatched route 404s before any auth runs. \`settleo-iam\` (:8081) issues
alg-pinned HS256 tokens, does refresh-rotation with reuse-detection, and
authorizes with a permissions-list model where **explicit Deny always beats
Allow** (the AWS rule), not RBAC.

Below the edge sit the domain services — wallet, escrow-orchestrator,
trade-engine, pricing, offer, compliance, payments, dispute, reputation, risk,
messaging, notifications, reconciliation, indexer, review, developer — each
enforcing its own deny-by-default S2S authorization rather than trusting the
gateway. They coordinate over a **transactional outbox → Redis Streams** event
bus (\`TradeSettled\`, \`EscrowFunded\`, \`WithdrawalHeld\`, \`ReconciliationDriftDetected\`,
…) with at-least-once delivery and at-most-once effect.

The crown jewel is \`settleo-ledger\`: the **single writer** to TigerBeetle and
the only authority on balances, exposed as double-entry transfers and two-phase
holds over gRPC. Every other service reaches money through its
\`@settleo/ledger-client\` port. A rebuildable MongoDB projection is derived from
the transfer log and is never the source of truth. Deterministic string→u128 id
encoding preserves idempotency across the boundary:

\`\`\`ts
export function encodeId(id: string): bigint {
  const digest = createHash('sha256').update(id).digest(); // 32 bytes
  let value = 0n;
  for (let i = 0; i < 16; i++) value = (value << 8n) | BigInt(digest[i]!);
  return value === 0n ? 1n : value; // TigerBeetle rejects a zero id
}
\`\`\`

## Money model & correctness

Money is **integer minor units** (u128-safe bigint), never floats; it crosses
the wire as a decimal string bounds-checked against \`U128_MAX\`. The ledger's
pure reference reducer encodes six invariants — double-entry always balances,
no overdraft by construction, idempotent replays, pending posts-xor-voids,
holds auto-void on timeout, linked transfers commit all-or-nothing — and doubles
as both the spec the TigerBeetle adapter must match and a deterministic fake for
higher-layer tests.

## Testing & security posture

Ledger invariants are property-tested with \`fast-check\`; integration tests run
against real TigerBeetle + a Mongo replica set via \`testcontainers\`. STRIDE
threat models were authored **before** feature code, targeting OWASP ASVS L3 for
money-tier services. Every internal call carries a constant-time, body-bound,
nonce-replay-protected HMAC; a durable Redis \`SET NX PX\` guard makes that replay
protection cross-instance and fail-closed. Boundary adapters that aren't built
yet (MPC signer, PSP, chain reads) are stubbed and **fail closed** rather than
faked — tracked honestly in a per-cell platform tracker.`,
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
      'A C#/.NET 6 Blazor generative-NFT builder rewritten as a Go 1.26 API + Next.js 16 frontend — parity reached, and the predecessor’s security holes closed.',
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

NFTMixer (Go) builds generative NFT collections: upload layered PNG art,
organise it into sources → assets → colour variants with traits and rarity
weights, wire a **node graph** describing how layers combine and how rare each
branch is, generate thousands of weighted-and-unique combinations, hand-curate
them, then render final PNGs + OpenSea metadata JSON + SHA-256 sidecars to S3.
It is a ground-up rewrite of a C#/.NET 6 Blazor Server app.

## The problem

The owner wanted long-term ownership of the stack and doesn't read C#. But
Blazor Server *is* the UI — \`.razor\` files aren't templates, they're a stateful
framework diffing DOM over a websocket — so roughly **70% of the "rewrite in Go"
was actually frontend work** in Next.js. The design doc says so out loud.

## The architecture

The backend is a Go 1.26 (\`net/http\` + \`chi\`) service in clean layers:
\`internal/domain\` (pure types + validation, no I/O), \`internal/engine\` (graph
path-tracing and weighted-and-unique generation), \`internal/render\`
(compositing, HSL/contrast filters, OpenSea metadata), \`internal/store\` (Mongo
v2 repositories with a declarative index plan applied at startup),
\`internal/blob\` (an S3/MinIO port), \`internal/auth\` (SIWE), and background
\`jobs\` that run in-process for v1. The Mongo \`projects\` document is the aggregate
root — image bytes never enter Mongo, only an S3 \`blobKey\` — so the service is
stateless and horizontally scalable. The frontend is a Next.js 16 App Router app
with a React Flow node canvas.

## Engineering decisions worth calling out

- **Real auth that authenticates.** The C# app believed whatever wallet address
  the browser named. The Go version implements **SIWE**: the server issues a
  nonce, composes the full EIP-4361 message, and recovers the signer from the
  signature — using \`secp256k1\` + keccak256 directly rather than go-ethereum,
  because go-ethereum's LGPL-3.0 code carries a relink/source obligation when
  static-linked into a proprietary binary. Malleable high-S signatures are
  rejected.
- **Ownership from the session, never the URL.** Membership is folded into the
  store's query *filter*, so a non-member's read selects no document —
  "a handler that forgot to check cannot leak, because there is no unfiltered
  read to call by mistake." That directly closes the C# download hole.
- **Sessions that actually expire** via Mongo TTL indexes on \`sessions\` and
  \`nonces\`, replacing an in-memory map whose cleanup method was empty.

## Deliberate parity breaks (improvements, not regressions)

One correct generator — weighted **and** unique with a bounded retry that fails
with an actionable exhaustion error — replaces the C# app's two divergent
generators (one of which could hang on an unbounded \`while\`). Absolute rarity is
the **MIN** of step rarities (the rarest step gates the branch), not a product.
Every layer is resized to output dimensions with a CatmullRom kernel so
non-uniform art composites correctly. Metadata is OpenSea-standard with a
parameterised \`image\` base URI so an IPFS CID can be substituted without
re-rendering.

## Testing & security posture

Test files sit beside nearly every source file; store tests use a throwaway DB
in the shared replica set. CI gates on \`gofmt\`/\`go vet\`/\`go test -race\` against
real Mongo, \`govulncheck\`, a web build, two Playwright legs, and a
committed-credential scan. Hardening includes strict CSP + HSTS, self-hosted
fonts, and storing only \`sha256(refresh)\` — never the token. Honestly-stated
limits: the auth rate limiter is per-process, and refresh-reuse revocation only
catches the same-instant race.`,
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
      'The backend for a Web3/NFT platform — the mint-critical auth and Merkle-whitelist trust boundaries carved into small, separately-auditable Express services.',
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
      'A Merkle-proof whitelist and wallet-login auth split into their own auditable services.',
    longDescription: `## What it is

GKOI is a multi-service Web3/NFT platform, not a monolith. Three cooperating
Express + TypeScript + MongoDB + Redis services share one four-layer convention
(routes → controllers → services → models), one \`IResponseData<T>\` envelope,
Redis-backed rate limiting, Prometheus metrics, and one HMAC service-to-service
auth scheme.

## The architecture

- **\`gkoi-authentications\`** owns wallet login (EIP-4361 / Sign-In-with-Ethereum)
  and is the **authoritative admin-role registry**. Its key move: the server
  *builds and stores* the login message, and the client signs it verbatim and
  never reconstructs it — eliminating client/server format drift. Verification
  consumes a single-use nonce, asserts it was issued for that exact account, then
  verifies the signature with \`viem\`. Each distinct failure reason feeds a
  failed-signature-burst anomaly ticket.
- **\`gkoi-whitelist\`** produces the presale allowlist Merkle root/proofs and
  pins contract metadata to IPFS.
- **\`gkoi-server\`** handles the large non-mint-critical surface: NFT
  metadata/pricing, collections, contests, galleries, DeFi/swaps, gaming,
  leaderboards and audit, with schema evolution via \`migrate-mongo\`
  (content-hash re-run, so every migration is written idempotent and guarded).

Services authenticate to each other over HMAC-SHA256 with the signed message
\`[METHOD, ts, nonce, sha256(body)]\` — the **path is deliberately excluded** so
the signature survives proxy/mount-prefix changes — plus a directional freshness
window and a one-time Redis nonce. Per-route authorization is scoped by the
authenticated caller id, so (for example) the auth service can only invalidate
the whitelist's admin cache and nothing more.

## The Merkle whitelist — scaling apart from the mint

Leaves are \`keccak256(address)\`; the tree is built with \`merkletreejs\` and
\`sortPairs: true\` so the contract's on-chain \`MerkleProof.verify\` matches
regardless of pair order. Only a **32-byte root** ever goes on-chain, so the
allowlist size never inflates mint gas or contract storage — verification is
O(log n) inside the contract, and the whitelist scales independently of the
mint. The service caches the *sorted address snapshot* (not the tree) so a
cached \`/proof\` is always byte-identical to what a cold rebuild — and the cached
\`/root\` — would produce; add/remove explicitly bust that shared version.

## Testing & security posture

Mocha + Chai + Sinon with nyc coverage (Supertest for the HTTP-facing services); Biome and a \`ts.check\`
pre-commit gate. The auth service ships its own \`SECURITY.md\` and a dated
\`SECURITY_AUDIT.md\` — the author security-reviews his own mint-critical services
and records the findings with file/line citations, which is itself the strongest
signal here: the trust boundaries are small enough to audit, and they get
audited.`,
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
      'The Foundry/Solidity contracts behind GKOI — a SeaDrop ERC721A collection with a swappable Creator-Token transfer validator, a CREATE2 factory, and a Conduit router.',
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
      'Royalties that survive the secondary market — enforcement delegated to a swappable validator, not hard-coded.',
    longDescription: `## What it is

The on-chain half of GKOI: a set of Foundry/Solidity repos — \`gkoi-erc721AC\`
(the mint collection), \`NftCollectionFactory\` (a CREATE2 deployer), and
\`Conduit\` (a Seaport-style channel-authorized transfer router).

## Enforceable royalties — the accurate mechanism

\`gkoi-erc721AC\` is a SeaDrop-based ERC721A collection. It is **not** a vendored
LimitBreak royalty policy. Instead it exposes the **Creator Token** interface
(\`ICreatorToken\`) and, on every non-mint/non-burn transfer, calls out to an
**external, owner-configurable** \`ITransferValidator721.validateTransfer\` in
\`_beforeTokenTransfers\`:

\`\`\`solidity
function _beforeTokenTransfers(address from, address to, uint256 startTokenId, uint256) internal virtual override {
    if (from != address(0) && to != address(0)) {
        address transferValidator = _transferValidator;
        if (transferValidator != address(0)) {
            ITransferValidator721(transferValidator).validateTransfer(msg.sender, from, to, startTokenId);
        }
    }
}
\`\`\`

Royalties themselves are **ERC-2981 rate declarations** (bps capped at 10 000);
*enforcement* — that a marketplace sale actually honours the rate — is
**delegated** to whatever validator the owner points the token at. Address \`0\`
means no validator and no enforcement. So the token itself stays standard, but
every secondary-market transfer is gated by a policy contract the creator
chooses and can swap, rather than by a single vendor's baked-in policy. As an
extra durability lever, transfers and approvals are **paused (soulbound) by
default** until the owner flips \`updateTransfersPaused(false)\`.

## Deployment and routing

\`NftCollectionFactory\` deploys standalone collections via \`Create2.deploy\` over
packaged **raw creation bytecode**, giving deterministic pre-computable
addresses. Separately, the SeaDrop *cloneable* line uses OpenZeppelin \`Clones\`
(**EIP-1167** minimal proxies) plus an \`initialize\` call. \`Conduit\` is Seaport's
channel-gated transfer router: users approve the conduit once, and only
controller-authorized channel contracts may then move their tokens — with the
honest caveat, straight from the contract's own NatSpec, that a malicious
channel owner could drain approvals.

## Allowlist styles

Two coexist and are worth contrasting: SeaDrop's on-chain Merkle mint (leaf =
\`keccak256(abi.encode(minter, mintParams))\`, so the proof carries per-minter
params) versus \`GKoiPresale\`'s ECDSA claim, where a role-gated off-chain
signature (\`VALIDATOR_ROLE\`) authorizes each mint. Both differ from the
whitelist *service's* plain \`keccak256(address)\` tree.

## Testing & security posture

Foundry unit/fuzz tests with a \`MockTransferValidator\` that asserts the
\`_beforeTokenTransfers → validateTransfer\` call happens and can revert; Hardhat
for coverage. \`optimizer_runs = 1_000_000\` and \`bytecode_hash = "none"\` are tuned
for deploy-cost and determinism. Security-relevant defaults are conservative:
transfers paused-by-default, royalty bps hard-capped, validator delegation
opt-in and owner-gated.`,
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
      'The non-custodial trade escrow of Settleo: an immutable Solidity contract that releases funds only on 2-of-3 on-chain approval voting — or a permissionless time-locked auto-refund.',
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

Settleo Escrow holds the crypto leg of a P2P trade. It is made of two parts: an
immutable Solidity contract (\`SettleoEscrow\`) that locks funds, and an off-chain
\`settleo-escrow-orchestrator\` that drives the lifecycle and mirrors every
settlement into the double-entry ledger. A separate \`settleo-dispute\` service
runs arbitration.

## The correct mechanism (not signatures)

The "2-of-3" is **on-chain approval voting by \`msg.sender\`** — *not* an ECDSA
threshold, *not* EIP-712 typed data, *not* a multisig. There is no domain
separator and no on-chain nonce scheme. Each of the three designated addresses
(buyer, seller, arbiter) calls \`approve\` itself, and the contract tallies
distinct signer votes; funds settle the instant two distinct parties approve the
same outcome:

\`\`\`solidity
function approve(bytes32 tradeId, Outcome outcome) external nonReentrant {
    if (outcome == Outcome.None) revert WrongState();
    Escrow storage e = _escrows[tradeId];
    if (e.state != State.Funded && e.state != State.Disputed) revert WrongState();
    if (msg.sender != e.buyer && msg.sender != e.seller && msg.sender != e.arbiter) revert NotSigner();
    if (_votes[tradeId][msg.sender] == outcome) revert AlreadyVoted();
    _votes[tradeId][msg.sender] = outcome;
    emit EscrowApproved(tradeId, msg.sender, outcome);
    if (_tally(tradeId, e, outcome) >= 2) { _settle(tradeId, e, outcome); }
}
\`\`\`

## Why the platform can never decide alone

The operator holds \`OPERATOR_ROLE\` — it can \`open\` an escrow and trigger the
permissionless refund, but it **holds no vote**. Moving funds always needs two
of the three party keys; the arbiter is only the swing vote. There are two paths
out: 2-of-3 approval (cooperative buyer+seller, or a disputed arbiter+party), or
a **permissionless, time-locked auto-refund** to the seller after the refund
deadline — so an absent or malicious operator can never strand funds. Raising a
dispute *freezes* the auto-refund clock, so a disputed escrow can only exit by a
2-of-3 ruling. \`pause\` gates only new intake (\`open\`/\`fund\`); \`approve\`,
\`dispute\` and \`refundExpired\` keep working so locked funds can always leave.

Safety is CEI + \`ReentrancyGuard\` + a fuzz/invariant-proven solvency invariant
(contract balance always ≥ locked amount), with native transfers via a low-level
\`call\` that reverts on failure and a \`receive()\` that rejects stray ETH.

## The off-chain half

The orchestrator client-side signs EIP-1559 transactions (with \`@noble/curves\`,
no ethers/viem) and is **idempotent under retry via on-chain reads** — it skips
an \`open\`/\`fund\`/vote already recorded. It never writes balances itself: a fund
opens a two-phase ledger hold (seller→escrow); a release commits the hold and
pays escrow→buyer(net) + escrow→fee in **one all-or-nothing linked batch** tagged
with the trade/transition id (which is what makes the ledger emit
\`TradeSettled\`); a refund voids the hold. Disputes are single-sourced off the
\`DisputeResolved\` event, and the dispute service is IDOR-hardened — a party's
role is derived from the gateway-asserted actor, never claimed, so one operator
can't cast two votes to self-resolve.

## Testing & security posture

The contracts carry 46 unit + 5 fuzz + 3 invariant tests
(\`invariant_solvent\`, \`invariant_conservation\`, terminal escrows hold nothing),
with attacker mocks for reentrancy and native-transfer rejection, plus a STRIDE
threat model. Honest caveat: the contract is **currently unaudited** — mainnet is
gated on a clean external audit — and the MPC signer for real keys is an external
component not yet built.`,
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
      'The original generative-NFT builder — C#/.NET 6, Blazor Server, PostgreSQL/EF Core — a mature product whose security foundations motivated the Go rewrite.',
    role: 'Predecessor codebase (rewritten as nftmixer-go)',
    stack: ['C#', '.NET 6', 'Blazor Server', 'EF Core 6 / PostgreSQL', 'SixLabors.ImageSharp', 'Docker'],
    heroText:
      'The stateful Blazor app that came first — mature, feature-rich, and honestly unshippable.',
    longDescription: `## What it is

NFTMixer (.NET) is the original generative-NFT builder: a C#/.NET 6 **Blazor
Server** application over **PostgreSQL via EF Core 6**, using MudBlazor for UI,
Z.Blazor.Diagrams for the node canvas, Nethereum for wallet connect,
SixLabors.ImageSharp for compositing, and AWS S3 + local disk for storage. It is
a real, feature-rich product — sources → assets → variants → traits → rarities →
payloads → node graph → generate → curate → render → zip — with ~40 EF
migrations spanning 2022–2026. Here it is a **read-only reference**.

## Why it matters here

This is the predecessor to \`nftmixer-go\`. Blazor Server is the architectural
fork in the road: the UI is rendered server-side and diffed over a SignalR
websocket, which gave progress dialogs "for free" but has **no Go equivalent** —
the honest reason the migration was ~70% frontend. Its stateful local-disk
storage (a volume that "must never be lost") is exactly what blocked safe
containerization and drove the Go app's stateless S3-for-everything design.

## The honest defects that motivated the rewrite

All four are real and citable, and each maps 1:1 to a Go-side fix:

- **Authentication that doesn't authenticate** — the browser reports the
  connected wallet and the server simply believes it; there is no signature
  challenge anywhere, so anyone can log in as any address, including an admin's.
- **An unauthenticated DB-dump endpoint** — \`GET /api/Download/export/db\` shells
  out to \`pg_dump\` and returns the full data dump with no authorization
  attribute (the runtime even installs \`postgresql-client\` for it).
- **Ownership taken from the URL** — a zip-download endpoint builds the output
  path straight from a \`userId\` in the URL with no membership check.
- **Sessions that never expire** — tokens live in a process-local dictionary
  whose cleanup method is literally empty.

Keeping it in the constellation is deliberate: the interesting engineering story
is the delta between a mature-but-unshippable app and its disciplined rewrite,
not either one alone.`,
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
      'The GKOI frontends — a Next.js 16 admin dashboard, the public mint site, and an NFT gallery — that turn chain operations into an interface a human can drive.',
    role: 'Frontend engineer',
    stack: ['Next.js 16', 'React 19', 'TypeScript', 'Privy + wagmi + viem', 'TanStack Query / SWR', 'Tailwind v4', 'Playwright'],
    heroText: 'Turning chain operations into an admin a human can actually drive.',
    longDescription: `## What it is

The user-facing tier of GKOI: three Next.js 16 (App Router) + React 19 apps —
\`gkoi-admin-v2\` (operator dashboard), \`gkoi-client-v3\` (public mint site), and
\`gkoi-gallery\` (NFT gallery). The wallet stack is **Privy + wagmi + viem**
(READMEs mentioning RainbowKit are stale). None of them owns any source of
truth: collection/config/whitelist data is fetched from the platform services,
and the server re-authorizes and re-enforces every mutation.

## The design move that makes chain ops legible

The admin's core idea is that **almost every operation is a backend-mediated REST
call wrapped in a toast lifecycle + confirm dialog, not a raw wallet
transaction.** On-chain *state* (presale stage, prices, owner) is read via wagmi
\`useReadContracts\` and surfaced as plain UI values — no signature required —
while privileged work is delegated to the backend the operator is already
authenticated to. The REST client is a thin cookie-auth axios wrapper
(\`withCredentials: true\`, no bearer token in JS), and each action drives UX
through \`toast.loading → toast.update(success|error)\`, surfacing the server's own
error message verbatim. The **one** genuine direct chain write in the whole admin
is the swap "claim" — the deliberate exception that proves the rule.

## Auth and safety rails

Login is Privy (SIWE-style) → an HttpOnly session cookie → an admin-role /
permission verify, with a tri-state gate designed so the connect/sign dialog
never dead-ends when unauthenticated. Admin role is fetched from the auth
service; the frontend never decides authorization itself. Playwright e2e covers
the operator routes, and all three apps use Biome + \`ts.check\` + lint-staged.

## Honest note

On the public mint site, the actual on-chain buy-presale submit path is
currently commented out behind a "SOLD OUT" state, so the live mint flow is not
claimed as active here.`,
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
      'Cross-device active-protection endpoint agent — a Go protection service plus a privileged Windows service that enforces only server-signed, verified directives.',
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
      'Active endpoint protection built around a signature-before-everything directive path.',
    longDescription: `## What it is

Sentova is cross-device active protection: installable desktop (Windows/macOS/
Linux) and mobile apps backed by a single Go protection service, arranged as a
\`go.work\` workspace. Five detection modules run per device — \`network_filter\`,
\`ioc_scan\`, \`posture\`, \`behavior_monitor\`, \`ransomware_guard\` — and a
server-side engine derives one of three verdicts: \`PROTECTED\`, \`AT_RISK\`,
\`COMPROMISED\`. Honesty is a product requirement: it explicitly does not claim to
stop every attack, and a per-cell tracker is the single source of truth for what
actually ships. In this build, **only the Windows desktop column ships real,
tested enforcement across all five modules**; every other platform cell is a
specced seam or roadmap item.

## Privilege separation

The desktop agent is two processes. A **Wails** app (Go + WebView2 + relocated
React) holds **no privilege** and is only an IPC client. A privileged Windows
service (\`sentova-serviced\`) runs as SYSTEM, exposes **no network listener**, and
is the only process that can terminate or quarantine. A shared \`core/\` package,
imported by both the server and the agent, keeps the wire/feed/directive formats
byte-for-byte identical so the two sides can't drift.

## The signed-directive enforcement path

This is the spine of the product:

1. **IPC authorize (fail-closed).** The connecting peer's token SID must equal
   the enrolling user's SID, resolved once at Accept by impersonation to dodge a
   PID-reuse TOCTOU. Mutating operations additionally require an integrity level
   \`>= IntegrityMedium\`; a low-IL/sandboxed caller is refused, and a failure to
   read the level is itself a rejection.
2. **VerifyDirective (signature before everything).** The verify order is exact:
   device-id binding → \`alg == ed25519\` → resolve the pinned key → recompute the
   signed core over canonical params and **verify the Ed25519 signature before
   acting** → *only then* check expiry (so a forged \`expiresAt\` can never help) →
   known type + per-platform allowlist.
3. **One shared Enforcer.** A single place drives a verified directive through
   the platform ports (kill / quarantine / network-filter), shared by the IPC
   path, the check-in loop, and \`confirm_directive\`, so a directive enforces **at
   most once**. Destructive kill/quarantine are held for in-app confirmation;
   nil ports (a non-elevated run) yield an honest \`"degraded"\` ack rather than a
   false success.
4. **Bounded at-most-once ReplayGuard.** An expiry-keyed seen-cache keyed on both
   \`id\` and \`nonce\`; a re-seen id/nonce is rejected as a replay after first
   acceptance, entries drop past the directive's own expiry, and capacity is
   bounded by evicting the soonest-expiring keys under a flood.

Separately, a **local-first** canary → correlate → kill/quarantine loop responds
to a ransomware trip **without a server round trip**, and every "what Sentova
did" string reflects what actually happened — a banned-claims grep forbids a
fixed success sentence.

## At-rest and IAM

Secrets are sealed with **DPAPI** and the data directory is ACL-hardened with a
protected DACL, closing the "0600 ignored on NTFS" hole. The backend is the IdP:
argon2id passwords, Ed25519 access JWTs with refresh rotation, opt-in TOTP and
WebAuthn passkeys (sign-count regression fails closed), and a roleless
groups+policies PDP with AWS-style default-deny, explicit-deny-wins semantics.

## Testing & security posture

Enforcement, IPC/verify, module logic, the replay guard, correlation and scan
are all covered by Go unit tests using **fake ports**, so they run anywhere. The
live WFP/ETW/\`TerminateProcess\` primitives are elevation-gated and were **not
executed on this non-elevated build** — the case study states that split as
plainly as the repo's own tracker does. A kernel/SYSTEM-equal attacker is
explicitly out of scope for this phase.`,
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
      'An anti-spyware / Mobile Threat Defense microservice that matches uploaded iOS/Android forensic artifacts against a STIX 2.1 IOC feed — as an index seek, not a pattern parse.',
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
      'STIX 2.1 IOC matching as an index seek, not a pattern parse.',
    longDescription: `## What it is

Sentova MTD is a new anti-spyware / Mobile Threat Defense microservice (Go
package \`mtd\`) inside the larger Sentova platform of Go microservices. It does
**server-side forensic analysis** of uploaded mobile artifacts (iOS sysdiagnose/
backup, Android bugreport) matched against a **STIX 2.1 spyware-IOC feed**,
producing a deterministic verdict. Following the platform's DB-per-service rule,
it owns an isolated \`sentova_mtd\` database with four collections:
\`mtd_indicators\`, \`mtd_feeds\`, \`mtd_artifacts\`, and \`mtd_verdicts\`.

## The core idea: index seek, not pattern parse

A STIX pattern is a *grammar*, not a key — matching thousands of raw patterns per
observed value is O(N). So at ingest, MTD lifts every concrete \`{kind, value}\`
comparison out of the STIX pattern once into a **denormalized, indexed
\`observables\` array** (the raw pattern is retained only for provenance). The
match hot path becomes a seek over the multikey index
\`{observables.value, observables.kind}\` — value leads because it's the
high-cardinality selector; kind narrows collisions.

Matching is two-phase and its correctness turns on a subtle bug avoided:

- **DB pre-filter.** One batched query
  \`{accountId: {$in}, observables: {$elemMatch: {value: {$in: values}}}}\`
  uses the multikey index — one query, never one-per-observable.
- **In-memory confirm.** The analyzer keeps only indicators at the feed's
  **active snapshot version** and confirms an exact per-element \`(value, kind)\`
  hit. The naive \`{observables.value: v, observables.kind: k}\` form is explicitly
  wrong because it can match \`v\` in one array element and \`k\` in a *different*
  one; \`$elemMatch\` binds both to the same element.

Feed ingest writes at \`active + 1\` and bumps the version in one update, so a
half-written feed is never matched and rollback is a version decrement.
Both sides of the match are normalized identically — otherwise matches silently
miss.

## Verdicts, privacy, and tenancy

Verdict derivation is pure and deterministic: 0 matches with a healthy parse →
\`CLEAN\`; 0 matches with a degraded/zero-observable parse → \`INCONCLUSIVE\` (a real
state, never silently downgraded to CLEAN); ≥1 match → \`COMPROMISED\`, with
severity = the max matched indicator severity and confidence = the strongest
matched observable kind. Family names (the Pegasus/Predator/Reign mercenary
class) and the shared \`low|medium|high|critical\` severity vocabulary are safe to
name; mercenary-spyware IOCs default to \`critical\`.

Every document carries an \`accountId\` and every query filters on it, and
identity is taken **only from the verified service-to-service context, never from
a request body** — making body-tampering structurally impossible. Sensitive
forensic fields (\`storageRef\`, \`deviceIdentifier\`, \`extractedRecords\`,
\`matchedValue\`, the inline \`rawArtifact\`) are **AES-256-GCM field-encrypted and
never indexed**; structural fields stay clear so indexes and TTL keep working,
and the polled list endpoint projects out every encrypted field so it decrypts
nothing. Retention/erasure is first-class: per-doc \`expiresAt\` TTL indexes plus
scoped erasure, because subjects may be under state-level threat.

## Testing & security posture

Unit tests cover store encryption, matching, STIX parsing, verdicts,
normalization and feeds, with a hermetic offline STIX fixture. A hard acceptance
gate requires the match query's \`explain("executionStats")\` to be an \`IXSCAN\` on
the observables index with keys-examined ≈ docs-returned — never a \`COLLSCAN\` —
and TTL indexes to show \`expireAfterSeconds: 0\`.`,
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
      'A multi-tenant property/rental management SaaS — and the Next.js Model→Service→Route reference architecture (with a real IAM engine) the other commerce apps clone.',
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
      'The Next.js + Mongo + Redis reference architecture behind a family of commerce apps.',
    longDescription: `## What it is

Managerenta is a multi-tenant property/rental management SaaS: a Next.js 16
App-Router monolith with a strict server-only backend, Mongoose 9 on MongoDB,
Redis for cache + rate-limit, S3 for images, and a hand-rolled AWS-IAM-style
authorization engine. Beyond the product, it is the **reference architecture**
the owner's other commerce apps (Chekka, Mogadget, Golden Bite, …) are cloned
from.

## The Model → Service → Route triad

All server code lives under \`src/server/\` and imports \`"server-only"\`:

- **Model** — the Mongoose schema *and* flat \`xxxDB()\` data-access functions.
  Cross-cutting invariants are pushed into schema hooks so every read path
  inherits them: a \`pre("aggregate")\` injects the soft-delete filter and
  normalizes \`_id → id\`; a \`post("aggregate")\` swaps stored S3 filenames for
  signed URLs via \`Promise.allSettled\` (one bad key can't fail the batch).
  Ownership is a query-level invariant — updates/deletes filter on
  \`{_id, userId, deleted: false}\` — and every \`*DB\` fn wraps a Prometheus timer
  and returns empty rather than throwing on reads.
- **Service** — one function per file, orchestrating models + S3 + Redis cache +
  notifications. Reads compute a namespaced Redis key and cache with a short TTL;
  writes invalidate. Services never touch \`req\`/\`Response\`.
- **Route** — thin: authorize → parse/validate with a Zod \`safeParse\` → call the
  service → shape a \`created()\`/\`ok()\`/\`handleError()\` envelope, all inside a
  \`withApiHandler(withAuth(...))\` wrapper that applies, **in order**, a CSRF
  Origin/Referer gate *before* rate limiting (so a failed check burns no quota),
  Redis-backed rate limiting, Mongo readiness, and Prometheus timing.

## Access control

\`withAuth\` resolves the JWT (with silent refresh rotation) and produces an
\`effectiveOwnerId\` — the user's own id in personal scope, or the org owner's id
when switched into an organization, so org members transparently operate on the
owner's resources through a single evaluation path. The IAM engine
(\`authorize(auth, action, resourceArn)\`) resolves effective policies, evaluates,
and audits the reason (never leaked to the client). The load-bearing boundary:
a tenant-isolation check denies any org-plane request whose target org ≠ the
caller's scope **regardless of policy content** — so even a wildcard policy
can't cross tenants.

\`\`\`ts
if (target.plane === "org" && target.orgId !== resourceScope(auth)) {
  return { decision: "deny", reason: "implicit deny (cross-scope org resource)" };
}
\`\`\`

## Testing & security posture

93 Vitest files under \`tests/\` mirror the \`src/server\` tree, with a
\`globalSetup\` that drops every scratch DB the run created (isolated throwaway
databases); coverage deliberately excludes \`runtime/\` and cron as "coverage
theater." 16 Playwright specs drive auth, 2FA, passkeys, properties, tenants,
organizations, the admin console and a full-app drive. A real three-pass
\`SECURITY_REVIEW.md\` documents ~40 findings — the standout being S1, where "2FA
was never enforced on login — the toggle was decorative," later fixed with a
two-step ticket flow. Deploy ships two pipelines: a multi-stage Dockerfile →
ECR via CodeBuild, and an AWS Amplify build.`,
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
      'A Nigerian professional car-inspection platform — a Next.js 16 monolith built on the Managerenta conventions, with a locked-report integrity model and a live inspection feed.',
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

Chekka ("Before you buy — Chekka") is a Nigerian car inspection and verification
platform. A buyer books an inspection; a professional inspector verifies the
vehicle and files a structured report; the buyer gets a report they can trust
before handing over money. Five roles — buyer, inspector, consultant, manager, admin —
live in one \`users\` collection discriminated by \`role\`.

## The architecture

It's a Next.js 16 monolith over Mongoose 9 + Redis + S3, and it is explicitly a
direct descendant of the Managerenta reference architecture: the spec ships the
identical \`withApiHandler(withAuth(...))\` route skeleton and the same Mongoose
model conventions (pre/post-aggregate hooks, per-\`*DB\` Prometheus timers,
select-false soft-delete, model memoization) — the build follows a written
contract rather than ad-hoc scope. (An honest correction to the internal brief:
that spec is **~4,700 words**, not "37k" — a dense, well-structured 12-feature
document, not an inflated one.)

## The inspection → report lifecycle

The core \`inspections\` collection embeds the car, buyer contact, pricing, the
full lifecycle timestamp set, and the report sub-schema (exterior / interior /
mechanical / road-test checklist arrays, each item \`good|minor|serious|n/a\`,
plus a verdict and summary). A status machine drives it:
\`submitted → assigned → scheduled → in_progress → report_processing → completed\`
(with a declined branch). Pricing is computed server-side from admin-tunable
site config plus a flat urgent surcharge.

Report integrity is the load-bearing part:

- **A locked report is immutable** — submitting against a report with
  \`reportLockedAt\` set throws \`ErrReportLocked\`.
- **The summary is recomputed server-side** from the checklist item statuses on
  submit, never trusted from the client. Locking sets \`completed\`, stamps the
  lock/complete timestamps, publishes a \`report_filed\` event to the admin live
  channel, and notifies the buyer.
- **Public share links** mint an unguessable UUID nonce → inspection-id mapping
  in Redis with a 7-day TTL, granting read-only unauthenticated access to a
  completed report that self-expires — the inspection id is never exposed in the
  link.

## Media and real-time

Photos are a separate append-only \`inspectionPhotos\` collection with a
denormalized \`photoCount\` maintained by atomic \`$inc\` (the decrement clamped so
races can't drive it negative), and S3 filenames are swapped to signed URLs in
the aggregate hook. A live inspection feed rides Redis pub/sub → SSE, with
\`currentSection\` tracking which report section is in progress. Report PDFs are
rendered with \`@react-pdf/renderer\`.

## Testing & security posture

Playwright e2e covers auth, booking and the inspection lifecycle; unit coverage
is thinner than Managerenta's (no Vitest configured here). Security is inherited
via the shared \`withApiHandler\` (rate-limit + CSRF), \`withAuth\` (JWT + refresh
rotation), Zod on every body, and report-lock immutability.`,
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
      'A premium treats/catering business in Abuja delivered as three surfaces in one Next.js 16 app — storefront, ops dashboard, and staff app — and the origin of the "per-operation" arch.',
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
      'Storefront, back-office, and staff app in one app — each operation its own narrow slice of authority.',
    longDescription: `## What it is

Golden Bite is a premium treats, platters and event-catering business in Kubwa,
Abuja, built as **three surfaces in one Next.js 16 App-Router app**: a customer
storefront, an operations/admin dashboard, and a staff (kitchen + delivery) app.
It was refactored to mirror the Managerenta patterns, and it is the **origin of
the "Golden Bite arch"** that Adverta later clones.

## The per-operation service + IAM discipline

The name is literal: services are **one file per operation** plus a barrel — e.g.
\`services/orders/\` holds \`createOrder\`, \`updateOrderStatus\`,
\`checkOrderCapacity\`, \`computeOrderTotals\`, \`ordersForKanban\`, \`attachDriver\`,
\`setDeliveryProof\`, … — and the models layer is likewise per-operation
\`*DB\` functions, each Prometheus-instrumented. IAM is a 5-role union
(\`customer | kitchen | delivery | manager | owner\`) with role groups defined
once. Two enforcement styles coexist: a \`withAuth(handler, ...roles)\` wrapper
(401 without a session, 403 if the role isn't allowed) and inline sentinel-error
checks inside handlers, so the shape is **one operation → one service call → one
role gate → one audit action**:

\`\`\`ts
export function withAuth(handler: TAuthedHandler, ...roles: TRole[]) {
  return async (req: Request) => {
    const session = await getSessionUser();
    if (!session) return fail(401, "Not authenticated");
    if (roles.length && !roles.includes(session.role)) return fail(403, "Forbidden");
    return handler(req, session);
  };
}
\`\`\`

The edge \`proxy.ts\` does only a cheap cookie-presence redirect and is explicitly
**not a security boundary** — role is re-checked in every handler. That least-
authority, small-blast-radius shape is the whole point.

## The cross-cutting spine

Zod validators are extracted per resource with \`.strict()\` schemas; SWR + a
\`withCredentials\` axios client (with a loop-guarded 401→login interceptor) drive
the client; an ioredis singleton with a **5s boot-ping that throws loudly rather
than falling back to memory** backs hot reads under namespaced keys with explicit
invalidation, plus a fixed-window rate limiter. Prometheus exposes an HTTP-
duration histogram (observed in \`withApiHandler\`) and a DB-duration histogram
(observed per \`*DB\` fn). Parallel admin/user audit streams fire in a \`finally\`
so they survive a throw.

## Testing & security posture

Playwright e2e runs serially on a dedicated port with a hermetic S3 fallback
(auth, admin pages, order lifecycle, session persistence, admin nav layering).
Honest flags carried into the case study: there is **no unit-test runner** (the
automated coverage is Playwright + \`ts.check\` only), and the \`/api/metrics\` and
dev peek routes are unauthenticated and should be disabled in production.`,
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
      'A Nigerian campus food pre-order marketplace: dated listings with cutoff times, Paystack split prepay, and atomic Redis slot reservations. Shipped on Next.js + Mongo (a Fastify/Prisma twin exists).',
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

Prechop is a Nigerian campus food **pre-order** marketplace: vendors publish
dated daily listings with a **cutoff time**; buyers reserve and pay **upfront via
Paystack** before the kitchen cooks. The tagline — "order before they cook" — is
the whole model, and it turns an ordinary catalog into a scheduling problem:
inventory that expires.

## Two backends, honestly

The repo contains **two distinct backends**, and the one actually shipped is not
the Prisma one:

- **\`prechop/\` (the live app)** is a single **Next.js 16** App-Router
  application containing both the React frontend and the API (route handlers
  under \`src/app/api\`), persisting to **MongoDB via Mongoose 9**, with **Redis
  (ioredis)** for OTP storage, slot-reservation locks, rate limiting and cron
  coordination. Background work is **in-process \`cron\`** — no queue.
- **\`prechop-api/\`** is an earlier/parallel standalone service: **Fastify 5 +
  Prisma 7 + PostgreSQL + BullMQ** across an API process and a worker process.
  This is where the richest data model (money as integer kobo throughout, cuid
  ids, listing/item/order/payment relationships) lives.

Both implement the same domain, so this case study draws the data model from the
Prisma side and the shipped scheduling mechanics from the Next.js side — without
pretending Postgres/Prisma is the live store.

## Cutoff enforcement — the interesting part

Enforcement is layered:

- **Read-time guard** on every order attempt — a "coming soon" check plus
  \`if (cutoffTime <= now) throw CutoffPassed\`.
- **Scheduled auto-close**, with two contrasting designs. \`prechop-api\` enqueues
  a **BullMQ delayed job keyed by listing id** (\`delay = max(0, cutoff - now)\`,
  \`jobId = listingId\` so it's idempotent and self-deduping) that fires exactly at
  cutoff. The live app instead runs a **per-minute cron sweep** where each job is
  wrapped in \`runSingleInstance\` — a Redis lock so only one instance per tick
  does the work under horizontal scaling.
- Cutoff isn't just "stop new orders": it **auto-cancels and Paystack-refunds**
  every PAID-but-unconfirmed order the vendor never committed to cook.
- The 30-minute pre-cutoff **warning** would otherwise fire 30 SMS from a
  per-minute sweep, so it's deduped with a per-listing \`SET NX\` whose TTL
  outlives the window — "expiry *is* the reset."

\`\`\`ts
async function scheduleDailyOrderAutoClose(dailyOrderId, cutoffTime) {
  const existingJob = await cutoffEnforceQueue.getJob(dailyOrderId);
  if (existingJob) await existingJob.remove();
  const delay = Math.max(0, cutoffTime.getTime() - Date.now());
  await cutoffEnforceQueue.add("close-daily-order", { dailyOrderId },
    { jobId: dailyOrderId, delay, removeOnComplete: true, removeOnFail: true });
}
\`\`\`

## Money and oversell safety

Paystack uses **split subaccounts** with a per-transaction charge (the platform
absorbs the processing fee, not the vendor). Order placement is
server-authoritative: items and addons are resolved and priced server-side,
totals are computed server-side, and Paystack is initialised **before any DB
write** — on failure, locks release and nothing persists. The webhook **verifies
the HMAC-SHA512 signature on the raw body with a timing-safe compare first**,
then handles only \`charge.success\`, checks idempotency, verifies the amount, and
transitions the order. Oversell is prevented with atomic Redis reservations —
the live app uses an \`INCRBY\` + \`EXPIRE\` reservation counter
(\`available = maxQuantity − committed − reserved\`, rolled back on failure).

## Testing & security posture

Vitest runs against a **per-worker throwaway DB** dropped on teardown; the
Playwright config is instructive in its own right — it defaults to an obscure
port and refuses to reuse a running server after a real incident where the suite
silently ran against the wrong app on a shared port, and it runs \`next start\` in
production mode so the boot guard is exercised. Security: server-authoritative
pricing, idempotency keys, AES-256-GCM encryption for bank details, dual-secret
HS256 JWTs, and a \`/api/health\` that is 200 only when both Mongo and Redis
answer.`,
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
      'A Nigerian advertising/marketplace platform — one shared Hono API behind a Next.js web app and an Expo mobile app, with a billing-aware campaign model and AWS-style per-request IAM.',
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
₦500/day, chat with buyers in-app": a self-serve marketplace + campaign builder +
advertiser dashboard + **agency white-label** + Trust-&-Safety ops, delivered as
**three consumers over one shared HTTP API**. It's a Yarn-workspaces Turborepo,
and the backend is a deliberate "carbon-clone" of the Golden Bite arch
(per-operation \`*DB\` model fns, per-op service files with Redis read-through
cache, Prometheus histograms, a \`{code,message,data}\` envelope, and AWS-style
IAM).

An honest correction to the internal brief: the backend is **Hono + Mongoose 8 /
MongoDB**, *not* Fastify/Prisma, and "per-operation database/service" means code
structure + application-level IAM, **not** distinct database credentials.

## The shared, typed API contract

Six workspaces: a Next.js \`apps/web\` (pure UI, proxying \`/api/*\` to the API),
an Expo \`apps/mobile\`, a Hono \`services/api\` (\`:4000\`, \`/api/v1\`, owning all
data access), \`packages/core\` (models/services/DB clients/middleware/metrics),
\`packages/contracts\` (zod schemas + route table + IAM catalog), and
\`packages/api-client\` (a transport-agnostic typed client). The purist boundary:
**neither web nor mobile imports \`core\`** — both speak to the API over HTTP via
the shared client, and packages are consumed as **raw TypeScript via \`exports\`
maps with no build step**, so a contract change breaks the compile of both apps
in the same commit rather than surfacing as a runtime surprise. The mobile
client de-dupes concurrent 401s via a single \`refreshInFlight\` promise so its
single-use rotating refresh token is spent exactly once.

## Billing-aware campaigns and money safety

\`ICampaign\` carries \`format\` (\`boost|sponsored|blast|banner\`), budget/spend, and
metrics. The load-bearing move is an **atomic budget draw** — spend + a lead are
booked only while \`spentNaira + amount <= totalBudgetNaira\`, enforced by a
\`$expr\` in the *query filter* so check-and-book is one atomic act with no
concurrent overspend:

\`\`\`ts
const result = await Campaign.findOneAndUpdate(
  { _id: id, $expr: { $lte: [{ $add: ["$spentNaira", amountNaira] }, "$totalBudgetNaira"] } },
  { $inc: { spentNaira: amountNaira, leads: 1 } },
  { returnDocument: "after" },
).lean<ICampaign>();
\`\`\`

Attribution is server-derived and ignores any client \`campaignId\`; billing fires
only on the trusted \`startConversation\` path keyed on a billing actor to defeat
Sybil drain; totals are always recomputed server-side. The Paystack webhook
verifies the signature first, moves the ledger only on \`charge.success\` with an
exact amount match, and is idempotent via unique provider/charge refs.

## Agency white-label and per-request IAM

The multi-tenant agency layer (tiered agencies with white-label \`brandColor\`
joined to client businesses) enforces tenancy in \`withPermission\`:
\`resolveScopedAgencyId\` takes the agency id **from the session, never the
request**, and holding \`clients:write\` is not enough to act on another agency.
IAM is a flat \`resource:action\` permission catalog with Allow/Deny policies where
**explicit Deny wins**; a user's effective set is **re-resolved from the DB on
every request** (Redis-cached ~30s; an inactive account resolves to an empty set
= deny all), so revocations bite within seconds.

\`\`\`ts
export function compileStatements(statements: IPolicyStatement[]): TPermission[] {
  const allow = new Set<TPermission>();
  const deny = new Set<TPermission>();
  for (const statement of statements) {
    const target = statement.effect === "Deny" ? deny : allow;
    for (const perm of expandActions(statement.actions)) target.add(perm);
  }
  for (const perm of Array.from(deny)) allow.delete(perm);
  return Array.from(allow).sort();
}
\`\`\`

## Testing & security posture

Vitest unit tests target a throwaway DB whose \`globalSetup\` **refuses any db not
prefixed \`adverta_vitest\`**; Playwright covers e2e; CI runs \`ts.check\`, Biome,
core tests, and both Docker builds (asserting non-root images with no baked-in
\`.env\`). A prod boot guard exits before binding if \`JWT_SECRET\` is missing or
weak, delivery credentials fail closed with a 503 rather than lie, and Pusher
private channels are signed only after the server verifies participation.`,
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
      'A single-owner Lagos gadget catalog with no cart — browse, then hand off to a prefilled WhatsApp/Instagram chat, with fire-before-navigate click analytics.',
    role: 'Solo engineer',
    stack: ['Next.js 16', 'TypeScript', 'MongoDB / Mongoose 9', 'Redis', 'Zod', 'pino', 'Vitest', 'Playwright'],
    heroText: 'A catalog that hands off to WhatsApp instead of a checkout.',
    longDescription: `## What it is

Mogadget is a single-owner gadget catalog for a Lagos store: visitors browse and
filter a catalog and order by tapping **"Chat on WhatsApp"** or **"DM on
Instagram."** There is deliberately **no cart, no checkout, no online payment,
and no customer accounts** — documented as an intentional product decision, not a
missing feature.

## The "no cart" hand-off — the actual mechanism

The order flow *is* the hand-off: browse → product page → tap a channel button →
a deep link opens a chat with a **prefilled message identifying the exact product
and price**, and negotiation/payment happen entirely in-chat, off-platform. The
link is built in a pure domain module:

\`\`\`ts
export function buildWhatsAppLink(p) {
  const base = \`Hi, I'm interested in the \${p.name} (\${formatNaira(p.priceNaira)}) listed on MoGadget\`;
  const msg = p.url ? \`\${base} — \${p.url}\` : base;
  return \`https://wa.me/\${WHATSAPP_NUMBER}?text=\${encodeURIComponent(msg)}\`;
}
\`\`\`

Analytics never block the sale: the client fires a click beacon **before
navigation** via \`navigator.sendBeacon\` (with a keepalive \`fetch\` fallback),
wrapped in try/catch. The server does an atomic \`$inc\` on the product's
WhatsApp/Instagram counter, best-effort appends to a \`clickEvents\` log (failures
logged via \`pino\`, never surfaced), then invalidates the admin cache. That log is
an append-only time-series with a **MongoDB TTL index** giving 180-day
auto-retention with no cron and no PII.

## Modelling

The \`Product\` schema encodes real retail invariants in a pure, unit-tested
\`domain/\` layer: NEW items forbid a cosmetic grade and are restockable; used
items require a grade and are unique units; a restockable listing auto-hides when
quantity hits zero (but restocking never auto-unhides — re-listing is a deliberate
admin action). A compound filter index plus a text index drive browse/search
facets, and the list query sinks SOLD / out-of-stock items below available ones.

## Descent, and an honest tension

It reuses the Managerenta \`src/server\` triad and \`withApiHandler\` (its auth
wrapper renamed \`withPermission\`), adding a pure \`domain/\` layer and a client
\`src/lib/\` API layer, with 39
colocated Vitest specs plus Playwright e2e. Worth flagging: the product doc
argued for "one admin, no roles," but the shipped app carries a **full IAM stack
with passkeys and TOTP 2FA** — the doc's own "Historical note" acknowledges the
pivot. The public click endpoint is intentionally unauthenticated but carries no
PII.`,
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
      'A collaborative task/project platform with built-in AI agents that act on your data — a pnpm monorepo whose ~320-line architecture lint fails the build on any boundary or cycle violation.',
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
      'An architecture lint that fails the build — layer inversions and import cycles held at zero.',
    longDescription: `## What it is

Aisolver (package \`taskwise-v2\`) is more than a task manager: it's a
collaborative task/project-management platform with **built-in AI agents that act
on the user's own data** — "Todoist + Notion + a team of AI assistants that can
actually do the work." Every user gets a personal butler agent, can hire
specialists, group them into squads, and share via workteams. Shipped modules
include the chat pipeline, Agent Skills, sandboxed artifacts, lists/tasks,
files/docs/sheets, drives, contacts, calendar, an orchestration/job engine, BI,
business-process flowcharts, and IMAP/SMTP mail. The classic task-manager surface
(lists, nested tasks, drag-drop, calendar, alarms, trash, invite-code
registration) is the substrate the agents act on.

## The architecture

A pnpm monorepo: \`apps/api\` (**Fastify 5 · TypeScript ESM · \`node-pg\` ·
PostgreSQL 17, no ORM**), \`apps/web\` (**React 19 · Vite 5 · Tailwind v4 ·
TanStack Query**, a custom \`pushState\` router, no Redux), and a shared
\`packages/chat-ui\`. Two load-bearing kernels: a \`sql\` tagged-template
\`SqlFragment\` type where **raw-string SQL does not compile** (parameterization
enforced by tsc), and a WebSocket realtime bus (migrated off SSE) with per-user
sockets, a ring buffer of recent frames, a monotonic per-user serial, and a
resume handshake that replays missed frames or tells a client the buffer is gone
after a server restart — an at-least-once-with-gap-detection protocol.

## The architecture lint that fails the build

The centerpiece is \`tools/arch-check.ts\`: a **zero-dependency (\`node:fs\` +
\`node:path\` only) ~320-line guard** run via \`pnpm arch:check\` that **exits 1 on
any violation** so CI and pre-push fail. It enforces five distinct classes of
decay:

- **\`routes ↛ routes\`** and **\`lib ↛ routes\`** — no layer inversion (with a
  documented Stage-6B exception that lets a decomposed route god-file import its
  own co-located module subtree, without opening the floodgates).
- **A static import-cycle ceiling of 0** — it builds the full intra-repo import
  graph, runs **iterative Tarjan SCC**, and fails if any file sits in a cycle;
  the header records the burn-down \`106 → 43 → 13 → 10 → 0\`. Dynamic \`import()\`
  is the sanctioned cycle-breaker and is deliberately *not* counted as an edge.
- **A legacy-path ban** so a completed consolidation can't regress.
- **A domain invariant** — every non-streaming Claude call must go through the
  resilient \`callClaude\` wrapper (credit/429/retry/telemetry), enforced by a
  small allowlist.

It also emits non-gating visibility reports: a god-file LOC list, an SCC summary,
and a mixed static+dynamic SCC report for the runtime layering debt a 0-static
ceiling can't see.

## Testing & security posture

Web unit tests use Vitest + Testing Library + happy-dom; API contract tests run
through \`tools/api-sim\` (a fast deterministic REST+DB suite with no LLM) with a
separate slow \`chat-sim\` harness for agent behavior, under a "no flaky tests"
policy. \`arch:check\` is a hard CI gate. Security: invite-gated signup, admin
pinned to a single uid + 2FA, \`sanitize-html\` on mail, parameterized SQL enforced
by the \`sql\` kernel, and a per-operation permission kernel. Deploy is AWS/EKS via
three ordered Terraform stacks.`,
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
      'A single-page marketing site for an AI-automation consultancy — static content, no backend, one interactive island, full SEO via static Next metadata (a standard server build, not a static export).',
    role: 'Solo engineer',
    stack: ['Next.js 16', 'TypeScript', 'Tailwind v4 (CSS-first)', '@base-ui/react', 'lucide-react'],
    heroText: 'When a static site is the correct amount of engineering.',
    longDescription: `## What it is

Fivestick is the marketing/landing site for an AI-automation consultancy that
"audits a business's workflows and builds bespoke AI agents." It's a single-page
Next.js 16 site whose primary CTA drives visitors to WhatsApp or a free 30-minute
audit call.

## Static content — but not a static export (the honest distinction)

The site is fully static in *content* — **no backend at all**: no \`src/app/api\`,
no server actions, no database, no auth, and no external \`fetch\` in the source.
But \`next.config.ts\` carries **zero custom options** — crucially, it does *not*
set \`output: 'export'\` — so the build is a standard Next.js **server bundle** in
\`.next\`, not an exported \`/out\` static site; deploy assumes a Node runtime (or
Vercel). The case study says "static content / no backend," not "static export."

There is exactly **one client component**: a dependency-free SVG
\`<animateMotion>\` + CSS-keyframe workflow animation. Everything else is a React
Server Component rendered at build. Conversions are offloaded entirely to a third
party (a \`wa.me\` link), so there's no form handler and no lead store to secure.

## SEO and styling

Full crawler discoverability is achieved purely with static Next metadata
conventions — \`sitemap.ts\`, \`robots.ts\` (an explicit AI-crawler allow-list),
Open Graph / Twitter / apple-icon image routes, \`manifest.ts\`, and
\`ProfessionalService\` JSON-LD. Styling is Tailwind v4 CSS-first (no
\`tailwind.config\`; brand tokens live in an \`@theme inline\` block). An honest
finding: **shadcn was scaffolded** (there's a \`components.json\`) but there is no
\`ui/\` directory and \`cn\`/Radix are never imported — the page uses hand-written
Tailwind components. There are no tests and no test runner, which for a static
brochure is a defensible scope, not an omission.

## Why it's here

It's the "right amount of engineering" counterpoint in the constellation: a
landing page's job is narrow — load fast, read clearly, convert — and reaching
for a CMS or a heavy app shell would be over-building. The interesting decision
is knowing where to stop.`,
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
      'A small cluster of learning/sandbox repos — a C++23 template exercising the spaceship operator, a TypeScript DSA set, and a Terraform local-provider sandbox.',
    role: 'Solo / learning',
    stack: ['C++23', 'TypeScript', 'Terraform', 'CMake'],
    heroText: 'The sandbox corner: language features, algorithms, and infra practice.',
    longDescription: `## What it is

Labs is a deliberately low-key cluster grouping the owner's learning and sandbox
repos rather than shipped products:

- a **C++23** project template exercising the three-way comparison
  (spaceship \`<=>\`) operator,
- a **hello-interview** DSA collection written in TypeScript, and
- a **Terraform** sandbox using the local provider.

## An honest note on scope

The Labs source is **not present on this machine**, so this entry is grounded
only in the portfolio inventory's own one-line description — deliberately, there
are no invented stack details, code excerpts, or benchmarks here. When the source
is available, this case study can be deepened; until then it stays a truthful
placeholder.

## Why it's here

Keeping the labs visible — but small — is the honest move. Not everything is a
platform; some of the work is sharpening tools: a modern C++ baseline, algorithm
reps, and infrastructure-as-code practice. Grouping them as a single node avoids
padding the constellation with three tiny stars while still crediting the work.`,
    graph: { cluster: 'tools-labs', weight: 1 },
    order: 3,
    featured: true,
    relatedPostSlugs: ['labs-cpp23-spaceship'],
  },
];

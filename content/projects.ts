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
Solidity escrow contracts and a shared library. Retail users trade through a
consumer app, desks through a business app, and operators watch it all from an
internal console — but every surface is downstream of one rule: **value moves in
exactly one place.**

## The problem

When money is on the line, "a bunch of services that each touch balances" is a
recipe for double-spends and irreconcilable state. The hard part isn't building
one service — it's building eighteen of them without letting any two of them
disagree about how much money exists. Settleo's answer is architectural: a single
value authority, a deny-by-default trust model on every hop, integer-only money,
and boundaries that are stubbed honestly rather than faked when the real
integration isn't built yet.

## The service topology

Traffic enters through \`settleo-gateway\` (:8080), a stateless edge/BFF with no
database and no domain logic — its only store is Redis (rate-limit, nonce,
idempotency). It recognises three credential shapes and denies everything else
with a uniform 401; its route table **is** the allow-list, so an unmatched route
404s before any auth runs. The console, by contrast, is a trusted internal client
that signs service-to-service **directly** to the domain services rather than
passing through the gateway.

| Tier | Service | Responsibility | Writes balances? |
|---|---|---|---|
| Edge | \`settleo-gateway\` | AuthN of 3 credential shapes, route allow-list, BFF request adaptation, recipient-gated WebSocket fan-out | No |
| Identity | \`settleo-iam\` (:8081) | Login/sessions, alg-pinned HS256 tokens, refresh-rotation with reuse detection, permissions-list authz | No |
| **Value authority** | \`settleo-ledger\` | **Sole writer to TigerBeetle**; double-entry transfers + two-phase holds over gRPC | **Yes — only here** |
| Money movement | wallet, escrow-orchestrator, trade-engine, payments | Drive deposits, escrow, trade sagas, fiat legs — all *through* the ledger client | No |
| Risk & control | risk, compliance, review, dispute, reconciliation | Withdrawal holds, KYC gates, operator review cases, 2-of-3 arbitration, drift checks | No |
| Market & social | pricing, offer, reputation, messaging, notifications | Price ticks, order book, ratings, chat, alerts | No |
| Chain & devs | indexer, developer | Reorg-safe on-chain ingestion, developer API keys | No |

Every service enforces its own **deny-by-default S2S authorization** rather than
trusting the gateway. IAM's authorizer is a permissions-list model — not RBAC —
where explicit **Deny always beats Allow** (the AWS rule).

## How money actually moves — the trade settlement path

A cooperative trade settles as a saga, and the interesting property is that no
single step is trusted to be atomic across services — every hop is idempotent and
legal-only:

1. **trade-engine** drives a trade FSM and asks the **escrow-orchestrator** to
   escrow the crypto leg.
2. The orchestrator opens + funds the on-chain \`SettleoEscrow\`, then mirrors the
   lock into the ledger as a **two-phase hold** (seller → escrow).
3. On a 2-of-3 release, the orchestrator posts the payout to the ledger as **one
   all-or-nothing linked batch** — commit the hold, pay escrow → buyer (net),
   escrow → fee — tagged \`settlement{tradeId, transitionId}\`.
4. That settlement tag is what makes the ledger emit **\`TradeSettled\`** (once per
   batch) plus a **\`LedgerTransferPosted\`** per transfer, through a transactional
   outbox onto Redis Streams.
5. **trade-engine** consumes \`TradeSettled\` and reaches \`completed\`.

The withdrawal path is the mirror image of trust: a wallet withdrawal is
risk-assessed, and a risky one becomes a ledger **hold** plus a \`WithdrawalHeld\`
event that opens a \`settleo-review\` case; an operator decides in the console, and
\`WithdrawalReviewDecided\` resumes or rejects the wallet. The money is reserved,
never released, until a human signs off.

## The crown jewel: a single-writer ledger

\`settleo-ledger\` is the **only writer** to TigerBeetle and the only authority on
balances, exposed as double-entry transfers and two-phase holds over a versioned
gRPC contract (\`settleo.ledger.v1.Ledger\`). Every other service reaches money
through its \`@settleo/ledger-client\` port — types only, no TigerBeetle access
escapes the ledger. Accounts and transfers map straight onto TigerBeetle
primitives:

| Concept | Field | Meaning |
|---|---|---|
| Account | \`ledger\` | one ledger space per asset (e.g. ETH, USDC) |
| Account | \`code\` | account type chosen by callers: user / fee / escrow / gateway / world |
| Account | \`allowDebitsExceedCredits\` | system/funding accounts (e.g. \`world\`) may run a debit balance; customer accounts may not |
| Balance | \`availableBalance\` | credit-normal: \`creditsPosted − debitsPosted − debitsPending\` |
| Transfer | \`flag\` | \`single\` \\| \`pending\` \\| \`post_pending\` \\| \`void_pending\` |
| Transfer | \`amount\` | u128 integer minor units; decimal **string** on the wire, \`bigint\` internally |

Account codes and ledger spaces are chosen by callers, not fixed in the ledger
repo, so the taxonomy stays open (crypto ETH/USDC spaces; fiat mirror accounts at
a higher offset with \`allowDebitsExceedCredits\` because fiat isn't custodied
on-platform). A **rebuildable MongoDB projection** is derived from the transfer
log and is *never* the source of truth — deterministic string→u128 id encoding
preserves idempotency across the boundary:

\`\`\`ts
export function encodeId(id: string): bigint {
  const digest = createHash('sha256').update(id).digest(); // 32 bytes
  let value = 0n;
  for (let i = 0; i < 16; i++) value = (value << 8n) | BigInt(digest[i]!);
  return value === 0n ? 1n : value; // TigerBeetle rejects a zero id
}
\`\`\`

## Money model & correctness

Money is **integer minor units** (u128-safe bigint), never floats; it crosses the
wire as a decimal string bounds-checked against \`U128_MAX\`. The ledger's pure
reference reducer encodes six invariants — double-entry always balances, no
overdraft by construction, idempotent replays, pending posts-xor-voids, holds
auto-void on timeout, linked transfers commit all-or-nothing — and doubles as
*both* the spec the TigerBeetle adapter must match *and* a deterministic fake for
higher-layer tests. Because TigerBeetle and Mongo cannot share a transaction,
durability for that gap is honestly stated as **rebuild-from-log**, and a
reconciliation job cross-checks the committed projection against TigerBeetle
field-by-field on an interval. \`drift = 0\` is a HARD non-functional requirement —
but it is meaningful only once the real event sources are wired, which the repo's
per-cell tracker says out loud rather than dressing up.

## Internal contract & transport security

gRPC is the canonical internal contract (org ADR-006): \`.proto\` packages are
versioned, and a breaking change requires a new package version, never an in-place
edit. Every internal call carries a **body-bound HMAC** — the caller signs
\`[METHOD, ts, nonce, sha256(canonicalBody)]\` where METHOD is the fully-qualified
RPC path (so a signature can't be replayed onto a different RPC), and the verifier
checks the HMAC in constant time, enforces a clock-skew window, and **burns the
nonce once** via a durable Redis \`SET NX PX\` guard that makes replay protection
cross-instance and fail-closed. Signing a gRPC body is a genuinely hard problem
because proto3 elides default-valued fields on the wire; Settleo solves it with a
transport-neutral canonical form (recursively drop proto3 defaults, sort keys,
JSON-encode) computed identically by signer and verifier.

## Testing & security posture

Ledger invariants are property-tested with \`fast-check\`; integration tests run
against real TigerBeetle + a Mongo replica set via \`testcontainers\`. STRIDE threat
models were authored **before** feature code, targeting OWASP ASVS L3 for
money-tier services — the ledger's model maps eleven threats (L1–L11) each to a
mitigation and a security test (overdraft-by-construction, replay-is-a-no-op,
post-xor-void, all-or-nothing rollback). Boundary adapters that aren't built yet
(MPC signer, PSP, chain-balance reads) are **stubbed and fail closed** rather than
faked, and the honesty is a documented product rule: domain logic and FSMs are
real and tested; simulated seams are labelled as such.`,
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

NFTMixer (Go) builds generative NFT collections end to end: upload layered PNG
art, organise it into **sources → assets → colour variants** carrying traits and
rarity weights, wire a **node graph** that describes how layers combine and how
rare each branch is, generate thousands of *weighted-and-unique* combinations,
hand-curate the survivors, then render final PNGs + **OpenSea metadata JSON** +
SHA-256 sidecars to S3. It is a ground-up rewrite of a C#/.NET 6 Blazor Server
app (NFTMixer) into a **Go 1.26 (\`net/http\` + \`chi\`) API** plus a
**Next.js 16 App Router** frontend. Slices 0–7 of 8 are built and the design doc
records "C# functional parity reached" at the end of slice 6.

## The uncomfortable truth about "rewrite it in Go"

The owner wanted long-term ownership of the stack and does not read C#. But
Blazor Server *is* the UI — \`.razor\` files are not templates, they are a stateful
server-side framework that diffs DOM over a SignalR websocket — and Go has no
equivalent. So the design doc says it out loud: **"Roughly 70% of this rewrite is
frontend work, and none of it is Go."** The engine, compositing, database, S3 and
auth ports were the genuinely straightforward part; the UI was rebuilt from
scratch in TypeScript. Budgeting for that up front is the difference between a
plan and a surprise. The migration also carried **zero cutover risk by design**:
existing data was declared expendable and the schema is greenfield, which the
design doc names as the single largest source of rewrite risk simply removed.

## The layering

The Go module is split so that the algorithmically risky parts are pure and
exactly testable, and everything with I/O sits at the edges:

- \`internal/domain\` — pure types + validation, **no I/O**: \`project.go\`,
  \`session.go\`, \`nonce.go\`, \`curation.go\`, \`generation.go\`, \`output.go\`,
  \`errors.go\`. Referential integrity between payloads, nodes, variants and
  rarities is enforced here on write.
- \`internal/engine\` — pure graph analysis: \`engine.go\` (path tracing +
  validation) and \`generate.go\` (weighted-and-unique selection). It imports only
  domain + stdlib, so its algorithms are pinned by fast, exact table tests.
- \`internal/render\` — \`composite.go\` (layer compositing), \`filter.go\`
  (HSL/contrast/brightness pixel filter), \`metadata.go\` (OpenSea JSON).
- \`internal/store\` — Mongo v2 repositories + \`indexes.go\`, a **declarative index
  plan** applied at startup where every index documents the query it serves.
- \`internal/blob\` — an object-storage port (\`Store\` interface) with an
  aws-sdk-v2 / MinIO implementation. Image bytes live here, never in Mongo.
- \`internal/auth\` — SIWE: \`siwe.go\` (EIP-4361 build/parse/verify), \`crypto.go\`
  (secp256k1 recovery + keccak256), \`service.go\` (nonce → verify → session).
- \`internal/httpapi\` — chi handlers, middleware, CORS, rate limiting, a shared
  \`IResponseData<T> = {code,message,data}\` envelope.
- \`internal/jobs\` — background render/publish/purge workers that run in-process
  in the API container for v1.
- \`internal/obs\` — slog logger, \`/healthz\`/\`/readyz\`, request-id, redaction.

The Mongo \`projects\` document is the **aggregate root**: it embeds
sources[]→assets[]→variants[], payloads[], graphVersions[]{nodes[],links[]},
rarities[], traits[] and masters[]. Image bytes never enter Mongo — only a
\`blobKey\` into S3 — so the API is **stateless and horizontally scalable**, and a
~10 MB write guard rejects an oversized document before it can approach Mongo's
16 MB ceiling. Because the whole aggregate is one document, a single atomic
update keeps every payload/node/variant/rarity reference consistent.

## Real authentication, as a sequence

The C# app believed whatever wallet address the browser named. The Go version
does actual Sign-In-with-Ethereum, and \`Service.Verify\` runs the decision in a
fixed order that closes each class of forgery:

1. **Parse** the message with a strict EIP-4361 parser that re-renders the
   parsed result and requires byte-for-byte equality with the input — a lenient
   parser is a differential where the user signs one message and the server
   believes another.
2. **Verify server expectations** — domain, URI, chain id, not-expired.
3. **Recover** the signing address from the signature (below).
4. **Consume the nonce** (single-use) and assert it was **issued to the recovered
   wallet** — a valid signature over *someone else's* challenge must not sign that
   someone in.
5. **Cross-check** the address printed inside the message equals the recovered
   one (defence in depth: it is what the user actually saw).
6. Only then **mint** the session.

Signature recovery is the entire auth decision, and it deliberately does **not**
pull in go-ethereum — that library is LGPL-3.0 and static-linking it into a
proprietary binary carries a relink/source obligation. Recovery needs only
secp256k1 + keccak256, both permissively licensed (the same licence reasoning
disables \`next/image\`'s sharp/libvips on the frontend):

\`\`\`go
v := sig[64] // Ethereum serialises [R||S||V]; dcrd wants [V||R||S]
switch v {
case 0, 1:  v += 27 // some wallets emit a bare recovery id
case 27, 28:
default:    return "", fmt.Errorf("%w: recovery byte %d invalid", ErrBadSignature, v)
}
if isHighS(sig[32:64]) { // reject malleable high-S: one message, two encodings
    return "", fmt.Errorf("%w: S in upper half of curve order (malleable)", ErrBadSignature)
}
compact := make([]byte, signatureLen)
compact[0] = v; copy(compact[1:], sig[:64])
pub, _, err := ecdsa.RecoverCompact(compact, EIP191Hash(message))
\`\`\`

The address is then keccak256 over the uncompressed public key (minus its \`0x04\`
prefix), last 20 bytes — and a code comment guards the one subtlety that fails
silently: it must be \`sha3.NewLegacyKeccak256\`, not \`sha3.New256\`, or every login
recovers a valid-looking but wrong address with no error to explain why.

## Ownership comes from the session, never the URL

No handler on the project surface reads a wallet from a path, body or header to
decide who the caller is; it passes the **session's** wallet to the store. And
membership is not re-checked in the handler at all — it is folded into the
store's query **filter**, defined in exactly one place:

\`\`\`go
func activeFilter(caller string) bson.D {
    return bson.D{
        {Key: "deletedAt", Value: nil},
        {Key: "$or", Value: bson.A{
            bson.D{{Key: "ownerId", Value: caller}},
            bson.D{{Key: "collaboratorIds", Value: caller}},
        }},
    }
}
\`\`\`

A non-member's read simply selects no document and returns \`ErrNotFound\` — "a
handler that forgot to check cannot leak, because there is no unfiltered read to
call by mistake." That single filter directly closes the C# \`DownloadController\`
hole where ownership was read straight out of the URL with no \`[Authorize]\`.

## Sessions that actually expire

The C# session store was a process-local map whose cleanup method was empty.
Here every \`Session\` carries a hard \`ExpiresAt\` (domain \`Validate\` refuses a
zero one), and Mongo TTL indexes on both \`sessions\` and \`nonces\` do the reaping —
no cron, no sweeper goroutine that can be deployed without its scheduler:

\`\`\`go
{coll: CollSessions, name: "sessions_ttl", keys: bson.D{{Key: "expiresAt", Value: 1}},
 ttl: true, why: "TTL reaping: the fix for design doc 4.5, sessions that never expired"},
{coll: CollNonces, name: "nonces_ttl", keys: bson.D{{Key: "expiresAt", Value: 1}},
 ttl: true, why: "an unanswered SIWE challenge must not live forever"},
\`\`\`

The nonce TTL was deliberately **split into its own collection** from sessions,
and the reaper's \`expireAfterSeconds\` is \`0\` because each field stores an
*absolute* expiry instant — the document dies at the moment the field names. Only
\`sha256(refresh)\` is ever stored, never the token itself.

## One correct generator (weighted **and** unique)

The C# app shipped two divergent generators — \`ProcessPaths\` (weighted, allows
duplicates) and \`ProcessPathsAccurate\` (unique but uniform-random, with an
unbounded \`while\` that hangs when the graph cannot yield enough distinct combos).
Go collapses them into one weighted selection + uniqueness check with a **bounded
retry** that fails with an actionable exhaustion error instead of spinning:

\`\`\`go
for produced < want {
    chosen := selectNFT(path, firstIndex, nodeByID, payloads, validVariant, syncPartners, weightOf, rng)
    key := strings.Join(chosen, ",")
    if seen[key] {
        fails++
        if fails >= MaxSelectionRetries { // 200; a synced/single-variant path trips this at once
            avail := Validate(g, payloads).TheoreticalMax
            return GenerateResult{}, &ExhaustionError{Requested: int64(qty), Available: avail}
        }
        continue
    }
    seen[key] = true
    nfts = append(nfts, NFT{Number: number, VariantIDs: chosen})
    number++; produced++; fails = 0
}
\`\`\`

Underneath sit three more deliberate corrections, each pinned by a test and each
citing the exact C# line it fixes:

- **Absolute rarity is the MIN of a path's step rarities** — the rarest step gates
  the combination — not the product and not the average (a test pins
  \`{0.5, 0.8} → 0.5\`).
- The DFS cycle guard is \`continue\`, not the C# \`goto\`: a child already on the
  path is skipped while its **siblings are still explored**, where the \`goto\`
  jumped out of the sibling loop and dropped whole parallel branches.
- Quantity **drift is reconciled in a loop** until the total equals the request
  exactly; the C# single pass could not converge when the excess exceeded the
  paths' combined count.
- **Numbering is gap-free**: a number is consumed only by an *accepted* NFT,
  where the C# incremented on every attempt including discarded duplicates.

Determinism is a hard requirement: everything the generator ranges is a slice in
fixed order, the weight/validity inputs are lookup-only maps, and a single seeded
\`*rand.Rand\` is consumed in one fixed order — so a stored seed reproduces a run
exactly.

## Compositing and metadata

Every layer is resized to the output dimensions with a high-quality CatmullRom
kernel — a deliberate parity break from the C# app, which resized only the base
layer and drew the rest at native size, misaligning any project whose art was not
uniformly sized:

\`\`\`go
resized := image.NewNRGBA(rect)
xdraw.CatmullRom.Scale(resized, rect, filtered, filtered.Bounds(), xdraw.Src, nil)
draw.Draw(canvas, rect, resized, image.Point{}, draw.Over) // first -> last, full alpha
\`\`\`

Metadata is **OpenSea-standard** (\`name\`, \`description\`, \`image\`, \`external_url\`,
typed \`attributes\`) rather than the C# flat \`{trait: value}\` dictionary that no
marketplace accepts. Crucially the \`image\` base URI is a **parameter**, and a
\`RewriteImageBaseURI\` pass re-points it — preserving the \`<number>.png\` filename
and every other byte — so once art is pinned the metadata can be rewritten to
\`ipfs://<cid>/<number>.png\` **without re-compositing**. Rendering is byte-different
from C# by design (different resampling and PNG encoders), so tests assert on
perceptual structure, never image hashes — while the metadata JSON must match
exactly.

## The predecessor's defects, and where each went

| C#/.NET 6 predecessor (real, cited)                                     | Go rewrite                                                                 |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Believe-the-browser wallet "auth" — no signature challenge anywhere     | Full SIWE: nonce → verify → recover signer via secp256k1/keccak256         |
| \`GET /api/Download/export/db\` shells to \`pg_dump\`, **no \`[Authorize]\`**  | Endpoint not ported at all (design carve-out)                              |
| Zip download builds the path from a URL \`userId\`, no membership check    | Ownership folded into the store query filter; no unfiltered read exists    |
| Sessions in a process-local map with an empty \`Cleanse()\`                | Hard \`ExpiresAt\` + Mongo TTL indexes on \`sessions\` and \`nonces\`             |
| Committed live Pinata API key/secret in source                          | Env-only, fail-fast at boot; predecessor key treated as burned            |
| Two generators, one with an unbounded \`while\` that hangs                 | One weighted-and-unique generator, bounded retry, actionable exhaustion    |
| Base-layer-only resize misaligns non-uniform art                        | Every layer resized to output dims with CatmullRom                         |
| Flat \`{trait:value}\` metadata, not marketplace-compatible                | OpenSea schema + parameterised image URI with a rewrite pass               |

## Testing & security posture

Test files sit beside nearly every source file across auth, domain, engine,
render, store, httpapi, jobs, blob and obs; store tests run against a throwaway
database in the shared replica-set Mongo and tear it down. The repo **defines**
(and the design doc specifies as runnable) gates for \`gofmt -l\`, \`go vet\`,
\`go test ./... -race\`, and \`govulncheck\`, plus a web \`tsc\` + \`biome check\` + unit
tests + production build and two Playwright legs (a production standalone
artifact and a \`next dev\` console-hygiene pass) — note the CI **workflow file
itself is not committed** in this repo (only a gitleaks config is), so these are
gates as defined, not something I can claim runs on every push. HANDOFF records
the web unit suite climbing 436 → 464 → 501 tests with the Playwright suite green.

Hardening: strict CSP + HSTS + \`X-Content-Type-Options\`/\`X-Frame-Options\`/
\`Referrer-Policy\`, self-hosted fonts, low-S malleability rejection, constant-time
compares on domain/nonce/admin-wallet checks, and \`ADMIN_WALLETS\` bootstrap
written with \`$setOnInsert\` so no later profile save can self-escalate. Runtime
site chrome lives in a DB-backed \`siteConfig\` doc editable without redeploy, while
security config (\`JWT_SECRET\`, \`SIWE_*\`, \`ADMIN_WALLETS\`, \`PINATA_JWT\`) stays
env-only and fail-fast.

Honestly-stated limits, straight from the README: graceful shutdown is verified
on Linux but not the Windows dev host; the auth rate limiter is per-process, so N
replicas mean N× the limit; and refresh-token-reuse revocation is partial — only
the same-instant double-use race triggers family revocation, while after-the-fact
theft detection needs consumed-token lineage the current schema does not carry.`,
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

GKOI is a multi-service Web3/NFT platform, deliberately **not** a monolith. Three
cooperating Express 5 + TypeScript + MongoDB + Redis services split the surface
along a single fault line — *is this code mint-critical?* — and everything that
touches who is allowed to mint, or who is an admin, is carved into its own small,
separately-auditable service.

| Service | Owns (source of truth) | Why it's isolated | Notable deps |
| --- | --- | --- | --- |
| \`gkoi-authentications\` | Wallet login (EIP-4361 / SIWE), JWT issue/verify, the **admin-role registry** | Auth is the identity trust boundary — small enough to audit, blast-radius-limited | \`viem\`, \`jsonwebtoken\` |
| \`gkoi-whitelist\` | The presale **Merkle allowlist** (root + proofs) and IPFS contract-metadata pinning | The mint gate; scales and fails independently of the core API | \`merkletreejs\`, \`ethers 6\`, Pinata |
| \`gkoi-server\` | Everything non-mint-critical: NFT metadata/pricing, collections, contests, galleries, DeFi/swaps, gaming, leaderboards, audit | The large, evolving surface; kept away from the mint path | \`alchemy-sdk\`, \`moralis\`, \`@uniswap/v4-sdk\`, \`sharp\`, \`migrate-mongo\` |

All three share one four-layer convention (routes → controllers → services →
models), one \`IResponseData<T> = { code, message, data }\` envelope, Redis-backed
rate limiting, Prometheus \`databaseResponseTimeHistogram\` timers labelled
\`{operation, collection, method, success}\`, and one HMAC service-to-service auth
scheme — so the three services read as one system without sharing a database.

## Wallet login without format drift

\`gkoi-authentications\` builds an EIP-4361 (Sign-In-with-Ethereum) message
server-side, **stores it**, and verifies the client's signature against the exact
stored copy — the client signs verbatim and never reconstructs the message, which
eliminates the entire class of client/server format-drift bugs. Verification
consumes a single-use nonce, asserts it was issued for that exact account, then
checks the signature with \`viem\`, and each distinct failure returns its own reason
(rather than a bare \`false\`) so a slow/replayed nonce can be told apart from a
wrong-key signature:

\`\`\`ts
const stored = await consumeLoginNonce(nonce);
if (!stored) return { ok: false, reason: "nonce_missing_or_expired" };
if (stored.account !== account.toLowerCase())
  return { ok: false, reason: "nonce_account_mismatch" };
const verified = await viemPublicClient.verifyMessage({
  address: account as \`0x\${string}\`, message: stored.message,
  signature: signature as \`0x\${string}\`,
});
return verified ? { ok: true } : { ok: false, reason: "signature_mismatch" };
\`\`\`

Those reasons feed a failed-signature-burst anomaly ticket — the auth service
watches itself.

## Service-to-service auth: signed, replay-bounded, path-independent

Services never trust an ambient \`ADMIN_API_KEY\` or a shared DB; every cross-service
call is HMAC-SHA256 signed over \`[METHOD, ts, nonce, sha256(body)]\`. The **path is
deliberately excluded** from the signed message, so a signature survives a
proxy/mount-prefix change, and freshness is checked *directionally* — up to five
minutes in the past but only thirty seconds in the future, so a far-future
timestamp can't be parked inside the window:

\`\`\`ts
function buildMessage({ method, timestamp, nonce, body }): string {
  return [method.toUpperCase(), timestamp, nonce, sha256(body ?? "")].join("\n");
}
function isTimestampFresh(ts: string): boolean {
  const age = Date.now() - Number(ts); // >0 = past, <0 = future
  return age <= SKEW_SECONDS * 1000 && age >= -FUTURE_SKEW_SECONDS * 1000;
}
\`\`\`

A one-time Redis nonce (\`svc:nonce:<uuid>\`, TTL = 2× the skew) blocks replays, and
authorization is per-route by **scope keyed on the authenticated \`x-svc-id\`** — so
\`gkoi-authentications\` is granted exactly \`admins:cache:invalidate\` on the whitelist
and nothing else. Least privilege between services, not just between users.

## The Merkle whitelist — scaling apart from the mint

Leaves are \`keccak256(address)\`; the tree is built with \`merkletreejs\` under
\`sortPairs: true\` so the contract's on-chain \`MerkleProof.verify\` matches
regardless of pair order. Only a **32-byte root** ever goes on-chain, so allowlist
size never inflates mint gas or contract storage — verification is O(log n) inside
the contract. The service's own trick is that it caches the **sorted address
snapshot** (the exact input the Merkle helpers hash), not a serialized tree, so a
cached \`/proof\` is byte-identical to a cold rebuild — and to the cached \`/root\`.
Root and snapshot share one logical version, busted together on every add/remove
via \`invalidateWhitelistCaches\`; a short TTL is only a safety net behind that
explicit invalidation. (The companion post drills into this build/proof/verify
flow.)

Writes are correct under load, too: batch add is a single unordered
\`insertMany({ ordered: false })\` that treats a duplicate-key (11000) as "already
present → null" while preserving input order/length, and the full-list read that
feeds the tree is hard-capped by an always-applied \`$limit\` so an unbounded \`$sort\`
can never be streamed back.

## Schema evolution: guarded, idempotent migrations

Schema changes run through \`migrate-mongo\` with \`useFileHash: true\` — a content
checksum decides re-runs, so every migration is written to be safely re-runnable.
The rename of the admin audit collection is representative: existence-checked on
both sides so a re-run or a fresh DB is a no-op, and \`renameCollection\` preserves
every index (including the TTL) so retention is untouched.

\`\`\`js
async up(db) {
  const src = await db.listCollections({ name: "audit-logs" }).toArray();
  const targetExists =
    (await db.listCollections({ name: "admin-audit-logs" }).toArray()).length > 0;
  if (src.length > 0 && !targetExists)
    await db.collection("audit-logs").rename("admin-audit-logs");
}
\`\`\`

The \`backfill_user_holdings\` migration goes further — a \`$group\` + \`$merge\` upsert
(unique index on \`{account, tokenAddress}\`, \`allowDiskUse\`, \`createdAt\` preserved on
match) that aggregates \`nfts\` by owner into a \`user-holdings\` collection as the
foundation for a co-ownership recommendation signal, idempotent by construction.

## Auditing the auditor

Audit is a first-class, two-stream concern (admin + user), and the whitelist
controllers carry an explicit rule — \`actorAccount: req.account ?? "unknown"\`, with
the comment "never substitute the target as the actor" — so an admin acting on a
user's address is never mislogged as the user.

## Testing & security posture

Mocha + Chai + Sinon with \`nyc\` coverage; Supertest exercises the HTTP surface on
\`gkoi-server\` and \`gkoi-authentications\` (not the whitelist). Biome plus a
\`ts.check\` + lint-staged pre-commit gate. The strongest signal here isn't a badge:
\`gkoi-authentications\` ships its own \`SECURITY.md\` (multi-tier Redis rate limits,
exact-string CORS matching after a regex-matching vuln was removed) **and** a dated
\`SECURITY_AUDIT.md\` that tallies findings with file/line citations. The author
security-reviews his own mint-critical services and records the results — which is
exactly what carving the trust boundaries small enough to audit was for.`,
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

The on-chain half of GKOI: four Foundry/Hardhat Solidity repos, each with its own
\`foundry.toml\`, \`test/\`, and \`script/\`.

| Repo | Role | Pragma | Deploy mechanism |
| --- | --- | --- | --- |
| \`gkoi-erc721AC\` | The mint collection — a SeaDrop-based ERC721A with a Creator-Token transfer-validator hook | \`0.8.17\` | EIP-1167 clones (SeaDrop cloneable line) |
| \`NftCollectionFactory\` | Deterministic collection deployer | \`^0.8.28\` | CREATE2 over raw creation bytecode |
| \`Conduit\` | Seaport channel-authorized transfer router (\`@author 0age\`) | \`0.8.14\` | Deployed/controlled by a ConduitController |
| \`gkoi-smart-contracts\` | ERC-20 GKOI token, swaps, sale, batch transfer | — | — |

\`gkoi-erc721AC\` builds two ways from one tree: a standard profile and a
\`[profile.upgradeable]\` pointing at \`src-upgradeable/src/\`, tuned with
\`optimizer_runs = 1_000_000\` and \`bytecode_hash = "none"\` for deploy-cost and
determinism. Foundry runs fast unit/fuzz; Hardhat is kept for coverage.

## Enforceable royalties — the accurate mechanism

The collection is **not** a vendored LimitBreak royalty policy. It exposes the
**Creator Token** interface (\`ICreatorToken\`) and, on every non-mint/non-burn
transfer, calls out to an **external, owner-configurable** validator in
\`_beforeTokenTransfers\`. The validator address lives behind
\`setTransferValidator(...) onlyOwner\`, and the null address means no validator and
no enforcement:

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

The interface it calls is intentionally minimal — a \`view\` gate that reverts to
block a transfer — and the token advertises the exact selector via
\`getTransferValidationFunction()\`, so a compliant marketplace knows which function
enforces policy:

\`\`\`solidity
interface ITransferValidator721 {
    function validateTransfer(address caller, address from, address to, uint256 tokenId) external view;
}
\`\`\`

Royalties themselves are a separate, honest thing: an **ERC-2981 rate
declaration**. \`setRoyaltyInfo\` reverts on a zero receiver or \`royaltyBps > 10_000\`,
and \`royaltyInfo\` is plain rate math the marketplace reads:

\`\`\`solidity
royaltyAmount = (_salePrice * info.royaltyBps) / 10_000;
\`\`\`

So the rate is on-chain and honoured by marketplaces that choose to; *enforcement*
that a sale actually pays it is delegated to whatever validator the owner points
the token at. The framing is precise on purpose — not "royalties are guaranteed
on-chain," but "policy lives in a hook that *can* enforce, and it travels with the
token, and the creator can swap it."

## Soulbound by default

An extra durability lever ships in \`ERC721SeaDropPausable\`: \`transfersPaused\`
starts \`true\`, so \`approve\`/\`setApprovalForAll\` revert and holder-initiated
transfers (\`from != 0\`) are blocked until the owner calls
\`updateTransfersPaused(false)\`. Tokens are effectively soulbound between mint and
that flip. Siblings \`ERC721SeaDropSoulbound\` and \`ERC721SeaDropRandomOffset\` cover
the permanent-soulbound and randomized-reveal variants.

## Three ways onto the allowlist

Eligibility is not one mechanism but three, each chosen for its context:

| Mechanism | Where | Leaf / proof | Trust model |
| --- | --- | --- | --- |
| SeaDrop Merkle mint | \`SeaDrop.mintAllowList\` | \`keccak256(abi.encode(minter, mintParams))\` — proof carries per-minter params | On-chain proof against a per-contract root |
| SeaDrop signed mint | \`SeaDrop.mintSigned\` | EIP-712 domain-separated digest | Off-chain allowed-signer signature, single-use |
| Presale ECDSA claim | \`GKoiPresale.buyPresale\` | \`ECDSA.recover\` → \`hasRole(VALIDATOR_ROLE, signer)\` | Role-gated off-chain signature, deadline ≤ 5 min, single-use |

The SeaDrop Merkle path is a standard OpenZeppelin verify against the root set per
\`nftContract\`:

\`\`\`solidity
if (!MerkleProof.verify(proof, _allowListMerkleRoots[nftContract], keccak256(abi.encode(minter, mintParams)))) {
    revert InvalidProof();
}
\`\`\`

Note this leaf is distinct from the whitelist *service's* plain
\`keccak256(address)\` tree — same primitive, different payload — a distinction the
companion post pulls apart.

## Deployment and routing

\`NftCollectionFactory.deploy\` is CREATE2 over **packaged raw creation bytecode** —
\`getBytecode\` concatenates \`type(ERC721Factory).creationCode\` with ABI-encoded
constructor args, and \`computeAddress\` pre-computes the deterministic address:

\`\`\`solidity
function deploy(uint256 amount, bytes32 salt, bytes memory bytecode) external onlyOwner returns (address addr) {
    address collectionAddress = Create2.deploy(amount, salt, bytecode);
    emit CollectionCreated(collectionAddress, msg.sender, salt);
    return collectionAddress;
}
\`\`\`

The SeaDrop *cloneable* line takes the other road: OpenZeppelin \`Clones\`
(**EIP-1167** minimal proxies) over a pre-deployed implementation, then
\`initialize(name, symbol, allowedSeaDrop, owner)\`, with the salt mixed with
\`blockhash(block.number)\` so clone addresses don't collide across chains.

\`Conduit\` is Seaport's channel-gated router: users approve the conduit once, and
only controller-authorized channels may then move their tokens, gated by an
assembly \`onlyOpenChannel\` modifier reading the \`_channels\` mapping directly. The
token side pre-approves the conduit (\`ERC721AConduitPreapproved\`) so mint→list is
approval-free. And the caveat is quoted straight from the contract's own NatSpec,
not hidden: *"a malicious or negligent owner can add a channel that allows for any
approved ERC20/721/1155 tokens to be taken immediately."*

## Testing & security posture

Foundry unit + fuzz tests across eleven suites, with test doubles under
\`src/test/\` — a \`MockTransferValidator\` constructed to succeed or always revert lets
tests assert the \`_beforeTokenTransfers → validateTransfer\` call actually fires and
can block a transfer (\`vm.expectRevert("MockTransferValidator: always reverts")\`),
and that \`getTransferValidationFunction()\` advertises the right selector. Hardhat
coverage config is present alongside. Security-relevant defaults are all
conservative: transfers paused-by-default, royalty bps hard-capped at 10 000,
validator delegation opt-in and owner-gated, presale signatures single-use with a
five-minute deadline. Deploy artifacts (\`broadcast/\`) and \`script/*.s.sol\` RPC/key
references stay out of this writeup.`,
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
immutable Solidity contract (\`SettleoEscrow\`, Solidity 0.8.28, OpenZeppelin
v5.1.0, deployed with no proxy) that locks funds, and an off-chain
\`settleo-escrow-orchestrator\` that drives the lifecycle and mirrors every
settlement into the double-entry ledger. A separate \`settleo-dispute\` service runs
arbitration under the same 2-of-3 rule. The contract's own docstring states the
thesis: **"2-of-3, never 1 … the platform alone can never decide an outcome."**

## The correct mechanism (not signatures)

The "2-of-3" is **on-chain approval voting by \`msg.sender\`** — *not* an ECDSA
threshold, *not* EIP-712 typed data, *not* a multisig. There is no domain
separator and no on-chain nonce scheme. Each of the three designated addresses
(buyer, seller, arbiter) calls \`approve\` itself; the contract records that
\`msg.sender\`'s vote and settles the instant two *distinct* parties back the same
outcome, in the same call:

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

The tally is O(1) over the three designated slots — one signer voting repeatedly
can never reach the threshold, and \`AlreadyVoted\` blocks a re-vote for the same
outcome. (Off-chain EIP-1559 signing exists only in the orchestrator to *submit*
these \`approve\` calls; delegated EIP-712 for gasless UX is explicitly deferred
until after audit because it would add signature-replay surface.)

## The on-chain state machine

| State | Reached by | Can leave to |
|---|---|---|
| \`None\` | (unknown trade id) | \`Opened\` via \`open\` |
| \`Opened\` | \`open\` (OPERATOR, 3 distinct parties, \`amount ≤ cap\`) | \`Funded\` via \`fund\` |
| \`Funded\` | seller \`fund\` (locks exact value, starts pay-by clock) | \`Released\`/\`Refunded\` (2-of-3), \`Disputed\`, or auto-\`Refunded\` |
| \`Disputed\` | party \`dispute\` (freezes the clock) | \`Released\`/\`Refunded\` (2-of-3 only) |
| \`Released\` | 2-of-3 \`Release\` → buyer | terminal |
| \`Refunded\` | 2-of-3 \`Refund\`, or permissionless \`refundExpired\` → seller | terminal |

## Why the platform can never decide alone

The operator holds \`OPERATOR_ROLE\` — it can \`open\` an escrow and trigger the
permissionless expired refund, but it **holds no vote**. Moving funds always needs
two of the three party keys; the arbiter is only the swing vote. There are exactly
two paths out:

- **2-of-3 approval** — cooperative buyer + seller, or on a dispute arbiter + the
  favoured party.
- **A permissionless, time-locked auto-refund** to the seller after
  \`refundDeadline\` — so an absent or malicious operator can never strand funds;
  anyone can call it once the clock runs out.

Raising a dispute *freezes* the auto-refund clock (a \`Disputed\` escrow is rejected
by \`refundExpired\`), so a disputed escrow can only exit by a 2-of-3 ruling.
\`pause\` gates only new intake (\`open\`/\`fund\`); \`approve\`, \`dispute\` and
\`refundExpired\` keep working so locked funds can always leave. Assets are
deny-by-default — escrowable only while a governor-set cap is \`> 0\` and never
above it. Settlement is Checks-Effects-Interactions plus \`ReentrancyGuard\`: the
escrow is terminalized and \`_locked\` decremented *before* any payout, native value
is sent by a low-level \`call\` that reverts the whole settlement on failure, and
\`receive()\` rejects stray ETH so nothing can enter except through \`fund\`.

## The off-chain half — settling THROUGH the ledger

The orchestrator's \`OnchainEscrowExecutor\` client-side signs EIP-1559 transactions
with \`@noble/curves\` (its own EVM stack — no ethers/viem) and is **idempotent under
retry via on-chain reads**: before it acts it reads state and skips an
\`open\`/\`fund\` already applied, and reads each signer's recorded vote to skip one
already cast (so an at-least-once redelivery never double-submits and reverts
\`AlreadyVoted\`). It **never writes balances itself** — it settles through the
ledger:

- **fund** opens a two-phase ledger hold (seller → escrow), mirroring the on-chain
  lock;
- **release** commits the hold and pays escrow → buyer (net) + escrow → fee in
  **one all-or-nothing linked batch** tagged with the trade — which is what makes
  the ledger emit \`TradeSettled\`;
- **refund** voids the hold.

Deterministic ledger ids (\`escrow:<tradeId>:hold|release|fee|refund\`) make every
ledger call idempotent, and the on-chain key itself is one-way —
\`onchainTradeId = keccak256(utf8(uuid))\` — so the reorg-safe indexer emits the
\`bytes32\` and the orchestrator resolves the order via a stored index. The order's
own FSM is legal-only:
\`requested → funding → funded → (releasing|refunding|disputed) → released|refunded|failed\`,
and an illegal transition throws.

## Arbitration under the same rule

\`settleo-dispute\` opens a case off \`DisputeRaised\`, assigns a neutral arbiter,
bundles chat **by reference only** (\`{transcriptRef, messageCount}\`, never bodies),
and resolves by a 2-of-3 vote whose tally keeps only each party's *latest* vote —
so one signer voting repeatedly can never reach the threshold. Resolution stages
\`DisputeResolved\` in the same write as the case, and the orchestrator drives the
on-chain release/refund **off that event** (single-sourced, no synchronous call).
The service is IDOR-hardened: a caller's party is **derived** from the
gateway-asserted \`actorId\`, never claimed, and the arbiter console path forces
\`party = 'arbiter'\` and requires \`actorId === arbiterId\` so one operator can't cast
two votes to self-resolve:

\`\`\`ts
function partyOf(c: DisputeCase, actorId: string): Party {
  if (actorId === c.buyerId) return 'buyer';
  if (actorId === c.sellerId) return 'seller';
  if (c.arbiterId !== undefined && actorId === c.arbiterId) return 'arbiter';
  throw new ForbiddenError({ details: { reason: 'not_a_party_to_dispute' } });
}
\`\`\`

## Testing & security posture

The contracts carry 46 unit + 5 fuzz + 3 invariant tests. The invariants prove
**solvency** (\`invariant_solvent\`: contract balance == \`lockedOf\`), value
**conservation**, and that terminal escrows hold nothing; the fuzz suite proves
value-conservation on native release and ERC20 refund, auto-refund timing, and cap
enforcement; attacker mocks (\`ReentrantActor\`, \`RejectNative\`) exercise the
reentrancy and failed-payout guards. A STRIDE model catalogues sixteen threats
(E1–E16), each mapped to a mitigation and a named test — from "operator drains an
escrow" (E1) to "governance pause traps funds" (E15). Signature malleability is
*not applicable*: there are no off-chain signatures to recover, so replay is
covered structurally (terminal states reject re-entry) rather than by nonces.
Honest caveats carried into the case study: the contract is **currently unaudited**
— mainnet is gated on a clean external report — and the MPC signer for real
party/operator keys is an external component not yet built.`,
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

NFTMixer (.NET) is the original generative-NFT builder and the predecessor that
\`nftmixer-go\` replaces: a **C#/.NET 6 Blazor Server** application over
**PostgreSQL via EF Core 6** (lazy-loading proxies), with MudBlazor for UI,
Z.Blazor.Diagrams for the node canvas, Nethereum for wallet connect,
SixLabors.ImageSharp for compositing, and AWS S3 + local disk for storage. A
three-project solution (\`NftMixer\`, plus a dead \`NftGenerator\` library and a
\`ConsoleTests\` harness), it reached a real, feature-rich product — sources →
assets → variants → traits → rarities → payloads → node graph → generate →
curate → render → zip — with ~40 EF migrations spanning 2022–2026. In this
workflow it is a **read-only reference**, kept because the interesting engineering
story is the *delta* between a mature-but-unshippable app and its disciplined
rewrite.

## Blazor Server is the fork in the road

The whole UI is \`.razor\` components rendered server-side and diffed to the browser
over a SignalR websocket (\`AddServerSideBlazor\`, \`MapBlazorHub\`,
\`MapFallbackToPage("/_Host")\`). That model is convenient — it gave generation
progress dialogs "for free" over the socket — but it is precisely the thing with
**no Go equivalent**, which is the honest reason the rewrite was ~70% frontend:
the entire interactive surface had to be rebuilt from scratch regardless of how
clean the engine port was. Storage compounded it: the app persisted to local disk
under \`{userId}/{mixName}/{n}.png|.json|.png.sha256\` on a volume that "must never
be lost," which is exactly what blocked safe containerization and drove the Go
app's stateless S3-for-everything design. The Dockerfile even runs a three-stage
build whose runtime installs \`postgresql-client\` because the app shells out to
\`pg_dump\`.

The live engine, notably, is not in the \`NftGenerator\` project at all — that
library is dead code. Generation, the graph model and rendering live in
\`Components/ProjectV3.razor\` (866 lines) and \`Components/Curation.razor\`,
alongside whole superseded generations of components (\`Project.razor\`,
\`Project2.razor\`, \`ProjectOLD.razor\`, an \`AssetSelectorDialog\` v1/v2, a
\`... - Copy.razor\`) that are referenced but unreachable.

## The honest defects that motivated the rewrite

All are real and citable, and each maps to a specific Go-side fix:

- **Authentication that does not authenticate.** \`MainLayout.razor\` reads
  \`GetProviderSelectedAccountAsync()\` and calls \`InitUserData(SelectedAccount)\`,
  which \`FindAsync\`es the user or silently creates one — no signature challenge
  anywhere. The server trusts whatever address the browser names, so anyone can
  log in as anyone, including an admin:

\`\`\`csharp
var enableProvider = await _ethereumHostProvider.EnableProviderAsync();
SelectedAccount = await _ethereumHostProvider.GetProviderSelectedAccountAsync();
if (SelectedAccount != null) {
    await InitUserData(SelectedAccount); // server trusts the address as-is
}
\`\`\`

- **An unauthenticated database-dump endpoint.** \`GET /api/Download/export/db\`
  shells out to \`pg_dump\` and streams back the full data dump, with **no
  \`[Authorize]\`** on the controller or action:

\`\`\`csharp
[HttpGet("export/db")]
public IActionResult ExportDatabase() {
    string connectionString = _configuration.GetConnectionString("DefaultConnection");
    string arguments = $"pg_dump -h {dbHost} -p {dbPort} -U {dbUser} --data-only --column-inserts -Fp {dbName}";
    var commandResult = BashExecutorService.Execute(arguments, backupFilePath, dbPwd);
    if (commandResult.Success) return File(commandResult.file, "application/octet-stream", backupFileName);
}
\`\`\`

- **Ownership taken from the URL.** \`GET /api/Download/zipmixer/{userId}/{mixName}\`
  builds the output path straight from the URL \`userId\` with no membership check,
  so anyone can download anyone's output.

- **Sessions that never expire.** Web3 tokens live in a process-local
  \`ConcurrentDictionary\` whose \`Cleanse()\` method is literally empty; the map is
  an unbounded, never-swept in-memory store:

\`\`\`csharp
public static void RegisterToken(string token, Web3User user) {
    _activeTokens.TryAdd(token, (DateTime.UtcNow, user));
    Cleanse();
}
static void Cleanse() {

}
\`\`\`

- **A committed live Pinata API key and secret**, hardcoded in
  \`UploadDataToPinata\` and committed to git — confirmed present; the values are
  treated as burned and are never carried forward or reproduced.

- **Unfinished IPFS publish** — \`PublishToIpfs\` returns before uploading, so IPFS
  never actually worked in the C# app.

## The two-generators problem

The clearest illustration of why a rewrite (not a patch) was the right call: the
app literally shipped a **"Process Paths"** button and a **"Process Paths
(Accurate)"** button that produced *different collections*. The "accurate" path
(\`ProjectV3.razor:607\`) is unique-but-uniform-random with an unbounded
\`while (generatedCount < stat.NumberToGenerate)\` that hangs when the graph cannot
produce enough distinct combinations, and it does \`nftNumber++\` on every attempt,
leaving gaps in the numbering. The Go rewrite folds both into a single
weighted-and-unique generator with a bounded retry and gap-free numbering.

## Why keep it in the constellation

It was not a toy — ~40 migrations, V3 generation, masters, rarity tiers, real
rendered output. That maturity is the point: the story worth telling is not "an
app was rewritten" but "a working, feature-complete product had foundations —
statefulness, spoofable auth, an open dump endpoint, a committed key — that could
not be kept," and what a disciplined rewrite does with that inheritance.`,
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

The user-facing tier of GKOI: three Next.js 16 (App Router) + React 19 apps on a
**Privy + wagmi + viem** wallet stack (READMEs mentioning RainbowKit are stale —
there is no RainbowKit in any manifest).

| App | Role | Stack shape |
| --- | --- | --- |
| \`gkoi-admin-v2\` | Operator dashboard | Privy + wagmi + viem, TanStack Query + SWR, react-hook-form + Zod, Playwright e2e |
| \`gkoi-client-v3\` | Public mint site | Lean read/submit: wagmi + viem + SWR + axios |
| \`gkoi-gallery\` | NFT gallery | Lean read-only browse/detail |

None of them owns any source of truth: collection/config/whitelist data is fetched
from the platform services as the same typed \`IResponseData<T>\` envelope the
services expose, and the server re-authorizes and re-enforces every mutation. The
frontends are projections.

## The design move that makes chain ops legible

The admin's core idea is counter-intuitive: for almost every privileged task, the
operator does **not** sign a raw wallet transaction. Instead the action is a
labeled button that POSTs to a backend the operator is already authenticated to,
and the chain/indexing work happens server-side. The REST client is a thin
cookie-auth axios wrapper — no bearer token ever sits in JS-readable storage:

\`\`\`ts
const axiosClient = axios.create({ withCredentials: true });
\`\`\`

Each action drives UX through a \`toast.loading → toast.update(success|error)\`
lifecycle and surfaces the server's own error message *verbatim*, guarded by an
\`isUserLoggedIn\` check:

\`\`\`ts
const toastId = toast.loading("Adding new collection...");
const url = \`\${env.MAIN_SERVICE_URL}/api/collections/add/\${tokenAddressOrSlug}?chainId=\${chainId}\`;
const { status, data: { data } } = await api().post(url, null);
if (status !== 201 || !data) throw new Error();
toast.update(toastId, { render: "Successfully added new collection!", type: "success", isLoading: false, autoClose: 3000 });
\`\`\`

So the operator clicks a clearly-named action, watches a live loading→result
toast, and never has to reason about calldata or gas for indexing an NFT
collection, reindexing it, or deleting it.

## On-chain state as read-only UI

Contract *state* is surfaced as plain dashboard values via wagmi
\`useReadContracts\`/\`useReadContract\` — no transaction required to *look*. The
presale hook reads \`owner\`, \`stage\`, and \`stagePrices\`, then maps the raw stage
enum to a human \`stageName\` and a \`formatEther\` price:

\`\`\`ts
const { data: contractReadsResults } = useReadContracts({
  allowFailure: true,
  contracts: [ { ...presaleContract, functionName: "owner" },
               { ...presaleContract, functionName: "stage" } ],
});
\`\`\`

## The one genuine chain write

There is exactly **one** real direct chain write in the whole admin: the swap
token redeem/claim, via wagmi \`useWriteContract\`, which submits the user's own
signed \`claim(...)\` through their connected wallet — never a server-held key. It's
the deliberate exception that proves the rule that privileged mutations are
otherwise delegated to the authenticated backend.

\`\`\`ts
const result = await mutateAsync({
  address: (siteConfigs?.gKoiSwapAddress as \`0x\${string}\`) || "",
  abi: gKoiMultiSwapABI, functionName: "claim",
  args: [payload.signatureData?.signature || "", id, payload.amountWei, payload.deadline],
});
\`\`\`

## Auth gate and operator breadth

Login is Privy (SIWE-style) → an HttpOnly session cookie (\`/api/login|verify|logout\`
route handlers) → an admin-role/permission verify, with a **tri-state gate**
(documented in the app's own flicker-design doc) built so the connect/sign dialog
never dead-ends when unauthenticated. Admin role is fetched from
\`gkoi-authentications\` — the frontend never decides authorization itself — and RBAC
hooks (\`useAdminAccessControl\`, \`useHasPermission\`, \`useIsSuperAdmin\`) gate a broad
operator surface: \`manage_collections\`, \`certified_nfts\`, \`art_contest_*\`,
\`communities\`, \`gcoin\`, \`guardians\`, \`power\`, \`quests\`, \`permissions\`,
\`announcements\`, \`admin_audit_log\`, \`gallery_whitelist\`, \`arenas\`, \`fighters\`, and
more.

## Testing & security posture

The admin ships Playwright e2e (\`playwright.config.ts\`, \`tests/\`) over the operator
routes; all three apps run Biome + \`ts.check\` + lint-staged and use
\`patch-package\`. Authorization is server-side by construction — cookie auth keeps
tokens out of JS, and the few chain writes go through the operator's own wallet.

## Honest note

On the public mint site, the actual on-chain \`buyPresale\` submit path is currently
**commented out behind a "SOLD OUT" state** — the code even carries a note that it
was left in place "so the presale can be re-enabled without rebuilding it." So a
live mint flow is *not* claimed as active here; what ships today is the eligibility
read, the claim-signature plumbing, and a SOLD-OUT UI.`,
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

Sentova is cross-device active protection: installable desktop
(Windows / macOS / Linux) and mobile (Android / iOS / iPadOS) apps backed by a
single Go protection service. Five detection modules run per device —
\`network_filter\`, \`ioc_scan\`, \`posture\`, \`behavior_monitor\`,
\`ransomware_guard\` — and a server-side engine derives one of three device
verdicts. Honesty is a stated product requirement: it does **not** claim to stop
every attack, and a per-cell platform tracker is the single source of truth for
what actually works today. In this build (P1), **only the Windows desktop column
ships real, tested enforcement across all five modules**; every other platform
cell is a specced code seam or a roadmap item, and the mobile scaffold renders
that truthfully in its capability panel.

| Verdict | Meaning |
|---|---|
| \`PROTECTED\` | No active indicators; posture within tolerance. |
| \`AT_RISK\` | Weakened posture or a provisional/unconfirmed signal. |
| \`COMPROMISED\` | A confirmed indicator or an executed enforcement trip. |

## One Go workspace, both sides sharing \`core\`

The repo is a single \`go.work\` workspace pinned to **Go 1.26.2** with toolchain
**go1.26.5** — a stdlib-CVE-patched compiler adopted without raising the language
version. The workspace \`use\`s five directories that resolve to four logical
modules (the fifth, \`apps/desktop/e2e\`, is a separate test module):

| Module path | Directory | Role |
|---|---|---|
| \`sentova/server\` | \`server\` | Backend modular monolith (\`:9700\`) |
| \`sentova/core\` | \`core\` | Shared pure logic, imported by **both** sides |
| \`sentova/desktop\` | \`apps/desktop\` | Wails app (unprivileged UI) |
| \`sentova/desktop-service\` | \`apps/desktop/service\` | Privileged Windows service |

The critical decision is \`core/\`: \`dsig\` (directive signing), \`feed\` (Ed25519
signed hash-prefix feed), \`hashprefix\` (Tier-1 filter), \`normalize\`, \`vocab\`,
\`wire\`. Because the exact same package is compiled into the server that *signs*
directives and the agent that *verifies* them, the wire / feed / directive
formats are byte-for-byte identical and cannot drift between the two sides.

## Five modules, six targets — the capability matrix

Each module's decision logic is platform-independent Go; what varies per OS is
whether it is wired to a real enforcement mechanism. The tracker states every
cell as one of four states, and the design docs (not the tracker) are the source
of truth where they disagree.

| Module | What it does | windows | macos | linux | android | ios | ipados |
|---|---|---|---|---|---|---|---|
| \`network_filter\` | Blocks blocklisted/phishing domains + infra (WFP on Windows) | SHIPPED-P1 | SPECCED-SEAM (P2) | SPECCED-SEAM (P2) | SPECCED-SEAM (P2) | SPECCED-SEAM (P3) | SPECCED-SEAM (P3) |
| \`ioc_scan\` | Matches STIX 2.1 indicators against files/processes/domains/hashes | SHIPPED-P1 | SPECCED-SEAM (P2) | SPECCED-SEAM (P2) | SPECCED-SEAM (P2) | N/A-OS | N/A-OS |
| \`posture\` | Scores hardening (patch age, disk encryption, firewall, lock, root/jailbreak) | SHIPPED-P1 | SPECCED-SEAM (P2) | SPECCED-SEAM (P2) | SPECCED-SEAM (P2) | SPECCED-SEAM (P3) | SPECCED-SEAM (P3) |
| \`behavior_monitor\` | Process/file/network activity with PID attribution (ETW) + module health | SHIPPED-P1 | SPECCED-SEAM (P2) | SPECCED-SEAM (P2) | ROADMAP-P2+ | N/A-OS | N/A-OS |
| \`ransomware_guard\` | Canary files + mass-encryption heuristics with real kill/quarantine | SHIPPED-P1 | SPECCED-SEAM (P2) | SPECCED-SEAM (P2) | ROADMAP-P2+ | N/A-OS | N/A-OS |

\`N/A-OS\` is deliberately distinct from \`ROADMAP\`: on iOS/iPadOS the OS forecloses
file/process scanning and behavioral tracing, so those cells will not ship *by
platform design* rather than "coming later". P2 targets a macOS System Extension,
a Linux root daemon (fanotify/eBPF) and Android native; P3 an iOS/iPadOS Network
Extension content filter.

## Privilege separation

The desktop agent is two processes with a hard privilege boundary:

- A **Wails** app (Go + WebView2 + relocated React) holds **no privilege** and is
  only an IPC client — it can request, never enforce.
- A privileged service, \`sentova-serviced\`, runs as **SYSTEM**, exposes **no
  network listener**, and is the only process that can terminate or quarantine.

They talk over a go-winio **named pipe** (\`github.com/Microsoft/go-winio\`), and
the privileged module's *only* third-party dependencies are that pipe library and
\`golang.org/x/sys\` for the WFP/ETW/DPAPI/ACL Win32 bindings — a deliberately tiny
trusted surface for the component that holds all the power.

The OS-abstraction seam is one interface file (\`platform/ports.go\`);
\`windows.go\` implements it for real, \`darwin.go\`/\`linux.go\` are not-wired seams.
Every port is designed around an attack it must survive — e.g. the process killer
must re-confirm identity before it acts, closing the PID-reuse window:

\`\`\`go
// ProcessKiller terminates a process by PID. Implementations MUST re-check the
// process identity (expectedName) before killing to avoid PID-reuse races.
type ProcessKiller interface {
    Kill(pid uint32, expectedName string) error
}
\`\`\`

## The signed-directive enforcement path

An agent that can kill and quarantine is a loaded weapon pointed at the machine
it protects, so the path from "an enforcement decision" to "the privileged code
that acts" is the most safety-critical thing in the product. It is a sequence of
fail-closed gates:

1. **IPC authorize.** The connecting peer's token SID must equal the enrolling
   user's SID — resolved **once at Accept by impersonation**, not per-request, to
   dodge a PID-reuse TOCTOU. Mutating ops additionally require integrity level
   \`>= IntegrityMedium\`; a Low-IL / sandboxed caller is refused, and a failure to
   read the level is itself a rejection. A relayed \`enforce_directive\` must also
   re-verify against the pinned server key — the channel is never trusted on a
   relayed directive's word alone.
2. **VerifyDirective — signature before everything.** A fixed six-step order
   (ported verbatim from the retired Rust implementation) so no forged field is
   consulted before the signature is proven: device-id binding → \`alg == ed25519\`
   → resolve pinned key by keyId (unknown ⇒ reject) → recompute the signed core
   over **canonical params** and verify the Ed25519 signature → **only then**
   expiry → known type + per-platform allowlist.

\`\`\`go
core := dsig.DirectiveSignedCore(env.ID, env.DeviceID, env.Type, paramsHash,
    env.CreatedAt, env.ExpiresAt, env.Nonce)
if err := dsig.VerifyB64(key, []byte(core), env.Sig.Value); err != nil {
    return Verified{}, directiveRejectedf("signature: %v", err)
}
// expiry checked AFTER signature so a forged expiresAt can't help
if expires < nowUnix { return Verified{}, directiveRejectedf("directive expired") }
\`\`\`

3. **One shared Enforcer.** A single struct is the only place a verified directive
   is driven through the kill / quarantine / network-filter ports, shared by the
   IPC path, the check-in loop, and \`confirm_directive\`. Destructive
   \`kill_process\`/\`quarantine_file\` are held for in-app confirmation; nil ports on
   a non-elevated run yield a non-applied \`"degraded"\` ack rather than a false
   success.

\`\`\`go
// Shared by the IPC path, the check-in loop, and confirm_directive so a directive
// enforces AT MOST ONCE (bounded by a shared ReplayGuard).
type Enforcer struct {
    killer      platform.ProcessKiller
    quarantiner platform.Quarantiner
    netFilter   platform.NetworkFilterBackend
    guard       *agent.ReplayGuard
    // ...
}
\`\`\`

4. **Bounded at-most-once ReplayGuard.** An expiry-keyed seen-cache keyed on
   **both** \`id\` and \`nonce\`; a re-seen id/nonce is rejected as \`replay\` after
   first acceptance, entries drop once the directive's own expiry passes, and
   capacity is bounded by evicting the soonest-expiring keys under a flood. Because
   the same guard sits behind all three entrypoints, dedup cannot be bypassed by
   choosing a path.

## Local-first ransomware response

A canary → correlate → kill/quarantine loop responds to a ransomware trip
**without a server round trip**. It drains canary events, runs \`ransomware_guard\`
decision logic, and on a critical trip immediately drives the local-first response
(kill the attributed process, quarantine the touched file). Filesystem-layer
events carry no PID, so an unattributed trip still quarantines the file and simply
skips the kill. A disabled \`ransomware_guard\` toggle takes no automated action but
still records an honest alert — and every "what Sentova did" string reflects what
*actually* happened, enforced by a banned-claims grep over shipped strings that
forbids a fixed success sentence.

## On-device scan honesty

The Windows \`ioc_scan\` feeds a platform target enumerator into an in-memory Tier-1
hash-prefix filter, single-flighted **per scope** so a burst of same-scope rescans
cannot spawn parallel disk walks. A not-ready rescan does **not** consume a replay
slot, so a redelivery can still scan; a Tier-1 hit is provisional until a Tier-2
confirm; a clean pass reports "no known indicators found" rather than silence.

## At-rest sealing and ACL hardening

- **DPAPI sealer** — \`CryptProtectData\`/\`CryptUnprotectData\` bind the device
  Ed25519 seed blob to Sentova with fixed app entropy: CurrentUser scope for a
  user-run dev build (works non-elevated, genuinely unit-tested), machine scope
  for the installed SYSTEM service, and never a UI prompt.
- **ACL hardening** — a protected DACL on \`%ProgramData%\Sentova\` and the
  quarantine store, closing the "0600 is ignored on NTFS → BUILTIN\Users can read"
  hole. It is elevation-gated: on a non-elevated dev run it is skipped
  (\`applied=false\`) rather than locking the user out.

## Authentication / IAM (the backend is the IdP)

argon2id passwords; EdDSA (Ed25519) access JWTs with a 15-minute TTL and refresh
rotation; opt-in TOTP (AES-256-GCM-sealed secret, argon2id recovery codes) and
WebAuthn passkeys with sign-count-regression fail-closed; an MFA step-up that
returns \`401 mfaRequired\` with a ticket and stamps \`amr\`/\`mfa\`/\`aal\` claims.
Authorization is a **roleless groups+policies PDP** with AWS-style resource names
(\`srn:sentova:<service>:<accountId>:<type>/<id>\`), default-deny and
explicit-deny-wins.

## Testing and security posture

Enforcement, IPC/verify, module logic, the replay guard, correlation and scan are
all covered by Go unit tests using **fake ports**, so they run anywhere. The split
is stated as plainly as the repo's own tracker states it: the **live**
system-mutating execution of WFP filtering, ETW telemetry and the
\`TerminateProcess\` kill primitive is **elevation-gated** and was **not executed on
this non-elevated build**. What *was* exercised non-elevated: the authenticated
named-pipe round-trip including an integrity-gated mutating op for a same-user
peer, and the CurrentUser DPAPI seal round-trip. A kernel/SYSTEM-equal attacker is
explicitly out of scope for P1.`,
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

Sentova MTD is a new anti-spyware / Mobile Threat Defense microservice (Go package
\`mtd\`, module \`github.com/sentova/mtd\`) inside the larger Sentova platform of Go
microservices behind an HMAC-authenticated gateway. It does **server-side forensic
analysis** of uploaded mobile artifacts — iOS sysdiagnose/backup, Android bugreport
— matched against a **STIX 2.1 spyware-IOC feed**, producing a deterministic
verdict. Following the platform's DB-per-service rule it owns an isolated
\`sentova_mtd\` database, and it mirrors the sibling \`surface\` service's
models/store/service/api/authz layout and the \`fieldcrypt.WithCipher\` boot
pattern.

| Collection | Holds | Sensitivity |
|---|---|---|
| \`mtd_indicators\` | STIX 2.1 indicators + lifted \`observables\` array | Curated intel (clear) |
| \`mtd_feeds\` | IOC feed registry + monotonic \`snapshotVersion\` | Metadata (clear) |
| \`mtd_artifacts\` | Uploaded forensic bundle record | High — PII, field-encrypted |
| \`mtd_verdicts\` | Analysis result + matches | Mixed — threat names clear, device values encrypted |

## The core idea: index seek, not pattern parse

A STIX 2.1 pattern is a *grammar*, not a key — matching thousands of raw patterns
per observed value is O(N) in the feed. So at ingest, MTD lifts every concrete
\`{kind, value}\` comparison out of the STIX pattern **once** into a denormalized,
indexed \`observables\` array (the raw \`pattern\` is retained only for provenance).
The match hot path becomes a seek over a multikey index:

\`\`\`go
// The match hot path: multikey over the embedded observables array. value
// leads (high-cardinality selector); kind narrows collisions.
{Keys: bson.D{
  {Key: "observables.value", Value: 1},
  {Key: "observables.kind", Value: 1},
}},
\`\`\`

The observable *kinds* are normalized categories — file hashes, network
indicators (domain / ipv4 / url), process names, provisioning-profile ids —
mapped from STIX object paths at ingest. The mapping is intentionally asymmetric
in one place: a STIX field is left unmapped where the artifact side cannot supply
a comparable value, because mapping it would silently read a real infection as
clean. Family resolves to \`pegasus | predator | reign | other\`, and
mercenary-spyware IOCs default to \`critical\`.

## Two-phase match, and the bug it avoids

Matching is a batched DB pre-filter followed by an in-memory confirm, and its
correctness turns on a subtle multikey trap:

- **DB pre-filter (one query, not one-per-observable).** A single scoped query
  pre-filters on value using the multikey index; the \`$elemMatch\` binds the value
  match to a *single* array element, and \`kind\` is deliberately **not** constrained
  here.

\`\`\`go
cur, err := s.indicators.Find(ctx, bson.M{
    "accountId":   bson.M{"$in": accountIDs},
    "observables": bson.M{"$elemMatch": bson.M{"value": bson.M{"$in": values}}},
})
\`\`\`

- **In-memory confirm.** The analyzer keeps only indicators at the feed's **active
  snapshot version** and confirms an exact per-element \`(value, kind)\` hit. The
  naive combined-key form \`{"observables.value": v, "observables.kind": k}\` is
  explicitly wrong on a multikey index: it can match \`v\` in one array element and
  \`k\` in a *different* one — a silent false positive — so the exact pairing is done
  in memory, not in the query.

\`\`\`go
// Confirm an EXACT per-element (value,kind) hit: the batched query pre-filtered
// on value only, so a value seen under a different kind must NOT match.
for _, iob := range ind.Observables {
    if !extracted[iob.Kind+"\\x00"+iob.Value] { continue }
    // ...record Match...
}
\`\`\`

This IXSCAN behaviour is a **structural** property, not a runtime assertion:
because \`observables\` is multikey-indexed, the value pre-filter *plans* as an
index seek rather than the collection scan a per-request STIX-pattern parse would
force. The data-model contract documents an \`explain\`-should-be-IXSCAN target,
but there is no mechanical \`executionStats\` acceptance gate in the repo — the
guarantee comes from the index, not from a test.

Both sides of the match are normalized identically; otherwise a match silently
misses. Feed ingest writes at \`active + 1\` and bumps the version pointer in one
update, so a half-written feed is never matched and a rollback is a
\`snapshotVersion\` decrement.

## Verdicts, privacy, tenancy

Verdict derivation is pure and deterministic — no Mongo, no bus:

| Condition | Verdict | Confidence / Severity |
|---|---|---|
| 0 matches, healthy parse | \`CLEAN\` | 1.0 / \`low\` |
| 0 matches, degraded / zero-observable parse | \`INCONCLUSIVE\` | 0.0 / \`low\` — a real state, never a CLEAN fallback |
| ≥ 1 match | \`COMPROMISED\` | strongest matched kind / max matched severity |

Confidence is derived from the strongest matched observable *kind* (a hash or a
profile id is a near-certain hit; a network indicator is strong; a process name is
the weakest single signal), and matches sort highest-severity-first with a
deterministic \`stixId\` tie-break so output is stable across runs. The severity
vocabulary \`low | medium | high | critical\` is shared platform-wide; family names
(the Pegasus / Predator / Reign mercenary class) are safe to name — the concrete
indicator values behind them are not.

Isolation and erasure are construction rules, because subjects may be under
state-level threat:

- Every document carries an \`accountId\` and every query filters on it. Match scope
  is the **union** of the caller's account and the shared \`platform\` account — a
  tenant sees its own private indicators plus the curated platform set, never
  another tenant's data.
- Identity is taken **only from the verified service-to-service context, never from
  a request body**, making body-tampering structurally impossible. Writing or
  enumerating the curated \`platform\` intel is gated to operator (platform-account)
  callers.
- Sensitive forensic fields (\`storageRef\`, \`deviceIdentifier\`, \`deviceName\`,
  \`extractedRecords\`, \`matches[].matchedValue\`, the inline \`rawArtifact\`) are
  **AES-256-GCM field-encrypted and never indexed**; structural fields stay clear
  so indexes and TTL keep working. The polled list endpoint projects *out* every
  encrypted field, so a poll fetches and decrypts nothing. Threat names
  (\`stixId\`/\`indicatorName\`/\`family\`) stay clear — they name the threat without
  revealing device contents.
- Retention is first-class: per-document \`expiresAt\` TTL indexes
  (\`expireAfterSeconds: 0\`) on artifacts and verdicts, plus scoped
  \`DeleteMany({accountId, principalId})\` erasure. The \`rawArtifact\` is encrypted
  *inline* in-document rather than as an external blob, so a doc delete plus the
  TTL fully cover the raw data with no external cleanup path to miss.

## Testing and security posture

Unit tests cover store encryption, matching, STIX parsing, verdicts,
normalization and feeds, driven by a hermetic offline STIX fixture in the
Amnesty MVT indicator format. Idempotent re-ingest is guaranteed by a unique
\`{accountId, stixId, feedVersion}\` index with an unordered bulk upsert. The
platform's standing security review is explicitly scoped to an older service set
and does **not** cover MTD — but the conventions MTD inherits (tenant isolation by
verified account, the HMAC s2s trust boundary, a default-deny PDP, typed BSON
queries, AES-256-GCM field encryption) are the reviewed-good platform baseline.`,
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
App-Router monolith with a strict, server-only backend, Mongoose 9 on MongoDB,
Redis for cache + rate-limit, S3 for images, and a hand-rolled AWS-IAM-style
authorization engine. But its more durable output is a **reference
architecture** — the Model → Service → Route triad that the owner's other
commerce apps (Chekka, Mogadget, Golden Bite) are cloned from. Get the skeleton
right once, and every new product spends its novelty budget on the actual
problem instead of re-litigating how a request becomes a database write.

## The Model → Service → Route triad

All server code lives under \`src/server/\` and imports \`"server-only"\`, so DB
handles, S3 clients and secrets can never be pulled into the client bundle.
Three layers, each with exactly one job and no reach past its own boundary:

| Layer | Lives in | Owns | Never touches |
|---|---|---|---|
| **Model** | \`models/<res>/{index,types}.ts\` | Mongoose schema + flat \`xxxDB()\` data-access fns; schema hooks; per-call Prometheus timers | HTTP, caching, business rules |
| **Service** | \`services/<res>/<verb>.ts\` (one fn per file) | Orchestration: models + S3 + Redis cache + notifications | \`req\`/\`Response\`, Mongoose internals |
| **Route** | \`app/api/<res>/route.ts\` | authorize → Zod \`safeParse\` → call service → response envelope | DB queries, cache keys, S3 |

**Model** — persistence plus the cross-cutting invariants, pushed *into schema
hooks* so every read path inherits them for free. In \`models/properties/index.ts\`
a \`pre("aggregate")\` injects the soft-delete filter and normalizes \`_id → id\`,
and a \`post("aggregate")\` fans stored S3 keys out to signed URLs with
\`Promise.allSettled\` so one bad key can't fail the whole batch:

\`\`\`ts
schema.pre("aggregate", function () {
  this.pipeline().unshift({ $match: { deleted: false } });
  this.pipeline().push({ $addFields: { id: { $toString: "$_id" } } });
  this.pipeline().push({ $project: { __v: 0, deleted: 0 } });
});
schema.post("aggregate", async (documents: IProperty[]) => {
  await Promise.allSettled(documents.map(async (doc) => {
    if (doc.image) doc.image = (await s3GetFileLink({ fileName: doc.image })) ?? doc.image;
  }));
});
\`\`\`

Every \`*DB\` function wraps a \`databaseResponseTimeHistogram\` timer labelled
\`{ operation, collection, method, success }\` and returns \`null\`/empty on a read
error rather than throwing — the service decides what an empty result means.
Ownership is a query-level invariant, not a post-hoc check: updates and deletes
filter \`{ _id, userId, deleted: false }\`, "delete" is a soft-delete \`$set\`, and
writes use \`returnDocument: "after"\` (never the deprecated \`new: true\`).

**Service** — one function per file, orchestrating models + S3 + Redis + notifications.
\`getProperties\` computes a namespaced Redis key, returns a cache hit, or fans a
\`Promise.all\` of the DB reads and caches the result under a 5-minute TTL:

\`\`\`ts
const query = getQueryKey({ userId, limit, offset, search, type, sort });
if (!refreshCache) {
  const cached = await redisRetrieveKeyString<GetPropertiesResult>(query);
  if (cached) return cached;
}
const [{ properties, total }, stats, unitStats] = await Promise.all([
  getPropertiesDB({ userId, ... }), getPropertyStatsDB({ userId }), getUnitStatsDB({ userId }),
]);
await redisUpdateKeyString(query, result, true, 5 * 60);
\`\`\`

**Route** — thin by construction: authorize → validate → call service → shape the
envelope, all inside the \`withApiHandler(withAuth(...))\` wrapper.

\`\`\`ts
export const POST = withApiHandler({ route: "/api/properties" }, withAuth(async ({ req, auth }) => {
  try {
    await authorize(auth, "properties:Create", arn.org.properties(resourceScope(auth)), { req });
    const parsed = await parseMultipart(req as NextRequest);
    const body = createPropertyBodySchema.safeParse(parsed.fields);
    if (!body.success) throw ErrInvalidFields;
    const result = await createProperty({ payload: { ...body.data, image, userId: auth.effectiveOwnerId } });
    return created(result, "Property created successfully");
  } catch (error) { return handleError(error); }
}));
\`\`\`

## The wrapper enforces order

\`withApiHandler\` composes the cross-cutting concerns in a deliberate, load-bearing
sequence. The CSRF Origin/Referer gate runs **before** the rate limiter — it is
the cheaper check (no Redis call), and a failed check must not spend a
rate-limit token — then Mongo readiness, the handler, and Prometheus timing:

| # | Step | Why in this position |
|---|---|---|
| 1 | CSRF Origin/Referer gate | cheapest check, no Redis; a reject must not burn a rate-limit token |
| 2 | Rate limit (100 req / 60s, Redis) | opt-out per route via \`rateLimit: false\` |
| 3 | \`connectMongoDB()\` | readiness before any handler DB call |
| 4 | handler | the actual route body |
| 5 | \`observe()\` Prometheus | wrapped so metrics never break a request |

\`\`\`ts
if (options.csrf !== false) {
  const reason = csrfReject(req);
  if (reason) { const res = fail(403, reason); observe(req, res.status, options.route, startNs); return res; }
}
if (rl) {
  rlResult = await enforceRateLimit(req, rl);
  if (!rlResult.allowed) return applyRateLimitHeaders(fail(429, "Too many requests..."), rlResult);
}
await connectMongoDB();
\`\`\`

## Access control: deny-wins, not roles

Two moving parts. \`withAuth\` resolves the JWT (with silent refresh-token
rotation and auto cookie reset) into an \`AuthResult\` whose load-bearing field is
\`effectiveOwnerId\`: the user's own id in personal scope, or the **org owner's
id** once they've switched into an organization — so org members transparently
operate on the owner's resources through a single evaluation path, and the org
owner is implicitly \`ADMIN\`.

Authorization itself is a real AWS-IAM-style policy engine (\`iam/engine.ts\`), not
inline role checks. \`evaluate()\` is pure — no I/O, no clock read (time arrives
via \`context.currentTime\`) — so it is deterministic and exhaustively
unit-testable, and it follows AWS semantics exactly: default-deny,
**explicit-Deny-wins**, allow only on an explicit matching Allow:

\`\`\`ts
for (const policy of policies) {
  for (const statement of policy.document.statements) {
    if (!statementMatches(statement, action, resource, context)) continue;
    if (statement.effect === "Deny") return { decision: "deny", reason: \`explicit deny by ...\` };
    if (statement.effect === "Allow" && !allow) allow = { statement, policyName: policy.name };
  }
}
return allow ? { decision: "allow", ... } : { decision: "deny", reason: "implicit deny (no matching allow)" };
\`\`\`

Above the policy loop sits a hard **tenant-isolation floor** in \`authorize.ts\`,
checked *before* any statement is considered — so even a wildcard customer
policy can never reach another tenant's resources:

\`\`\`ts
if (target.plane === "org" && target.orgId !== resourceScope(auth)) {
  return { decision: "deny", reason: "implicit deny (cross-scope org resource)" };
}
\`\`\`

Personal-scope users are handed an in-memory \`selfScopePolicy\` (Allow \`*\` on
resources under their own id) so there is one evaluation path for everyone —
no hardcoded decision branch in the engine. Platform-plane actions require an
active \`operator\` identity resolved from the DB; a disabled operator is denied
before any policy lookup. Denials are audited with the engine's reason, which is
never leaked to the client. This engine replaced ad-hoc role checks after the
audit found org-admins could remove the owner.

## Testing & security posture

**93 Vitest files** under \`tests/\` mirror the \`src/server\` tree; a \`globalSetup\`
drops every scratch DB the run created (isolated throwaway databases), and
coverage deliberately excludes \`runtime/\` and \`cron.ts\` as "coverage theater."
**16 Playwright specs** drive auth, 2FA, passkeys, properties, tenants,
organizations, the admin console, the portal, notifications, settings, and a
full-app drive.

The receipts are a real three-pass \`SECURITY_REVIEW.md\` (~40 findings): Pass 1
infra/dependency (C/H/M/LOW), Pass 2 an auth-gate audit (the S-series), Pass 3 a
backlog cleanup (\`__Host-\` cookies, CSRF Origin/Referer, tokens hashed at rest,
an \`updateUserRawDB\` allowlist). The standout is **S1** — "2FA was never enforced
on login; the toggle was decorative" — found by audit and fixed with a two-step
ticket flow (a 5-minute signed ticket, then \`POST /api/auth/login/2fa\`). Others:
a regex-injection in a user lookup, SVG/stored-XSS with magic-byte MIME sniffing,
and an unauthenticated \`/api/metrics\` in production.

## Deploy — one repo, two pipelines

A multi-stage \`Dockerfile\` (\`node:20-alpine\` deps → builder → runner, Next
standalone output, non-root \`nextjs:nodejs\` uid/gid 1001) that \`buildspec.yml\`
pushes to ECR via AWS CodeBuild (tagged with the 7-char commit hash, emitting
\`imagedefinitions.json\`); or an AWS Amplify build (\`amplify.yml\`). Same tree, two
targets.`,
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

Chekka ("before you buy — Chekka") is a Nigerian car inspection and verification
platform. A buyer books an inspection; a professional inspector verifies the
vehicle and files a structured report; the buyer gets a report they can trust
before handing over money. **Five roles** — buyer, inspector, consultant,
manager, admin — live in one \`users\` collection discriminated by a \`role\` enum,
with granular permissions attached to the \`manager\` role only.

## Descended from the reference architecture

Chekka is explicitly "built on the same conventions as \`managerenta-client\`" —
its README says so on line 5, and the spec's "Tech Stack & Code Conventions"
section embeds the exact skeletons the build then follows verbatim: the same
server-only \`src/server/\` triad, the identical \`withApiHandler(withAuth(...))\`
route shape, and the same Mongoose model conventions (\`pre\`/\`post("aggregate")\`
hooks, per-\`*DB\` \`databaseResponseTimeHistogram\` timers, \`select:false\`
soft-delete, \`mongoose.models[...]\` memoization). The infrastructure is
deliberately unsurprising so the surprise budget can all go to the domain.

## The inspection lifecycle is a state machine

The core \`inspections\` collection embeds the car, buyer contact, pricing
(\`price\`, \`platformFee\`), the full lifecycle timestamp set (\`assignedAt\`,
\`acceptedAt\`, \`startedAt\`, \`reportDeadline\`, \`completedAt\`, \`reportLockedAt\`, …),
the embedded report sub-schema, and a \`photoCount\`. Its \`status\` field is a
constrained enum that advances in one direction:

| Status | Meaning | Enters via |
|---|---|---|
| \`submitted\` | booked, awaiting assignment | \`createInspection\` |
| \`assigned\` | an inspector is attached | assign (or *at creation* → stamps \`assignedAt\`) |
| \`declined\` | inspector rejected — excluded from every dashboard bucket | decline |
| \`scheduled\` | inspector accepted; date set | accept |
| \`in_progress\` | inspection underway (\`currentSection\` tracks the live section) | start |
| \`report_processing\` | physical done; report being filed (\`reportDeadline\` runs) | complete-physical |
| \`completed\` | report locked & filed (\`reportLockedAt\` set) | \`submitReport(lock)\` |

Pricing is computed server-side in \`createInspection.ts\` from an admin-tunable
\`siteConfig.pricing\` (standard / premium; \`special_request\` = 0) plus a flat
\`URGENT_SURCHARGE = 10_000\`; assigning an inspector at creation stamps
\`assignedAt\` and jumps the status straight to \`assigned\`.

## Report integrity is the product

A report a buyer paid to trust must be immutable once filed, and its numbers must
be the server's — not the client's. On submit, Chekka **recomputes the summary
counts** from the checklist item statuses across all four sections and refuses to
touch a locked report:

\`\`\`ts
if (current.reportLockedAt) throw ErrReportLocked;
const all = [...report.exterior, ...report.interior, ...report.mechanical, ...report.roadTest];
const summary = { ...report.summary,
  passed:  all.filter((i) => i.status === "good").length,
  minor:   all.filter((i) => i.status === "minor").length,
  serious: all.filter((i) => i.status === "serious").length };
if (lock) { patch.status = "completed"; patch.reportLockedAt = new Date(); patch.completedAt = new Date(); }
\`\`\`

Locking also publishes a \`report_filed\` event to the admin live channel and
emits the buyer's "report ready" notification best-effort. Sharing a finished
report is a **read-only, self-expiring capability**: an unguessable \`uuidv4()\`
nonce maps to the inspection id in Redis under a 7-day TTL, so the link grants
unauthenticated read access to *one* report and the inspection id never appears
in the URL:

\`\`\`ts
const SHARE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const nonce = uuidv4();
await redisUpdateKeyString(shareKey(nonce), { inspectionId }, true, SHARE_TTL_SECONDS);
return { nonce };
\`\`\`

## Media and real-time

Photos are a separate append-only \`inspectionPhotos\` collection with a
denormalized \`photoCount\` maintained by atomic \`$inc\` — the decrement clamped
\`{ photoCount: { $gt: 0 } }\` so a race can't drive it negative — and stored S3
filenames are swapped to signed URLs (24-hour expiry) in the aggregate hook.
A live inspection feed rides Redis pub/sub → SSE (inspector-side actions publish;
buyer and admin consume), with \`currentSection\` tracking which report section is
in progress. Report PDFs are rendered with \`@react-pdf/renderer\`. Overdue
enforcement queries \`status: "report_processing", reportDeadline < now\` for the
admin "Overdue Reports" view.

## Testing & security posture

**15 Playwright specs** cover auth and auth-gating, booking, the inspection flow,
inspector photo upload and report UI, the live feed, share links, consultant
chat, and the admin queue/managers/site-config. Unit coverage is thinner than
Managerenta's — no Vitest is configured here — so the safety story leans on the
inherited spine: the shared \`withApiHandler\` (rate-limit + CSRF), \`withAuth\`
(JWT + refresh rotation), Zod on every body, and report-lock immutability.

**An honest correction to the internal brief:** the driving spec
(\`Chekka_Core_Features.md\`) is **4,728 words across 596 lines**, not the "37k"
the brief claimed — a dense, well-structured twelve-feature document, not an
inflated one.`,
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
It was refactored (a "Wave 3 carbon-clone") to mirror the Managerenta reference
patterns, and it is the **origin of the "Golden Bite arch"** that Adverta later
clones — a dedicated \`src/server/\` layer with \`databases/\` + \`runtime/\`, an
ioredis singleton, a structured Redis-key cache with explicit invalidation,
Prometheus metrics, extracted Zod validators, and \`withApiHandler\` on every route.

## The per-operation service + IAM discipline

The name is literal: services are **one file per operation** plus a barrel. E.g.
\`services/orders/\` holds \`createOrder\`, \`updateOrderStatus\`, \`checkOrderCapacity\`,
\`computeOrderTotals\`, \`ordersForKanban\`, \`attachDriver\`, \`setDeliveryProof\`,
\`todaysOrders\`, … re-exported per namespace (\`export * as orders from "./orders"\`).
Below them, the models layer is likewise per-operation \`*DB\` functions, each
Prometheus-instrumented. IAM is a **5-role union**
(\`customer | kitchen | delivery | manager | owner\`) with role groups defined once
(\`STAFF_ROLES\`, \`ADMIN_ROLES\`). Two enforcement styles coexist: a
\`withAuth(handler, ...roles)\` wrapper and inline sentinel-error checks inside
handlers — so the shape is **one operation → one service call → one role gate →
one audit action**:

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

The edge \`proxy.ts\` (Next 16's renamed middleware) does only a cheap
cookie-presence redirect and is explicitly **not a security boundary** — the role
is re-checked in every handler. Each write is independently gated *and* audited:

\`\`\`ts
export const POST = withApiHandler(
  { route: "/api/admin/menu/products" },
  auditAdmin(postHandler, { action: "product.create", targetType: "product", captureBody: true }),
);
\`\`\`

## The cross-cutting spine

\`withApiHandler\` wraps every route with a fixed order of work — a Redis
fixed-window rate limit (default 100/min/IP, emitting \`X-RateLimit-*\` +
\`Retry-After\`), then the inner handler, then \`handleError\` to the canonical
envelope, then a Prometheus observation that *always* fires. Reads are
cache-first per operation: \`listProducts\` builds a namespaced key, returns a
presigned cache hit, or runs the DB work and sets a 5-minute TTL:

\`\`\`ts
const key = getQueryKey({ categorySlug, query, featured, limit });
if (!refreshCache) {
  const cached = await redisRetrieveKeyString<IProduct[]>(key);
  if (cached) return presignAssetFieldsList(cached, ASSET_FIELDS, CACHE_TTL_SECONDS);
}
// … DB read …
await redisUpdateKeyString<IProduct[]>(key, result, true, CACHE_TTL_SECONDS);
\`\`\`

The ioredis singleton runs a **5-second boot ping that throws loudly rather than
falling back to memory**; Zod validators are \`.strict()\` per operation; SWR + a
\`withCredentials\` axios client (with a loop-guarded 401→login interceptor) drive
the client; two Prometheus histograms (\`http_request_duration_seconds\`,
\`database_request_duration_seconds\`) make every route and every DB call
independently observable; and parallel \`auditAdmin\`/\`auditUser\` streams fire in a
\`finally\` so they survive a throw.

## Testing & security posture

Coverage is **Playwright e2e only** (auth, admin pages, admin-nav layering, order
lifecycle, session persistence), serial on a dedicated port \`3007\` with a
hermetic S3 fallback (the config blanks AWS creds). Honest flags carried into the
case study: there is **no unit-test runner** (no Vitest/Jest — automated coverage
is Playwright + \`ts.check\` only), and \`/api/metrics\` plus the dev
\`otp-peek\`/\`reset-token-peek\` routes are **unauthenticated** and should be
prod-disabled or protected at ingress. Auth is \`jose\` HS256 sessions
(httpOnly + \`sameSite=lax\`, \`secure\` gated by env), bcryptjs passwords, and
OTP/reset flows with TTLs; sentinel errors map to a \`{code,message,data}\` envelope
via \`handleError\`.`,
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
the whole model, and that preposition turns an ordinary catalog into a
scheduling problem: **inventory that expires.**

## Two backends, honestly

The repo carries **two distinct backends**, and the one actually shipped is not
the Prisma one:

| Dimension | \`prechop/\` — the live app | \`prechop-api/\` — the standalone twin |
|---|---|---|
| Framework | Next.js 16 App Router (frontend **and** API in one) | Fastify 5 API + a separate worker process |
| Store | MongoDB via **Mongoose 9** | PostgreSQL via **Prisma 7** (cuid ids) |
| Background work | in-process \`cron\`, no queue | **BullMQ** delayed jobs + worker |
| Cutoff auto-close | per-minute \`cutoff-sweep\` cron under a Redis lock | delayed job keyed \`jobId = dailyOrderId\`, fires at cutoff |
| Slot oversell guard | \`INCRBY\`/\`EXPIRE\` reservation counter | \`SET NX\` per-(item,order) lock |
| Queue infra | none | Redis-backed BullMQ |

Both implement the same domain (dated listings, cutoffs, Paystack split prepay,
oversell guards), so this case study draws the cleanest expression of the *data
model* from \`prechop-api\`'s Prisma schema and the *shipped scheduling mechanics*
from the Next.js app — without pretending Postgres/Prisma is the live store. The
Prisma schema is worth reading on its own: money is **integer kobo** everywhere,
a \`DailyOrder\` snapshots item name/price/image/prep-time at listing-creation, and
a \`Payment\` carries a unique \`idempotencyKey\` and a \`webhookVerified\` flag.

The live \`prechop/\` backend layers under \`src/server/\`: \`constants/\`,
\`databases/\` (Mongo + Redis singletons), \`lib/\` (a \`withApiHandler ∘ withAuth\`
composition, response envelope, CSRF, rate limit), 17 Mongoose \`models/\` with
typed \`*DB\` functions, \`providers/\` (Paystack, Sendchamp, Resend, S3, web-push),
\`services/\`, and Zod \`validators/\`. It even carries a full IAM subsystem
(policies/groups, \`services/iam/can.ts\`) the brief never mentioned.

## Cutoff enforcement — the interesting part

Enforcement is layered. A **read-time guard** runs on every order attempt — a
"coming soon" check for a not-yet-open listing plus
\`if (cutoffTime <= now) throw CutoffPassed\` — so no scheduler race can let a late
order slip through even if a sweep is delayed. The **scheduled auto-close** is
where the two backends diverge. \`prechop-api\` enqueues a **BullMQ delayed job
keyed by listing id** that fires *exactly* at the cutoff:

\`\`\`ts
async function scheduleDailyOrderAutoClose(dailyOrderId, cutoffTime) {
  const existingJob = await cutoffEnforceQueue.getJob(dailyOrderId);
  if (existingJob) await existingJob.remove();
  const delay = Math.max(0, cutoffTime.getTime() - Date.now());
  await cutoffEnforceQueue.add("close-daily-order", { dailyOrderId },
    { jobId: dailyOrderId, delay, removeOnComplete: true, removeOnFail: true });
}
\`\`\`

The live app instead runs a **per-minute cron sweep** where each of eight
\`CronJob\`s is wrapped in \`runSingleInstance\` — a per-process token plus a Redis
lock so that under horizontal scaling only one instance per tick does the work:

\`\`\`ts
const key = \`cron:lock:\${DB_NAME}:\${job}\`;
const got = await acquireLock(key, INSTANCE_ID, ttlSeconds);
if (!got) return;
try { await fn(); } finally { await releaseLock(key, INSTANCE_ID); }
\`\`\`

Several jobs pass \`PLATFORM_TIMEZONE\` (Lagos) as a load-bearing argument, not
decoration: \`cron\` schedules in the server's local time, so on a UTC host the
nightly sold-out reset would fire at 01:00 Lagos and leave every sold-out item
dark through the first trading hour.

Closing a listing isn't the same as "stop new orders": a separate
\`cutoff-enforce\` job (\`sweepStalePaidOrders\`) **auto-cancels and Paystack-refunds**
every PAID-but-unconfirmed order the vendor took money for and never committed to
cook — its 280s lock TTL deliberately outlives a slow batch of Paystack round
trips so the next tick can't start an overlapping sweep. And the 30-minute
pre-cutoff *warning* would fire 30 SMS from a per-minute sweep, so it's deduped
with a per-listing \`SET NX\` whose TTL outlives the window; the key is never
released because **expiry is the reset**, and a lost lock (Redis down) yields *no*
warning rather than a duplicate — the safe direction for a message that costs
money to send.

## Money and oversell safety

Order placement is **server-authoritative**: the client sends only ids, and the
server resolves and prices items *and* add-ons (rejecting an add-on that doesn't
belong to the exact daily-order item), computes totals, and **initialises
Paystack before any DB write** — on failure it releases the Redis slot locks and
persists nothing. Paystack runs on **split subaccounts** with a per-transaction
charge so the platform absorbs the processing fee, not the vendor. The webhook
verifies an **HMAC-SHA512** signature on the *raw* body with \`crypto.timingSafeEqual\`
*before* doing anything, then handles only \`charge.success\`, checks idempotency,
verifies the paid amount equals the record, and transitions the order. Finite
\`maxQuantity\` slots are guarded separately with atomic Redis reservations —
availability = capacity − committed − reserved — that roll back cleanly under
contention:

\`\`\`ts
const reservedAfter = await Redis.incrby(key, item.quantity);
await Redis.expire(key, ttlSeconds);
acquired.push({ id: item.dailyOrderItemId, qty: item.quantity });
if (item.committed + reservedAfter > item.maxQuantity) {
  for (const a of acquired) await decrReserved(a.id, a.qty); // roll back all
  return { ok: false, failedItemId: item.dailyOrderItemId };
}
\`\`\`

## Testing & security posture

Vitest runs against a **per-worker throwaway DB** (\`prechop-vitest-<pid>-<pool>\`)
whose \`globalSetup\` mints the id and guarantees the scratch database is dropped
even when a worker crashes — never the dev DB — across ~35 test files (models,
services incl. \`iam\`/\`dailyOrderFlow\`/\`cronSweeps\`, providers). The Playwright
config is instructive in its own right: it defaults to an obscure port (\`3187\`)
and *refuses* to reuse a running server after a real incident where the suite
silently ran against \`adverta-web-1\` on a shared port, uses a dedicated throwaway
Mongo + Redis logical db dropped after the run, and runs \`next start\` in
production mode so the prod boot guard (\`assertRuntimeConfig\`) is exercised by
e2e. Security: server-authoritative pricing, idempotency keys, AES-256-GCM
encryption for vendor bank details, dual-secret HS256 JWTs (access + refresh
cookies), Redis-backed rate limiting, and a \`GET /api/health\` that returns 200
only when both Mongo *and* Redis answer.`,
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
and the backend is a deliberate "carbon-clone" of the Golden Bite arch:
per-operation \`*DB\` model fns, per-op service files with a Redis read-through
cache, Prometheus histograms, a \`{code,message,data}\` envelope, and AWS-style
IAM.

An honest correction to the internal brief: the backend is **Hono + Mongoose 8 /
MongoDB**, *not* Fastify/Prisma, and "per-operation database/service" means code
structure plus application-level IAM, **not** distinct database credentials.

## The shared, typed API contract

| Workspace | Package | Role |
|---|---|---|
| \`apps/web\` | \`@adverta/web\` | Next.js UI; proxies \`/api/*\` → the API via a \`next.config\` rewrite. Never imports \`core\`. |
| \`apps/mobile\` | \`@adverta/mobile\` | Expo / React Native; bearer access token in memory + rotating refresh in \`expo-secure-store\`. |
| \`services/api\` | \`@adverta/api\` | **Hono** on \`:4000\`, \`/api/v1\`; owns all data access. \`tsx\` runs the TS directly — no build step. |
| \`packages/core\` | \`@adverta/core\` | models / services / DB clients / middleware / metrics / bootstrap (Mongoose 8, ioredis). |
| \`packages/contracts\` | \`@adverta/contracts\` | zod schemas + route table + IAM catalog — a zod-only leaf. |
| \`packages/api-client\` | \`@adverta/api-client\` | one transport-agnostic \`ApiClient\` for all three callers. |

The purist boundary is the point: **neither web nor mobile imports \`core\`** — both
speak to \`services/api\` over HTTP through \`@adverta/api-client\`, sharing the
\`@adverta/contracts\` schemas, and every package is consumed as **raw TypeScript
via \`exports\` maps with no build step**. So a contract change breaks the *compile*
of both apps in the same commit (\`yarn ts.check\`), not as a runtime surprise —
there is no "the mobile app is two versions behind the endpoint" class of bug,
because the endpoint's request schema and the client's input type are the *same*
Zod object. The mobile client de-dupes concurrent 401s via a single
\`refreshInFlight\` promise so its single-use rotating refresh token is spent
exactly once under a burst. Backing services are hard requirements wired in
\`bootstrap()\` (no in-memory fallback), with \`/healthz\` (liveness) and \`/readyz\`
(Mongo ping + Redis PING, 503 when down) probes.

## Billing-aware campaigns and money safety

\`ICampaign\` carries \`format\` (\`boost|sponsored|blast|banner\`), \`status\`, a budget,
spend, targeting, and metrics — visibility modelled as a paid, time-bound thing.
The load-bearing move is an **atomic budget draw**: spend + a lead are booked only
while \`spentNaira + amount <= totalBudgetNaira\`, enforced by a \`$expr\` in the
*query filter* so check-and-book is one indivisible act with no concurrent
overspend:

\`\`\`ts
const result = await Campaign.findOneAndUpdate(
  { _id: id, $expr: { $lte: [{ $add: ["$spentNaira", amountNaira] }, "$totalBudgetNaira"] } },
  { $inc: { spentNaira: amountNaira, leads: 1 } },
  { returnDocument: "after" },
).lean<ICampaign>();
\`\`\`

Attribution is derived server-side and **ignores any client \`campaignId\`**;
billing fires only on the trusted \`startConversation\` path, keyed on a
\`billingActorId\` to defeat Sybil drain; totals are always recomputed, never
trusted. The Paystack webhook verifies the signature first, moves the ledger only
on \`charge.success\` with an exact amount match, and is idempotent via unique
provider/charge refs — non-2xx on failure so Paystack retries.

## Agency white-label and per-request IAM

The multi-tenant agency layer (tiered agencies with a white-label \`brandColor\`,
joined to client businesses via \`agencyClients\`) enforces tenancy in
\`withPermission\`: \`resolveScopedAgencyId\` takes the agency id **from the session,
never the request**, and holding a feature permission is not enough to reach
another tenant — a platform operator (\`metrics:read\`) is the only principal who
may inspect any tenant via an explicit query. IAM itself is AWS-flavoured with
**no role layer**: a flat \`resource:action\` permission catalog, policies of
Allow/Deny statements where an explicit **Deny always wins**, and groups that
bundle policies:

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

A user's effective set is **re-resolved from the database on every request**
(Redis-cached for 30s; an inactive account resolves to the empty set = deny all),
so an admin's revocation or deactivation bites within seconds, not at next
sign-in.

## Redis, metrics & testing posture

Redis is an ioredis singleton on \`global.__advertaRedis\` (HMR-safe) that pings on
boot and fails loud, with glob delete via non-blocking \`SCAN\`; read services
cache under \`services:<domain>:<method>:<params>\` and **never cache empty
results**. Prometheus exposes two histograms — \`http_request_duration_seconds\`
(observed in \`withApiHandler\`) and \`database_request_duration_seconds\` (observed
in every \`*DB\` fn) — at an anonymous \`/api/v1/metrics\`. Vitest targets a throwaway
db whose \`globalSetup\` **refuses any db not prefixed \`adverta_vitest\`**; Playwright
covers e2e; CI runs \`ts.check\`, Biome, core tests, and both Docker builds
(asserting non-root images with no baked-in \`.env\`). A prod boot guard exits
before binding if \`JWT_SECRET\` is missing or under 32 chars, delivery credentials
fail closed with a 503 rather than lie, and Pusher private channels are signed
only after the server verifies participation.`,
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

Mogadget is a single-owner gadget catalog for a Lagos store. Visitors browse and
filter a catalog and order by tapping **"Chat on WhatsApp"** or **"DM on
Instagram"** — there is deliberately **no cart, no checkout, no online payment,
and no customer accounts**. The product doc says it in the first four lines and
again in §8: "no step in this flow touches a cart, checkout, or account system."
It reuses the Managerenta triad but adds two layers of its own: a pure
\`src/server/domain/\` of business rules and a typed client \`src/lib/\` API wrapper.

## Architecture — triad plus a pure domain layer

The server folders are the familiar \`models/\`, \`services/\` (one function per
file), \`validators/\`, plus \`domain/\` — pure, DB-free, unit-tested rules
(\`whatsapp.ts\`, \`naira.ts\`, \`slug.ts\`, \`product.ts\`). Structural logging is
\`pino\`, unique to this app. The \`products\` model carries a compound browse index
\`{ isVisible, category, condition, priceNaira }\` and a text index
\`{ name, brand, description }\`, and \`listProductsDB\` sinks unavailable items below
available ones after the DB sort:

\`\`\`ts
// SOLD / OUT_OF_STOCK always sink below available items (product doc §5.2).
const rank = (p: IProduct) => (p.status === "SOLD" || p.status === "OUT_OF_STOCK" ? 1 : 0);
result.sort((a, b) => rank(a) - rank(b));
\`\`\`

## The domain invariants — two product shapes, enforced

The interesting modelling lives in \`domain/product.ts\`: a NEW item and a
pre-owned unit are structurally different records, and \`assertProductInvariants\`
rejects any mixture on every write:

| Rule | NEW | Used (UK / US / NG) |
|---|---|---|
| \`cosmeticGrade\` | must be \`null\` | required (A / B / C) |
| \`stockType\` | \`RESTOCKABLE\` | \`UNIQUE_UNIT\` |
| \`status\` | \`IN_STOCK\` / \`OUT_OF_STOCK\` | \`AVAILABLE\` / \`SOLD\` |
| \`quantity\` | integer ≥ 0 | \`null\` |
| sold-out expressed as | quantity 0 → auto-hidden | \`SOLD\` |

\`\`\`ts
if (isNew) {
  if (p.cosmeticGrade !== null) bad();
  if (p.stockType !== "RESTOCKABLE") bad();
  if (!restockStatuses.includes(p.status)) bad();
  if (p.quantity === null || p.quantity < 0) bad();
} else {
  if (p.cosmeticGrade === null) bad();
  if (p.stockType !== "UNIQUE_UNIT") bad();
  if (!uniqueStatuses.includes(p.status)) bad();
  if (p.quantity !== null) bad();
}
\`\`\`

A companion rule, \`stockAwareVisibility\`, auto-hides a \`RESTOCKABLE\` listing the
moment its quantity hits 0 — enforced on every write, *not* gated behind the
admin visibility toggle — but restocking never auto-unhides it: re-listing stays
a deliberate admin choice.

## The "no cart" core: WhatsApp / Instagram hand-off

The order flow *is* the hand-off. \`domain/whatsapp.ts\` builds a deep link whose
prefilled message identifies the exact product and price, so negotiation and
payment happen entirely in-chat, off-platform:

\`\`\`ts
export function buildWhatsAppLink(p: { name: string; priceNaira: number; url?: string }): string {
  const base = \`Hi, I'm interested in the \${p.name} (\${formatNaira(p.priceNaira)}) listed on MoGadget\`;
  const msg = p.url ? \`\${base} — \${p.url}\` : base;
  return \`https://wa.me/\${WHATSAPP_NUMBER}?text=\${encodeURIComponent(msg)}\`;
}
\`\`\`

Click tracking must never block the sale, so the client fires **before**
navigation with \`navigator.sendBeacon\` (keepalive \`fetch\` fallback), wrapped in
try/catch — "analytics are best-effort — never interrupt the sale." The server
does an atomic \`$inc\` on the product's channel counter, then a best-effort append
to a time-series log whose failure is logged via \`pino\` but never fails the click:

\`\`\`ts
const productId = await incrementClickDB({ slug, channel }); // atomic $inc, returns null if gone
if (!productId) return false;
try { await insertClickEventDB({ productId, slug, channel }); }
catch (err) { getLogger().warn({ err, slug, channel }, "click-event insert failed (click still recorded)"); }
\`\`\`

## Analytics without a cron and without PII

The \`clickEvents\` collection is an append-only event log with a **MongoDB TTL
index** for automatic 180-day retention — no cron job — plus a secondary index
that supports a day-by-channel \`$group\` trend query. It stores no PII:

\`\`\`ts
const RETENTION_SECONDS = 180 * 24 * 60 * 60; // 180 days
// Automatic retention — no cron. TTL must be a single-field index.
ClickEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });
ClickEventSchema.index({ createdAt: 1, channel: 1 });
\`\`\`

## An honest tension: the doc said "one admin," the build shipped IAM

The product doc argued for a single admin login and no permission framework
(§13/§21) — but the shipped app carries a full IAM stack: users, groups and
policies gated by a \`withPermission(handler, ...required)\` wrapper, plus WebAuthn
passkeys and TOTP 2FA with recovery codes. The doc's line-22 "Historical note"
flags the pivot honestly rather than pretending the plan never changed. The
public click endpoint stays unauthenticated by design — but it carries no PII.

## Testing & security posture

**39 colocated Vitest specs** sit beside their subjects — \`domain/\` rules,
\`services/products/*\`, the \`products\` model, and the client \`src/lib/\` API
wrappers all have adjacent tests — giving strong unit discipline over the
invariants and the hand-off. Playwright covers the public catalog, admin, admin
analytics, and settings. Tooling is \`pnpm\` + Biome + Vitest + Playwright, and the
dev server runs on port 6060.`,
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

Aisolver (package \`taskwise-v2\`, repo \`taskwise-dev\`) undersells itself as "a
rebuilt task manager." It is a collaborative task- and project-management
platform with **built-in AI agents that act on the user's own data** — its own
architecture doc frames it as "Todoist + Notion + a team of AI assistants that
can actually do the work." Every user gets a personal *butler* agent, can hire
*specialist* agents, group them into *squads*, and share them through
*workteams*. The shipped surface (live on prod) spans a chat pipeline, Agent
Skills, sandboxed artifacts, lists/tasks, files/docs/sheets, drives, contacts, a
calendar, a durable orchestration/job engine, BI dashboards, business-process
flowcharts, an admin console, and IMAP/SMTP mail with an email assistant. The
classic task-manager surface — nested lists, drag-drop, a calendar, alarms,
trash, invite-code registration — is the *substrate* the agents operate on, not
the whole product.

## The monorepo shape

It's a pnpm workspace (\`apps/*\`, \`packages/*\`) with two deployables and a shared
package:

- **\`apps/api\`** (\`@taskwise/api\`) — **Fastify 5 · TypeScript ESM · \`node-pg\` ·
  PostgreSQL 17, no ORM**. The AI turn pipeline, the tool registry ("tool book"),
  Agent Skills ("skill book"), sandboxed artifacts, squad routing, and the
  orchestration/job engine all live under \`apps/api/src/lib/agentRuntime/\`.
- **\`apps/web\`** (\`@taskwise/web\`) — **React 19 · Vite 5 · Tailwind v4 · TanStack
  Query 5**, with a custom \`pushState\` router (no React Router) and server state
  in React Query (no Redux); the centrepiece component is \`V2ChatThread\`.
- **\`packages/chat-ui\`** (\`@aisolver/chat-ui\`) — the shared chat UI, consumed as
  \`workspace:*\`.

Two kernels hold a codebase this size together — a \`sql\` tagged-template that
makes unparameterized SQL a *compile* error, and a WebSocket bus that survives
reconnects — but the thing I reach for first when I open the repo is the
architecture lint.

## The architecture lint that fails the build

The centrepiece of the discipline is \`tools/arch-check.ts\`: a **zero-dependency**
(\`node:fs\` + \`node:path\` only) guard, run as \`pnpm arch:check\`, that **exits 1 on
any violation** so CI and the pre-push hook fail. "Please don't import the
database from the route layer" is a code-review plea that erodes under deadline;
a red check does not get tired. It enforces five distinct classes of decay and
emits three non-gating visibility reports:

| Rule | Scope | What it forbids | Gate |
|---|---|---|---|
| \`routes↛routes\` | \`routes/\` **and** \`v2/routes/\` | a route file importing another route file — with a Stage-6B exception for co-located module composition | exit 1 |
| \`lib↛routes\` | \`lib/\` **and** \`v2/lib/\` | the lower layer importing the upper | exit 1 |
| static import-cycle ceiling | all of \`apps/api/src\` | any file inside a static import cycle; ceiling \`CYCLE_CEILING = 0\` (override \`ARCH_CYCLE_MAX\`) | exit 1 |
| legacy-path ban | all of \`apps/api/src\` | any relative specifier referencing the old \`agentWorker\` or \`v2/lib\` paths | exit 1 |
| \`raw-anthropic-fetch\` | all of \`apps/api/src\` | hitting \`api.anthropic.com/v1/messages\` off a 6-entry allowlist | exit 1 |
| cycles / LOC / mixed-SCC reports | all of \`apps/api/src\` | *nothing* — visibility only | never |

The v2 chat pipeline was, for a while, the most active subtree and completely
unguarded; Stage 4 of the audit remediation turned the route/lib roots into
**sets** spanning both v1 and v2 so the boundary rules cover it too.

## How the lint reasons about a cycle

The import-cycle rule is the interesting one. It builds the full intra-repo
static import graph over *all* of \`apps/api/src\` (not just the route/lib
boundary), runs an **iterative Tarjan SCC** (iterative precisely to avoid a
stack overflow on a deep graph), and fails if the count of files sitting in any
strongly-connected component of size ≥ 2 exceeds the ceiling. The ceiling is
**0**, and a comment records the burn-down as each cut landed:

\`\`\`ts
// 0 — apps/api/src has NO static import cycles. Any new one fails the build.
// (History: 106 pre-H5 → 43 mixed-edge → 13 static after the H5 keystone/
// turnLocks cuts → 10 after the squadRouting vocative-leaf extraction → 0
// after lazy-loading synthesis→dispatch.)
\`\`\`

Only **static** edges count. Dynamic \`import()\` is the *sanctioned* way to break
a static cycle — it defers to runtime and creates no module load-order / TDZ
hazard, which is the actual concern — so counting it would over-report a
deliberately dynamic-broken edge as a violation. The legacy-path ban and the raw
fetch guard, by contrast, scan *all* import kinds (static, dynamic, and
side-effect \`import '…'\`).

The Stage-6B exception is how the lint allows *some* route→route imports without
opening the floodgates: a route god-file may be decomposed into a co-located
\`routes/modules/<name>/\` subtree, and only two edges are legal — a sibling within
the same module dir, and the thin composer \`routes/<name>.ts\` importing its own
module. Everything else stays a violation:

\`\`\`ts
function isSanctionedModuleImport(file: string, target: string): boolean {
  const tm = moduleNameOf(target);
  if (!tm) return false;
  if (moduleNameOf(file) === tm) return true; // sibling within the module
  return file.replace(/\\\\/g, '/').endsWith(\`/routes/\${tm}.ts\`); // the module's composer
}
\`\`\`

The last rule is a domain-specific invariant, not a generic layering one: every
non-streaming Claude call must go through the resilient \`callClaude\` wrapper
(credit accounting, 429/retry, telemetry), so any file hitting the Anthropic
messages endpoint that isn't one of six intentional raw callers is a violation.
The allowlist is documented inline with *why* each entry is exempt — the
streaming turn has its own retry, the skills path needs Files-API hosts
\`callClaude\` can't serve, and so on.

## The \`sql\` tagged-template kernel

Every SQL statement platform-wide is a \`\` sql\`…\${v}…\` \`\` \`SqlFragment\`; the string
overloads were deleted so **raw-string SQL does not compile** — \`tsc\` is the
gate. \`sql.raw\` is the sole non-binding splice, guarded by its own checker with
an allowlist ledger, and a corpus tap records \`{text, values}\` at the pg boundary
for byte-identity proofs. Parameterization stops being a habit you can forget and
becomes a property the type system enforces.

## realtimeBus — WebSocket with replayable history

Live updates were **migrated off SSE onto WebSocket**; the legacy in-process SSE
subscriber map was removed outright. The replacement, \`realtimeBus\`, is a
WS-native per-user notification bus (\`@fastify/websocket\`) built as a swappable
interface so a future cross-process Redis-Streams/NATS migration is a single-file
swap. Per user it keeps a \`Set<WebSocket>\` (multi-tab safe), a **ring buffer** of
recent frames (\`RING_SIZE = 500\`, TTL-trimmed at 5 min) for reconnect replay, and
a **monotonic serial**. Every frame embeds a process-wide \`processStartMs\`
captured at module load, so a client reconnecting after a server restart is told
the buffer is gone and falls back to a refetch — an at-least-once protocol with
explicit gap detection via a resume handshake (\`resume\` →
\`resumed\`/\`resume_unavailable\`). Ephemeral frames (presence, editing, typing) are
delivered live but *not* retained, so a resume never resurrects a stale "✏️
editing" pill.

## Testing, deploy & security posture

Web unit tests use Vitest + Testing Library + happy-dom; API contract tests run
through two harnesses — \`tools/api-sim\` (a fast, deterministic REST+DB suite with
no LLM, the everyday gate) and a slow, nondeterministic \`tools/chat-sim\` for
agent behaviour — under a "no flaky tests" policy, and \`arch:check\` is a hard CI
gate. Security: invite-gated signup, admin pinned to a single uid + 2FA,
\`sanitize-html\` on inbound mail, parameterized SQL enforced by the \`sql\` kernel,
and a per-operation permission kernel. Deploy is AWS/EKS via three ordered
Terraform stacks (\`bootstrap → envs/dev → cicd\`) sharing one S3 backend, with a
private-only EKS API, RDS PostgreSQL, a CloudFront+S3 SPA, IRSA roles, and
External Secrets Operator.`,
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
audit call — one \`page.tsx\` composing Navbar → Hero, Problem, Process,
WhatWeBuild, WhyBespoke, CtaRepeat, Founder → Footer, where the only render-time
computation is the footer copyright year.

## Static content — but not a static export (the honest distinction)

The site is fully static in *content* — **no backend at all**: no \`src/app/api\`,
no \`use server\` server actions, no database, no auth, and no external \`fetch\` in
\`src/\`. But \`next.config.ts\` carries **zero custom options**:

\`\`\`ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  /* config options here */
};
export default nextConfig;
\`\`\`

Crucially it does *not* set \`output: 'export'\` — so the build is a standard
Next.js **server bundle** in \`.next\`, not an exported \`/out\` static site; deploy
assumes a Node runtime (or Vercel). The case study says "static content / no
backend," not "static export."

There is exactly **one client component**: \`workflow-animation.tsx\`, a
dependency-free SVG \`<animateMotion>\` + CSS-keyframe animation. Everything else is
a React Server Component rendered at build. Conversions are offloaded entirely to
a third party (a \`wa.me\` link), so there's no form handler and no lead store to
secure — removing an entire category of runtime failure by not having a runtime
to fail.

## SEO and styling

Full crawler discoverability is achieved purely with static Next metadata
conventions — \`sitemap.ts\`, \`robots.ts\` (an explicit AI-crawler allow-list),
Open Graph / Twitter / apple-icon image routes, \`manifest.ts\`, and
\`ProfessionalService\` JSON-LD in the layout. Styling is **Tailwind v4, CSS-first**:
no \`tailwind.config.*\` at all; \`globals.css\` uses \`@import "tailwindcss"\` plus an
\`@theme inline\` block of brand tokens and \`tw-animate-css\`. An honest finding —
**shadcn was scaffolded** (there's a \`components.json\` with \`style: "base-nova"\`,
base UI via \`@base-ui/react\`, not Radix) but **no \`src/components/ui/\` directory
exists** and \`cn\`/Radix are never imported: the page uses hand-written Tailwind
components. There is no test script and no test runner, which for a static
brochure is a defensible scope, not an omission, and there are no \`.env*\` files —
nothing to leak.

## Why it's here

It's the "right amount of engineering" counterpoint in the constellation: a
landing page's job is narrow — load fast, read clearly, convert — and reaching
for a CMS or a heavy app shell would be over-building. The interesting decision is
knowing where to stop.`,
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
- a **hello-interview** data-structures-and-algorithms collection written in
  TypeScript, and
- a **Terraform** sandbox using the local provider.

## An honest note on scope

The Labs source is **not present on this machine**, so this entry is grounded
only in the portfolio inventory's own one-line description — deliberately, there
are no invented stack details, code excerpts, or benchmarks here. When the source
is available, this case study can be deepened; until then it stays a truthful
placeholder rather than a padded one.

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

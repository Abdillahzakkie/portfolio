import type { PostSeedInput } from '@/server/models';

/**
 * Companion blog posts — one per featured project.
 *
 * Every post's `projectSlug` is the EXACT slug of a project in `./projects.ts`
 * (which mirrors the registry in `docs/design/00-concept.md §3`). This is the
 * required post → project link (ACCEPTANCE #3).
 *
 * Each `body` is a deep technical write-up grounded in the real repo — actual
 * data structures, protocols, and short verbatim code — and is meant to
 * COMPLEMENT (not duplicate) the project case-study in `./projects.ts`.
 *
 * `status` policy (HANDOFF decision #2 + authoring rule):
 *   - `published` — neutral engineering write-ups of the owner's own products.
 *   - `draft`     — anything about CLIENT platforms (GKOI, Settleo) or SECURITY
 *                   detection internals (Sentova / Sentova MTD). These stay
 *                   architecture/decision level (no secrets, no exploitable
 *                   specifics) and the owner publishes them manually.
 *
 * `readingTime` is intentionally omitted — the service computes it from `body`.
 * `publishedAt` is set only on published posts (drafts stay null by default).
 * Content is grounded in each repo's real source; no invented benchmarks,
 * versions, or dates.
 */
export const posts: PostSeedInput[] = [
  // ─────────────────── Settleo (client / fintech → draft) ───────────────────
  {
    title: 'Building a double-entry ledger on TigerBeetle',
    slug: 'settleo-single-writer-ledger-tigerbeetle',
    status: 'draft',
    projectSlug: 'settleo',
    excerpt:
      'In Settleo, exactly one service is allowed to move money. Here is why that single-writer rule — over gRPC, on TigerBeetle, in u128 minor units — is the whole reason balances can be trusted.',
    tags: ['typescript', 'tigerbeetle', 'grpc', 'ledger', 'fintech', 'double-entry'],
    seo: {
      metaTitle: 'Building a double-entry ledger on TigerBeetle — Settleo',
      metaDescription:
        'Why Settleo makes one service the sole writer to a TigerBeetle double-entry ledger, with u128 integer money, two-phase holds, and a rebuild-from-log durability story.',
    },
    body: `In Settleo, exactly one service is allowed to move money: \`settleo-ledger\`.
Every other service — the gateway, the escrow orchestrator, the reorg-safe
indexer — can *describe* an intent, but only the ledger records the debits and
credits that make it real. It is the sole writer to TigerBeetle; everyone else
reaches it over gRPC through a shared \`@settleo/ledger-client\`. That
single-writer rule is the whole reason a balance can be trusted.

## Double-entry, on a database built for it

Double-entry accounting is old and boring, which is exactly what you want near
funds: every transfer debits one account and credits another by the same amount,
so value is conserved by construction. TigerBeetle models accounts and transfers
as first-class primitives, so the ledger leans on that instead of hand-rolling a
balances table. Accounts are credit-normal, and "available" is a pure function of
four counters:

| Field | Meaning |
|---|---|
| \`debitsPosted\` / \`creditsPosted\` | settled movements |
| \`debitsPending\` / \`creditsPending\` | reserved by open holds |
| \`availableBalance\` | \`creditsPosted − debitsPosted − debitsPending\` |
| \`allowDebitsExceedCredits\` | true only for system/funding accounts (e.g. \`world\`) |

Six invariants are pinned and property-tested with \`fast-check\`: double-entry
always balances, available balance never goes negative, a transfer id applied
twice equals applied once, a pending transfer posts *xor* voids exactly once, a
hold auto-voids exactly at timeout, and linked transfers commit all-or-nothing.

## A pure reducer as the behavioural oracle

The most useful trick in the repo is that the invariants live in a *pure,
in-memory* \`Ledger\` class with no I/O and no clock. It is simultaneously (a) the
specification the TigerBeetle adapter must match, and (b) a fast deterministic
fake for higher-layer tests. Its batch method encodes both idempotency and
all-or-nothing rollback in a few lines — snapshot, try, restore on throw:

\`\`\`ts
postTransfers(transfers: readonly Transfer[]): void {
  const snapshot = this.snapshot();
  try {
    for (const t of transfers) {
      if (this.applied.has(t.id)) continue; // idempotent replay
      this.applyOne(t);
      this.applied.add(t.id);
    }
  } catch (err) {
    this.restore(snapshot);
    throw err;
  }
}
\`\`\`

Overdraft is rejected *by construction*: the reducer refuses any debit that would
drive \`availableBalance\` below zero unless the account explicitly permits it, and
TigerBeetle enforces the identical rule via \`debits_must_not_exceed_credits\`. Two
independent code paths, same guarantee — which is what makes the integration test
a real cross-check rather than a tautology.

## Money is never a float

Amounts are **u128 integer minor units** — larger than any native JavaScript
number — so they cross the gRPC wire as a decimal **string**, are bounds-checked
against \`U128_MAX\` at the adapter edge, and live as \`bigint\` internally. There is
no floating-point path anywhere near a balance.

## Idempotency across a type boundary

TigerBeetle wants a u128 id and rejects a zero, while the domain speaks string
ids. The bridge is deterministic: SHA-256 the domain id and take the top 16 bytes
as a big-endian u128, so the same string always maps to the same id and a retry
is a no-op rather than a double-spend.

\`\`\`ts
export function encodeId(id: string): bigint {
  const digest = createHash('sha256').update(id).digest(); // 32 bytes
  let value = 0n;
  for (let i = 0; i < 16; i++) value = (value << 8n) | BigInt(digest[i]!);
  return value === 0n ? 1n : value; // TigerBeetle rejects a zero id
}
\`\`\`

## Two-phase holds and all-or-nothing batches

The domain's four transfer flags map straight onto TigerBeetle's transfer model,
and the three hold RPCs are thin aliases over the same \`PostTransfers\` use-case:

| Flag | TigerBeetle | Hold RPC |
|---|---|---|
| \`single\` | plain transfer | — |
| \`pending\` | pending transfer (+ timeout) | \`OpenHold\` |
| \`post_pending\` | commit the pending amount | \`PostHold\` |
| \`void_pending\` | release the reservation | \`VoidHold\` |

Crucially, the timeout is authoritative *in the database*. TigerBeetle auto-voids
an expired pending transfer server-side, so the client never drives expiry — the
adapter's \`expirePending\` returns \`[]\` on purpose, with a comment explaining that
the timeout is authoritative in TB. A settlement that pays a buyer and a fee at
once is a linked batch: every transfer but the last is flagged \`linked\`, so the
whole group commits together or not at all.

\`\`\`ts
const tb = transfers.map((t, i) =>
  this.toTBTransfer(t, i < transfers.length - 1 && transfers.length > 1));
\`\`\`

The adapter also translates TigerBeetle's result codes into typed domain errors,
so callers see \`ConflictError\` / \`NotFoundError\` rather than raw enum ordinals:

| TigerBeetle status | Domain error |
|---|---|
| \`exceeds_credits\` / \`exceeds_debits\` | \`ConflictError\` "insufficient available balance" |
| \`*_account_not_found\` / \`pending_transfer_not_found\` | \`NotFoundError\` |
| \`pending_transfer_already_posted\` / \`_voided\` / \`_expired\` | \`ConflictError\` "pending already resolved" |
| \`created\` / \`exists\` | success (idempotent re-apply) |

## The hard part: signing a gRPC body

Every internal call is HMAC-signed over the request body, but proto3 elides
default-valued fields on the wire — so a naive \`sign(bytes)\` breaks the moment a
zero or empty field is dropped, and \`@grpc/grpc-js\` only ever hands you the
*deserialized* message. The fix is a transport-neutral canonical form: recursively
drop proto3 defaults, sort keys, JSON-encode — computed identically by signer and
verifier so the signature survives (de)serialization.

\`\`\`ts
function prune(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(prune).filter((e) => !isEmpty(e));
  if (typeof v === 'object' && v !== null) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const pv = prune((v as Record<string, unknown>)[k]);
      if (!isEmpty(pv)) out[k] = pv;
    }
    return out;
  }
  return v;
}
\`\`\`

Because the HMAC binds the body — which isn't available until the message
arrives — verification runs **per handler**, not in a metadata interceptor, and
the signed METHOD is the fully-qualified RPC path so a signature for one RPC can't
be replayed against another.

## Durability, stated honestly

TigerBeetle and the MongoDB read model cannot share a transaction. Rather than
pretend otherwise, the projection is treated as derived and **rebuildable from the
transfer log**: the ledger stages \`LedgerTransferPosted\` (one per transfer, key
\`transfer:<id>\`) and \`TradeSettled\` (once per settlement batch) through a
transactional outbox, and the projector replays that log — committing the balance
snapshot, the transfer-history append, and a dedup marker in one multi-document
Mongo transaction (hence the replica-set requirement). A reconciliation pass then
cross-checks the committed projection against TigerBeetle **field by field**:

\`\`\`ts
const pairs = [
  ['debitsPosted', projected.debitsPosted, authoritative.debitsPosted],
  ['creditsPosted', projected.creditsPosted, authoritative.creditsPosted],
  ['debitsPending', projected.debitsPending, authoritative.debitsPending],
  ['creditsPending', projected.creditsPending, authoritative.creditsPending],
  ['available', projectedAvailable(projected), availableBalance(authoritative)],
];
\`\`\`

\`drift = 0\` is a hard non-functional requirement, surfaced as \`ledger_reconcile_*\`
metrics. The honest footnote: it only *means* something once the real event
sources are wired end to end — until then it's a guardrail proving the two derived
paths agree, not a claim that the whole platform has been reconciled in
production. The ledger is authoritative; the projection is a cache that can always
be reconstructed — the only durability story that survives a crash between the two
stores.`,
  },

  // ─────────────────── NFTMixer (Go) — neutral → published ───────────────────
  {
    title: 'Rewriting a .NET Blazor app in Go without losing parity',
    slug: 'nftmixer-net-to-go-parity-rewrite',
    status: 'published',
    publishedAt: '2026-07-10T09:00:00.000Z',
    projectSlug: 'nftmixer-go',
    excerpt:
      'Porting a stateful Blazor Server app to Go + Next.js meant confronting an uncomfortable truth: most of the rewrite was not Go at all — and the interesting parts were the bugs we refused to carry over.',
    tags: ['go', 'dotnet', 'nextjs', 'rewrite', 'siwe'],
    seo: {
      metaTitle: 'Rewriting a .NET Blazor app in Go without losing parity',
      metaDescription:
        'What survived the port from C#/.NET 6 Blazor Server to Go + Next.js, why 70% of a "Go rewrite" was frontend, and the deliberate parity breaks that fixed the original.',
    },
    body: `"Rewrite it in Go" is a satisfying sentence. In this case it was also, mostly, a
lie — and noticing that early is what made the rewrite tractable.

## Blazor Server *is* the UI

The original NFTMixer is a C#/.NET 6 Blazor Server app. Its \`.razor\` files are not
templates: Blazor Server renders on the server and pushes DOM diffs to the browser
over a SignalR websocket. Go has no equivalent. So while the generation engine,
layer compositing, database access, S3, and wallet auth all port to Go cleanly,
roughly **70% of the work was frontend**, rebuilt from scratch in a Next.js 16 App
Router app. The design doc says it plainly — "none of it is Go" — and budgeting
for that up front is the difference between a plan and a surprise.

The other thing decided up front removed most of the risk: **the migration has no
cutover.** Existing data was declared expendable and the schema is greenfield, so
there was no dual-write window, no backfill, no "does the old row map to the new
shape" edge cases. The design doc names data migration as the single largest
source of rewrite risk — and then deletes it.

## Parity is a milestone, and it means behaviour

"Functional parity" here is not a vibe; it is a defined checkpoint, reached at the
end of slice 6, with slice 7 (masters / IPFS / export / batch limits) classed as
parity-complete without it. And parity means matching *behaviour*, not porting
files. Delivery was **vertical slices, 0 through 7** — each one a thin cut through
domain → store → engine → HTTP → UI that works before the next begins — with graph
path-tracing pulled forward into slice 4 because both rarity and sync validation
need the same walk.

That framing is what let me *leave things behind on purpose*. Three categories of
C# code were explicit non-ports:

- **Dead code** — the entire \`NftGenerator\` library (the live engine was actually
  inside a \`.razor\` component), and whole superseded component generations
  (\`ProjectOLD.razor\`, \`... - Copy.razor\`) that were referenced but unreachable.
- **Dangerous code** — an unauthenticated \`pg_dump\` export endpoint and a
  committed live Pinata key. Porting those faithfully would have been faithfully
  reproducing debt.
- **Unfinished code** — an IPFS \`PublishToIpfs\` that returned before it uploaded.
  There was no working behaviour to preserve.

## Authentication that actually authenticates

The original's "auth" believed whatever wallet the browser named — no signature,
anywhere. The Go app does real SIWE, and the whole decision is a short, ordered
sequence in \`Service.Verify\`: parse strictly, check server expectations, recover
the signer, consume a single-use nonce **issued to that exact wallet**, and only
then mint a session. Recovery pointedly does **not** pull in go-ethereum — its
library code is LGPL-3.0, and static-linking it into a proprietary binary carries
a relink/source obligation. Recovery needs only secp256k1 and keccak256, both
permissively licensed, so the core is a few lines:

\`\`\`go
v := sig[64] // Ethereum [R||S||V]; dcrd wants [V||R||S]
if isHighS(sig[32:64]) { return "", errMalleable } // reject malleable high-S
compact := make([]byte, signatureLen)
compact[0] = v
copy(compact[1:], sig[:64])
pub, _, err := ecdsa.RecoverCompact(compact, EIP191Hash(message))
\`\`\`

Ownership then comes from the session, folded into the store's query *filter*, so
a handler that forgets to check simply selects no document and returns
\`ErrNotFound\` — there is no unfiltered read to leak by mistake. Sessions expire via
a Mongo TTL index instead of living forever in an in-memory map whose cleanup
method was empty.

## Deliberate parity *breaks* that are fixes

A rewrite is the one chance to be correct where the original was wrong. Each of
these breaks is pinned by a test, and the code comment cites the exact C# line it
replaces:

| Behaviour              | C#/.NET predecessor                                      | Go rewrite                                             |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| Generators             | Two — weighted-with-dupes *and* unique-with-unbounded-\`while\` | One weighted-and-unique with a **bounded** retry       |
| Exhaustion             | Hangs when combos run out                                | \`ExhaustionError{Requested, Available}\` — a clean 4xx |
| Combination rarity     | (varies) — not gated on the rarest step                  | **MIN** of step rarities: \`{0.5, 0.8} → 0.5\`           |
| Cycle guard            | \`goto\` — drops whole parallel branches                   | \`continue\` — skip the node, keep its siblings          |
| Quantity drift         | Single pass, cannot always converge                      | **Loop** until the total equals the request exactly    |
| NFT numbering          | \`nftNumber++\` on every attempt → gaps                    | Consumed only by an *accepted* NFT → gap-free          |
| Layer resize           | Base layer only → misaligns non-uniform art              | **Every** layer resized to output dims (CatmullRom)    |
| Metadata               | Flat \`{trait:value}\` — no marketplace takes it           | OpenSea schema + parameterised, rewritable image URI   |

The bounded retry is the headline, because it turns a hang into an answer:

\`\`\`go
for produced < want {
  chosen := selectNFT(...)
  key := strings.Join(chosen, ",")
  if seen[key] {
    fails++
    if fails >= MaxSelectionRetries {
      return GenerateResult{}, &ExhaustionError{Requested: int64(qty), Available: avail}
    }
    continue
  }
}
\`\`\`

And the metadata break pays for itself in slice 7: because the \`image\` field is a
parameter rather than baked in, once art is pinned to IPFS the entire run's
metadata is re-pointed at \`ipfs://<cid>/<number>.png\` by a rewrite pass — filename
and every other byte preserved — with **no re-compositing**.

## Rendering can't be identical, and that's fine

Go's resampling kernels and PNG encoder are not the C# ImageSharp ones, so the
rendered bytes differ. Rather than chase an impossible hash match, the render
tests assert on **perceptual structure** — while the metadata JSON, which *must*
be byte-stable for a marketplace, is checked exactly. Parity with the intent, not
the mistake. That is the whole discipline of this rewrite in one line: keep the
behaviour worth keeping, fix the behaviour that was wrong, and refuse to port the
behaviour that never should have existed.`,
  },

  // ─────────────────── GKOI Platform (client → draft) ───────────────────
  {
    title: 'A Merkle-proof whitelist that scales apart from the mint',
    slug: 'gkoi-merkle-whitelist',
    status: 'draft',
    projectSlug: 'gkoi-platform',
    excerpt:
      'Why GKOI carves its allowlist into its own service, and how keccak256(address) Merkle leaves keep it cheap on-chain while snapshot caching keeps every served proof consistent with the served root.',
    tags: ['web3', 'merkle', 'nft', 'nodejs', 'ipfs'],
    seo: {
      metaTitle: 'A Merkle-proof whitelist that scales apart from the mint',
      metaDescription:
        'How gkoi-whitelist builds a keccak256(address) Merkle tree with merkletreejs sortPairs, puts only a 32-byte root on-chain, and serves consistent proofs via snapshot caching and explicit invalidation.',
    },
    body: `A mint is a stampede, and the worst place to discover a bottleneck is the one
request path that also decides who is allowed to pay you. GKOI carves its
allowlist out into a service of its own — \`gkoi-whitelist\` — so it can scale,
fail, and be audited independently of the core API. This post follows one thing
end to end: how an address becomes a leaf, a leaf becomes a proof, and a proof
gets verified — cheaply — at mint.

## Why Merkle, and what actually goes on-chain

Storing thousands of allowlisted addresses on-chain is expensive. A Merkle tree
collapses the whole set into a single 32-byte **root** the contract stores, while
each user carries only the O(log n) **proof** that their address is a leaf. That's
the entire scaling property: the allowlist can grow to any size without changing
what lives on-chain or what a mint costs in gas.

## Step 1 — build: keccak256 leaves, order-independent pairs

The leaf is a single \`keccak256(address)\`, and the tree is built with
\`merkletreejs\` under \`sortPairs: true\`. That option matters more than it looks: it
sorts each pair before hashing, so the tree is order-independent and the contract's
standard \`MerkleProof.verify\` reconstructs the same root without the service and
the contract having to agree on sibling ordering.

\`\`\`ts
const hashedAddresses = addresses.map((addr) => ethers.keccak256(addr));
const root = new MerkleTree(hashedAddresses, ethers.keccak256, {
  sortPairs: true,
}).getRoot();
return \`0x\${root.toString("hex")}\`;
\`\`\`

An operator takes that root and sets it on the mint contract. The service never
writes on-chain.

## Step 2 — prove: the same config, per user

A proof must be built with a byte-identical tree, or verification fails. So the
proof helper hashes the same snapshot the same way, computes the target's leaf,
and asks the tree for the sibling path:

\`\`\`ts
const merkleTree = new MerkleTree(hashedAddresses, ethers.keccak256, { sortPairs: true });
const leaf = ethers.keccak256(targetAddress);
const resultProof = merkleTree
  .getProof(leaf)
  .map((proofObj) => \`0x\${proofObj.data.toString("hex")}\`);
\`\`\`

The REST surface is exactly three reads — \`GET /root\`, \`GET /proof/:address\`,
\`GET /is-whitelisted/:address\` — plus admin add/remove/list/count. The user fetches
their proof; the *contract* does the verification.

## Step 3 — verify: O(log n), on-chain, standard

On-chain, verification is a standard OpenZeppelin \`MerkleProof.verify(proof, root,
leaf)\` that recomputes the root by hashing the leaf up its sibling path. Because
\`sortPairs\` made pair-hashing order-independent, the service's root and the
contract's recomputed root agree. It's worth being precise that this is a
**different tree** from SeaDrop's own allowlist path, where the leaf is
\`keccak256(abi.encode(minter, mintParams))\` so the proof carries per-minter mint
parameters — same primitive, different payload, different tree. The whitelist
service's tree is the plain-address one.

## The correctness trap: cache the snapshot, not the tree

The O(n) keccak work still has to stay off the request hot path, but caching a
serialized tree invites drift — deserialize slightly differently and a served
proof no longer matches the served root. So the cache stores the **sorted address
snapshot**: the exact list the helpers hash. Rebuilding
\`keccak256 + MerkleTree(sortPairs:true)\` from that snapshot is byte-identical to a
cold rebuild, so a cached \`/proof\` is *always* consistent with the cached \`/root\`.

\`\`\`ts
// The snapshot is the exact list the merkle helpers hash, so caching it
// (rather than the whole tree) keeps the keccak256 + MerkleTree(sortPairs:true)
// config — and therefore every emitted proof — byte-identical to a cold rebuild.
\`\`\`

Root and snapshot share one logical version and are invalidated together, so a
mutation is reflected on the very next read:

\`\`\`ts
async function invalidateWhitelistCaches(address?: string): Promise<void> {
  const keys = [merkleRootCacheKey(), merkleAddressesCacheKey()];
  if (address) keys.push(membershipCacheKey(address));
  await redisDeleteKeys(...keys);
}
\`\`\`

A short TTL sits behind that explicit add/remove invalidation as a safety net, not
as the primary correctness mechanism. And the full-list read that feeds the tree
is hard-capped by an always-applied \`$limit\` (the \`retrieveAll\` path is bounded by
\`MERKLE_FULL_READ_CAP\`), so an unbounded \`$sort\` can never be streamed back even if
the collection outgrows expectations.

## Metadata rides the same discipline

Contract metadata (three images plus a \`metadata.json\`) is pinned to IPFS via
Pinata and referenced as \`ipfs://<cid>\`. The pin is deterministic and changes
rarely, so the resulting URI is cached behind a 24-hour TTL — and **only successful
pins are memoized**, so a failed pin is never cached as a permanent answer.

## Why a whole service for this

Whitelisting and authentication are the mint-critical surfaces, so they live apart
from the large \`gkoi-server\` — each small enough to reason about, each shipping its
own security and audit docs, each enforcing its own scoped HMAC service-to-service
contract. There's no shared database and no ambient admin key: cross-service reads
are scoped, signed calls. The allowlist doesn't just scale apart from the mint — it
fails and gets audited apart from it too.`,
  },

  // ─────────────────── GKOI Contracts (client → draft) ───────────────────
  {
    title: 'Royalties that survive the secondary market: ERC721-AC',
    slug: 'erc721ac-enforceable-royalties',
    status: 'draft',
    projectSlug: 'gkoi-contracts',
    excerpt:
      'ERC721-AC declares a royalty rate with ERC-2981 and delegates enforcement to an external, owner-swappable transfer validator — policy that lives in a hook and travels with the token.',
    tags: ['solidity', 'foundry', 'erc721', 'royalties', 'seadrop', 'nft'],
    seo: {
      metaTitle: 'Royalties that survive the secondary market: ERC721-AC',
      metaDescription:
        'How the GKOI collection exposes the Creator Token interface and calls an external, swappable ITransferValidator721 in _beforeTokenTransfers, with ERC-2981 rates and soulbound-by-default transfers.',
    },
    body: `Marketplace-honoured royalties are a promise, not a mechanism — and promises break
the moment a venue decides to compete on fees. The GKOI collection
(\`gkoi-erc721AC\`) takes a more honest position: it is a SeaDrop-based ERC721A token
that declares its royalty *rate* on-chain and delegates *enforcement* to a policy
contract that travels with the token and that the creator can swap.

## Rate versus enforcement — two things people smudge together

- **The rate** is an ERC-2981 declaration. \`royaltyInfo(tokenId, salePrice)\`
  returns \`salePrice * royaltyBps / 10_000\`, and \`setRoyaltyInfo\` reverts on a zero
  receiver or \`royaltyBps > 10_000\`. Marketplaces read this and may honour it.
- **The enforcement** is a separate question — did a transfer actually route
  through a sale that paid it? — and it lives in an external, owner-configurable
  transfer validator.

The rate math itself is deliberately boring:

\`\`\`solidity
royaltyAmount = (_salePrice * info.royaltyBps) / 10_000;
\`\`\`

## The enforcement seam

The token exposes the **Creator Token** interface (\`ICreatorToken\`) and, in
\`_beforeTokenTransfers\`, calls out to whatever validator the owner has pointed it
at — on every non-mint/non-burn transfer:

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

The validator is stored behind \`setTransferValidator(...) onlyOwner\`, and the null
address means no validator and no enforcement. That is the whole design: the token
stays standard, but every secondary-market transfer is gated by a policy contract
the creator *chooses* and can replace — an operator-blocking or royalty-enforcing
validator survives the secondary market without hard-coding one vendor's policy
into the collection. The honest framing is "policy lives in a hook that *can*
enforce, and it travels with the token," not "royalties are guaranteed on-chain."

The interface it calls is a one-line \`view\` gate that reverts to block, and the
token advertises the exact selector so a compliant venue knows what enforces:

\`\`\`solidity
interface ITransferValidator721 {
    function validateTransfer(address caller, address from, address to, uint256 tokenId) external view;
}
\`\`\`

Tests pin this seam down with a \`MockTransferValidator\` built to always revert — a
transfer with that validator set fails with
\`vm.expectRevert("MockTransferValidator: always reverts")\`, proving the hook
actually calls out and that a validator can block a move.

## Extra durability levers

Transfers and approvals are **paused (soulbound) by default** — \`transfersPaused\`
starts \`true\`, and \`approve\`/\`setApprovalForAll\` plus holder-initiated transfers
revert until the owner flips it:

\`\`\`solidity
bool public transfersPaused = true;
function updateTransfersPaused(bool paused) external onlyOwner {
    transfersPaused = paused;
    emit TransfersPausedChanged(paused);
}
\`\`\`

Conduit pre-approval keeps mint→list approval-free without weakening the validator
gate — but the Conduit's own NatSpec warns, and I'll quote it rather than bury it,
that *"a malicious or negligent owner can add a channel that allows for any
approved ERC20/721/1155 tokens to be taken immediately."* A conduit is a
one-approval, controller-gated router; that convenience is also its trust caveat.

## Three ways onto the allowlist

Eligibility is not one mechanism. SeaDrop verifies an on-chain Merkle proof whose
leaf carries per-minter parameters:

\`\`\`solidity
MerkleProof.verify(proof, _allowListMerkleRoots[nftContract], keccak256(abi.encode(minter, mintParams)))
\`\`\`

The separate \`GKoiPresale\` path instead uses an **ECDSA role-signed claim** — it
recovers the signer and requires the \`VALIDATOR_ROLE\`, with the signature
single-use and its deadline capped at five minutes out:

\`\`\`solidity
address signer = _recoverAddress(message, _signature);
require(hasRole(VALIDATOR_ROLE, signer), "GKoiPresale: Invalid signature");
\`\`\`

And both differ again from the whitelist *service's* plain \`keccak256(address)\`
tree (its own post covers that). Three "is this address allowed" mechanisms — an
on-chain Merkle proof, an off-chain role-signed claim, and a plain-address service
tree — each picked for its context.

## Deploy paths: CREATE2 versus EIP-1167

Standalone collections come from \`NftCollectionFactory.deploy\`, which is
\`Create2.deploy\` over **packaged raw creation bytecode** (\`getBytecode\` concatenates
\`type(ERC721Factory).creationCode\` with ABI-encoded constructor args), giving a
deterministic, pre-computable address. The SeaDrop *cloneable* line takes the other
road entirely — OpenZeppelin \`Clones.cloneDeterministic\` (**EIP-1167** minimal
proxies) of a pre-deployed implementation, with the salt mixed with
\`blockhash(block.number)\` so clones don't collide across chains, then an
\`initialize\` call:

\`\`\`solidity
bytes32 cloneSalt = keccak256(abi.encodePacked(salt, blockhash(block.number)));
address instance = Clones.cloneDeterministic(seaDropCloneableUpgradeableImplementation, cloneSalt);
ERC721SeaDropCloneable(instance).initialize(name, symbol, allowedSeaDrop, msg.sender);
\`\`\`

Raw-bytecode CREATE2 when you want a full, independent deployment; a cheap EIP-1167
clone-plus-initialize when you want many collections off one implementation. Two
tools, chosen deliberately — which is the same instinct as delegating royalty
enforcement to a swappable validator rather than baking one policy in forever.`,
  },

  // ─────────────────── Settleo Escrow (client → draft) ───────────────────
  {
    title: 'A 2-of-3 non-custodial escrow (the platform is not enough)',
    slug: 'settleo-2-of-3-escrow',
    status: 'draft',
    projectSlug: 'settleo-escrow',
    excerpt:
      'Settleo escrows release only on on-chain 2-of-3 approval voting by the parties themselves, or a permissionless time-locked auto-refund — the operator holds no vote at all.',
    tags: ['solidity', 'foundry', 'escrow', 'web3', 'non-custodial'],
    seo: {
      metaTitle: 'A 2-of-3 non-custodial escrow (the platform is not enough)',
      metaDescription:
        "How Settleo's SettleoEscrow moves funds only on on-chain 2-of-3 approval voting by msg.sender or a permissionless auto-refund, with CEI/reentrancy guards and a fuzz-proven solvency invariant.",
    },
    body: `The strongest thing you can say about an escrow is what it *cannot* do. Settleo's
\`SettleoEscrow\` cannot be moved by any single party — not the buyer, not the
seller, and pointedly not the platform that operates it. The contract's own
docstring puts it bluntly: **"2-of-3, never 1."**

## It's a vote, not a signature scheme

The mechanism is often mis-described as a multisig or a threshold signature. It is
neither. There is no \`ecrecover\`, no EIP-712 typed data, and no on-chain nonce
scheme in the contract. Instead, each of three designated addresses — \`buyer\`,
\`seller\`, \`arbiter\` — calls \`approve\` itself, and the contract records that
\`msg.sender\`'s vote. When two distinct parties vote for the same outcome, the same
call settles:

\`\`\`solidity
function approve(bytes32 tradeId, Outcome outcome) external nonReentrant {
    Escrow storage e = _escrows[tradeId];
    if (e.state != State.Funded && e.state != State.Disputed) revert WrongState();
    if (msg.sender != e.buyer && msg.sender != e.seller && msg.sender != e.arbiter) revert NotSigner();
    if (_votes[tradeId][msg.sender] == outcome) revert AlreadyVoted();
    _votes[tradeId][msg.sender] = outcome;
    if (_tally(tradeId, e, outcome) >= 2) { _settle(tradeId, e, outcome); }
}
\`\`\`

The tally is O(1) over exactly three designated slots, so one signer voting
repeatedly can never reach the threshold alone — and \`AlreadyVoted\` stops a signer
padding the count by re-submitting:

\`\`\`solidity
function _tally(bytes32 tradeId, Escrow storage e, Outcome outcome) private view returns (uint256 n) {
    if (_votes[tradeId][e.buyer] == outcome) n++;
    if (_votes[tradeId][e.seller] == outcome) n++;
    if (_votes[tradeId][e.arbiter] == outcome) n++;
}
\`\`\`

The three parties must be non-zero and *pairwise distinct*, checked at \`open\` —
distinctness is precisely what makes "2-of-3" meaningful, because if two roles
collapsed to one address a single key could reach the threshold. The operator
holds an \`OPERATOR_ROLE\` that may \`open\` an escrow and trigger a refund, but it
holds **no vote** — a fact pinned by the test \`test_approve_operatorHasNoVote\`.
The platform is structurally incapable of deciding an outcome.

## Two ways for funds to move — and only two

Money leaves the contract by exactly one of two paths: a 2-of-3 approval
(cooperatively buyer + seller, or on a dispute arbiter + one party), or a
**permissionless, time-locked auto-refund** to the seller after \`refundDeadline\`.
Because the refund is permissionless, an absent or malicious operator can never
strand funds — anyone can trigger it once the clock runs out:

\`\`\`solidity
function refundExpired(bytes32 tradeId) external nonReentrant {
    Escrow storage e = _escrows[tradeId];
    if (e.state != State.Funded) revert WrongState();
    if (block.timestamp < e.refundDeadline) revert DeadlineNotReached();
    _settle(tradeId, e, Outcome.Refund);
}
\`\`\`

Note the state guard: only a \`Funded\` escrow auto-refunds. Raising a dispute moves
it to \`Disputed\`, which \`refundExpired\` rejects — so **a dispute freezes the
clock**, and a disputed escrow can only be resolved by a 2-of-3 vote. That tension
is deliberate: the auto-refund is a liveness backstop for the honest-but-idle
case, and disputing explicitly opts out of it in favour of arbitration.

## Safety scaffolding

The value transfer is Checks-Effects-Interactions plus \`nonReentrant\`: the escrow
is terminalized and \`_locked\` decremented *before* any payout, native value is
sent by a low-level \`call\` and reverts the whole settlement on failure, and
\`receive()\` rejects stray ETH so nothing enters except through \`fund\`. \`pause\`
gates only new intake (\`open\`/\`fund\`), so locked funds can always exit. Assets are
deny-by-default — escrowable only up to a governor-set cap. Fuzz and invariant
tests prove the solvency property that, for every asset, the contract's balance is
always at least \`lockedOf(asset)\`, alongside value-conservation and "terminal
escrows hold nothing." There are no off-chain signatures to recover, so classic
signature malleability simply doesn't apply; replay is handled structurally by the
state machine rejecting re-entry into terminal states.

## Off-chain: choosing the votes, idempotently

The contract enforces the threshold; the orchestrator's job is to decide *which*
two approvals to drive and to submit them without ever double-voting. A pure
domain function maps a trigger to the two roles: a cooperative release is
buyer + seller, a disputed release is arbiter + buyer, a disputed refund is
arbiter + seller — and \`planApprovals\` defensively re-checks that the plan
genuinely reaches 2-of-3 before any on-chain instruction. The executor then
signs EIP-1559 transactions (with \`@noble/curves\` — no ethers/viem) and is
**idempotent under retry via on-chain reads**, a CAS-style pattern that skips a
vote already recorded:

\`\`\`ts
for (const role of roles) {
  const signer = this.addressForRole(role, settleParties);
  if ((await this.readVote(id32, signer)) === outcomeEnum) continue; // already voted
  if ((await this.readState(id32)) === terminal) break; // a prior vote already settled it
  lastHash = await this.sendTx(signer, encodeCall(SIG.approve, [/* … */]), 0n);
}
\`\`\`

So an at-least-once redelivery never resubmits a vote and reverts \`AlreadyVoted\` —
it reads the chain, sees the vote is already there, and moves on.

## Arbitration keeps the same rule

When a trade is disputed, \`settleo-dispute\` resolves it under the *same* 2-of-3
threshold, and its tally keeps only each party's latest vote so one signer can
never reach the threshold alone:

\`\`\`ts
export function tally(votes: readonly Vote[]): Tally {
  const latest = new Map<Party, Outcome>();
  for (const v of votes) latest.set(v.party, v.outcome); // last write per party wins
  for (const outcome of OUTCOMES) {
    const decidedBy = [...latest.entries()].filter(([, o]) => o === outcome).map(([p]) => p);
    if (decidedBy.length >= 2) return { decided: outcome, decidedBy };
  }
  return { decided: null, decidedBy: [] };
}
\`\`\`

The service is IDOR-hardened: a voter's role is *derived* from the
gateway-asserted actor, never claimed, and the arbiter console path forces
\`party = 'arbiter'\` and requires the caller to *be* the assigned arbiter — so one
operator can't cast a "buyer" vote and then an "arbiter" vote to self-resolve.
Resolution stages \`DisputeResolved\` in the same write as the case, and the
orchestrator drives the on-chain release/refund off that event alone.

## The platform is not enough

The escrow secures the crypto leg on-chain; final settlement is *mirrored* into
Settleo's off-chain double-entry ledger. On fund the orchestrator opens a
two-phase hold (seller → escrow); on release it commits that hold and pays
escrow → buyer (net) plus escrow → fee as **one all-or-nothing linked batch**
tagged with the trade — which is what makes the ledger emit \`TradeSettled\`. It
never writes balances itself, and the ledger ids are deterministic functions of
the trade id, so every command is idempotent under retry. One honest caveat worth
stating plainly: the contract is currently **unaudited**, with mainnet gated
behind a clean external audit, and the MPC signer that would hold real party keys
in production is an external component not yet built.`,
  },

  // ─────────────────── NFTMixer (.NET) — neutral → published ───────────────────
  {
    title: 'The Blazor app that came first (and why we left it)',
    slug: 'nftmixer-net-blazor-predecessor',
    status: 'published',
    publishedAt: '2026-07-08T09:00:00.000Z',
    projectSlug: 'nftmixer-net',
    excerpt:
      'A retrospective on the original C#/.NET 6 Blazor Server generative-NFT builder — a real, feature-rich product whose four honest defects justified a ground-up rewrite.',
    tags: ['dotnet', 'blazor', 'csharp', 'retrospective'],
    seo: {
      metaTitle: 'The Blazor app that came first (and why we left it)',
      metaDescription:
        'A retrospective on NFTMixer (.NET) — the C#/.NET 6 Blazor Server generative-NFT builder that defined the product, and the defects (spoofable auth, an open DB dump, a committed key, non-expiring sessions) that motivated the Go rewrite.',
    },
    body: `Before the Go app there was a Blazor one, and it worked. It shipped features. It
had ~40 EF Core migrations spanning 2022 to 2026, a V3 generation engine, masters,
rarity tiers, and a real rendered-output tree on disk. It was mature, not a toy.
This is the honest retrospective of the app we left — what it did well, what it
could not keep, and why the second of those forced a rewrite rather than a patch.

## The thing it did well was also the thing that trapped it

NFTMixer (.NET) is a C#/.NET 6 **Blazor Server** app. The entire UI is \`.razor\`
components rendered on the server and diffed to the browser over a SignalR
websocket (\`AddServerSideBlazor\`, \`MapBlazorHub\`, \`MapFallbackToPage("/_Host")\`).
That model is genuinely productive: a long generation run could stream progress
dialogs to the client "for free," because the server was already holding the
component's state and pushing updates down the socket.

But that same statefulness is the fork in the road. Blazor Server has **no Go
equivalent** — there is nothing to port a stateful, socket-diffed component tree
*to*. So the moment the decision was "own the stack in Go," the entire interactive
surface had to be rebuilt from scratch in TypeScript, no matter how clean the
engine was. That is the honest reason the migration ended up ~70% frontend. The
framework that made the app pleasant to build is the one that made it impossible
to port.

Storage sealed it. The app persisted generated output to **local disk**, under
\`{userId}/{mixName}/{n}.png|.json|.png.sha256\`, on a volume the design notes say
"must never be lost." A stateful disk that can't be lost is the opposite of a
container you can kill and reschedule — it is exactly what blocked safe
containerization and drove the Go app's stateless, S3-for-everything design.

## The four foundations we couldn't keep

The features were fine. The foundations were not — and these are the ones that
turned "improve it" into "replace it." Each is real and citable, and each maps 1:1
to a Go-side fix.

**1. Authentication that doesn't authenticate.** The browser reports the connected
account and the server simply believes it — no signature challenge anywhere:

\`\`\`csharp
SelectedAccount = await _ethereumHostProvider.GetProviderSelectedAccountAsync();
if (SelectedAccount != null) {
    await InitUserData(SelectedAccount); // server trusts the address as-is
}
\`\`\`

\`InitUserData\` then \`FindAsync\`es that address or silently creates the user.
Anyone can log in as any address, including an admin's. *(Go fix: real SIWE — the
server issues a nonce, the client signs the full message, and the server recovers
the signer via secp256k1/keccak256.)*

**2. An unauthenticated database dump.** \`GET /api/Download/export/db\` shells out
to \`pg_dump\` and returns the whole dump, with **no \`[Authorize]\`** — the runtime
image even installs \`postgresql-client\` to make the shell-out work. *(Go fix: not
ported at all.)*

**3. Ownership read from the URL.** \`GET /api/Download/zipmixer/{userId}/{mixName}\`
builds the output path directly from the URL \`userId\`, no membership check, so any
caller can download any user's output. *(Go fix: ownership is folded into the
store's query filter — there is no unfiltered read to leak.)*

**4. Sessions that never expire.** Web3 tokens live in a process-local
\`ConcurrentDictionary\` whose sweep method is empty:

\`\`\`csharp
public static void RegisterToken(string token, Web3User user) {
    _activeTokens.TryAdd(token, (DateTime.UtcNow, user));
    Cleanse();
}
static void Cleanse() {

}
\`\`\`

The map only ever grows. *(Go fix: every session carries a hard \`ExpiresAt\` that a
Mongo TTL index enforces.)* There was also a committed live Pinata API key in
source — treated as burned and never carried forward.

## The tell: two "generate" buttons

If you want a single symptom that captures why this needed a rewrite rather than a
refactor, it is that the app shipped a **"Process Paths"** button and a **"Process
Paths (Accurate)"** button — and they produced *different collections*. The
"accurate" one was unique-but-uniform-random with an unbounded
\`while (generatedCount < stat.NumberToGenerate)\` that hangs when the graph can't
yield enough distinct combinations, and it incremented the NFT number on every
attempt, leaving gaps. Two divergent notions of "generate," one of which could
lock up, is not a bug you patch; it is a design you replace. The Go engine folds
both into one weighted-and-unique generator with a bounded retry that fails with an
actionable exhaustion error instead of spinning.

## Why it still earns its place

None of this is a dunk on the app. It reached a feature set the rewrite spent
seven slices catching up to, and several of its behaviours were correct enough to
port verbatim. The reason to keep it visible is that the interesting engineering is
the **delta**: a working, mature product whose statefulness, spoofable auth, open
dump endpoint and leaked key could not survive contact with "we have to own and
trust this in production." The Blazor app is the honest baseline that makes the Go
rewrite legible — you cannot appreciate the discipline of the second without the
inheritance of the first.`,
  },

  // ─────────────────── GKOI Apps (client → draft) ───────────────────
  {
    title: 'Turning chain operations into an admin a human can drive',
    slug: 'gkoi-admin-chain-ops-ui',
    status: 'draft',
    projectSlug: 'gkoi-apps',
    excerpt:
      'The GKOI admin makes chain operations legible by not making the operator sign raw transactions — labeled buttons POST to an authenticated backend while wagmi reads on-chain state as plain UI.',
    tags: ['nextjs', 'react', 'web3', 'wagmi', 'admin'],
    seo: {
      metaTitle: 'Turning chain operations into an admin a human can drive',
      metaDescription:
        'How the GKOI admin turns on-chain operations into backend-mediated REST calls with a toast lifecycle, reads contract state via wagmi useReadContracts, and keeps authority server-side behind cookie auth.',
    },
    body: `Three Next.js apps sit in front of the GKOI platform: an admin dashboard
(\`gkoi-admin-v2\`), the public mint site (\`gkoi-client-v3\`), and a gallery
(\`gkoi-gallery\`). They're all Next.js 16 + React 19 on a Privy + wagmi + viem
wallet stack, and they hold **no source of truth** — the server and the contracts
are authoritative, and the frontends are projections that fetch typed
\`IResponseData<T>\` envelopes and submit back. This post is about the admin's
central design decision: how it makes chain operations legible to a human.

## Make chain ops legible by *not* signing raw transactions

The admin's core move is counter-intuitive: for almost every privileged task, the
operator does **not** sign a wallet transaction. Instead the action is a labeled
button that POSTs to a backend the operator is already authenticated to, and the
chain/indexing work happens server-side. The UX is a toast lifecycle that surfaces
the server's own message verbatim, guarded by a login check so nothing fires while
signed out:

\`\`\`ts
const toastId = toast.loading("Adding new collection...");
const url = \`\${env.MAIN_SERVICE_URL}/api/collections/add/\${tokenAddressOrSlug}?chainId=\${chainId}\`;
const { status, data: { data } } = await api().post(url, null);
if (status !== 201 || !data) throw new Error();
toast.update(toastId, { render: "Successfully added new collection!", type: "success", isLoading: false });
\`\`\`

The same shape covers \`deleteCollection\` (DELETE) and \`reIndexCollection\` (POST
\`/reindex\`). The operator clicks a clearly-named action and watches a live
loading→result toast; nobody reasons about calldata to index an NFT collection.

## On-chain state is read-only UI

Contract *state*, meanwhile, is surfaced as plain values. wagmi \`useReadContracts\`
pulls \`owner\`, \`stage\`, and \`stagePrices\` off the presale contract, and the hook
maps the raw stage enum to a human name and a \`formatEther\` price — no transaction
required to *look*:

\`\`\`ts
const { data: contractReadsResults } = useReadContracts({
  allowFailure: true,
  contracts: [ { ...presaleContract, functionName: "owner" },
               { ...presaleContract, functionName: "stage" } ],
});
\`\`\`

\`allowFailure: true\` matters: one unreadable call degrades a field rather than
blanking the whole panel.

## The single genuine chain write

There is exactly **one** real direct chain write in the whole admin — the swap
token redeem/claim, via wagmi \`useWriteContract\`, submitting the operator's own
signed \`claim(...)\` through their connected wallet (never a server-held key). It's
the deliberate exception that proves the rule that privileged mutations are
otherwise delegated to the authenticated backend.

## Safety rails

Auth is cookie-based — the REST client is \`axios.create({ withCredentials: true })\`,
so the session never sits in JS-readable storage, and the server re-authorizes
every mutation. The gate is Privy (SIWE-style) → HttpOnly session cookie →
admin-role/permission verify, with a tri-state design so the connect/sign dialog
never dead-ends when unauthenticated. The admin role is fetched from
\`gkoi-authentications\` — the frontend never decides authorization itself — and
Playwright e2e drives the operator routes.

## Why this shape

Keeping the frontend thin concentrates the mint-critical logic where it can be
re-authorized, re-enforced, and audited: server-side. The client reflects results;
it never *is* the result. That's the same reason the public mint site currently
leaves its on-chain \`buyPresale\` submit **commented out behind a "SOLD OUT" state**
rather than shipping a half-live write path — the authoritative decision about
whether the mint is open lives on the server and in the contract, and the UI is
honest about only projecting it.`,
  },

  // ─────────────────── Sentova (security internals → draft) ───────────────────
  {
    title: 'A signed directive path for an endpoint agent',
    slug: 'sentova-signed-directive-enforcement',
    status: 'draft',
    projectSlug: 'sentova',
    excerpt:
      'Sentova can kill and quarantine processes, so every enforcement directive is Ed25519-verified before it runs — signature before expiry, at most once, and honestly gated on elevation.',
    tags: ['go', 'security', 'windows', 'wfp', 'edr'],
    seo: {
      metaTitle: 'A signed directive path for an endpoint agent — Sentova',
      metaDescription:
        'How Sentova verifies enforcement directives (signature before expiry, six-step order) over an authenticated named pipe, drives kill/quarantine/network-filter through one enforcer, and gates the live privileged primitives on elevation.',
    },
    body: `An agent that can terminate processes and filter network traffic is a loaded
weapon pointed at the machine it protects. Sentova treats the *directive path* —
how an enforcement decision reaches the privileged code that acts on it — as the
most safety-critical thing in the product, and hardens it end to end. This post
walks that one path.

## Privilege separation first

The desktop agent is two processes. A Wails UI holds **no privilege** and is only
an IPC client. A Windows service runs as SYSTEM, exposes **no network listener**,
and is the only thing that can kill or quarantine. They talk over a go-winio
named pipe, and the privileged module's only third-party dependencies are that
pipe library and \`golang.org/x/sys\` — a deliberately tiny trusted surface for the
one component that holds all the power. A request has to survive several
fail-closed gates before anything happens.

## Authorize: peer SID, then integrity

The pipe is authenticated by the peer's Windows token, and the identity is
resolved **once at Accept by impersonating the connected endpoint** — not by a
per-request PID lookup, which is subject to a PID-reuse TOCTOU. The connecting
peer's token SID must equal the enrolling user's SID, and a read failure is
itself a rejection. Then a second gate: mutating operations
(\`enforce_directive\`, \`restore_quarantine\`, \`unenroll\`, \`erase_data\`, …) require at
least medium integrity, so a Low-IL or sandboxed caller is refused, and a failure
to read the level is fail-closed:

\`\`\`go
if isMutatingOp(req.Op) {
    lvl, lerr := peer.IntegrityLevel()
    if lerr != nil || lvl < platform.IntegrityMedium {
        return wire.Err("forbidden", "insufficient integrity level for this operation")
    }
}
\`\`\`

The integrity RIDs are ordered constants (\`IntegrityUntrusted\` … \`IntegritySystem\`)
so \`>= IntegrityMedium\` is a valid comparison rather than a set membership test. A
relayed \`enforce_directive\` gets a third check: the envelope must re-verify against
the pinned server key. The channel being authenticated does not make the agent
trust a relayed directive's *contents* — it re-proves them.

## Verify: signature before every other field

\`VerifyDirective\` ports a fixed six-step order (carried verbatim from the retired
Rust implementation): device-id binding → \`alg == ed25519\` → resolve the pinned
key by keyId → recompute the signed core over **canonical params** and **verify the
Ed25519 signature** → *then* expiry → then the type/platform allowlist. The
ordering is the whole point. Expiry is checked *after* the signature precisely so
a forged \`expiresAt\` is never consulted before the signature is proven — no
attacker-controlled field is trusted ahead of the proof that the envelope is
authentic:

\`\`\`go
core := dsig.DirectiveSignedCore(env.ID, env.DeviceID, env.Type, paramsHash,
    env.CreatedAt, env.ExpiresAt, env.Nonce)
if err := dsig.VerifyB64(key, []byte(core), env.Sig.Value); err != nil {
    return Verified{}, directiveRejectedf("signature: %v", err)
}
// expiry checked AFTER signature so a forged expiry can't help
if expires < nowUnix { return Verified{}, directiveRejectedf("directive expired") }
\`\`\`

A known-but-unsupported type/platform combo acks \`unsupported\` — it is never
enforced. Mutating a field like \`expiresAt\` or \`type\` breaks the signature and is
caught here; the *only* way to make the agent act is to present a genuinely
server-signed envelope.

## Enforce: one enforcer, one guard, at most once

A single shared \`Enforcer\` is the only place a verified directive is driven
through the kill / quarantine / network-filter ports, and it is shared by the IPC
path, the check-in loop, and \`confirm_directive\`, so dedup can't be bypassed by
choosing a path. Its at-most-once property comes from a bounded \`ReplayGuard\` that
keys the seen-cache on **both** the directive id and its nonce:

\`\`\`go
idKey := "id:" + id
if _, seen := g.seen[idKey]; seen {
    return directiveRejectedf("directive replay: id already enforced")
}
if nonce != "" {
    if _, seen := g.seen["nonce:"+nonce]; seen {
        return directiveRejectedf("directive replay: nonce already seen")
    }
}
\`\`\`

Tracking both means a captured directive can't be re-fired by mutating one field
(mutating either breaks the signature upstream; re-using both is caught here).
Entries drop once the directive's own expiry passes, and under a flood the guard
evicts the soonest-to-expire keys to bound memory. Destructive types
(\`kill_process\`, \`quarantine_file\`) are held for in-app confirmation; nil ports on
a non-elevated run yield an honest \`"degraded"\` ack rather than a fake success.

Separately, a **local-first** canary → correlate → kill/quarantine loop can act on
the device's own detections with no server round trip: on a critical ransomware
trip it kills the attributed process and quarantines the touched file immediately.
A filesystem-layer event with no PID still quarantines the file and skips the kill
rather than guessing.

## Honesty as a security posture

The live system-mutating primitives — WFP filtering, ETW telemetry, and the
\`TerminateProcess\` kill — are elevation-gated behind an explicit integration flag
and were **not executed on this build** (the build machine was non-elevated). What
*was* exercised: the authenticated named-pipe round-trip including an
integrity-gated mutating op for a same-user peer, and the CurrentUser DPAPI seal
round-trip. The enforcement logic throughout is unit-tested against **fake ports**,
so it runs anywhere, and every "what Sentova did" string reflects what actually
happened — a banned-claims grep over shipped strings forbids a fixed success
sentence. Stating that split plainly — rather than claiming a kill primitive is
"proven" — is part of the posture, not a footnote.`,
  },

  // ─────────────────── Sentova MTD (security internals → draft) ───────────────────
  {
    title: 'STIX 2.1 IOC matching as an index seek, not a pattern parse',
    slug: 'sentova-mtd-stix-index-seek',
    status: 'draft',
    projectSlug: 'sentova-mtd',
    excerpt:
      'Matching mobile forensic artifacts against STIX 2.1 spyware indicators is a hot path, so Sentova MTD lifts each observable into a multikey-indexed array — turning a pattern parse into an index seek.',
    tags: ['go', 'stix', 'mtd', 'forensics', 'mongodb'],
    seo: {
      metaTitle: 'STIX 2.1 IOC matching as an index seek — Sentova MTD',
      metaDescription:
        'How Sentova MTD denormalizes STIX 2.1 indicators into a multikey-indexed observable array so the artifact-match hot path is an index seek, with tenant∪platform scoping, s2s identity, and field encryption.',
    },
    body: `Sentova MTD analyses iOS and Android forensic artifacts against known
mercenary-spyware indicators. Do that naively and every scan becomes a parade of
STIX pattern parses — a grammar re-interpreted once per observable, per artifact.
The whole design moves that work from request time to write time. This post is
about that one move and the correctness traps around it.

## A STIX pattern is a grammar; a match should be a key lookup

STIX 2.1 \`indicator\` objects carry patterns like \`[domain-name:value = '…']\`.
Parsing the pattern at match time is O(N) in the feed. Instead, \`sentova-mtd\`
lifts every concrete comparison out of the pattern **once at ingest** into a
denormalized \`observables\` array of \`{kind, value}\` pairs, normalized on the way
in. The raw pattern is retained for provenance, but it is not what you query. The
hot path is a multikey index over that array:

\`\`\`go
// value leads (high-cardinality selector); kind narrows collisions.
{Keys: bson.D{
  {Key: "observables.value", Value: 1},
  {Key: "observables.kind", Value: 1},
}},
\`\`\`

Value leads because it is the high-cardinality selector — a hash or a domain
prunes the candidate set hard; \`kind\` then narrows the remaining collisions. There
is one deliberate asymmetry: a STIX field is left unmapped where the artifact side
cannot supply a comparable value. Mapping it anyway would let a real infection read
as clean, which is the worst possible failure mode for this product, so the mapping
is kept honest by omission rather than optimistic by inclusion.

## Two-phase match, and why the obvious query is wrong

Matching is a batched DB pre-filter followed by an in-memory confirm. One query
does the pre-filter, scoped to the caller's tenant plus the shared platform set:

\`\`\`go
cur, err := s.indicators.Find(ctx, bson.M{
    "accountId":   bson.M{"$in": accountIDs},
    "observables": bson.M{"$elemMatch": bson.M{"value": bson.M{"$in": values}}},
})
\`\`\`

The \`$elemMatch\` keeps the \`value\` match bound to a single array element while the
\`$in\` rides the multikey index; \`kind\` is not constrained in the DB query. Then, in
memory, the analyzer keeps only indicators at the feed's **active snapshot version**
and confirms an exact per-element \`(value, kind)\` hit:

\`\`\`go
for _, iob := range ind.Observables {
    if !extracted[iob.Kind+"\\x00"+iob.Value] { continue } // exact (kind,value) pair
    // ...record Match...
}
\`\`\`

The naive combined-key form \`{"observables.value": v, "observables.kind": k}\` is
deliberately avoided: on a multikey index it can match \`v\` in one array element and
\`k\` in a *different* one — a silent false positive on a product where a false
positive can mean telling a journalist they are compromised when they are not. The
pre-filter is on value alone; the exact pairing is confirmed in memory where it can
be reasoned about element by element.

One more silent-failure guard: normalization has to be byte-identical on both the
indicator side and the artifact side, or the value in the bundle never equals the
value in the index and the match quietly misses. Both sides run the same normalize
pass for exactly that reason.

## The IXSCAN is structural, not asserted

Because \`observables\` is multikey-indexed, the value pre-filter *plans* as an
\`IXSCAN\` instead of the \`COLLSCAN\` a per-request STIX-pattern parse would force —
the index does the seek. This is a **structural** guarantee that follows from the
schema, not a runtime check: the data-model contract documents an
\`explain\`-should-be-IXSCAN target, but there is no mechanical \`executionStats\`
acceptance gate in the repo. The guarantee comes from the index being there, not
from a test asserting the plan.

## Snapshots that flip atomically

Feeds carry a monotonic \`snapshotVersion\`. An ingest writes at \`active + 1\` and
bumps the pointer in one update, so a half-written feed is never matched and a
rollback is a version decrement. That version also travels into every verdict
(\`indicatorFeedVersion\`) so a result is reproducible against the exact intel that
produced it. Verdict derivation is pure and deterministic: zero matches on a healthy
parse is \`CLEAN\`; zero matches on a *degraded* parse is \`INCONCLUSIVE\` (a real
state, never silently downgraded to clean); any match is \`COMPROMISED\` with severity
taken from the strongest matched indicator. Mercenary-spyware families default to
\`critical\` so they sort to the top.

## Isolation and erasure as construction rules

Because the subjects may be under state-level threat, the storage model is built
for it. Every document carries an \`accountId\`, and match scope is the union of the
caller's account and the shared \`platform\` account — never another tenant's data.
Identity comes from the verified service-to-service context, **never** a request
body:

\`\`\`go
account = s2s.Account(r.Context())
principal = s2s.Principal(r.Context())
if account == "" || principal == "" {
    return "", "", apperr.Unauthenticated("not authenticated")
}
\`\`\`

The fields that reveal a person or device are AES-256-GCM field-encrypted, and
**encrypted fields are never indexed**; the list endpoint projects them out
entirely so a poll decrypts nothing. Retention is first-class: per-document
\`expiresAt\` TTL indexes plus scoped erasure, with the raw artifact encrypted inline
in-document so a delete plus the TTL leave no external blob to miss. Family *names*
(Pegasus, Predator, Reign) and the shared severity vocabulary are safe to talk
about; the concrete indicator values behind them are not, and never appear outside
the encrypted store.`,
  },

  // ─────────────────── Managerenta — neutral → published ───────────────────
  {
    title: 'The reference architecture I clone across every commerce app',
    slug: 'managerenta-reference-architecture',
    status: 'published',
    publishedAt: '2026-07-14T09:00:00.000Z',
    projectSlug: 'managerenta',
    excerpt:
      'Managerenta is a rental-management app, but its more useful output is a Next.js + Mongo + Redis Model→Service→Route template — with an IAM engine and a receipts-first security review — that the other apps are built from.',
    tags: ['nextjs', 'architecture', 'mongodb', 'redis', 'patterns'],
    seo: {
      metaTitle: 'The reference architecture I clone across every commerce app',
      metaDescription:
        'How Managerenta became the Model → Service → Route reference: schema-hook invariants, a CSRF-before-ratelimit wrapper, an AWS-IAM-style engine with a hard tenant floor, and a three-pass security review.',
    },
    body: `Managerenta is a property/rental management app. It is also, quietly, the most
reused thing I've built — because its layering became the template every other
commerce app inherits. This is a tour of that template and, more usefully, of
*why* each piece is shaped the way it is.

## Why have a template at all

Every new product arrives with genuinely novel parts — a domain, a lifecycle, a
pricing rule — and a large sameness underneath: how a request authenticates,
becomes a validated call, hits the database, gets cached, and comes back as JSON.
If that sameness is re-improvised each time, the novelty and the plumbing get
debugged together, forever. Managerenta freezes the plumbing so a new app's
budget goes to its actual problem. Chekka and Mogadget are literal descendants.

## One boundary, three layers

All server code lives under \`src/server/\` and imports \`"server-only"\`, so the DB,
S3, and secrets can't leak into the client bundle. Above that boundary sit three
layers, each with one job:

| Layer | Job | Forbidden from |
|---|---|---|
| **Model** | Mongoose schema + flat \`xxxDB()\` fns; invariants in schema hooks | HTTP, caching |
| **Service** | business logic + Redis caching; one function per file | \`req\` / \`Response\` |
| **Route** | authorize → \`safeParse\` → call service → envelope | DB, cache keys, S3 |

The rule that makes the layers independently testable is that **model reads never
throw**. Each \`*DB\` function wraps a Prometheus timer and, on error, returns
\`null\`/empty — so the service layer decides what "nothing" means and the route
decides the HTTP, with no exceptions crossing a boundary by surprise:

\`\`\`ts
const timer = databaseResponseTimeHistogram.startTimer();
try {
  const result = await Property.findOneAndUpdate(
    { _id, userId, deleted: false }, { $set: payload }, { returnDocument: "after" });
  if (!result) throw ErrPropertyNotFound;
  timer({ operation, collection, method: "updatePropertyDB", success: "true" });
  return { ...result.toObject(), id: result.id };
} catch { timer({ ...,  success: "false" }); return null; }
\`\`\`

Notice ownership is a *query filter*, not a later check: a handler that forgot to
scope its read simply selects nothing, because there is no unfiltered read to
call by mistake.

## The wrapper's order is load-bearing

\`withApiHandler\` composes the cross-cutting concerns, and the sequence is a design
decision, not an accident. The CSRF Origin/Referer gate runs **before** the rate
limiter — it's the cheaper check (no Redis round-trip), and a rejected request
must not spend one of the caller's rate-limit tokens:

\`\`\`ts
if (options.csrf !== false) {
  const reason = csrfReject(req);
  if (reason) { const res = fail(403, reason); observe(req, res.status, options.route, startNs); return res; }
}
if (rl) { rlResult = await enforceRateLimit(req, rl);
  if (!rlResult.allowed) return applyRateLimitHeaders(fail(429, "Too many requests"), rlResult); }
await connectMongoDB();
\`\`\`

## Authorization that survives a bad policy

Authorization is a real AWS-IAM-style policy engine, not scattered role checks.
\`withAuth\` first resolves an \`effectiveOwnerId\` — the user's own id in personal
scope, or the org owner's id once they've switched into an organization — so org
members transparently act on the owner's resources through *one* evaluation path.
Personal-scope users even get an in-memory \`selfScopePolicy\`, so the engine has no
special case:

\`\`\`ts
if (!auth.organizationId) {
  const principalArn = principalArnForUser(auth.userId, auth.userId);
  return { principalArn, policies: [selfScopePolicy(auth.userId)] };
}
\`\`\`

The engine itself is *pure* — no I/O, no clock read (time is injected via the
condition context) — which is exactly why it can be exhaustively unit-tested, and
it follows AWS semantics: default-deny, explicit-Deny-wins. But the property that
lets me trust multi-tenancy sits *above* the policy loop: a tenant-isolation floor
denies any cross-scope org request before a single statement is read.

\`\`\`ts
if (target.plane === "org" && target.orgId !== resourceScope(auth)) {
  return { decision: "deny", reason: "implicit deny (cross-scope org resource)" };
}
\`\`\`

Even a wildcard policy can't cross tenants, because the boundary is checked before
the policy is.

## Receipts, not vibes

The reason it's a *reference* is that it's proven. **93 Vitest files** run against
throwaway scratch DBs that a \`globalSetup\` drops on teardown; **16 Playwright
specs** drive auth, 2FA, passkeys, and a full-app path; and a three-pass
\`SECURITY_REVIEW.md\` catalogues roughly forty findings. The one I quote most is
S1: "2FA was never enforced on login; the toggle was decorative" — a feature that
looked done, wasn't, and was found by writing the audit down. It was fixed with a
two-step ticket flow: password success mints a 5-minute signed ticket and sets no
session cookie until a second call verifies the TOTP code.

Getting the skeleton right once, cloning it, and re-running that discipline on
each descendant is the whole payoff: the next app argues about its domain, never
about how a request becomes a database write.`,
  },

  // ─────────────────── Chekka — neutral → published ───────────────────
  {
    title: 'Building to a written spec instead of a vibe',
    slug: 'chekka-spec-driven-build',
    status: 'published',
    publishedAt: '2026-07-12T09:00:00.000Z',
    projectSlug: 'chekka',
    excerpt:
      "Chekka sells trust in a used-car purchase, so \"verified\" was pinned down in a real written spec — one that ships the code skeleton — before the first route existed.",
    tags: ['nextjs', 'spec-driven', 'mongodb', 'product'],
    seo: {
      metaTitle: 'Building Chekka to a written spec instead of a vibe',
      metaDescription:
        'How Chekka — a professional car-inspection product — was built as a Next.js 16 monolith against a dense ~4,700-word specification that ships its own route-handler and Mongoose conventions.',
    },
    body: `Chekka's whole pitch — "before you buy, Chekka" — is that an independent
professional inspects a used car so the buyer doesn't have to gamble. When the
product *is* trust, you can't improvise the definition of "verified" halfway
through the build. So Chekka started from a written specification.

## A real spec, honestly sized

The spec (\`Chekka_Core_Features.md\`) is about **4,728 words across 596 lines** —
twelve numbered core features plus a "Tech Stack & Code Conventions" section.
It isn't enormous; it's *dense and structured*, and its most useful trick is that
it ships the **code skeleton** the build then follows verbatim. The route-handler
shape and the Mongoose model conventions are written into the spec itself, so
"spec" and "scaffold" are the same document, and the build follows a contract
instead of rediscovering scope in code review. (One correction worth making
plainly: an internal brief called this a "37k-word" spec — the verified count is
4.7k. Precision is the point of a spec; it should extend to describing the spec.)

## Descended from the reference architecture

The spec doesn't invent conventions — it inherits them. Chekka is explicitly
"built on the same conventions as \`managerenta-client\`" (README line 5): the same
server-only \`src/server/\` triad, the same \`withApiHandler(withAuth(...))\` route
skeleton, the same \`pre\`/\`post("aggregate")\` hooks, \`databaseResponseTimeHistogram\`
timers, \`select:false\` soft-delete, and model memoization. The infrastructure is
deliberately unsurprising so the surprise budget can go entirely to the domain.

## The domain is a lifecycle

The core entity is \`inspections\`, and its \`status\` field is a one-directional
state machine: \`submitted → assigned → (declined) → scheduled → in_progress →
report_processing → completed\`. Each transition stamps its own timestamp
(\`assignedAt\`, \`acceptedAt\`, \`startedAt\`, \`reportDeadline\`, \`completedAt\`,
\`reportLockedAt\`), and dashboards bucket off the status — \`declined\` is
intentionally excluded from every bucket. Assigning an inspector at creation
stamps \`assignedAt\` and jumps straight to \`assigned\`; pricing is computed
server-side from an admin-tunable \`siteConfig\` plus a flat urgent surcharge, never
trusted from the client.

## Report integrity is the product

A report a buyer paid to trust must be immutable once filed, and its numbers must
be the server's, not the client's. On submit, Chekka recomputes the summary counts
from the checklist item statuses across all four sections and refuses to touch a
locked report:

\`\`\`ts
if (current.reportLockedAt) throw ErrReportLocked;
const all = [...report.exterior, ...report.interior, ...report.mechanical, ...report.roadTest];
const summary = { ...report.summary,
  passed:  all.filter((i) => i.status === "good").length,
  minor:   all.filter((i) => i.status === "minor").length,
  serious: all.filter((i) => i.status === "serious").length };
if (lock) { patch.status = "completed"; patch.reportLockedAt = new Date(); patch.completedAt = new Date(); }
\`\`\`

Locking flips the status to \`completed\`, stamps the lock/complete timestamps,
publishes a \`report_filed\` event to the admin live feed over Redis pub/sub, and
notifies the buyer. Sharing a finished report is then a read-only, self-expiring
capability: a \`uuidv4()\` nonce maps to the inspection id in Redis under a 7-day
TTL, so the link grants unauthenticated read access to *one* report and the
inspection id never appears in the URL.

## Why the spec paid off

Report integrity, S3-backed photo evidence (an append-only collection with a
race-safe \`photoCount\`), and a booking flow that schedules real humans are the
three things that carry the product; everything else is plumbing in service of
them. Because those three were pinned in writing before the first route existed,
the build could be aggressive about the plumbing and careful about the trust —
which is the correct place to spend care in a product that sells verification.
The delivery leaned on **15 Playwright specs** across booking, the inspection
flow, photo upload, the live feed and share links; the thinner unit story (no
Vitest here) is itself an honest line in the ledger.`,
  },

  // ─────────────────── Golden Bite — neutral → published ───────────────────
  {
    title: 'Per-operation services and IAM for a small business',
    slug: 'golden-bite-per-operation-iam',
    status: 'published',
    publishedAt: '2026-07-11T09:00:00.000Z',
    projectSlug: 'golden-bite',
    excerpt:
      'Golden Bite runs a storefront, an ops dashboard, and a staff app on a per-operation service + IAM discipline — one operation, one authority check, one audit action — sized for a bakery.',
    tags: ['nextjs', 'architecture', 'iam', 'redis', 'observability'],
    seo: {
      metaTitle: 'Per-operation services and IAM for a small business',
      metaDescription:
        'How Golden Bite applies a per-operation service + five-role IAM discipline across a storefront, ops dashboard, and staff app — with an edge that is explicitly "not a security boundary".',
    },
    body: `Golden Bite is a premium treats and catering business in Kubwa, Abuja, served by
three surfaces in one Next.js 16 app: a customer storefront, an operations
dashboard, and a staff (kitchen + delivery) app. The interesting decision is that
a small business runs on an isolation discipline usually reserved for much bigger
systems — and this app is where the "Golden Bite arch" that later apps clone was
born.

## Per-operation services

Rather than a few fat service objects, each operation is its own file. \`orders\`
alone has \`createOrder.ts\`, \`updateOrderStatus.ts\`, \`checkOrderCapacity.ts\`,
\`computeOrderTotals.ts\`, \`attachDriver.ts\`, \`setDeliveryProof.ts\`, and more, with
a barrel re-exporting per namespace. Below them the model layer is likewise
per-operation \`*DB\` functions, each Prometheus-instrumented. One operation → one
service call → one authority check → one audit action.

## IAM sized for a bakery

Authority is a five-role union — \`customer | kitchen | delivery | manager |
owner\` — with role groups defined once (\`STAFF_ROLES\`, \`ADMIN_ROLES\`). Two
enforcement styles coexist: a wrapper that gates by allowed roles, and inline
sentinel-error checks inside handlers.

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
**"not a security boundary"** — the role is re-checked in every handler, so
authority is never trusted at the edge. Each write is independently gated and
audited:

\`\`\`ts
export const POST = withApiHandler(
  { route: "/api/admin/menu/products" },
  auditAdmin(postHandler, { action: "product.create", targetType: "product", captureBody: true }),
);
\`\`\`

## The wrapper enforces order

\`withApiHandler\` composes the cross-cutting concerns in a fixed order, and the
Prometheus observation *always* fires — success or thrown error:

\`\`\`ts
const rl = await consume({ identifier: ip, scope: rlScope, max: rlMax, windowSeconds: rlWindow });
if (!rl.allowed) { /* 429 + Retry-After + X-RateLimit-* */ }
else response = await handler(req, ctx);
// … finally, always:
restResponseTimeHistogram.observe({ ip, method: req.method, route, status_code }, elapsedSeconds);
\`\`\`

## The supporting cast, each doing one thing

Zod validates at the edges with \`.strict()\` objects; an ioredis singleton throws
loudly on a 5-second boot ping rather than silently falling back to memory;
reads are cache-first per operation under a namespaced key
(\`services:products:listProducts:{cat}:{q}:{f}:{l}\`) with a short TTL and explicit
invalidation on write; two Prometheus histograms
(\`http_request_duration_seconds\` and \`database_request_duration_seconds\`) make
every route and every DB call independently observable; and parallel
\`auditAdmin\`/\`auditUser\` streams fire in a \`finally\` so they survive a throw.

## Honest edges

Two things get stated plainly rather than polished away: there's **no unit-test
runner** here — the automated coverage is Playwright e2e (serial, hermetic S3) +
\`ts.check\` — and \`/api/metrics\` plus the dev \`otp-peek\`/\`reset-token-peek\` routes
are **unauthenticated** and should be prod-disabled or protected at ingress.

## Why bother at this size

Because the discipline is nearly free once it's a habit, and it scales *down* as
gracefully as up. The same instinct — isolate operations, give each the least
authority it needs, measure them separately — is what shows up, much larger, in
the platforms. Practising it on a bakery keeps it sharp, and Adverta later cloned
this exact shape.`,
  },

  // ─────────────────── Prechop — neutral → published ───────────────────
  {
    title: 'Inventory that expires: modelling cutoff times',
    slug: 'prechop-cutoff-scheduling',
    status: 'published',
    publishedAt: '2026-07-09T09:00:00.000Z',
    projectSlug: 'prechop',
    excerpt:
      'Prechop lets students order campus food before it is cooked, so each listing is a window that opens and closes — enforced two different ways across two backends, one shipped and one not.',
    tags: ['nextjs', 'mongodb', 'paystack', 'bullmq', 'cron', 'marketplace'],
    seo: {
      metaTitle: 'Inventory that expires: modelling cutoff times in Prechop',
      metaDescription:
        'How Prechop enforces listing cutoffs — a per-minute cron sweep in the live Next.js/MongoDB app versus a BullMQ delayed job in the separate Fastify/Prisma service — with Paystack prepay and atomic Redis slot reservations.',
    },
    body: `Prechop's tagline is "order before they cook," and that preposition is the entire
product. A vendor posts a **dated listing** with a **cutoff time**; students
pre-order and prepay via Paystack; the kitchen cooks to demand it can actually
see. The engineering question is deceptively small: *is this listing still
orderable?*

## Two backends, told honestly

The repo carries two implementations of the same domain, and it's worth being
clear about which ships:

| | \`prechop/\` (live, shipped) | \`prechop-api/\` (earlier twin) |
|---|---|---|
| Framework | Next.js 16 (FE + API in one) | Fastify 5 + worker |
| Store | MongoDB / Mongoose 9 | PostgreSQL / Prisma 7 |
| Scheduling | per-minute cron sweep + Redis lock | BullMQ delayed job keyed by listing id |
| Queue | none | BullMQ |

The Prisma schema is the cleanest expression of the data model (money as integer
kobo, cuid ids, listing → item → order → payment), so it's worth reading — but it
is *not* the live store. I'll draw the model from \`prechop-api\` and the shipped
scheduling from the Next.js app.

## Three time-states

A listing is a window. It is **not-yet-open** while \`scheduledDate\` /
\`availableFrom\` is in the future, **orderable** between open and \`cutoffTime\` while
\`ACTIVE\`, and **closed** once the cutoff passes. The read-time guard on every
order attempt is the same in both backends — reject a too-early order, throw a
cutoff-passed error past the deadline — so no scheduler race can let a late order
slip through even if a sweep runs late.

## Two ways to close a listing at its cutoff

This is the interesting divergence. \`prechop-api\` enqueues a **BullMQ delayed job
keyed by listing id** that fires *exactly* at the cutoff; the \`jobId\` makes it
self-deduping and idempotent, and a re-publish removes and re-adds it:

\`\`\`ts
const existingJob = await cutoffEnforceQueue.getJob(dailyOrderId);
if (existingJob) await existingJob.remove();
const delay = Math.max(0, cutoffTime.getTime() - Date.now());
await cutoffEnforceQueue.add("close-daily-order", { dailyOrderId },
  { jobId: dailyOrderId, delay, removeOnComplete: true, removeOnFail: true });
\`\`\`

The live app instead runs a **per-minute cron sweep**, wrapping each job in a
helper that takes a Redis lock so only one instance per tick does the work under
horizontal scaling:

\`\`\`ts
const key = \`cron:lock:\${DB_NAME}:\${job}\`;
const got = await acquireLock(key, INSTANCE_ID, ttlSeconds);
if (!got) return;
try { await fn(); } finally { await releaseLock(key, INSTANCE_ID); }
\`\`\`

Several jobs pass a Lagos timezone as a *load-bearing* argument: \`cron\` schedules
in the server's local time, so on a UTC host the nightly sold-out reset would
fire at 01:00 Lagos and leave sold-out items dark through the first trading hour.

## Cutoff isn't just "stop new orders"

When the window closes, orders the vendor took money for but never confirmed are
**auto-cancelled and refunded** through Paystack — closing the listing and
sweeping stale paid orders are two different jobs, and the enforce job's lock TTL
deliberately outlives a slow batch of Paystack round trips so the next tick can't
start an overlapping sweep.

The 30-minute pre-cutoff *warning* is the subtle one. It runs every minute inside
a 30-minute window, so a naive implementation sends the same buyer 30 messages.
There's no \`warnedAt\` column, so the dedupe is a Redis \`SET NX\` per listing whose
TTL outlives the window: the first tick to claim a listing is the only one that
notifies, the key is **never released** because expiry *is* the reset, and a lost
lock (Redis down) yields *no* warning rather than a duplicate — the safe
direction for a notification that costs money to send. A quieter fix hides in the
same service: the warning query asks the *operational* question (status +
\`cutoffTime\`) instead of borrowing a *marketplace-visibility* query that also
filtered \`isPublic\` and vendor-open flags — because whether a listing is
browsable has nothing to do with whether its buyers deserve a warning.

## Money and slots are server-authoritative

Pricing, item resolution, and add-on ownership are all computed server-side — the
client sends only ids. Paystack runs on split subaccounts (the platform absorbs
the processing fee), and the webhook verifies an **HMAC-SHA512** signature on the
raw body with a timing-safe compare *before* doing anything, then checks
idempotency and that the paid amount matches the record. Finite \`maxQuantity\`
slots are guarded separately with atomic Redis reservations that roll back cleanly
under contention:

\`\`\`ts
const reservedAfter = await Redis.incrby(key, item.quantity);
await Redis.expire(key, ttlSeconds);
acquired.push({ id: item.dailyOrderItemId, qty: item.quantity });
if (item.committed + reservedAfter > item.maxQuantity) {
  for (const a of acquired) await decrReserved(a.id, a.qty); // roll back all
  return { ok: false, failedItemId: item.dailyOrderItemId };
}
\`\`\`

Availability is \`maxQuantity − committed − reserved\`, so two buyers racing for the
last portion can't both slip past.`,
  },

  // ─────────────────── Adverta — neutral → published ───────────────────
  {
    title: 'One shared API behind web and native',
    slug: 'adverta-monorepo-shared-api',
    status: 'published',
    publishedAt: '2026-07-07T09:00:00.000Z',
    projectSlug: 'adverta',
    excerpt:
      'Adverta ships a Next.js web app and an Expo mobile app against one Hono/Mongoose API in a Turborepo — and a single shared Zod contract makes an API change break both clients in the same commit.',
    tags: ['turborepo', 'hono', 'nextjs', 'react-native', 'monorepo', 'marketplace'],
    seo: {
      metaTitle: 'One shared API behind web and native — Adverta',
      metaDescription:
        'How Adverta serves a Next.js web app and an Expo mobile app from one Hono/Mongoose API in a Turborepo, sharing a Zod contract and a typed client, with explicit-Deny IAM re-resolved per request and atomic budget draws.',
    },
    body: `Adverta is a Nigeria-focused advertising and marketplace product — free listings,
paid boosts, in-app chat, a campaign builder, and an agency white-label mode —
fronted by two clients, a Next.js web app and an Expo/React-Native mobile app,
speaking to exactly one backend. It's a Turborepo, and the shared contract is the
whole point.

## One contract, consumed as TypeScript

The backend is a **Hono** API over **Mongoose 8 / MongoDB** (not Fastify/Prisma),
and neither client imports its internals:

| Workspace | Role |
|---|---|
| \`apps/web\` (\`@adverta/web\`) | Next.js UI; proxies \`/api/*\` to the API. Never imports \`core\`. |
| \`apps/mobile\` (\`@adverta/mobile\`) | Expo; bearer token in memory + rotating refresh in secure-store. |
| \`services/api\` (\`@adverta/api\`) | Hono \`:4000\` \`/api/v1\`; owns all data. \`tsx\`, no build step. |
| \`packages/contracts\` | zod schemas + route table + IAM catalog — zod-only leaf. |
| \`packages/api-client\` | one typed \`ApiClient\` for web-cookie, SSR-cookie, and mobile-bearer callers. |
| \`packages/core\` | models / services / DB / middleware / metrics. |

Both apps talk to the API over HTTP through \`@adverta/api-client\`, sharing the
\`@adverta/contracts\` Zod schemas — and packages are consumed as **raw TypeScript
via \`exports\` maps with no build step**. So a contract change breaks the *compile*
of both apps in the same commit. There is no "the mobile app is two versions
behind the endpoint" class of bug, because the endpoint's request schema and the
client's input type are the *same* Zod object (\`createCampaignSchema\` is imported
by both the API route and the client). The mobile client's 401 auto-refresh is
de-duped via a single \`refreshInFlight\` promise, so the single-use rotating
refresh token is spent exactly once even under a burst of concurrent 401s.

## Money that can't be double-spent

Boosts are a billing-aware model: a campaign has a budget, a spend, and metrics,
and visibility is a paid, time-bound thing. The load-bearing detail is that a
budget draw is a single atomic act — the ceiling lives in the query *filter*, so
check-and-book can't race into an overspend:

\`\`\`ts
const result = await Campaign.findOneAndUpdate(
  { _id: id, $expr: { $lte: [{ $add: ["$spentNaira", amountNaira] }, "$totalBudgetNaira"] } },
  { $inc: { spentNaira: amountNaira, leads: 1 } },
  { returnDocument: "after" },
).lean<ICampaign>();
\`\`\`

Attribution is derived server-side and ignores any client-sent \`campaignId\`;
billing fires only on the trusted conversation-start path, keyed on a billing
actor id to defeat Sybil drain; and totals are always recomputed, never trusted.

## IAM with no roles, and Deny that wins

Authorization is AWS-flavoured with **no role layer**: a flat \`resource:action\`
permission catalog, policies of Allow/Deny statements where an explicit **Deny
always wins**, and groups that bundle policies.

\`\`\`ts
for (const statement of statements) {
  const target = statement.effect === "Deny" ? deny : allow;
  for (const perm of expandActions(statement.actions)) target.add(perm);
}
for (const perm of Array.from(deny)) allow.delete(perm);
\`\`\`

The property that makes it trustworthy is *when* it runs: a user's effective set
is **re-resolved from the database on every request**, not read from the JWT. The
token only identifies the caller; the permissions are recomputed (Redis-cached
for 30 seconds; an inactive account resolves to the empty set = deny all), so a
revocation or deactivation bites within seconds:

\`\`\`ts
const cached = await redisRetrieveKeyString<TPermission[]>(key);
if (cached) return cached;
const user = await getUserById({ id: userId });
if (!user) return []; // inactive/missing → empty = deny all
const effective = await resolveEffectiveForUser({ user });
await redisUpdateKeyString<TPermission[]>(key, effective, true, CACHE_TTL_SECONDS);
\`\`\`

## Tenancy from the session, never the request

Agency white-label rides on top. \`resolveScopedAgencyId\` takes the agency id from
the **session**, and a caller who merely holds a feature permission still can't
reach another tenant — only a platform operator (\`metrics:read\`) may inspect a
requested tenant via an explicit query:

\`\`\`ts
export async function sessionCanAccessAgency(session, agencyId) {
  if (session.agencyId && session.agencyId === agencyId) return true;
  return sessionHasPermissions(session, [Permission.MetricsRead]);
}
\`\`\`

So holding \`clients:write\` is enough to manage *your* agency's clients and no one
else's. One honest caveat carried into the writing: "per-operation
database/service" describes code structure plus application-level IAM — one \`*DB\`
fn and one service file per operation — not distinct database credentials.`,
  },

  // ─────────────────── Mogadget — neutral → published ───────────────────
  {
    title: 'A catalog with no cart (on purpose)',
    slug: 'mogadget-catalog-without-cart',
    status: 'published',
    publishedAt: '2026-07-06T09:00:00.000Z',
    projectSlug: 'mogadget',
    excerpt:
      'Mogadget deliberately has no checkout. It hands a shopping intent to WhatsApp with a prefilled deep link, tracks the tap with a fire-before-navigate beacon, and keeps its rules in a pure domain layer.',
    tags: ['nextjs', 'mongodb', 'product', 'commerce', 'whatsapp'],
    seo: {
      metaTitle: 'A catalog with no cart (on purpose) — Mogadget',
      metaDescription:
        'Why Mogadget, a single-owner Lagos gadget catalog, ships without a cart or checkout — a prefilled wa.me deep link, a non-blocking sendBeacon, a TTL click log, and catalog invariants in a pure domain layer.',
    },
    body: `Most catalog apps end at a cart. Mogadget deliberately doesn't have one. There is
no checkout, no online payment, and no customer account anywhere in the product —
the store owner sells through WhatsApp and Instagram, so the app's job ends the
moment it hands a ready-to-send message to the buyer's chat app. The product doc
states it outright: "no step in this flow touches a cart, checkout, or account
system." This post is about what replaces the cart, and how to instrument it
without ever getting in the sale's way.

## The hand-off is the order flow

Browse → product page → tap "Chat on WhatsApp" or "DM on Instagram" → a deep link
opens with a prefilled message that names the exact product and price →
negotiation and payment happen entirely in-chat. The whole "checkout" is one pure
function that builds a \`wa.me\` URL:

\`\`\`ts
export function buildWhatsAppLink(p: { name: string; priceNaira: number; url?: string }): string {
  const base = \`Hi, I'm interested in the \${p.name} (\${formatNaira(p.priceNaira)}) listed on MoGadget\`;
  const msg = p.url ? \`\${base} — \${p.url}\` : base;
  return \`https://wa.me/\${WHATSAPP_NUMBER}?text=\${encodeURIComponent(msg)}\`;
}
\`\`\`

That's the entire conversion mechanism. It's pure, so it's trivially unit-tested,
and it lives in a \`domain/\` layer with no database in sight.

## Analytics that can't cost you a sale

The one thing you still want to know is which channel a buyer chose — but
measuring it must never delay or block the tap. The client fires the beacon
**before** navigation, using \`navigator.sendBeacon\` (which survives the page
unload) with a keepalive \`fetch\` fallback, all wrapped so a failure is silent:

\`\`\`ts
export function fireClickBeacon(slug: string, channel: TClickChannel): void {
  const path = \`/api/products/\${encodeURIComponent(slug)}/click\`;
  const body = JSON.stringify({ channel });
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(path, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(path, { method: "POST", body, keepalive: true });
  } catch { /* analytics are best-effort — never interrupt the sale */ }
}
\`\`\`

The server side keeps the same posture: an atomic \`$inc\` on the product's channel
counter moves first, and only then does it *try* to append to a time-series log —
a failure there is logged and swallowed, never surfaced. The counter is the fast
path; the event log is the nice-to-have.

## No cron, no PII

That event log is a \`clickEvents\` collection with a MongoDB **TTL index** for
180-day auto-retention — the database expires old rows, so there's no cron job to
run or forget — plus a \`{ createdAt, channel }\` index behind a day-by-channel
trend aggregation. It stores a slug, a channel, and a timestamp; no person, no
device, nothing to leak.

## The catalog's real rules live in a pure domain layer

Without a cart, the modelling weight shifts onto the catalog itself, and Mogadget
puts those rules in \`domain/product.ts\` rather than scattering them through
handlers. A **NEW** item must be restockable, carry no cosmetic grade, and track
an integer quantity; a **used** unit must be a unique unit that carries a grade
and has no quantity at all. \`assertProductInvariants\` rejects any mixture on every
write, and a companion rule auto-hides a restockable listing the instant its
quantity hits zero — but never auto-unhides it, because re-listing is a deliberate
decision, not a side effect of a stock bump.

## An honest footnote

The product doc argued for one admin and no permission framework. The shipped app
has a full IAM stack behind a \`withPermission\` wrapper, plus passkeys and TOTP —
and the doc's own "Historical note" flags that pivot rather than pretending the
plan held. Dropping the cart didn't mean dropping the rigor; it just moved the
rigor to where a no-cart store actually needs it — the invariants, the hand-off,
and analytics that stay out of the way. **39 colocated Vitest specs** guard
exactly those parts.`,
  },

  // ─────────────────── Aisolver — neutral → published ───────────────────
  {
    title: 'An architecture lint that fails the build',
    slug: 'aisolver-architecture-lint',
    status: 'published',
    publishedAt: '2026-07-13T09:00:00.000Z',
    projectSlug: 'aisolver',
    excerpt:
      'AISolver is a larger AI-agent workspace than a to-do app, and it keeps its layers honest with a zero-dependency arch-check that fails the build on any boundary crossing or import cycle.',
    tags: ['typescript', 'fastify', 'monorepo', 'architecture', 'postgres'],
    seo: {
      metaTitle: 'An architecture lint that fails the build — Aisolver',
      metaDescription:
        'How AISolver (taskwise-v2) enforces its module boundaries with a zero-dependency arch-check.ts — routes↛routes, lib↛routes, an import-cycle ceiling of 0 via Tarjan SCC, a legacy-path ban, and a raw-fetch allowlist.',
    },
    body: `AISolver (package \`taskwise-v2\`) is easy to undersell as "a rebuilt task
manager." It's really a collaborative task/project platform with built-in AI
agents that act on the user's own data — Todoist plus Notion plus a team of
assistants that can do the work — and the task-manager surface (lists, nested
tasks, calendar, alarms, trash) is the substrate the agents operate on. A
codebase that large needs its layers defended, and it defends them with a
~320-line script that isn't allowed to be optional.

## A lint that fails the build

\`tools/arch-check.ts\` is a **zero-dependency** (\`node:fs\` + \`node:path\` only)
boundary guard, run as \`pnpm arch:check\`, that **exits 1** on any violation so CI
and pre-push fail. "Please don't import the database from the UI layer" is a
code-review plea that erodes under deadline; a red check does not get tired. It
enforces five distinct classes of decay and — importantly — three reports that
never touch the exit code:

| Rule | Scope | Forbids | Gate |
|---|---|---|---|
| \`routes↛routes\` | \`routes/\` + \`v2/routes/\` | a route importing another route (Stage-6B module exception) | exit 1 |
| \`lib↛routes\` | \`lib/\` + \`v2/lib/\` | the lower layer importing the upper | exit 1 |
| cycle ceiling | all of \`apps/api/src\` | any file in a static import cycle; ceiling \`0\` | exit 1 |
| legacy-path ban | all of \`apps/api/src\` | specifiers referencing the old \`agentWorker\` or \`v2/lib\` paths | exit 1 |
| \`raw-anthropic-fetch\` | all of \`apps/api/src\` | \`api.anthropic.com/v1/messages\` off a 6-entry allowlist | exit 1 |
| cycles / LOC / mixed-SCC | all of \`apps/api/src\` | *nothing* — visibility only | never |

## The cycle rule, and why dynamic \`import()\` is not an edge

The cycle rule builds the full intra-repo static import graph over *all* of
\`apps/api/src\`, runs an **iterative Tarjan SCC** (iterative to avoid a stack
overflow on a deep graph), and fails if any file sits in a strongly-connected
component of size ≥ 2. The ceiling is literally **0**, and a comment logs the
burn-down as the cuts landed: \`106 → 43 → 13 → 10 → 0\`.

Only **static** edges count. That's a deliberate choice, spelled out in the
source: a dynamic \`import()\` defers to runtime, so it creates no module
load-order / TDZ hazard — which is the *actual* thing an import cycle threatens.
Dynamic import is therefore the sanctioned way to break a static cycle, and
counting it as an edge would over-report an intentionally-broken back-edge as a
violation.

\`\`\`ts
// STATIC edges ONLY. Dynamic import() is the sanctioned way to break a static
// cycle — it defers to runtime and creates no module load-order / TDZ hazard …
// Counting dynamic edges would over-report (e.g. agentEvents↔jobProgress-
// Notifications is intentionally dynamic-broken).
\`\`\`

The legacy-path ban and the raw-fetch guard scan *all* import kinds (static,
dynamic, and side-effect \`import '…'\`) — because a *rename* or a forbidden call
is wrong however it's spelled — but the cycle graph is static-only.

## Allowing *some* route→route imports without opening the floodgates

A pure "no route imports a route" rule fights a legitimate refactor: decomposing
a route god-file into a co-located \`routes/modules/<name>/\` subtree. The Stage-6B
exception permits exactly two edges — a sibling *within* the same module dir, and
the thin composer \`routes/<name>.ts\` importing its own module — and nothing else.
Cross-module and arbitrary top-level route→route imports stay violations:

\`\`\`ts
function isSanctionedModuleImport(file: string, target: string): boolean {
  const tm = moduleNameOf(target);
  if (!tm) return false;
  if (moduleNameOf(file) === tm) return true; // sibling within the module
  return file.replace(/\\\\/g, '/').endsWith(\`/routes/\${tm}.ts\`); // the module's composer
}
\`\`\`

## A domain invariant, not just layering

The fifth rule isn't generic architecture — it's a product invariant. Every
non-streaming Claude call must go through the resilient \`callClaude\` wrapper
(credit accounting, 429/retry, telemetry), so any file that hits the Anthropic
messages endpoint and isn't one of six intentional raw callers is a violation.
The allowlist is documented inline with *why* each entry is exempt — the
streaming turn has its own retry, the skills path needs Files-API hosts
\`callClaude\` can't serve — so extending it is a deliberate, reviewed act.

## Visibility without gating

Three reports run every check but never fail it: an SCC summary, a list of files
≥ 1200 lines (split candidates, so growth is *observed* rather than rediscovered
by the next audit), and a **mixed static+dynamic SCC** report — because dynamic
import breaks the *static* cycle but the resulting runtime SCC is real layering
debt the 0-static ceiling makes invisible. The header is candid that this whole
script is the *interim* guard until a fuller \`kernel/platform/contracts/modules\`
structure lands, at which point it's swapped for dependency-cruiser. Encoding the
layering as an executable check — one that even carries a documented exception for
legitimate decomposition — is how the structure defends itself instead of relying
on everyone remembering the plan.`,
  },

  // ─────────────────── Fivestick — neutral → published ───────────────────
  {
    title: 'When a static site is the correct amount of engineering',
    slug: 'fivestick-static-landing',
    status: 'published',
    publishedAt: '2026-07-05T09:00:00.000Z',
    projectSlug: 'fivestick',
    excerpt:
      'Fivestick is a marketing site for an AI automation consultancy. Building it as static content — one client island, no backend, conversions offloaded to WhatsApp — is the whole design decision.',
    tags: ['nextjs', 'tailwind', 'static', 'marketing'],
    seo: {
      metaTitle: 'When a static site is the correct amount of engineering',
      metaDescription:
        'Why Fivestick, a consultancy landing site, ships as static Next.js content with Tailwind v4 CSS-first and hand-written components — and why, precisely, it is not a hard static export.',
    },
    body: `Fivestick is the landing site for an AI automation consultancy, and its primary
job is to send a visitor to a WhatsApp chat or a free 30-minute audit call.
Building it as static content — not as an application — is the whole design
decision.

## Match the tool to the job

A marketing page has a narrow, honest mandate: load fast, read clearly, convert.
None of that needs a database, a session, or a server round-trip. Fivestick has
**no backend at all** — no \`api\` routes, no \`use server\` actions, no external
\`fetch\` in \`src/\`. It's Next.js with React Server Components rendering the page at
build, and exactly **one** client island: a dependency-free SVG animation
(\`workflow-animation.tsx\`, an \`<animateMotion>\` + CSS-keyframe piece, no animation
library). There's no form handler and no lead store because conversion is
offloaded to a third party (a \`wa.me\` link), which removes an entire category of
runtime failure by simply not having a runtime to fail.

## Static content, stated precisely

One honest nuance: this is static *content*, not a hard static export. The README
calls it "statically rendered," and it is — but \`next.config.ts\` carries **no
\`output: 'export'\`** (it's the empty-defaults file), so the build is a standard
Next.js server bundle that assumes a Node runtime (or Vercel), not an exported
\`/out\` directory. It's a fair "right amount of engineering" story either way; it's
just not a file-server-only site, and saying so keeps the claim accurate.

## Styling, and the shadcn that wasn't

Styling is **Tailwind v4, CSS-first** — no \`tailwind.config.*\` at all; the theme
lives in \`globals.css\` behind \`@import "tailwindcss"\` and an \`@theme inline\` block
of brand tokens. shadcn was *scaffolded* (there's a \`components.json\`, base UI via
\`@base-ui/react\` rather than Radix), but no \`src/components/ui\` directory was ever
generated and \`cn\`/Radix are never imported — the page uses hand-written Tailwind
components. Full SEO and crawler discoverability is achieved purely with static
Next metadata conventions (\`sitemap.ts\`, \`robots.ts\`, OpenGraph/Twitter image
routes, a manifest) plus \`ProfessionalService\` JSON-LD.

## Restraint as a skill

It's easy to reach for the same heavy app shell you use everywhere. Recognising
that this problem is a document, not an application, is a design decision worth
naming. The right amount of engineering is sometimes noticeably less than you're
capable of — and knowing where that line sits is its own kind of experience.`,
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

## An honest note on scope

The Labs source isn't present on this machine, so this write-up is grounded only
in the portfolio inventory's own one-line description — no invented stack details,
code excerpts, or benchmarks. When the source is available, there's a real post to
write about what \`<=>\` actually generates and where it surprises you; until then,
this stays a truthful placeholder rather than a padded one.

## Why group them

Three tiny repos as three tiny stars would pad the map and imply more than there
is. One "Labs" node credits the work without inflating it. It's the sharpening
stone, not the blade: a modern C++ baseline to keep the language fresh, algorithm
reps to keep the fundamentals warm, and IaC practice to keep the ops muscles from
atrophying. Shipping products is the visible work; staying sharp is the work that
makes the next product better, and naming a place for the second kind — upfront
that it's practice, not production — is just keeping the portfolio honest.`,
  },
];

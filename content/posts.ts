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
balances table. Six invariants are pinned and property-tested with \`fast-check\`:
double-entry always balances, available balance never goes negative, a transfer
id applied twice equals applied once, a pending transfer posts *xor* voids
exactly once, a hold auto-voids exactly at timeout, and linked transfers commit
all-or-nothing.

## Money is never a float

Amounts are **u128 integer minor units** — larger than any native JavaScript
number — so they cross the gRPC wire as a decimal **string**, are bounds-checked
against \`U128_MAX\` at the adapter edge, and live as \`bigint\` internally. There
is no floating-point path anywhere near a balance.

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

## Holds and all-or-nothing batches

Two-phase holds map onto TigerBeetle pending / post-pending / void-pending
transfers, and the timeout is authoritative *in the database* — the client never
drives expiry, so \`expirePending\` returns \`[]\` on purpose. A settlement that
pays a buyer and a fee at once is a linked batch: every transfer but the last is
flagged \`linked\`, so the group commits together or not at all.

\`\`\`ts
const tb = transfers.map((t, i) =>
  this.toTBTransfer(t, i < transfers.length - 1 && transfers.length > 1));
\`\`\`

## The hard part: signing a gRPC body

Every internal call is HMAC-signed over the request body, but proto3 elides
default-valued fields on the wire — so a naive \`sign(bytes)\` breaks the moment a
zero or empty field is dropped. The fix is a transport-neutral canonical form
(recursively drop proto3 defaults, sort keys, JSON-encode) computed identically
by signer and verifier, and the signed method is the fully-qualified RPC path so
a signature can't be replayed onto a different call.

## Durability, stated honestly

TigerBeetle and the MongoDB read model cannot share a transaction. Rather than
pretend otherwise, the projection is treated as derived and **rebuildable from
the transfer log**, and a reconciliation pass cross-checks it against TigerBeetle
field-by-field on an interval with a hard non-functional requirement of **drift =
0**. The ledger is authoritative; the projection is a cache that can always be
reconstructed — the only durability story that survives a crash between the two
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
    body: `"Rewrite it in Go" is a satisfying sentence. It is also, in this case, mostly a
lie — and noticing that early is what made the rewrite tractable.

## Blazor Server *is* the UI

The original NFTMixer is a C#/.NET 6 Blazor Server app. Its \`.razor\` files are
not templates: Blazor Server renders on the server and pushes DOM diffs to the
browser over a SignalR websocket. Go has no equivalent. So while the generation
engine, layer compositing, database access, S3, and wallet auth all port to Go
cleanly, roughly **70% of the work was frontend**, rebuilt from scratch in a
Next.js 16 App Router app. The design doc says it plainly — "none of it is Go" —
and budgeting for that up front is the difference between a plan and a surprise.

## Authentication that actually authenticates

The original's "auth" believed whatever wallet address the browser named — no
signature challenge, anywhere. The Go app implements real **SIWE** (EIP-4361):
the server issues a nonce, composes the full message, the client signs it
verbatim, and the server *recovers* the signing address. Crucially it does **not**
pull in go-ethereum for that — its library code is LGPL-3.0, and static-linking it
into a proprietary binary carries a relink/source obligation. Recovery needs only
secp256k1 and keccak256, both permissively licensed, so the whole auth decision is
a few lines:

\`\`\`go
v := sig[64]                          // Ethereum [R||S||V]; dcrd wants [V||R||S]
if isHighS(sig[32:64]) { return "", errMalleable } // reject malleable high-S
compact := make([]byte, signatureLen)
compact[0] = v
copy(compact[1:], sig[:64])
pub, _, err := ecdsa.RecoverCompact(compact, EIP191Hash(message))
\`\`\`

Ownership now comes from the session, folded into the store's query *filter*, so
a handler that forgets to check simply selects no document and returns
\`ErrNotFound\` — there is no unfiltered read to leak by mistake. Sessions expire
via a Mongo TTL index instead of living forever in an in-memory map whose cleanup
method was empty.

## Parity means behaviour, not files

Several things were deliberately left behind because they were dead or dangerous:
an unauthenticated full-database-dump endpoint, IPFS publishing that returned
before it uploaded, and whole generations of superseded components that were
referenced but unreachable. Porting those would have been faithfully reproducing
debt.

## Deliberate parity *breaks* that are fixes

A rewrite is a chance to be correct where the original was wrong:

- **One generator, not two.** C# had a weighted-but-duplicating path and a
  unique-but-uniform path with an unbounded \`while\` that hung. Go collapses them
  into weighted selection plus a uniqueness check with a **bounded** retry that
  fails with an actionable exhaustion error instead of spinning forever.
- **MIN, not product, rarity.** The absolute rarity of a combination is the
  minimum of its step rarities — the rarest step gates it — and the cycle guard
  \`continue\`s past a revisited node instead of the C# \`goto\` that dropped whole
  parallel branches.
- **Resize every layer** to the output dimensions with a CatmullRom kernel, so
  non-uniform art composites without the misalignment the C# base-layer-only
  resize produced, and emit **OpenSea-standard metadata** with the image URI as a
  parameter so an IPFS CID can be substituted without re-rendering.

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

Rendering is byte-different from C# by design (different resampling and PNG
encoders), so tests assert on structure and perception, never image hashes —
while the metadata JSON must match exactly. Parity with the *intent*, not the
mistake.`,
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
fail, and be audited independently of the core API.

## Why Merkle, and what actually goes on-chain

Storing thousands of allowlisted addresses on-chain is expensive. A Merkle tree
collapses the whole set into a single 32-byte **root** the contract stores, while
each user carries only the O(log n) **proof** that their address is a leaf. The
leaf is a single \`keccak256(address)\`, and the tree is built with \`merkletreejs\`
under \`sortPairs: true\` so pair-hashing is order-independent and the contract's
\`MerkleProof.verify\` matches byte-for-byte:

\`\`\`ts
const hashedAddresses = addresses.map((addr) => ethers.keccak256(addr));
const root = new MerkleTree(hashedAddresses, ethers.keccak256, {
  sortPairs: true,
}).getRoot();
return \`0x\${root.toString("hex")}\`;
\`\`\`

Only that root lives on-chain. An operator sets it on the mint contract; the
service serves each user their proof over REST (\`/root\`, \`/proof/:address\`,
\`/is-whitelisted/:address\`) and the *contract* does the actual verification at
mint. That is the "scales apart from the mint" property: allowlist size doesn't
inflate gas or contract storage at all.

## Cache the snapshot, not the tree

The O(n) keccak work still has to stay off the request hot path. The trick is to
cache the **sorted address snapshot** — the exact input the Merkle helpers hash —
rather than a serialized tree:

\`\`\`ts
// The snapshot is the exact list the merkle helpers hash, so caching it
// (rather than the whole tree) keeps the keccak256 + MerkleTree(sortPairs:true)
// config — and therefore every emitted proof — byte-identical to a cold rebuild.
\`\`\`

Root and snapshot share one logical version and are invalidated together on every
add/remove, so a served \`/proof\` is *always* consistent with the served \`/root\`.
A short TTL is a safety net behind that explicit invalidation, not the primary
correctness mechanism. Contract metadata (images plus JSON) is pinned to IPFS and
referenced as \`ipfs://\`, with the resulting URI cached behind a 24-hour TTL and
only successful pins memoized.

## Small, separately-auditable trust boundaries

Whitelisting and authentication are the mint-critical surfaces, so they live in
their own services — \`gkoi-whitelist\` and \`gkoi-authentications\`, the latter the
single source of truth for admin roles — apart from the large \`gkoi-server\`
surface. Each is small enough to reason about, ships its own security and audit
docs, enforces its own scoped HMAC service-to-service contract, and limits blast
radius. There is no shared database and no ambient admin key: cross-service reads
are scoped, signed calls.`,
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
    body: `Marketplace-honoured royalties are a promise, not a mechanism — and promises
break the moment a venue decides to compete on fees. The GKOI collection
(\`gkoi-erc721AC\`) takes a more honest position: it is a SeaDrop-based ERC721A
token that declares its royalty *rate* on-chain and delegates *enforcement* to a
policy contract that travels with the token.

## Rate versus enforcement

Two different things get smudged together as "royalties":

- **The rate** is an ERC-2981 declaration — \`royaltyInfo(tokenId, salePrice)\`
  returns \`salePrice * royaltyBps / 10_000\`, and the setter reverts if
  \`royaltyBps > 10_000\`. Marketplaces read this and may honour it.
- **The enforcement** is a separate question: did a transfer actually route
  through a sale that paid it? That answer lives in an external,
  owner-configurable transfer validator, called on every non-mint/non-burn
  transfer.

The token exposes the **Creator Token** interface (\`ICreatorToken\`) and, in
\`_beforeTokenTransfers\`, calls out to whatever validator the owner has pointed it
at:

\`\`\`solidity
function _beforeTokenTransfers(address from, address to, uint256 startTokenId, uint256) internal virtual override {
    if (from != address(0) && to != address(0)) {
        address v = _transferValidator;
        if (v != address(0)) {
            ITransferValidator721(v).validateTransfer(msg.sender, from, to, startTokenId);
        }
    }
}
\`\`\`

That is the whole design: the token stays standard, but every secondary-market
transfer is gated by a policy contract the creator *chooses* and can swap.
Address \`0\` means no validator and no enforcement; a royalty-enforcing validator
survives the secondary market without hard-coding one vendor's policy into the
collection. The honest framing isn't "royalties are guaranteed on-chain" — it's
"policy lives in a hook that *can* enforce, and it travels with the token."

## Extra durability levers

Transfers and approvals are **paused (soulbound) by default** — \`transfersPaused\`
starts \`true\`, and holder-initiated transfers revert until the owner calls
\`updateTransfersPaused(false)\`. Conduit pre-approval keeps mint→list
approval-free without weakening the validator gate, though the Conduit's own
NatSpec warns honestly that a malicious channel owner could drain approvals — a
real trust caveat, not hidden.

## Three ways onto the allowlist

It's worth contrasting the eligibility mechanisms. SeaDrop verifies an on-chain
Merkle proof whose leaf is \`keccak256(abi.encode(minter, mintParams))\` — the
proof carries per-minter mint parameters:

\`\`\`solidity
MerkleProof.verify(proof, _allowListMerkleRoots[nftContract], keccak256(abi.encode(minter, mintParams)))
\`\`\`

The separate \`GKoiPresale\` path instead uses **ECDSA role-signed claims** —
\`_recoverAddress\` recovers a signer and requires it to hold \`VALIDATOR_ROLE\`. And
both are distinct again from the whitelist *service's* plain \`keccak256(address)\`
tree: three "is this address allowed" mechanisms, each chosen for its context.`,
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
seller, and pointedly not the platform that operates it.

## It's a vote, not a signature scheme

The mechanism is often mis-described as a multisig or a threshold signature. It
is neither. There is no \`ecrecover\`, no EIP-712 typed data, and no on-chain nonce
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

The tally is O(1) over the three designated slots, so one signer voting
repeatedly can never reach the threshold alone. The operator holds an
\`OPERATOR_ROLE\` that may \`open\` an escrow and trigger a refund, but it holds **no
vote** — a fact pinned by the test \`test_approve_operatorHasNoVote\`. The platform
is structurally incapable of deciding an outcome. (Off-chain, the orchestrator
signs EIP-1559 transactions only to *submit* those on-chain \`approve\` calls; it
never holds a party key.)

## Two ways for funds to move — and only two

Money leaves the contract by exactly one of two paths: a 2-of-3 approval
(cooperatively buyer + seller, or on a dispute arbiter + one party), or a
**permissionless, time-locked auto-refund** to the seller after \`refundDeadline\`.
Because the refund is permissionless, an absent or malicious operator can never
strand funds — anyone can trigger it once the clock runs out. Raising a dispute
*freezes* that clock: a \`Disputed\` escrow is rejected by the auto-refund path and
can only be resolved by a 2-of-3 vote.

## Safety scaffolding

The value transfer is Checks-Effects-Interactions plus \`nonReentrant\`: state is
terminalized and \`_locked\` decremented *before* any payout, native value is sent
by low-level \`call\` and reverts the whole settlement on failure, and \`receive()\`
rejects stray ETH. \`pause\` gates only new intake (\`open\`/\`fund\`), so locked funds
can always exit. Assets are deny-by-default — escrowable only up to a
governor-set cap. Fuzz and invariant tests prove the solvency property that, for
every asset, the contract balance is always at least \`lockedOf(asset)\`.

## The platform is not enough

The escrow secures the crypto leg on-chain; final settlement is *mirrored* into
Settleo's off-chain double-entry ledger. The orchestrator opens a two-phase hold
(seller → escrow) on fund, and on release commits it as one all-or-nothing linked
batch — escrow → buyer (net) plus escrow → fee — tagged with the trade. It never
writes balances itself, and deterministic ledger ids make every command
idempotent under retry. One honest caveat worth stating: the contract is
currently **unaudited**, with mainnet gated behind an external audit.`,
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
    body: `Before there was a Go rewrite, there was a working product. NFTMixer (.NET) is
the original generative-NFT builder — C#/.NET 6, Blazor Server, a three-project
Dockerized solution — and it earns its place in the story because the rewrite
only makes sense against it.

## It was a real product, not a toy

The domain model was sound and complete: layered art flows through sources →
assets → variants → traits → rarities → a node graph, then generates PNGs plus
metadata and SHA-256 sidecars. It carried roughly forty EF Core migrations
spanning 2022 to 2026, a masters system, and rarity tiers, with a live V3
generation UI. People used it, and the rewrite kept the model wholesale.

## Blazor Server was the fork in the road

Blazor Server renders \`.razor\` components on the server and diffs them to the
browser over a SignalR websocket. That handed the app things like progress
dialogs "for free" — but it is precisely the piece with no Go equivalent, which
is why the migration ended up ~70% frontend. You cannot port a stateful,
server-rendered UI framework; you rebuild the interface.

## The defects that justified leaving

The interesting engineering lesson is in the defects, catalogued honestly:

- **"Authentication" that didn't authenticate.** The browser reported the
  connected wallet and the server simply believed it — no signature, anywhere.

\`\`\`csharp
SelectedAccount = await _ethereumHostProvider.GetProviderSelectedAccountAsync();
if (SelectedAccount != null) {
    await InitUserData(SelectedAccount);   // server trusts the address as-is
}
\`\`\`

- **An unauthenticated database-dump endpoint** — \`GET /api/Download/export/db\`
  shelled out to \`pg_dump\` and returned the whole dataset with no \`[Authorize]\`.
- **A live API key committed to the repository.**
- **Sessions that never expired**, held in a process-local dictionary whose
  cleanup method was literally empty:

\`\`\`csharp
public static void RegisterToken(string token, Web3User user) {
    _activeTokens.TryAdd(token, (DateTime.UtcNow, user));
    Cleanse();
}
static void Cleanse() {
}
\`\`\`

There was also a two-generators problem — a "Process Paths" button and a "Process
Paths (Accurate)" button that produced *different* collections, the accurate one
with an unbounded loop that could hang. None of this is exotic; it's the ordinary
erosion that accumulates in a shipping app. Naming it is what turned "rewrite for
the language" into "rewrite for correctness." Its successor, \`nftmixer-go\`,
exists to keep the model and drop the debt.`,
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
\`IResponseData<T>\` envelopes and submit back.

## Make chain ops legible by not signing raw transactions

The admin's core move is counter-intuitive: for almost every privileged task, the
operator does **not** sign a wallet transaction. Instead, the action is a labeled
button that POSTs to a backend the operator is already authenticated to, and the
chain / indexing work happens server-side. The UX is a toast lifecycle that
surfaces the server's own message verbatim:

\`\`\`ts
const toastId = toast.loading("Adding new collection...");
const url = \`\${env.MAIN_SERVICE_URL}/api/collections/add/\${tokenAddressOrSlug}?chainId=\${chainId}\`;
const { status, data: { data } } = await api().post(url, null);
if (status !== 201 || !data) throw new Error();
toast.update(toastId, { render: "Successfully added new collection!", type: "success", isLoading: false });
\`\`\`

On-chain *state*, meanwhile, is read-only UI: wagmi \`useReadContracts\` pulls
\`owner\`, \`stage\`, and \`stagePrices\` off the presale contract, and the hook maps
the raw stage enum to a human name and a formatted price. No transaction is
required to *look*.

\`\`\`ts
const { data } = useReadContracts({
  allowFailure: true,
  contracts: [ { ...presaleContract, functionName: "owner" },
               { ...presaleContract, functionName: "stage" } ],
});
\`\`\`

There is exactly **one** genuine direct chain write in the admin — the swap token
redeem/claim, via \`useWriteContract\` — and it's the deliberate exception that
proves the rule.

## Safety rails

Auth is cookie-based: the REST client is \`axios.create({ withCredentials: true })\`
so the session never sits in JS-readable storage, and the server re-authorizes
every mutation. The gate is Privy (SIWE-style) → HttpOnly session cookie →
admin-role/permission verify, with the role fetched from \`gkoi-authentications\` —
the frontend never decides authorization itself. Playwright e2e drives the
operator routes. The through-line: keep the frontends thin so the mint-critical
logic stays concentrated, server-side, and audited.`,
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
most safety-critical thing in the product, and hardens it end to end.

## Privilege separation first

The desktop agent is two processes. A Wails UI holds **no privilege** and is only
an IPC client. A Windows service runs as SYSTEM, exposes **no network listener**,
and is the only thing that can kill or quarantine. They talk over an authenticated
named pipe, and a request has to survive several fail-closed gates before anything
happens.

## Authorize, verify, enforce — in that order

1. **Peer authentication.** The connecting peer's token SID must equal the
   enrolling user's SID, resolved once at accept-time by impersonation to dodge a
   per-request PID-reuse TOCTOU. A read failure is itself a rejection.
2. **Integrity gate.** Mutating ops (\`enforce_directive\`, \`quarantine\`,
   \`unenroll\`, …) require at least medium integrity; a low-IL / sandboxed caller
   is refused, and a failure to read the level is fail-closed:

\`\`\`go
if isMutatingOp(req.Op) {
    lvl, lerr := peer.IntegrityLevel()
    if lerr != nil || lvl < platform.IntegrityMedium {
        return wire.Err("forbidden", "insufficient integrity level for this operation")
    }
}
\`\`\`

3. **Signature before everything.** \`VerifyDirective\` ports a fixed six-step
   order: device-id binding → \`alg == ed25519\` → resolve the pinned key by keyId →
   recompute the signed core over canonical params and **verify the signature** →
   *then* check expiry → then the type/platform allowlist. Expiry is checked after
   the signature precisely so a forged \`expiresAt\` can never be consulted before
   the signature is proven:

\`\`\`go
if err := dsig.VerifyB64(key, []byte(core), env.Sig.Value); err != nil {
    return Verified{}, directiveRejectedf("signature: %v", err)
}
// expiry checked AFTER signature so a forged expiry can't help
if expires < nowUnix { return Verified{}, directiveRejectedf("directive expired") }
\`\`\`

## One enforcer, one guard, at most once

A single shared \`Enforcer\` is the only place a verified directive is driven
through the kill / quarantine / network-filter ports, and it's shared by the IPC
path, the check-in loop, and \`confirm_directive\` so dedup can't be bypassed by
choosing a path. A bounded \`ReplayGuard\` keys the seen-cache on **both** the
directive id and its nonce, evicting soonest-to-expire entries under a flood, so a
captured directive can't fire twice. Destructive types (\`kill_process\`,
\`quarantine_file\`) are held for in-app confirmation; nil ports on a non-elevated
run yield an honest \`"degraded"\` ack rather than a fake success. A local-first
canary → correlate → kill/quarantine loop can act on the device's own detections
with no server round trip.

## Honesty as a security posture

The live system-mutating primitives — WFP filtering, ETW telemetry, and the
\`TerminateProcess\` kill — are elevation-gated behind an explicit integration flag
and were **not executed on this build** (the build machine was non-elevated). What
*was* exercised: the authenticated named-pipe round-trip including an
integrity-gated mutating op, and the DPAPI seal round-trip. The enforcement logic
throughout is unit-tested against **fake ports**, so it runs anywhere. Stating that
split plainly — rather than claiming a kill primitive is "proven" — is part of the
posture, not a footnote.`,
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
The whole design moves that work from request time to write time.

## A STIX pattern is a grammar; a match should be a key lookup

STIX 2.1 \`indicator\` objects carry patterns like \`[domain-name:value = '…']\`.
Parsing the pattern at match time is O(N) in the feed. Instead, \`sentova-mtd\`
lifts every concrete comparison out of the pattern **once at ingest** into a
denormalized \`observables\` array of \`{kind, value}\` pairs, normalized on the way
in. The raw pattern is retained for provenance, but it is not what you query. The
hot path is a multikey index over that array:

\`\`\`go
// value leads (high-cardinality selector); kind narrows collisions.
{Keys: bson.D{{Key: "observables.value", Value: 1}, {Key: "observables.kind", Value: 1}}},
\`\`\`

## Two-phase match, and why the obvious query is wrong

Matching is a batched DB pre-filter followed by an in-memory confirm. One query
does \`{observables: {$elemMatch: {value: {$in: values}}}}\` — the \`$elemMatch\`
keeps the \`value\` match bound to a single array element while the \`$in\` rides the
multikey index; \`kind\` is not constrained in the DB query. Then, in memory, the
analyzer keeps only indicators at the feed's **active snapshot version** and
confirms an exact per-element \`(value, kind)\` hit. The
naive \`{"observables.value": v, "observables.kind": k}\` form is deliberately
avoided because on a multikey index it can match \`v\` in one array element and \`k\`
in a *different* one — a silent false positive. Normalization has to be
byte-identical on both the indicator and artifact sides, or matches quietly miss.
The guarantee is structural rather than a runtime check: because \`observables\` is
a multikey index, the pre-filter plans as an \`IXSCAN\` instead of the \`COLLSCAN\`
that a per-request STIX-pattern parse would force — the index does the seek.

## Snapshots that flip atomically

Feeds carry a monotonic \`snapshotVersion\`. An ingest writes at \`active + 1\` and
bumps the pointer in one update, so a half-written feed is never matched and a
rollback is a version decrement. Verdict derivation is pure and deterministic:
zero matches on a healthy parse is \`CLEAN\`, zero matches on a *degraded* parse is
\`INCONCLUSIVE\` (a real state, never silently downgraded to clean), and any match
is \`COMPROMISED\` with severity taken from the strongest matched indicator.
Mercenary-spyware families default to \`critical\` so they sort to the top.

## Isolation and erasure as construction rules

Because the subjects may be under state-level threat, the storage model is built
for it:

- Every document carries an \`accountId\`, and match scope is the union of the
  caller's account and the shared \`platform\` account — never another tenant's
  data. Identity comes from the verified service-to-service context, **never** a
  request body:

\`\`\`go
account = s2s.Account(r.Context())
principal = s2s.Principal(r.Context())
if account == "" || principal == "" {
    return "", "", apperr.Unauthenticated("not authenticated")
}
\`\`\`

- The fields that reveal a person or device are AES-256-GCM field-encrypted, and
  **encrypted fields are never indexed**; the list endpoint projects them out
  entirely so a poll decrypts nothing.
- Retention is first-class: per-document \`expiresAt\` TTL indexes plus scoped
  erasure, so a subject's data ages out or is deleted with no external cleanup
  path to miss.

Family *names* (Pegasus, Predator, Reign) and the shared severity vocabulary are
safe to talk about; the concrete indicator values behind them are not, and never
appear outside the encrypted store.`,
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
commerce app inherits.

## The Model → Service → Route triad

All server code lives under \`src/server/\` and imports \`"server-only"\`, so the
DB, S3, and secrets can't leak into the client bundle. Three layers, each with one
job:

- **Models** own persistence. A Mongoose schema plus flat \`xxxDB()\` functions,
  each wrapped in a Prometheus timer and returning \`null\`/empty on a read error
  rather than throwing. Cross-cutting rules live in schema hooks: a
  \`pre("aggregate")\` injects \`{ $match: { deleted: false } }\` and normalizes
  \`_id\` to a string; a \`post("aggregate")\` swaps stored S3 keys for signed URLs.
  Ownership is a query-level invariant — updates and deletes filter
  \`{ _id, userId, deleted: false }\`, and "delete" is a soft-delete flag.
- **Services** hold business logic and caching. One function per file; they
  compute Redis query keys, return a cache hit or run the DB work and set a TTL,
  and never touch \`req\`/\`Response\`.
- **Route handlers** stay thin: authorize → \`safeParse\` with Zod → call a service
  → shape the response envelope.

## The wrapper enforces order

\`withApiHandler\` composes the cross-cutting concerns in a deliberate order, and
the ordering is load-bearing: the CSRF Origin/Referer check runs **before** the
rate limiter, so a failed check burns no quota.

\`\`\`ts
if (options.csrf !== false) {
  const reason = csrfReject(req);
  if (reason) { const res = fail(403, reason); observe(req, res.status, options.route, startNs); return res; }
}
if (rl) { rlResult = await enforceRateLimit(req, rl);
  if (!rlResult.allowed) return applyRateLimitHeaders(fail(429, "Too many requests"), rlResult); }
\`\`\`

## Access control that survives a bad policy

Authorization is a real AWS-IAM-style policy engine, not inline role checks.
\`withAuth\` resolves an \`effectiveOwnerId\` — the user's own id in personal scope,
or the org owner's id when they've switched into an organization — so org members
transparently operate on the owner's resources through a single evaluation path.
And the engine has a hard tenant-isolation floor that beats policy content
entirely:

\`\`\`ts
if (target.plane === "org" && target.orgId !== resourceScope(auth)) {
  return { decision: "deny", reason: "implicit deny (cross-scope org resource)" };
}
\`\`\`

Even a wildcard policy can't cross tenants, because the boundary is checked before
the policy is.

## Receipts, not vibes

The reason it's a *reference* is that it's proven: 93 Vitest files against
throwaway scratch DBs dropped on teardown, 16 Playwright specs, and a three-pass
\`SECURITY_REVIEW.md\` with roughly forty findings. The standout is S1 — "2FA was
never enforced on login; the toggle was decorative" — found by audit and fixed
with a two-step ticket flow. Getting the skeleton right once and cloning it means
each new product spends its novelty budget on the actual problem, not on
re-litigating how a request becomes a database write.`,
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

The spec (\`Chekka_Core_Features.md\`) is about **4,700 words across 596 lines** —
twelve numbered core features plus a "Tech Stack & Code Conventions" section. It
isn't enormous; it's *dense and structured*, and its most useful trick is that it
ships the **code skeleton** the build then follows verbatim: the route-handler
shape and the Mongoose model conventions are written into the spec, so "spec" and
"scaffold" are the same document. The build follows a contract instead of
rediscovering scope in code review.

## Descended from the reference architecture

Chekka is explicitly "built on the same conventions as \`managerenta-client\`" —
its README says so on line 5. The same server-only \`src/server/\` triad, the same
\`withApiHandler(withAuth(...))\` route skeleton, the same \`pre\`/\`post("aggregate")\`
hooks, \`databaseResponseTimeHistogram\` timers, soft-delete, and model
memoization. The infrastructure is deliberately unsurprising so the surprise
budget can all go to the domain.

## The domain is a lifecycle

The core entity is \`inspections\`, and its \`status\` field is a state machine:
\`submitted → assigned → (declined) → scheduled → in_progress → report_processing →
completed\`. Assigning an inspector at creation stamps \`assignedAt\` and jumps to
\`assigned\`; pricing is computed server-side from an admin-tunable \`siteConfig\`
plus a flat urgent surcharge.

## Report integrity is the product

A report a buyer paid to trust must be immutable once filed, and its numbers must
be the server's, not the client's. On submit, Chekka recomputes the summary counts
from the checklist item statuses and refuses to touch a locked report:

\`\`\`ts
if (current.reportLockedAt) throw ErrReportLocked;
const all = [...report.exterior, ...report.interior, ...report.mechanical, ...report.roadTest];
const summary = { ...report.summary,
  passed:  all.filter(i => i.status === "good").length,
  minor:   all.filter(i => i.status === "minor").length,
  serious: all.filter(i => i.status === "serious").length };
if (lock) { patch.status = "completed"; patch.reportLockedAt = new Date(); }
\`\`\`

Sharing a finished report is a read-only, self-expiring capability: a \`uuidv4()\`
nonce maps to the inspection id in Redis with a 7-day TTL, so the link grants
unauthenticated read access to *one* report and the inspection id never appears in
the URL. Report integrity, S3-backed evidence, and a booking flow that schedules
real humans are the three things that carry the product; everything else is
plumbing in service of them.`,
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

## The supporting cast, each doing one thing

Zod validates at the edges with \`.strict()\` objects; an ioredis singleton throws
loudly on a 5-second boot ping rather than silently falling back to memory;
namespaced Redis cache keys are invalidated on write; two Prometheus histograms
(\`http_request_duration_seconds\` and \`database_request_duration_seconds\`) make
every route and every DB call independently observable; and parallel
\`auditAdmin\`/\`auditUser\` streams fire in a \`finally\` so they survive a throw.

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
clear about which ships. The **live app** is a single Next.js 16 App-Router
application persisting to **MongoDB via Mongoose 9**, with Redis for locks, OTP,
rate-limiting, and cron coordination — no queue. A **separate, earlier service**
(\`prechop-api\`) is Fastify 5 + **Prisma 7 / PostgreSQL** with a BullMQ worker. The
Prisma schema is the cleanest expression of the data model, so it's worth reading
— but it is *not* the live store. I'll draw the model from \`prechop-api\` and the
shipped scheduling from the Next.js app.

## Three time-states

A listing is a window. It is **not-yet-open** while \`scheduledDate\` /
\`availableFrom\` is in the future, **orderable** between open and \`cutoffTime\`
while \`ACTIVE\`, and **closed** once the cutoff passes. The read-time guard on every
order attempt is the same in both backends — reject a too-early order, throw a
cutoff-passed error past the deadline — so no scheduler race can let a late order
slip through.

## Two ways to close a listing at its cutoff

This is the interesting divergence:

- **\`prechop-api\` — a BullMQ delayed job keyed by listing id.** On publish it
  removes any existing job and enqueues one that fires exactly at the cutoff; the
  \`jobId = dailyOrderId\` makes it self-deduping and idempotent.

\`\`\`ts
const existingJob = await cutoffEnforceQueue.getJob(dailyOrderId);
if (existingJob) await existingJob.remove();
const delay = Math.max(0, cutoffTime.getTime() - Date.now());
await cutoffEnforceQueue.add("close-daily-order", { dailyOrderId },
  { jobId: dailyOrderId, delay, removeOnComplete: true, removeOnFail: true });
\`\`\`

- **The live app — a per-minute cron sweep with a Redis single-instance lock.**
  Every job is wrapped in a helper that takes a \`cron:lock:<db>:<job>\` so only one
  instance per tick does the work under horizontal scaling. Simpler, no queue
  infra, and several jobs are pinned to the Lagos timezone because a UTC host would
  fire an hour off.

## Cutoff isn't just "stop new orders"

When the window closes, orders the vendor took money for but never confirmed are
**auto-cancelled and refunded** through Paystack — closing the listing and
sweeping stale paid orders are two different jobs. The 30-minute pre-cutoff
*warning* needs idempotency, because a per-minute sweep would otherwise send
thirty SMS; it's solved with a per-listing \`SET NX\` whose TTL outlives the window,
so the expiry *is* the reset.

## Money and slots are server-authoritative

Pricing, item resolution, and add-on ownership are all computed server-side — the
client sends only ids. Paystack runs on split subaccounts (the platform absorbs
the processing fee), and the webhook verifies an **HMAC-SHA512** signature on the
raw body with a timing-safe compare *before* doing anything, then checks
idempotency and that the paid amount matches the record. Finite \`maxQuantity\`
slots are guarded separately with atomic Redis reservations (\`INCRBY\` + \`EXPIRE\`,
availability = capacity − committed − reserved) so concurrent buyers can't oversell
the last portion.`,
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
and neither client imports its internals. Both talk to it over HTTP through two
shared packages: \`@adverta/contracts\` (per-domain Zod schemas, the route table,
and the IAM catalog — a zod-only leaf) and \`@adverta/api-client\` (one typed
\`ApiClient\` serving web-cookie, SSR-forwarded-cookie, and mobile-bearer callers).
The packages are consumed as **raw TypeScript via \`exports\` maps — no build step**
— so a contract change breaks the *compile* of both apps in the same commit. There
is no "the mobile app is two versions behind the endpoint" class of bug, because
the endpoint's request schema and the client's input type are the same Zod object.

The mobile client's 401 auto-refresh is de-duped via a single \`refreshInFlight\`
promise, so the single-use rotating refresh token is spent exactly once even under
a burst of concurrent 401s.

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
actor id to defeat Sybil drain; and totals are always recomputed, never trusted
from the client.

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

A user's effective set is **re-resolved from the DB on every request**
(Redis-cached for 30 seconds; an inactive account resolves to the empty set = deny
all), so a revocation bites within seconds. Agency white-label rides on top: an
agency id is taken from the **session, never the request**, so holding
\`clients:write\` is not enough to act on *another* agency's clients.

One honest caveat carried into the writing: "per-operation database/service"
describes code structure plus application-level IAM — one \`*DB\` fn and one service
file per operation — not distinct database credentials.`,
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
    body: `Mogadget is a gadget catalog for a single Lagos retailer, and it ends where most
e-commerce sites begin: there is no cart and no checkout. A customer browses,
filters, and orders over **WhatsApp or Instagram**. The missing feature is the
feature.

## The hand-off *is* the order flow

This is a documented product decision, not an unfinished one: the store already
closes sales in chat, so bolting on a checkout would add a payment integration, an
order-state machine, and a fulfilment flow to duplicate a conversation the owner
would rather just have. The site's only job is to turn a browsing intent into a
well-framed message. A pure-function \`domain/whatsapp.ts\` builds the deep link,
prefilling the exact product and price:

\`\`\`ts
export function buildWhatsAppLink(p) {
  const base = \`Hi, I'm interested in the \${p.name} (\${formatNaira(p.priceNaira)}) listed on MoGadget\`;
  const msg = p.url ? \`\${base} — \${p.url}\` : base;
  return \`https://wa.me/\${WHATSAPP_NUMBER}?text=\${encodeURIComponent(msg)}\`;
}
\`\`\`

## Analytics that never interrupt the sale

The one thing the site *does* record is which channel a visitor tapped, and it
does so without ever blocking navigation. A client beacon fires **before** the
browser leaves — \`navigator.sendBeacon\` with a keepalive \`fetch\` fallback, wrapped
in try/catch — and the server atomically \`$inc\`s a per-product counter, then
appends to a \`clickEvents\` log best-effort. That log is a **TTL-expiring,
PII-free** time-series: a MongoDB TTL index ages rows out after 180 days with no
cron, and nothing personal is stored. Analytics are best-effort; the sale is not.

## The model carries the rules

Catalog invariants live in a pure, unit-tested \`domain/\` layer rather than
scattered through handlers: a \`NEW\` product must have no cosmetic grade and be
restockable, a used one must carry a grade and be a unique unit, and a restockable
listing auto-hides when quantity hits zero (but restocking never auto-unhides —
re-listing is a deliberate admin action). The product list itself sinks
sold/out-of-stock items below available ones, and search rides a Mongo text index
alongside a compound filter index.

## Honest tension

The product doc argued for "one admin login, no roles," but the shipped app
actually carries a full IAM stack — users, groups, policies, WebAuthn passkeys,
and TOTP 2FA — and the doc's own "historical note" flags the pivot. It's a
descendant of the managerenta reference architecture (same \`src/server\` triad and
\`withApiHandler\`, with its own \`withPermission\` RBAC wrapper) plus a \`domain/\` layer and a client \`src/lib/\` API
layer, with 39 colocated Vitest specs. Matching software to how a business
*actually* sells often means building less — and being honest about where you
built more.`,
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
agents that act on the user's own data — think Todoist plus Notion plus a team of
assistants that can do the work — and the task-manager surface (lists, nested
tasks, calendar, alarms, trash) is the substrate the agents operate on. A codebase
that large needs its layers defended, and it defends them with a script.

## A lint that fails the build

The centrepiece is \`tools/arch-check.ts\`: a ~320-line, **zero-dependency**
(\`node:fs\` + \`node:path\` only) boundary guard, run as \`pnpm arch:check\`, that
**exits 1** on any violation so CI and pre-push fail. "Please don't import the
database from the UI layer" is a code-review plea that erodes under deadline; a red
check does not get tired. It enforces five distinct classes of decay:

- **routes ↛ routes** — a route file may not import another route file, with a
  documented **Stage-6B exception**: a decomposed god-file may import its own
  co-located \`routes/modules/<name>/*\`, but cross-module and arbitrary top-level
  route→route imports stay violations.
- **lib ↛ routes** — the lower layer may never import the upper one.
- **An import-cycle ceiling of 0.** It builds the full static import graph over
  \`apps/api/src\`, runs iterative **Tarjan SCC**, and fails if any file sits in a
  cycle. Only *static* edges count — dynamic \`import()\` is the sanctioned
  cycle-breaker — and a comment records the burn-down as cuts landed:
  \`106 → 43 → 13 → 10 → 0\`.
- **A legacy-path ban**, so a completed rename can't silently regress.
- **A raw-fetch allowlist** — any file calling the Anthropic messages endpoint
  that isn't on a six-entry allowlist is a violation, forcing every non-streaming
  model call through one resilient wrapper that handles credits, 429s, retries,
  and telemetry.

It also emits **non-gating** visibility reports — a cycles summary, a list of files
≥1200 lines as split candidates, and a mixed static+dynamic SCC report for runtime
layering debt the zero-static ceiling can't see. The header is honest that this is
the *interim* guard until a fuller structure lands, at which point it's swapped for
dependency-cruiser.

## The shape underneath

It's a pnpm monorepo: an \`apps/web\` of **React 19 + Vite + Tailwind v4 + TanStack
Query**, and an \`apps/api\` of **Fastify 5 + \`node-pg\` + Zod over PostgreSQL 17**,
with no ORM. Live updates were migrated off SSE onto a WebSocket bus,
\`realtimeBus\`, whose design is worth stealing: a per-user \`Set<WebSocket>\`
(multi-tab safe), a ring buffer of recent frames for reconnect replay, and a
monotonic per-user sequence. Each frame carries the process start time, so a client
reconnecting after a server restart is told the buffer is gone and falls back to a
refetch — an at-least-once realtime protocol with explicit gap detection via a
resume handshake.

## Why it matters on any project

Architecture rot doesn't wait for scale; it starts on day two of any codebase with
layers. Encoding the layering as an executable check — one that even carries a
documented exception for legitimate decomposition — is how the structure defends
itself instead of relying on everyone remembering the plan.`,
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
build, and exactly **one** client island: a dependency-free SVG animation. There's
no form handler and no lead store because conversion is offloaded to a third party
(a \`wa.me\` link), which removes an entire category of runtime failure by simply
not having a runtime to fail.

## Static content, stated precisely

One honest nuance: this is static *content*, not a hard static export. The README
calls it "statically rendered," and it is — but \`next.config.ts\` carries **no
\`output: 'export'\`**, so the build is a standard Next.js server bundle that assumes
a Node runtime (or Vercel), not an exported \`/out\` directory. It's a fair "right
amount of engineering" story either way; it's just not a file-server-only site, and
saying so keeps the claim accurate.

## Styling, and the shadcn that wasn't

Styling is **Tailwind v4, CSS-first** — no \`tailwind.config.*\` at all; the theme
lives in \`globals.css\` behind \`@import "tailwindcss"\` and an \`@theme inline\` block
of brand tokens. shadcn was *scaffolded* (there's a \`components.json\`), but no
\`src/components/ui\` directory was ever generated and \`cn\`/Radix are never imported
— the page uses hand-written Tailwind components. Full SEO and crawler
discoverability is achieved purely with static Next metadata conventions
(\`sitemap.ts\`, \`robots.ts\`, OpenGraph/Twitter image routes, a manifest) plus
\`ProfessionalService\` JSON-LD.

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

## Why group them

Three tiny repos as three tiny stars would pad the map and imply more than there
is. One "Labs" node credits the work without inflating it. It's the sharpening
stone, not the blade: a modern C++ baseline to keep the language fresh, algorithm
reps to keep the fundamentals warm, and IaC practice to keep the ops muscles from
atrophying.

## The point of a labs corner

Shipping products is the visible work; staying sharp is the work that makes the
next product better. Naming a place for the second kind — and being upfront that
it's practice, not production — is just keeping the portfolio honest.`,
  },
];

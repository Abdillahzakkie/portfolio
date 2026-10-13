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
      'In Settleo, only one service is ever allowed to move money — and that single rule is what makes every balance trustworthy.',
    tags: ['typescript', 'tigerbeetle', 'grpc', 'ledger', 'fintech', 'double-entry'],
    seo: {
      metaTitle: 'Building a double-entry ledger on TigerBeetle — Settleo',
      metaDescription:
        'Why Settleo makes one service the sole writer to a TigerBeetle double-entry ledger, with u128 integer money, two-phase holds, and a rebuild-from-log durability story.',
    },
    body: `In Settleo, exactly one service is allowed to move money: \`settleo-ledger\`.
Every other service can *describe* what should happen, but only the ledger records
the debits and credits that make it real. It is the sole writer to the money
database; everyone else asks it over the network. That single-writer rule is the
whole reason a balance can be trusted.

## Double-entry, on a database built for it

Double-entry accounting is old and boring, which is exactly what you want near
money: every transfer takes an amount from one account and adds the same amount to
another, so value can never appear or vanish. The ledger runs on TigerBeetle, a
database that understands accounts and transfers as first-class things, so it
leans on that instead of hand-rolling a balances table. A handful of rules are
pinned down and property-tested: balances always balance, available balance never
goes negative, applying the same transfer twice equals applying it once, and a
hold posts *or* voids exactly once.

## A pure reducer as the spec

The most useful trick in the repo is that those rules live in a *pure, in-memory*
\`Ledger\` class with no I/O and no clock. It is both the specification the real
database adapter must match and a fast fake for higher-level tests. Its batch
method captures idempotency and all-or-nothing rollback in a few lines — snapshot,
try, restore on failure:

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

Overdrafts are refused by construction in both the reducer and TigerBeetle, so the
integration test is a real cross-check rather than a tautology.

## Money is never a float

Amounts are integer minor units, too large for a normal JavaScript number, so they
cross the wire as a decimal string and live as \`bigint\` internally. There is no
floating-point path anywhere near a balance.

## Idempotency across a type boundary

TigerBeetle wants a numeric id and the domain speaks string ids, so the bridge is
deterministic: hash the string id and use the result as the numeric id. The same
string always maps to the same id, so a retry becomes a no-op rather than a
double-spend.

## Two-phase holds

A hold reserves money now and commits or releases it later, and the timeout lives
in the database: TigerBeetle auto-voids an expired hold itself, so the client never
drives expiry. A settlement that pays a buyer and a fee at once is a linked batch
that commits together or not at all.

## The hard part: signing a gRPC body

Every internal call is signed over the request body, but the wire format quietly
drops empty and zero fields — so a naive signature breaks the moment one is
dropped. The fix is a shared canonical form: drop those defaults, sort the keys,
JSON-encode — computed identically by sender and verifier so the signature survives
the round trip. Because the signature covers the body, it is checked per handler,
and the signed name is the fully-qualified RPC path so a signature for one call
can't be replayed against another.

## Durability, stated honestly

TigerBeetle and the MongoDB read model cannot share a transaction, so the read
model is treated as a cache that is always **rebuildable from the transfer log**.
The ledger stages an event per transfer through a transactional outbox, and a
projector replays that log to rebuild balances and history. A reconciliation pass
then cross-checks the two field by field and requires zero drift. The honest
footnote: that only *means* something once the real event sources are wired end to
end — until then it's a guardrail proving the two derived paths agree, not a claim
that the whole platform has been reconciled in production. The ledger is
authoritative; the projection is a cache that can always be reconstructed.`,
  },

  // ─────────────────── NFTMixer (Go) — neutral → published ───────────────────
  {
    title: 'Rewriting a .NET Blazor app in Go without losing parity',
    slug: 'nftmixer-net-to-go-parity-rewrite',
    status: 'published',
    publishedAt: '2026-07-10T09:00:00.000Z',
    projectSlug: 'nftmixer-go',
    excerpt:
      'Porting an old .NET app to Go and Next.js, where most of the work turned out not to be Go at all — and the best parts were the bugs we refused to carry over.',
    tags: ['go', 'dotnet', 'nextjs', 'rewrite', 'siwe'],
    seo: {
      metaTitle: 'Rewriting a .NET Blazor app in Go without losing parity',
      metaDescription:
        'What survived the port from C#/.NET 6 Blazor Server to Go + Next.js, why 70% of a "Go rewrite" was frontend, and the deliberate parity breaks that fixed the original.',
    },
    body: `"Rewrite it in Go" is a satisfying sentence. In this case it was also, mostly, a
lie — and noticing that early is what made the rewrite tractable.

## Blazor Server *is* the UI

The original NFTMixer is a C#/.NET 6 Blazor Server app. Blazor Server renders the
page on the server and pushes screen updates to the browser over a live socket, and
Go has no equivalent. So while the generation engine, database access, storage, and
wallet auth all port to Go cleanly, roughly **70% of the work was frontend**,
rebuilt from scratch in a Next.js app. Budgeting for that up front is the
difference between a plan and a surprise.

One more decision removed most of the remaining risk: **the migration has no
cutover.** Existing data was declared expendable and the schema is new, so there
was no dual-write window, no backfill, and none of the "does the old row map to the
new shape" edge cases — which is normally the single largest source of rewrite
risk.

## Parity means behaviour, not files

"Functional parity" here is a defined checkpoint, and it means matching *behaviour*,
not porting files. That framing is what let me *leave things behind on purpose*.
Three kinds of C# code were deliberate non-ports:

- **Dead code** — a whole generator library that wasn't actually the live engine,
  plus superseded components that were referenced but unreachable.
- **Dangerous code** — an unauthenticated \`pg_dump\` export endpoint and a
  committed live Pinata key. Porting those faithfully would just have reproduced
  the debt.
- **Unfinished code** — an IPFS publish that returned before it uploaded. There
  was no working behaviour to preserve.

## Authentication that actually authenticates

The original's "auth" believed whatever wallet the browser named — no signature,
anywhere. The Go app does real SIWE: parse the message strictly, recover who
actually signed it, consume a single-use nonce **issued to that exact wallet**, and
only then mint a session. Recovery deliberately avoids pulling in go-ethereum —
its library code is LGPL-3.0 and would put a source/relink obligation on a
proprietary binary — and needs only two permissively-licensed primitives:

\`\`\`go
v := sig[64] // Ethereum [R||S||V]; dcrd wants [V||R||S]
if isHighS(sig[32:64]) { return "", errMalleable } // reject malleable high-S
compact := make([]byte, signatureLen)
compact[0] = v
copy(compact[1:], sig[:64])
pub, _, err := ecdsa.RecoverCompact(compact, EIP191Hash(message))
\`\`\`

Ownership then comes from the session and is folded into the database query itself,
so a handler that forgets to check simply finds no document and returns not-found —
there is no unfiltered read to leak by mistake. Sessions expire through a database
TTL index instead of living forever in an in-memory map whose cleanup method was
empty.

## Deliberate parity *breaks* that are fixes

A rewrite is the one chance to be correct where the original was wrong, and each
fix is pinned by a test. The original shipped two different generators, one of
which could **hang** when it ran out of unique combinations; the Go engine folds
both into one generator with a **bounded retry** that returns a clean exhaustion
error instead of spinning. Numbering that used to leave gaps is now gap-free;
layers that used to misalign are all resized to the output; and flat metadata that
no marketplace accepted was replaced with a schema marketplaces actually read.

## Rendering can't be identical, and that's fine

Go's image encoder isn't the C# one, so the rendered bytes differ. Rather than
chase an impossible exact-match, the render tests check **perceptual structure**,
while the metadata JSON — which *must* be byte-stable for a marketplace — is checked
exactly. Parity with the intent, not the mistake. That is the whole discipline of
this rewrite in one line: keep the behaviour worth keeping, fix the behaviour that
was wrong, and refuse to port the behaviour that never should have existed.`,
  },

  // ─────────────────── GKOI Platform (client → draft) ───────────────────
  {
    title: 'A Merkle-proof whitelist that scales apart from the mint',
    slug: 'gkoi-merkle-whitelist',
    status: 'draft',
    projectSlug: 'gkoi-platform',
    excerpt:
      'Why GKOI runs its mint allowlist as its own small service, and how it proves an address belongs on the list cheaply — without putting the whole list on the blockchain.',
    tags: ['web3', 'merkle', 'nft', 'nodejs', 'ipfs'],
    seo: {
      metaTitle: 'A Merkle-proof whitelist that scales apart from the mint',
      metaDescription:
        'How gkoi-whitelist builds a keccak256(address) Merkle tree with merkletreejs sortPairs, puts only a 32-byte root on-chain, and serves consistent proofs via snapshot caching and explicit invalidation.',
    },
    body: `A mint is a stampede, and the worst place to find a bottleneck is the one request
path that also decides who is allowed to pay you. GKOI carves its allowlist out
into a service of its own — \`gkoi-whitelist\` — so it can scale, fail, and be
audited on its own. This post follows one thing end to end: how an address becomes
proof that it's on the list, and how that proof gets checked cheaply at mint time.

## Why Merkle, and what actually goes on-chain

Storing thousands of allowed addresses on the blockchain is expensive. A Merkle
tree solves that: it folds the whole list into a single 32-byte fingerprint (the
**root**) that the contract stores, while each user carries only a small **proof**
that their address is in the list. That's the whole scaling property — the list can
grow to any size without changing what lives on-chain or what a mint costs.

## Build: hashed addresses, order-independent pairs

Each address is hashed into a leaf, and the tree is built with a setting
(\`sortPairs\`) that sorts each pair before hashing. That makes the tree
order-independent, so the contract can rebuild the same root without the service
and the contract having to agree on any ordering:

\`\`\`ts
const hashedAddresses = addresses.map((addr) => ethers.keccak256(addr));
const root = new MerkleTree(hashedAddresses, ethers.keccak256, {
  sortPairs: true,
}).getRoot();
return \`0x\${root.toString("hex")}\`;
\`\`\`

An operator sets that root on the mint contract. The service never writes
on-chain — it only ever answers three reads (the root, a given address's proof, and
whether an address is on the list) plus admin add/remove. At mint the contract
rebuilds the root from the user's proof, and because the pairs are order-independent,
it always agrees with the service's root. (It's a **different tree** from SeaDrop's
own allowlist, whose leaves carry per-minter parameters — same idea, different
payload.)

## The correctness trap: cache the list, not the tree

The hashing work still has to stay off the request hot path, but caching a built
tree invites drift — rebuild it slightly differently and a served proof no longer
matches the served root. So the cache stores the **sorted list of addresses**
instead: the exact input the helpers hash. Rebuilding from that is byte-identical
to a cold build, so a cached proof is *always* consistent with the cached root.
Root and list share one version and are invalidated together, so a change shows up
on the next read, and the full-list read that feeds the tree is hard-capped so it
can never stream back an unbounded result. Contract metadata is pinned to IPFS and
cached for 24 hours — and **only successful pins are memoized**, so a failed pin is
never cached as a permanent answer.

## Why a whole service for this

Whitelisting and authentication are the mint-critical surfaces, so they live apart
from the large \`gkoi-server\` — each small enough to reason about, each shipping its
own security and audit docs, each enforcing its own scoped, signed calls. There's no
shared database and no ambient admin key. The allowlist doesn't
just scale apart from the mint — it fails and gets audited apart from it too.`,
  },

  // ─────────────────── GKOI Contracts (client → draft) ───────────────────
  {
    title: 'Royalties that survive the secondary market: ERC721-AC',
    slug: 'erc721ac-enforceable-royalties',
    status: 'draft',
    projectSlug: 'gkoi-contracts',
    excerpt:
      'How an NFT collection can declare its royalty and then hand enforcement to a swappable policy contract that travels with the token — instead of trusting each marketplace to pay.',
    tags: ['solidity', 'foundry', 'erc721', 'royalties', 'seadrop', 'nft'],
    seo: {
      metaTitle: 'Royalties that survive the secondary market: ERC721-AC',
      metaDescription:
        'How the GKOI collection exposes the Creator Token interface and calls an external, swappable ITransferValidator721 in _beforeTokenTransfers, with ERC-2981 rates and soulbound-by-default transfers.',
    },
    body: `Marketplace-honoured royalties are a promise, not a mechanism — and promises break
the moment a venue decides to compete on fees. The GKOI collection
(\`gkoi-erc721AC\`) takes a more honest position: it declares its royalty *rate*
on-chain and hands *enforcement* to a policy contract that travels with the token
and that the creator can swap out.

## Rate versus enforcement — two things people smudge together

- **The rate** is a standard ERC-2981 declaration: given a sale price, the contract
  reports the royalty owed, and setting it rejects a zero receiver or a rate above
  100%. Marketplaces read this and *may* honour it.
- **The enforcement** — did a transfer actually route through a sale that paid the
  royalty? — is a separate question, answered by an external, owner-configurable
  transfer validator.

## The enforcement seam

On every ordinary transfer, the token calls out to whatever validator the owner has
pointed it at:

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

The validator is owner-set and swappable, and the null address means no validator
and no enforcement. That's the whole design: the token stays standard, but every
secondary-market transfer is gated by a policy the creator *chooses* and can
replace. The honest framing is "policy lives in a hook that *can* enforce, and it
travels with the token," not "royalties are guaranteed on-chain." A test with a
validator built to always revert proves the hook really does call out.

## Extra durability levers

Transfers and approvals are **paused (soulbound) by default** and stay that way
until the owner flips a switch. Conduit pre-approval keeps the mint→list step
approval-free without weakening the validator gate — but the conduit's own docs
warn, and I'll quote rather than bury it, that *"a malicious or negligent owner can
add a channel that allows for any approved ERC20/721/1155 tokens to be taken
immediately."* A conduit is a one-approval, controller-gated router; that
convenience is also its trust caveat.

## Three ways onto the allowlist

Eligibility isn't one mechanism. SeaDrop verifies an on-chain Merkle proof whose
leaf carries per-minter parameters; a separate presale path uses a role-signed claim
that's single-use with its deadline capped five minutes out; and both differ again
from the whitelist *service's* plain-address tree. Three "is this address allowed"
mechanisms, each picked for its context.

## Deploy paths: two tools, chosen deliberately

Standalone collections deploy from packaged raw bytecode to a deterministic,
pre-computable address. The cloneable SeaDrop line takes the other road — a cheap
minimal-proxy clone of one pre-deployed implementation, then an initialize call. A
full independent deployment when you want one; a cheap clone when you want many off
one implementation — the same instinct as delegating royalty enforcement to a
swappable validator rather than baking one policy in forever.`,
  },

  // ─────────────────── Settleo Escrow (client → draft) ───────────────────
  {
    title: 'A 2-of-3 non-custodial escrow (the platform is not enough)',
    slug: 'settleo-2-of-3-escrow',
    status: 'draft',
    projectSlug: 'settleo-escrow',
    excerpt:
      "Settleo's escrow can only release money when two of the three parties agree — the platform that runs it gets no vote at all.",
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

The mechanism is often mis-described as a multisig. It isn't. Each of three named
addresses — \`buyer\`, \`seller\`, \`arbiter\` — calls \`approve\` itself, and the
contract records that caller's vote. When two distinct parties vote for the same
outcome, the same call settles:

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

The tally counts exactly three slots, so one signer voting repeatedly can never
reach the threshold alone, and \`AlreadyVoted\` stops a signer padding the count. The
three parties must be distinct addresses, checked when the escrow opens — because if
two roles collapsed to one address, a single key could reach "2-of-3" by itself.
The operator may *open* an escrow and trigger a refund, but it holds **no vote** —
pinned by a test. The platform is structurally incapable of deciding an outcome.

## Two ways for funds to move — and only two

Money leaves by exactly one of two paths: a 2-of-3 approval, or a **permissionless,
time-locked auto-refund** to the seller after the deadline. Because the refund is
permissionless, an absent or malicious operator can never strand funds — anyone can
trigger it once the clock runs out. But only a *funded* escrow auto-refunds:
raising a dispute freezes the clock, and a disputed escrow can only be resolved by
a 2-of-3 vote. That tension is deliberate — the auto-refund is a backstop for the
honest-but-idle case, and disputing explicitly opts out of it in favour of
arbitration.

## Safety scaffolding

The payout follows checks-effects-interactions with a reentrancy guard: the escrow
is finalized and its locked amount decremented *before* any money moves, and a
failed transfer reverts the whole settlement. Stray ETH is rejected, and \`pause\`
gates only new intake, so locked funds can always exit. Fuzz and invariant tests
prove the solvency property — for every asset, the contract's balance is always at
least what it owes. There are no off-chain signatures to recover, so signature
malleability simply doesn't apply, and replay is handled by the state machine
refusing to re-enter terminal states.

## Off-chain: choosing the votes, idempotently

The contract enforces the threshold; the orchestrator decides *which* two approvals
to drive and submits them without ever double-voting. It signs its own transactions
and is **idempotent under retry by reading the chain first** — skipping a vote
that's already recorded and stopping if a prior vote already settled the trade:

\`\`\`ts
for (const role of roles) {
  const signer = this.addressForRole(role, settleParties);
  if ((await this.readVote(id32, signer)) === outcomeEnum) continue; // already voted
  if ((await this.readState(id32)) === terminal) break; // a prior vote already settled it
  lastHash = await this.sendTx(signer, encodeCall(SIG.approve, [/* … */]), 0n);
}
\`\`\`

So an at-least-once redelivery never resubmits a vote — it reads the chain, sees the
vote is already there, and moves on. The dispute service applies the *same* 2-of-3
rule and is IDOR-hardened: a voter's role is *derived* from the gateway-asserted
actor, never claimed, so one operator can't cast a "buyer" vote and then an
"arbiter" vote to self-resolve.

## The platform is not enough

The escrow secures the on-chain leg; final settlement is *mirrored* into Settleo's
off-chain double-entry ledger as one all-or-nothing linked batch, with
deterministic ids so every command is idempotent under retry. One honest caveat
worth stating plainly: the contract is currently **unaudited**, with mainnet gated
behind a clean external audit, and the multi-party signer that would hold real
party keys in production is an external component not yet built.`,
  },

  // ─────────────────── NFTMixer (.NET) — neutral → published ───────────────────
  {
    title: 'The Blazor app that came first (and why we left it)',
    slug: 'nftmixer-net-blazor-predecessor',
    status: 'published',
    publishedAt: '2026-07-08T09:00:00.000Z',
    projectSlug: 'nftmixer-net',
    excerpt:
      'A look back at the original .NET Blazor version of NFTMixer — a real, feature-rich app whose four honest flaws are exactly why it was rebuilt from scratch.',
    tags: ['dotnet', 'blazor', 'csharp', 'retrospective'],
    seo: {
      metaTitle: 'The Blazor app that came first (and why we left it)',
      metaDescription:
        'A retrospective on NFTMixer (.NET) — the C#/.NET 6 Blazor Server generative-NFT builder that defined the product, and the defects (spoofable auth, an open DB dump, a committed key, non-expiring sessions) that motivated the Go rewrite.',
    },
    body: `Before the Go app there was a Blazor one, and it worked. It shipped features, had a
real generation engine, masters, rarity tiers, and years of database migrations
behind it. It was mature, not a toy. This is the honest retrospective — what it did
well, what it couldn't keep, and why the second forced a rewrite rather than a patch.

## The thing it did well was also the thing that trapped it

NFTMixer (.NET) is a C#/.NET 6 **Blazor Server** app: the whole UI renders on the
server and is pushed to the browser over a live socket. That model is productive — a
long generation run could stream progress "for free." But it has **no Go
equivalent**, so the moment the decision was "own the stack in Go," the entire
interactive surface had to be rebuilt in TypeScript. That's the honest reason the
migration ended up ~70% frontend. Storage sealed it: the app wrote output to **local
disk**, on a volume the design notes say "must never be lost" — the opposite of a
container you can kill and reschedule.

## The four foundations we couldn't keep

The features were fine; the foundations were not — and each maps to a Go-side fix.

**1. Authentication that doesn't authenticate.** The browser reported the connected
wallet and the server simply believed it — no signature challenge anywhere, so
anyone could log in as any address, including an admin's. *(Go fix: real SIWE.)*

**2. An unauthenticated database dump.** An export endpoint shelled out to
\`pg_dump\` and returned the whole dump with **no authorization** on it. *(Go fix:
not ported at all.)*

**3. Ownership read from the URL.** A download endpoint built the output path
straight from the \`userId\` in the URL, so any caller could download any user's
output. *(Go fix: ownership is folded into the database query.)*

**4. Sessions that never expire.** Tokens lived in a process-local map whose sweep
method was empty, so it only ever grew:

\`\`\`csharp
public static void RegisterToken(string token, Web3User user) {
    _activeTokens.TryAdd(token, (DateTime.UtcNow, user));
    Cleanse();
}
static void Cleanse() {

}
\`\`\`

*(Go fix: every session carries a hard expiry a database TTL index enforces.)*
There was also a committed live Pinata API key in source — treated as burned and
never carried forward.

## The tell: two "generate" buttons

The clearest symptom: the app shipped a **"Process Paths"** button and a **"Process
Paths (Accurate)"** button that produced *different collections*. The "accurate" one
could hang when the graph couldn't yield enough distinct combinations, and it left
gaps in the numbering. Two divergent notions of
"generate," one of which could lock up, isn't a bug you patch; it's a design you
replace. The Go engine folds both into one generator with a bounded retry that
fails with an actionable error instead of spinning.

## Why it still earns its place

None of this is a dunk on the app; it reached a feature set the rewrite spent seven
slices catching up to. The reason to keep it visible is that the interesting
engineering is the **delta**: a working, mature product whose statefulness, spoofable
auth, open dump endpoint and leaked key couldn't survive "we have to own and trust
this in production." The Blazor app is the honest baseline that makes the Go rewrite
legible.`,
  },

  // ─────────────────── GKOI Apps (client → draft) ───────────────────
  {
    title: 'Turning chain operations into an admin a human can drive',
    slug: 'gkoi-admin-chain-ops-ui',
    status: 'draft',
    projectSlug: 'gkoi-apps',
    excerpt:
      'How the GKOI admin lets an operator run blockchain tasks with plain labeled buttons, instead of asking them to sign raw transactions.',
    tags: ['nextjs', 'react', 'web3', 'wagmi', 'admin'],
    seo: {
      metaTitle: 'Turning chain operations into an admin a human can drive',
      metaDescription:
        'How the GKOI admin turns on-chain operations into backend-mediated REST calls with a toast lifecycle, reads contract state via wagmi useReadContracts, and keeps authority server-side behind cookie auth.',
    },
    body: `Three Next.js apps sit in front of the GKOI platform: an admin dashboard, the
public mint site, and a gallery. They hold **no source of truth** — the server and
the contracts are authoritative, and the frontends are projections that fetch typed
data and submit back. This post is about the admin's central design decision: how
it makes blockchain operations legible to a human.

## Make chain ops legible by *not* signing raw transactions

For almost every privileged task, the operator does **not** sign a wallet
transaction. Instead the action is a labeled button that POSTs to a backend the
operator is already logged into, and the chain and indexing work happens
server-side, surfaced as a live loading→result toast that shows the server's own
message (guarded by a login check so nothing fires while signed out). Adding,
deleting and re-indexing a collection all share that shape — the operator clicks a
clearly-named action, and nobody reasons about raw transaction data to index an NFT
collection.

## On-chain state is read-only UI

Contract *state*, meanwhile, is surfaced as plain values. The admin reads things
like the owner, the current sale stage, and prices straight off the presale
contract and maps them to human names and formatted prices — no transaction
required just to *look*. Reads are allowed to fail individually, so one unreadable
value degrades a single field rather than blanking the whole panel.

## The single genuine chain write

There is exactly **one** real direct chain write in the whole admin — a token
redeem/claim, submitted through the operator's own connected wallet (never a
server-held key). It's the deliberate exception that proves the rule.

## Why this shape

Auth is cookie-based, so the session never sits in JS-readable storage; the server
re-authorizes every mutation and decides the admin role — the frontend never decides
authorization itself. Keeping the frontend thin concentrates the mint-critical logic
where it can be re-authorized and audited: server-side. That's the same reason the
public mint site currently leaves its on-chain buy submit **commented out behind a
"SOLD OUT" state** rather
than shipping a half-live write path — the authoritative decision about whether the
mint is open lives on the server and in the contract, and the UI is honest about
only projecting it.`,
  },

  // ─────────────────── Sentova (security internals → draft) ───────────────────
  {
    title: 'A signed directive path for an endpoint agent',
    slug: 'sentova-signed-directive-enforcement',
    status: 'draft',
    projectSlug: 'sentova',
    excerpt:
      "Sentova's agent can kill and quarantine processes, so every command it's told to run is cryptographically checked first — signature before anything else, and only once.",
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

The desktop agent is two processes. The UI holds **no privilege** and is only a
client. A Windows service runs as SYSTEM, exposes **no network listener**, and is
the only thing that can kill or quarantine. They talk over a local named pipe, and
the privileged side keeps a deliberately tiny set of dependencies. A request has to
survive several fail-closed gates before anything happens.

## Authorize: who's on the other end of the pipe

The pipe is authenticated by the caller's Windows token, resolved **once when the
connection is accepted** rather than by a per-request PID lookup (which is open to a
PID-reuse race). The connecting peer must be the enrolling user, and mutating
operations additionally require at least medium integrity, so a low-integrity or
sandboxed caller is refused — and a failure to read either fact fails closed. A
relayed directive gets a third check: the envelope must re-verify against the pinned
server key, so an authenticated channel doesn't make the agent trust a relayed
directive's *contents* — it re-proves them.

## Verify: signature before every other field

Verification runs a fixed order: bind the device id, check the algorithm, resolve
the pinned key, recompute the signed core and **verify the signature** — and only
*then* check expiry and the type/platform allowlist. The order is the whole point.
Expiry is checked *after* the signature precisely so a forged \`expiresAt\` is never
consulted before the signature is proven:

\`\`\`go
core := dsig.DirectiveSignedCore(env.ID, env.DeviceID, env.Type, paramsHash,
    env.CreatedAt, env.ExpiresAt, env.Nonce)
if err := dsig.VerifyB64(key, []byte(core), env.Sig.Value); err != nil {
    return Verified{}, directiveRejectedf("signature: %v", err)
}
// expiry checked AFTER signature so a forged expiry can't help
if expires < nowUnix { return Verified{}, directiveRejectedf("directive expired") }
\`\`\`

Mutating any field breaks the signature and is caught here; the only way to make
the agent act is to present a genuinely server-signed envelope.

## Enforce: one enforcer, at most once

A single shared enforcer is the only place a verified directive is driven through the
kill / quarantine / network-filter ports, shared across every path so dedup can't be
bypassed by choosing a different route. Its at-most-once property comes from a replay
guard keyed on **both** the directive id and its nonce, so a captured directive can't
be re-fired by mutating one field. Destructive actions are held for in-app
confirmation, and on a non-elevated run the missing privileged ports yield an honest
\`"degraded"\` ack rather than a fake success. Separately, a **local-first** loop acts
on the device's own detections with no server round trip — on a critical ransomware
trip it kills the attributed process and quarantines the touched file.

## Honesty as a security posture

The live system-mutating primitives — network filtering, telemetry, and the actual
process kill — are elevation-gated and were **not executed on this build**, because
the build machine was non-elevated. What *was* exercised: the authenticated
named-pipe round-trip including an integrity-gated mutating op, and the
encrypted-seal round-trip. The enforcement logic is unit-tested against **fake
ports**, and every "what Sentova did" string reflects what actually happened — a
banned-claims check over shipped strings forbids a canned success sentence. Stating
that split plainly — rather than claiming a kill primitive is "proven" — is part of
the posture.`,
  },

  // ─────────────────── Sentova MTD (security internals → draft) ───────────────────
  {
    title: 'STIX 2.1 IOC matching as an index seek, not a pattern parse',
    slug: 'sentova-mtd-stix-index-seek',
    status: 'draft',
    projectSlug: 'sentova-mtd',
    excerpt:
      "Checking a phone's forensic data against known spyware fingerprints has to be fast, so Sentova MTD reshapes each indicator so a match becomes a simple index lookup.",
    tags: ['go', 'stix', 'mtd', 'forensics', 'mongodb'],
    seo: {
      metaTitle: 'STIX 2.1 IOC matching as an index seek — Sentova MTD',
      metaDescription:
        'How Sentova MTD denormalizes STIX 2.1 indicators into a multikey-indexed observable array so the artifact-match hot path is an index seek, with tenant∪platform scoping, s2s identity, and field encryption.',
    },
    body: `Sentova MTD analyses iOS and Android forensic artifacts against known
mercenary-spyware indicators. Do that naively and every scan re-parses the STIX
threat-intelligence format (a standard way to describe attack indicators) per
indicator. The whole design moves that work from scan time to write time — this post
is about that move and its traps.

## A STIX pattern is a grammar; a match should be a key lookup

STIX 2.1 indicators carry patterns like \`[domain-name:value = '…']\`, and parsing
that at match time scales with the feed. Instead, \`sentova-mtd\` lifts every concrete
comparison out of the pattern **once at ingest** into a plain array of \`{kind, value}\`
pairs, normalized on the way in. The raw pattern is kept for provenance but isn't what
you query; the hot path is a multikey index over that array:

\`\`\`go
// value leads (high-cardinality selector); kind narrows collisions.
{Keys: bson.D{
  {Key: "observables.value", Value: 1},
  {Key: "observables.kind", Value: 1},
}},
\`\`\`

Value leads because it's the high-cardinality selector — a hash or a domain prunes
the candidate set hard, then \`kind\` narrows what's left. A STIX field is deliberately
left unmapped wherever the artifact side can't supply a comparable value — mapping it
anyway could let a real infection read as clean.

## Two-phase match, and why the obvious query is wrong

Matching is a database pre-filter on **value alone** (scoped to the caller's tenant
plus the shared platform set), then an in-memory confirm of the exact \`(value, kind)\`
pair. The tempting shortcut — matching value and kind together in one query — is
avoided, because on a multikey index it can match the value in one element and the
kind in a *different* one, a silent false positive — telling a journalist they're
compromised when they aren't. One more guard: normalization must be
byte-identical on both sides, or the match quietly misses — so both run the same
normalize pass.

## The index seek is structural, not asserted

Because the array is multikey-indexed, the pre-filter *plans* as an index seek instead
of the collection scan a pattern parse would force — a **structural** guarantee. But
honestly, it comes from the index being there, not from a test asserting the plan: the
data-model contract documents the target, but there's no mechanical plan-checking gate
in the repo.

## Snapshots that flip atomically

Feeds carry a version number. An ingest writes at the next version and flips the
pointer in one update, so a half-written feed is never matched, and that version
travels into every verdict so a result is reproducible against the exact intel that
produced it. The verdict is pure and deterministic: no matches on a healthy parse is
\`CLEAN\`;
no matches on a *degraded* parse is \`INCONCLUSIVE\` (a real state, never downgraded to
clean); any match is \`COMPROMISED\`, with severity from the strongest matched
indicator.

## Isolation and erasure as construction rules

Because the subjects may be under state-level threat, the storage model is built for
it: every document carries an account id, and match scope is the union of the caller's
account and the shared platform account — never another tenant's data. Identity comes
from the verified service-to-service context, **never** a request body. The fields
that reveal a person or device are encrypted, and **encrypted fields are never
indexed** — the list endpoint projects them out, so a poll decrypts nothing. Retention
is first-class too: per-document expiry indexes plus scoped erasure, the raw artifact
encrypted inline so a delete leaves no blob to miss. Family *names* (Pegasus,
Predator, Reign) are safe to talk about; the concrete indicator values behind them
never appear outside the encrypted store.`,
  },

  // ─────────────────── Managerenta — neutral → published ───────────────────
  {
    title: 'The reference architecture I clone across every commerce app',
    slug: 'managerenta-reference-architecture',
    status: 'published',
    publishedAt: '2026-07-14T09:00:00.000Z',
    projectSlug: 'managerenta',
    excerpt:
      'Managerenta is a rental-management app, but its most reused output is the backend template — and the security discipline — that every other app I build inherits.',
    tags: ['nextjs', 'architecture', 'mongodb', 'redis', 'patterns'],
    seo: {
      metaTitle: 'The reference architecture I clone across every commerce app',
      metaDescription:
        'How Managerenta became the Model → Service → Route reference: schema-hook invariants, a CSRF-before-ratelimit wrapper, an AWS-IAM-style engine with a hard tenant floor, and a three-pass security review.',
    },
    body: `Managerenta is a property/rental management app. It's also, quietly, the most
reused thing I've built — because its layering became the template every other
commerce app inherits. This is a tour of that template and *why* each piece is shaped
the way it is.

## Why have a template at all

Every new product has novel parts — a domain, a lifecycle, a pricing rule — and a
large sameness underneath: how a request authenticates, becomes a validated call,
hits the database, gets cached, and comes back as JSON. Re-improvise that each time
and you debug the novelty and the plumbing together, forever. Managerenta freezes the
plumbing so a new app's budget goes to its actual problem; Chekka and Mogadget are
literal descendants.

## One boundary, three layers

All server code lives behind a server-only boundary, so the database, storage, and
secrets can't leak into the client bundle. Above it sit three layers, each with one
job: the **Model** (schema and data access, invariants in schema hooks), the
**Service** (business logic and caching), and the **Route** (authorize →
validate → call service → format the response).

The rule that makes the layers independently testable is that **model reads never
throw**. Each database function returns \`null\` or empty on error, so the service
decides what "nothing" means and the route decides the HTTP:

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
scope its read simply selects nothing, because there's no unfiltered read to call by
mistake. In the route wrapper the order matters too — the cheap CSRF origin check
runs **before** the rate limiter, so a rejected request never spends a rate-limit
token.

## Authorization that survives a bad policy

Authorization is a real AWS-IAM-style policy engine, not scattered role checks. It
resolves an *effective owner* — the user's own id, or the org owner's id once they've
switched into an organization — so org members act through one evaluation path. The
engine is *pure* (no I/O, no clock read), so it can be exhaustively unit-tested, and
it follows AWS semantics: default-deny, explicit-Deny-wins. But the property I trust
multi-tenancy on sits *above* the policy loop: a tenant-isolation floor denies any
cross-scope org request before a single statement is read, so even a wildcard policy
can't cross tenants.

## Receipts, not vibes

The reason it's a *reference* is that it's proven. **93 Vitest files** run against
throwaway scratch databases that a global setup drops on teardown; **16 Playwright
specs** drive auth, 2FA, passkeys, and a full-app path; and a three-pass security
review catalogues roughly forty findings. The one I quote most is S1: "2FA was never
enforced on login; the toggle was decorative" — a feature that looked done, wasn't,
and was caught by writing the audit down. Getting the skeleton right once and
re-running that discipline on each descendant is the payoff: the next app argues about
its domain, not about how a request becomes a database write.`,
  },

  // ─────────────────── Chekka — neutral → published ───────────────────
  {
    title: 'Building to a written spec instead of a vibe',
    slug: 'chekka-spec-driven-build',
    status: 'published',
    publishedAt: '2026-07-12T09:00:00.000Z',
    projectSlug: 'chekka',
    excerpt:
      "Chekka sells trust in a used-car purchase, so it nailed down what \"verified\" means in a written spec before writing a single route.",
    tags: ['nextjs', 'spec-driven', 'mongodb', 'product'],
    seo: {
      metaTitle: 'Building Chekka to a written spec instead of a vibe',
      metaDescription:
        'How Chekka — a professional car-inspection product — was built as a Next.js 16 monolith against a dense ~4,700-word specification that ships its own route-handler and Mongoose conventions.',
    },
    body: `Chekka's pitch — "before you buy, Chekka" — is that an independent professional
inspects a used car so the buyer doesn't gamble. When the product *is* trust, you
can't improvise what "verified" means halfway through the build. So Chekka started
from a written specification.

## A real spec, honestly sized

The spec is about **4,728 words across 596 lines** — twelve numbered core features
plus a section on tech stack and conventions. It isn't enormous; it's *dense and
structured*, and its most useful trick is that it ships the **code skeleton** the
build then follows verbatim, so "spec" and "scaffold" are the same document and the
build follows a contract instead of rediscovering scope in code review. (One
correction worth making plainly: an internal brief called this a
"37k-word" spec — the verified count is 4.7k. Precision is the point of a spec; it
should extend to describing the spec.) The conventions aren't invented either:
Chekka is built on the same server-only structure, route skeleton, schema hooks and
soft-delete as Managerenta, so the surprise budget can go entirely to the domain.

## The domain is a lifecycle

The core entity is an inspection, and its status is a one-directional state machine:
\`submitted → assigned → (declined) → scheduled → in_progress → report_processing →
completed\`. Each transition stamps its own timestamp. Pricing is computed
server-side from an admin-tunable config plus a flat urgent surcharge, never trusted
from the client.

## Report integrity is the product

A report a buyer paid to trust must be immutable once filed, and its numbers must be
the server's, not the client's. On submit, Chekka recomputes the pass/minor/serious
counts from the checklist items and refuses to touch a locked report. Locking flips
the status to completed, stamps the timestamps, publishes an event to the admin live
feed, and notifies the buyer. Sharing a finished report is a read-only, self-expiring
link: a random nonce maps to the inspection id under a 7-day expiry, so it grants
unauthenticated read access to *one* report without the id ever appearing in the URL.

## Why the spec paid off

Report integrity, photo evidence, and a booking flow that schedules real humans carry
the product; everything else is plumbing. Because those three were pinned in writing
before the first route existed, the build could be aggressive about the plumbing and
careful about the trust. Delivery leaned on **15 Playwright specs** across booking, the
inspection flow, photo upload, the live feed and share links; the thinner unit story
(no Vitest here) is itself an honest line in the ledger.`,
  },

  // ─────────────────── Golden Bite — neutral → published ───────────────────
  {
    title: 'Per-operation services and IAM for a small business',
    slug: 'golden-bite-per-operation-iam',
    status: 'published',
    publishedAt: '2026-07-11T09:00:00.000Z',
    projectSlug: 'golden-bite',
    excerpt:
      'Golden Bite runs a storefront, an ops dashboard, and a staff app on a strict one-operation-one-check discipline — the kind of isolation usually reserved for much bigger systems.',
    tags: ['nextjs', 'architecture', 'iam', 'redis', 'observability'],
    seo: {
      metaTitle: 'Per-operation services and IAM for a small business',
      metaDescription:
        'How Golden Bite applies a per-operation service + five-role IAM discipline across a storefront, ops dashboard, and staff app — with an edge that is explicitly "not a security boundary".',
    },
    body: `Golden Bite is a premium treats and catering business in Kubwa, Abuja, served by
three surfaces in one Next.js app: a customer storefront, an operations dashboard,
and a staff (kitchen + delivery) app. The interesting decision is that a small
business runs on an isolation discipline usually reserved for much bigger systems —
and this app is where the "Golden Bite arch" that later apps clone was born.

## Per-operation services

Rather than a few fat service objects, each operation is its own file —
\`createOrder\`, \`updateOrderStatus\`, \`checkOrderCapacity\`, \`attachDriver\`, and so
on — and the model layer below is per-operation too, each instrumented for metrics.
One operation → one service call → one authority check → one audit action.

## IAM sized for a bakery

Authority is a five-role union — \`customer | kitchen | delivery | manager | owner\` —
with role groups defined once. A wrapper gates each route by allowed roles:

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

The edge proxy does only a cheap cookie-presence redirect and is explicitly **"not a
security boundary"** — the role is re-checked in every handler, so authority is
never trusted at the edge. Each write is independently gated and audited, and the
route wrapper always records timing in a \`finally\`, whether the handler succeeds or
throws.

## Honest edges

Two things get stated plainly rather than polished away: there's **no unit-test
runner** here — the automated coverage is Playwright e2e plus a type-check — and
\`/api/metrics\` plus the dev \`otp-peek\`/\`reset-token-peek\` routes are
**unauthenticated** and should be prod-disabled or protected at ingress.

## Why bother at this size

Because the discipline is nearly free once it's a habit, and it scales *down* as
gracefully as up. The same instinct — isolate operations, give each the least
authority it needs, measure them separately — is what shows up, much larger, in the
platforms. Practising it on a bakery keeps it sharp, and Adverta later cloned this
exact shape.`,
  },

  // ─────────────────── Prechop — neutral → published ───────────────────
  {
    title: 'Inventory that expires: modelling cutoff times',
    slug: 'prechop-cutoff-scheduling',
    status: 'published',
    publishedAt: '2026-07-09T09:00:00.000Z',
    projectSlug: 'prechop',
    excerpt:
      "Prechop lets students order campus food before it's cooked, so every listing is a window that opens and closes — and closing it on time is the whole engineering problem.",
    tags: ['nextjs', 'mongodb', 'paystack', 'bullmq', 'cron', 'marketplace'],
    seo: {
      metaTitle: 'Inventory that expires: modelling cutoff times in Prechop',
      metaDescription:
        'How Prechop enforces listing cutoffs — a per-minute cron sweep in the live Next.js/MongoDB app versus a BullMQ delayed job in the separate Fastify/Prisma service — with Paystack prepay and atomic Redis slot reservations.',
    },
    body: `Prechop's tagline is "order before they cook," and that preposition is the whole
product. A vendor posts a **dated listing** with a **cutoff time**; students pre-order
and prepay; the kitchen cooks to demand it can see. The engineering question is
deceptively small: *is this listing still orderable?*

## Two backends, told honestly

The repo carries two implementations of the same domain. The live app is a single
Next.js app (frontend and API together) on MongoDB, closing listings with a
per-minute cron sweep and a Redis lock. An earlier twin — a separate Fastify service
on PostgreSQL with a BullMQ job queue — is the cleanest expression of the data model
(money as integer kobo), so it's worth reading, but it is *not* the live store.

## Three time-states

A listing is a window. It's **not-yet-open** while its start time is in the future,
**orderable** between open and the cutoff, and **closed** once the cutoff passes. The
read-time guard on every order attempt is the same in both backends — reject a
too-early order, reject one past the deadline — so no scheduler race can let a late
order slip through even if a sweep runs late.

## Two ways to close a listing at its cutoff

This is the interesting divergence. The earlier backend enqueues a **delayed job
keyed by the listing id** that fires *exactly* at the cutoff, self-deduping via the
job id. The live app instead runs a **per-minute cron sweep**, wrapping each job in a
Redis lock so only one instance per tick does the work under horizontal scaling:

\`\`\`ts
const key = \`cron:lock:\${DB_NAME}:\${job}\`;
const got = await acquireLock(key, INSTANCE_ID, ttlSeconds);
if (!got) return;
try { await fn(); } finally { await releaseLock(key, INSTANCE_ID); }
\`\`\`

Several jobs pass a Lagos timezone as a *load-bearing* argument: cron schedules in
the server's local time, so on a UTC host the nightly sold-out reset would fire at
01:00 Lagos and leave sold-out items dark through the first trading hour.

## Cutoff isn't just "stop new orders"

When the window closes, orders the vendor took money for but never confirmed are
**auto-cancelled and refunded**, and the enforce job's lock deliberately outlives a
slow batch of refunds so the next tick can't start an overlapping sweep. The
30-minute pre-cutoff *warning* is subtler: it runs every minute inside a 30-minute
window, so a naive version sends the same buyer 30 messages. The dedupe is a Redis
set-if-absent per listing whose expiry outlives the window — the first tick to claim
it is the only one that notifies, the key is **never released** because expiry *is*
the reset, and a lost lock (Redis down) yields *no* warning rather than a duplicate,
the safe direction for a notification that costs money to send.

## Money and slots are server-authoritative

Pricing, item resolution, and add-on ownership are all computed server-side — the
client sends only ids. Payment runs through Paystack, and the webhook verifies its
signature on the raw body with a timing-safe compare *before* doing anything, then
checks idempotency and that the paid amount matches the record. Finite quantity slots
are guarded separately with atomic Redis reservations that roll back cleanly under
contention — availability is \`maxQuantity − committed − reserved\`, so two buyers
racing for the last portion can't both slip past.`,
  },

  // ─────────────────── Adverta — neutral → published ───────────────────
  {
    title: 'One shared API behind web and native',
    slug: 'adverta-monorepo-shared-api',
    status: 'published',
    publishedAt: '2026-07-07T09:00:00.000Z',
    projectSlug: 'adverta',
    excerpt:
      'Adverta serves a website and a mobile app from one backend, sharing a single contract so that changing the API breaks both clients in the same commit — on purpose.',
    tags: ['turborepo', 'hono', 'nextjs', 'react-native', 'monorepo', 'marketplace'],
    seo: {
      metaTitle: 'One shared API behind web and native — Adverta',
      metaDescription:
        'How Adverta serves a Next.js web app and an Expo mobile app from one Hono/Mongoose API in a Turborepo, sharing a Zod contract and a typed client, with explicit-Deny IAM re-resolved per request and atomic budget draws.',
    },
    body: `Adverta is a Nigeria-focused advertising and marketplace product — free listings,
paid boosts, in-app chat, a campaign builder, and an agency white-label mode —
fronted by two clients, a Next.js web app and an Expo/React-Native mobile app,
speaking to exactly one backend. It's a monorepo — everything in one shared codebase —
and the shared contract is the whole point.

## One contract, consumed as TypeScript

Both apps talk to the API through one shared client, and both import the same set of
Zod schemas that describe every request and response. The packages are consumed as
**raw TypeScript with no build step**, so a contract change breaks the *compile* of
both apps in the same commit. There's no "the mobile app is two versions behind the
endpoint" class of bug, because the endpoint's request schema and the client's input
type are the *same* object. The mobile client's 401 auto-refresh is de-duped through
a single in-flight promise, so its single-use rotating refresh token is spent
exactly once even under a burst of concurrent 401s.

## Money that can't be double-spent

Boosts are billing-aware: a campaign has a budget, a spend, and metrics, and
visibility is a paid, time-bound thing. The load-bearing detail is that a budget
draw is a single atomic act — the ceiling lives in the query *filter*, so
check-and-book can't race into an overspend:

\`\`\`ts
const result = await Campaign.findOneAndUpdate(
  { _id: id, $expr: { $lte: [{ $add: ["$spentNaira", amountNaira] }, "$totalBudgetNaira"] } },
  { $inc: { spentNaira: amountNaira, leads: 1 } },
  { returnDocument: "after" },
).lean<ICampaign>();
\`\`\`

Attribution is derived server-side and ignores any client-sent campaign id; billing
fires only on the trusted conversation-start path, keyed on a billing actor id to
defeat Sybil drain; and totals are always recomputed, never trusted.

## IAM with no roles, and Deny that wins

Authorization is AWS-flavoured with **no role layer**: a flat \`resource:action\`
permission catalog, policies of Allow/Deny statements where an explicit **Deny
always wins**, and groups that bundle policies. The property that makes it
trustworthy is *when* it runs: a user's effective permissions are **re-resolved from
the database on every request**, not read from the token (briefly cached; an inactive
account resolves to the empty set = deny all), so a revocation or deactivation bites
within seconds.

## Tenancy from the session, never the request

Agency white-label rides on top. The agency id is taken from the **session**, and a
caller who merely holds a feature permission still can't reach another tenant — only
a platform operator may inspect a requested tenant. So holding a "manage clients"
permission is enough to manage *your* agency's clients and no one else's. One honest
caveat carried into the writing: "per-operation database/service" describes code
structure plus application-level IAM — one data-access function and one service file
per operation — not distinct database credentials.`,
  },

  // ─────────────────── Mogadget — neutral → published ───────────────────
  {
    title: 'A catalog with no cart (on purpose)',
    slug: 'mogadget-catalog-without-cart',
    status: 'published',
    publishedAt: '2026-07-06T09:00:00.000Z',
    projectSlug: 'mogadget',
    excerpt:
      'Mogadget deliberately has no checkout — it hands a ready-to-send message straight to WhatsApp, and measures the tap without ever getting in the way of the sale.',
    tags: ['nextjs', 'mongodb', 'product', 'commerce', 'whatsapp'],
    seo: {
      metaTitle: 'A catalog with no cart (on purpose) — Mogadget',
      metaDescription:
        'Why Mogadget, a single-owner Lagos gadget catalog, ships without a cart or checkout — a prefilled wa.me deep link, a non-blocking sendBeacon, a TTL click log, and catalog invariants in a pure domain layer.',
    },
    body: `Most catalog apps end at a cart. Mogadget deliberately doesn't — no checkout, no
online payment, no customer account anywhere. The owner sells through
WhatsApp and Instagram, so the app's job ends the moment it hands a ready-to-send
message to the buyer's chat app.

## The hand-off is the order flow

Browse → product page → tap "Chat on WhatsApp" or "DM on Instagram" → a deep link
opens with a prefilled message naming the exact product and price → the rest happens
in-chat. The whole "checkout" is one pure function that builds a \`wa.me\` link —
trivially unit-tested, with no database in sight.

## Analytics that can't cost you a sale

You still want to know which channel a buyer chose — but measuring it must never delay
the tap. So the client fires the beacon **before** navigation, using
\`navigator.sendBeacon\` (which survives the page unload) with a keepalive \`fetch\`
fallback, wrapped so a failure is silent:

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

The server keeps the same posture: an atomic counter increment moves first, and only
then does it *try* to append to an event log — a failure there is logged and
swallowed. That log auto-retains for 180 days by a database expiry index (no cron to
forget) and stores only a slug, a channel, and a timestamp — no person, nothing to
leak.

## The catalog's rules live in a pure domain layer

Without a cart, the modelling weight shifts onto the catalog. A **new** item must be
restockable, carry no grade, and track an integer quantity; a **used** unit must be
unique, carry a grade, and have no quantity. A single check rejects any
mixture on every write, and a companion rule auto-hides a restockable listing when its
quantity hits zero — but never auto-unhides it, because re-listing is a deliberate
decision, not a side effect.

## An honest footnote

The product doc argued for one admin and no permission framework; the shipped app has
a full IAM stack, plus passkeys and TOTP — and the doc's own "Historical note" owns
that pivot rather than pretending the plan held. Dropping the cart didn't drop the
rigor; it moved it to where a no-cart store needs it — the invariants, the hand-off,
and analytics that stay out of the way. **39 colocated Vitest specs** guard exactly
those parts.`,
  },

  // ─────────────────── Humanz (Exedos / company → draft) ───────────────────
  {
    title: 'A machine credential that passes your step-up check',
    slug: 'humanz-api-key-step-up',
    status: 'draft',
    projectSlug: 'humanz',
    excerpt:
      'An API key satisfies a two-factor step-up gate by construction — so in Humanz the sensitive surfaces are fenced off from keys entirely, not hidden behind a factor a key can always present.',
    tags: ['typescript', 'fastify', 'security', 'authorization', 'api-keys', 'postgres'],
    seo: {
      metaTitle: 'A machine credential that passes your step-up check — Humanz',
      metaDescription:
        'Why Humanz enforces API-key authorization structurally off the HTTP method ("the path is the domain"), fails closed on any unclassified route, and fences machine keys off the step-up-gated surfaces they would otherwise pass by construction.',
    },
    body: `Humanz is the HR platform at Exedos, and HR data is the kind other systems want to
read on a schedule: a payroll run, a sister scheduling app, a reporting job. That
means machine credentials — API keys — and keys are where authorization models often
go wrong. Here is the shape Humanz settled on, and the one security decision teams
tend to get backwards.

## The path is the domain

A key's grant is not a list of allowed routes. It is a small matrix: five data
domains — \`employees\`, \`organisation\`, \`access\`, \`audit\`, \`contact\` — each set to
read-only or read-write. Enforcement reads that matrix off two things the request
already carries. The domain is the first URL segment after \`/api/admin/\`; the access
level is the HTTP method — anything that isn't a GET or HEAD needs \`rw\`. Both are
known before the body is parsed.

That is the whole check, and its value is what it makes impossible. You can't ship a
mutating route that forgot its authorization annotation, because there is no
annotation — the method *is* the annotation. A new endpoint under a known domain
inherits the domain's rule for free.

## Fail closed, or it isn't a security control

The check degrades toward *less* access on every input it doesn't understand. A URL
whose first segment isn't one of the five domains resolves to \`undefined\`; no grant
contains \`undefined\`, so the route is refused to every key until a human classifies
it. A grant blob that has been corrupted or half-written parses to the empty set, not
the full one. The default answer to "is this allowed?" is no, and you have to do work
to turn it into yes.

## The key that passes your step-up check

Here is the part worth reusing. Humanz protects its most dangerous admin actions —
minting credentials, editing pay rates, destructive bulk operations, restoring
deleted records — with a step-up second factor: a human re-enters an authenticator
code within a short grace window before the action runs.

An API key has no authenticator. So a key *passes step-up by construction*: there is
no prompt it can fail, because there is nothing to prompt. If you treat a key as "a
user who happens to be a program," you have granted every automated caller access to
the exact surfaces the step-up gate was built to slow down.

The fix is not a better prompt. It is a list. Humanz keeps an explicit set of path
segments that no key may ever touch — the credential, pay, destructive and
resurrection surfaces — and refuses a key there before the grant matrix is even
consulted. The convenience of a key (it runs unattended, with no human in the loop)
is precisely the property that disqualifies it from the actions that most need a
human in the loop.

## Why this reads as a general rule

Step-up authentication assumes the thing being stepped up is a person. The moment a
non-person credential exists, that assumption is a hole, and the honest response is to
decide *which actions a machine may never take* and enforce it structurally — not to
pretend the machine can satisfy a human check. Humanz writes that decision down as a
fenced-off segment list, right next to the grant matrix, where the next person adding
a route can see it.

This is a company product on a private repository, so the write-up stays at the
architecture level and names no secrets.`,
  },

  // ─────────────────── Squaddy (Exedos / company → draft) ───────────────────
  {
    title: 'One decision core: making a race impossible, not unlikely',
    slug: 'squaddy-decision-core',
    status: 'draft',
    projectSlug: 'squaddy',
    excerpt:
      'Two approvers can act on the same request at once. Squaddy stops a double-apply by anchoring every decision to one compare-and-swap inside the same transaction as its effects — removing the window instead of shrinking it.',
    tags: ['typescript', 'fastify', 'postgres', 'concurrency', 'transactions', 'payroll'],
    seo: {
      metaTitle: 'One decision core: making a race impossible, not unlikely — Squaddy',
      metaDescription:
        'How Squaddy routes every approval through one module whose pending→applied compare-and-swap is the first statement in the same transaction as the decision writes, so a losing racer rolls back and a timesheet correction can never apply twice.',
    },
    body: `Squaddy approves things: a time-off request, a shift swap, a timesheet correction.
Two different humans can approve the same request at the same instant — an employee's
approver from the mobile app, an administrator from the back office. If both
approvals apply, an add-only timesheet correction lands twice and someone's hours
double. This is a race, and the tempting fixes only make it *less likely*.

## The drift that started it

The approver route and the admin panel each used to carry the same payroll
choreography, written in two idioms. An audit in mid-2026 flagged it as classic
drift: two copies of one critical decision, destined to disagree. The repair was not
to synchronise the copies. It was to delete one.

## One module, one invariant

Every path that turns a pending request into a decision now funnels through a single
module. It owns exactly one rule, and the rule is about ordering inside a
transaction:

The status compare-and-swap — flipping the request from \`pending\` to \`applied\` or
\`denied\` — is the *first* statement in the same database transaction as the
decision's effects. Not a check before the transaction. Not a flag written after.
First, and inside.

That ordering is what turns "unlikely" into "impossible." Two deciders race the same
request; both open a transaction; both try to move \`pending\` to a terminal state. The
database lets exactly one win the compare-and-swap. The loser's
\`UPDATE ... WHERE status = 'pending'\` matches zero rows, the module aborts, and
*everything else it wrote in that transaction rolls back with it*. There is no window
between "I checked it was pending" and "I wrote the payroll effect," because the check
and the effects commit or fail as one unit.

## The core holds no authorization

The surprising design choice is what the module leaves out. It performs no permission
check at all. Whether this caller may approve this request is decided at the route,
before the core runs; by the time control reaches the decision core, authority is
settled and the only remaining question is correctness under concurrency. Keeping
authorization out of the core is what lets both the mobile approver flow and the admin
panel share it without either one embedding its own access rules inside.

## Why "impossible" is the right target

You can make a double-apply rare with advisory locks, careful ordering, or an
optimistic read-then-write. All of them leave a window, and windows get hit at scale
in exactly the way that corrupts payroll. Anchoring the whole decision to a single
compare-and-swap that gates the same transaction as its effects removes the window
instead of shrinking it. The cost is one discipline — the status flip goes first —
and a team rule that there is one and only one place a request becomes a decision.

For v1 there is a known, accepted limit around it: leave balances don't carry over
between years. That is a product decision recorded in the same module, not a gap the
concurrency model hides.

This is a company product on a private repository, so the write-up stays at the
architecture level.`,
  },

  // ─────────────────── Aisolver — neutral → published ───────────────────
  {
    title: 'An architecture lint that fails the build',
    slug: 'aisolver-architecture-lint',
    status: 'published',
    publishedAt: '2026-07-13T09:00:00.000Z',
    projectSlug: 'aisolver',
    excerpt:
      'AISolver is a big AI-agent workspace, and it keeps its own architecture honest with a small script that fails the build the moment a layer boundary is crossed.',
    tags: ['typescript', 'fastify', 'monorepo', 'architecture', 'postgres'],
    seo: {
      metaTitle: 'An architecture lint that fails the build — Aisolver',
      metaDescription:
        'How AISolver (taskwise-v2) enforces its module boundaries with a zero-dependency arch-check.ts — routes↛routes, lib↛routes, an import-cycle ceiling of 0 via Tarjan SCC, a legacy-path ban, and a raw-fetch allowlist.',
    },
    body: `AISolver (package \`taskwise-v2\`) is easy to undersell as "a rebuilt task manager."
It's really a collaborative task/project platform with built-in AI agents that act
on the user's own data — Todoist plus Notion plus a team of assistants that can do
the work — and the task-manager surface (lists, nested tasks, calendar, alarms) is
the substrate the agents operate on. A codebase that large needs its layers
defended, and it defends them with a ~320-line script that isn't allowed to be
optional.

## A lint that fails the build

\`tools/arch-check.ts\` is a **zero-dependency** boundary guard, run as a script,
that **exits with an error** on any violation so CI and pre-push both fail. "Please
don't import the database from the UI layer" is a code-review plea that erodes under
deadline; a red check does not get tired. It enforces a handful of rules — a route
can't import another route, a lower layer can't import an upper one, no file may sit
in an import cycle (the ceiling is literally **0**), banned legacy paths, and a rule
that every raw call to the model API go through one wrapper — plus a few reports that
never touch the exit code.

## The cycle rule, and why dynamic \`import()\` is not an edge

The cycle rule builds the full internal import graph, runs a cycle-detection pass
(iterative, to avoid a stack overflow on a deep graph), and fails if any file sits
in a cycle. The ceiling is **0**, and a comment logs the burn-down as the cuts
landed: \`106 → 43 → 13 → 10 → 0\`.

Only **static** imports count. That's deliberate: a dynamic \`import()\` defers to
runtime, so it creates no module load-order hazard — the *actual* thing an import
cycle threatens — which makes it the sanctioned way to break a static cycle. (The
legacy-path and raw-call guards do scan every import kind, because a rename or a
forbidden call is wrong however it's spelled.)

## Two exceptions that keep the rules honest

A blanket "no route imports a route" rule fights a legitimate refactor — splitting a
giant route file into a co-located subtree of smaller modules — so the check permits
exactly two edges: a sibling within the same module directory, and the thin composer
file importing its own module. And the model-API rule isn't generic architecture but
a product invariant: every non-streaming model call must go through one resilient
wrapper (credit accounting, retries, telemetry), so any file hitting the model's
messages endpoint that isn't one of a few intentional exceptions is a violation, each
documented inline with *why* it's exempt.

## Visibility without gating

A few reports run every check but never fail it: a summary of cycles, a list of
oversized files (split candidates), and a report of cycles that only exist once
dynamic imports are counted — real layering debt the static-only ceiling makes
invisible. The header is candid that it's the *interim* guard until a fuller module
structure lands, at which point it's swapped for an off-the-shelf tool. Encoding the
layering as an executable check is how the structure defends itself instead of
relying on everyone remembering the plan.`,
  },

  // ─────────────────── Fivestick — neutral → published ───────────────────
  {
    title: 'When a static site is the correct amount of engineering',
    slug: 'fivestick-static-landing',
    status: 'published',
    publishedAt: '2026-07-05T09:00:00.000Z',
    projectSlug: 'fivestick',
    excerpt:
      'Fivestick is a marketing site for an AI automation consultancy, and building it as plain static content — no backend at all — is the entire design decision.',
    tags: ['nextjs', 'tailwind', 'static', 'marketing'],
    seo: {
      metaTitle: 'When a static site is the correct amount of engineering',
      metaDescription:
        'Why Fivestick, a consultancy landing site, ships as static Next.js content with Tailwind v4 CSS-first and hand-written components — and why, precisely, it is not a hard static export.',
    },
    body: `Fivestick is the landing site for an AI automation consultancy, and its primary job
is to send a visitor to a WhatsApp chat or a free 30-minute audit call. Building it
as static content — not as an application — is the whole design decision.

## Match the tool to the job

A marketing page has a narrow, honest mandate: load fast, read clearly, convert.
None of that needs a database, a session, or a server round-trip. Fivestick has **no
backend at all** — no API routes, no server actions, no external fetches. It's
Next.js rendering the page at build time, with exactly **one** interactive piece: a
dependency-free SVG animation. Conversion is offloaded to a third party (a WhatsApp
link), which removes an entire category of runtime failure by simply not having a
runtime to fail.

## Static content, stated precisely

One honest nuance: this is static *content*, not a hard static export. The README
calls it "statically rendered," and it is — but the Next config carries **no
\`output: 'export'\`**, so the build is a standard Next.js server bundle that assumes
a Node runtime, not an exported \`/out\` directory. Saying so keeps the claim
accurate. Styling is Tailwind v4, CSS-first, with no config file; shadcn was
*scaffolded* but no UI components were ever generated — the page is hand-written
Tailwind.

## Restraint as a skill

Recognising that this problem is a document, not an application, is a design decision
worth naming: the right amount of engineering is sometimes noticeably less than you're
capable of, and knowing where that line sits is its own kind of experience.`,
  },

  // ─────────────── AiSolver CRM — neutral → published ───────────────
  {
    title: 'An open-web enrichment crawler that behaves itself',
    slug: 'aisolver-crm-open-web-enrichment',
    status: 'published',
    publishedAt: '2026-10-13T09:00:00.000Z',
    projectSlug: 'aisolver-crm',
    excerpt:
      'AiSolver CRM enriches leads from the open web, and the whole feature is built around one idea: take only what a well-behaved bot may, and record where every fact came from.',
    tags: ['typescript', 'fastify', 'postgres', 'crawler', 'ssrf', 'gdpr'],
    seo: {
      metaTitle: 'An open-web enrichment crawler that behaves itself — AiSolver CRM',
      metaDescription:
        'How AiSolver CRM enriches leads from the open web: an SSRF guard that rejects private targets before any fetch, robots.txt and per-domain rate limits, dormant-until-keyed providers, and provenance rows backed by object storage.',
    },
    body: `AiSolver CRM enriches sales leads from the open web. The engineering interest is
not the fetching — it's everything built around it to keep the feature polite,
safe and auditable. It runs as a BullMQ worker beside the API, and three rules
shape it: take only what a well-behaved bot may, never let a crawl reach somewhere
it shouldn't, and record where every fact came from.

## The SSRF guard runs before the fetch

A lead can carry an attacker-influenced URL, so "fetch this page" is a server-side
request forgery risk by default. The crawler resolves each target and checks the
resolved address *before* opening a connection, rejecting private, loopback and
link-local ranges in both IPv4 and IPv6 — \`127.0.0.0/8\`, \`10/8\`, \`172.16/12\`,
\`192.168/16\`, \`169.254/16\`, \`0.0.0.0/8\` and their v6 equivalents. An unparseable
address is treated as unsafe. Only then does it fetch, over plain \`GET\`, with a
10-second timeout, a 2 MiB body cap and a small redirect bound.

## Polite by construction

The crawler reads and honours \`robots.txt\` per origin, including \`crawl-delay\`,
rate-limits requests to the same host, and sends a declared bot user-agent. There
is no headless browser, no cookies or login, and no anti-bot evasion; gated
platforms are reached only through a public OpenGraph card or a licensed provider,
never by scraping behind a login. Paid providers (Brave, Tavily, PDL, Apollo) stay
dormant until their API key is set — ask for one that isn't configured and the
answer is a flat \`400 provider_not_configured\` rather than a half-working call.

## Provenance, so nothing is a mystery fact

Enrichment writes to two places and folds only a few fields into the lead. Each
discovered record becomes an \`enrichment_sources\` row holding the provider, the
\`source_url\` and \`fetched_at\`, and the untouched fetched page is kept in object
storage, referenced by key. The lead carries only the merged business fields —
name, company, email, phone, title — and no raw payload. So every value on a lead
can be traced back to the page it came from, and a field can be re-derived without
crawling again.

## Erasure is an endpoint, not a promise

The data is business-contact only, on a stated legitimate-interest basis, so
deletion has to be real. \`DELETE /api/leads/:id/enrichment\` hard-deletes that lead's
provenance rows and writes an audit entry recording how many it removed; for a full
right-to-erasure response you pair it with deleting the lead itself, so the merged
fields and their sources both go. The politeness, the guard and the provenance are
the feature — the fetch is the easy part.`,
  },

  // ─────────────────── Maitura — neutral → published ───────────────────
  {
    title: 'Kobo, a single-writer ledger, and a test that forbids drift',
    slug: 'maitura-ledger-projection-invariant',
    status: 'published',
    publishedAt: '2026-10-13T09:00:00.000Z',
    projectSlug: 'maitura',
    excerpt:
      'Maitura is a parcel-courier marketplace whose money path rests on three decisions: integer kobo everywhere, one module that may write the ledger, and a property test that forbids the wallet from drifting.',
    tags: ['go', 'mongodb', 'ledger', 'event-sourcing', 'property-testing', 'fintech'],
    seo: {
      metaTitle: 'Kobo, a single-writer ledger, and a test that forbids drift — Maitura',
      metaDescription:
        'How Maitura keeps money trustworthy in a Go modular monolith: integer kobo with a visible suffix, a ledger that is the only monetary writer, a wallet projection over it, a transactional outbox, and a rapid property test that the projection cannot drift from the journal.',
    },
    body: `Maitura is a Nigerian parcel-courier marketplace — the customer names a price and
riders bid — built as a Go modular monolith. The part worth writing about is the
money path, because a marketplace that holds escrow and pays out riders cannot let
its books disagree with themselves.

## Kobo, and a suffix that catches floats

Every monetary field is an integer in kobo (a hundredth of a naira), and every one
carries a \`Kobo\` suffix in its name. The point is reviewability: a float where
money belongs is visible on sight in a diff, because it won't end in \`Kobo\`.
Integer-only money never accrues the rounding error that floats do.

## One writer, and a projection over it

The \`ledger\` module is the only module permitted to write a monetary entry. The
\`wallet\` is not a second source of truth — it is a projection computed from the
ledger's journal. That is the same single-writer discipline that keeps Settleo's
balances trustworthy: when exactly one thing may move money, a balance is something
you can reason about rather than reconcile.

## A property test named for its invariant

The risk with a projection is that it drifts from the thing it projects. Maitura
pins that down with a property test — generated inputs under \`rapid\` — named for
exactly what it forbids: the projection cannot drift from the journal. Whatever
sequence of entries the test throws at the ledger, replaying them into the wallet
projection has to land on the same balance the journal implies. A named invariant
beats a comment; it fails the build the day the two diverge.

## Why nothing gets lost between modules

Modules don't read each other's collections — a module calls another's application
layer through a port or consumes its events. Events travel over Redis Streams behind
a transactional outbox: a state change and its event commit in a single MongoDB
transaction into the module's collections plus an \`outbox\`, and a separate relay
publishes them. So nothing is emitted for a write that didn't commit, nothing
committed is lost, and consumers are idempotent by event id. For money, "the payout
happened but the event didn't" is the bug you most need to make impossible, and the
outbox is how.`,
  },
];

# 00 — Organizing Concept: "The Constellation of Work"

**Status:** contract (design owns this file). Frontend + admin build against it.
**Scored against:** ACCEPTANCE #5 (responsive), #6 (a11y ≥ 90), #8 (graph home).

---

## 1. The metaphor

The home page is an **observatory chart** — a night-sky constellation map of
Abdullah's engineering work. Every project is a **star (node)**. Stars are
gravitationally bound into **four constellations (domain clusters)**:

| Cluster | Domain | What binds the stars |
|---|---|---|
| **Web3** | on-chain / NFT / crypto-settlement | wallets, contracts, ledgers, indexers |
| **Security** | active protection / threat defense | agents, IOC matching, forensics |
| **Commerce** | Nigeria-focused marketplaces | Next.js + Mongo/Redis reference arch |
| **Tools / Labs** | products + learning | task manager, marketing, sandboxes |

**Why a constellation and not a generic force-graph blob:** a random hairball
says "I have projects." A *chart* says "I have a body of work with structure."
The four clusters are legible from the first frame; the viewer instantly reads
*this person ships across four disciplines* before clicking anything. That legible
grouping is the memorable hook, not the wiggle of a physics sim.

## 2. What the visual elements MEAN (semantics are load-bearing)

- **Node (star)** = one project. Node **size** encodes prominence/depth
  (`prominence: 1–3`), not recency. Bigger star = flagship (e.g. Settleo,
  nftmixer-go, sentova). This gives the eye a reading order.
- **Node halo/glow** = has a published companion blog post. A dim/ringless node
  = case study exists but post is still `draft`. This ties the graph to
  ACCEPTANCE #3 without extra UI.
- **Cluster label** = the domain name, always rendered as real text (an SVG
  `<text>` / HTML label, screen-reader visible), never as decoration only.
- **Edge (faint line)** = a real relationship, drawn sparingly so the chart
  reads as a map, not a web. Only two edge kinds exist:
  - **kinship edge** (solid, within cluster) — shared lineage, e.g.
    `NFTMixer → nftmixer-go` (the C#→Go rewrite), or `managerenta →
    golden_bite / chekka / mogadget` (the reference architecture it seeded).
  - **bridge edge** (dashed, cross-cluster) — a project that spans domains,
    e.g. `Settleo ↔ GKOI Contracts` (both Web3 + security-critical). Bridges
    are rare (≤ 4 total) and exist to show range, not to clutter.
- **Background** = a faint dot-grid "sky", not a photo. Cheap to render, theme
  aware, no external asset, no Lighthouse cost.

Edges are **decorative-affordance only** — they are `aria-hidden`. All meaning a
sighted user gets from an edge is *also* stated in prose on the destination case
study ("Rewrite of NFTMixer", "Built on the managerenta architecture"), so the
edge carries no unique information a keyboard/AT user would lose. See
`02-graph-home.md` for the accessibility contract.

## 3. Node registry (the ~20 real projects → nodes)

This is the canonical list frontend renders. IDs are stable slugs; the case-study
route is `/projects/[slug]`. Prominence 3 = flagship (largest star), 1 = small.
Grounding = the repo(s) in `docs/PROJECT-INVENTORY.md`. Copy authenticity is the
tech-writer's job; this registry only fixes **identity, cluster, size, links**.

> The backend/content owns the real project + post records. This registry is the
> **design intent** for how many nodes exist and how they group — if the seeded
> data disagrees, the seed wins on copy but SHOULD preserve these clusters and
> prominence tiers. Flagged in HANDOFF.

### Web3 (7 nodes)
| slug | label | prominence | grounding |
|---|---|---|---|
| `settleo` | Settleo | 3 | personal/settleo/* (24-repo P2P/OTC settlement) |
| `nftmixer-go` | NFTMixer (Go) | 3 | exedos_corp/nftmixer-go |
| `nftmixer-net` | NFTMixer (.NET) | 1 | exedos_corp/NFTMixer (predecessor) |
| `gkoi-platform` | GKOI Platform | 2 | v2/gkoi-server,-authentications,-whitelist |
| `gkoi-apps` | GKOI Apps | 1 | v2/gkoi-admin-v2,-client-v3,-gallery |
| `gkoi-contracts` | GKOI Contracts | 2 | Smart contracts/* (ERC721-AC, Foundry) |
| `settleo-escrow` | Settleo Escrow | 2 | settleo-escrow-contracts + orchestrator |

### Security (2 nodes)
| slug | label | prominence | grounding |
|---|---|---|---|
| `sentova` | Sentova | 3 | personal/sentova (Wails cross-device) |
| `sentova-mtd` | Sentova MTD | 2 | personal/bin/sentova (STIX 2.1 MTD) |

### Commerce (6 nodes)
| slug | label | prominence | grounding |
|---|---|---|---|
| `managerenta` | Managerenta | 2 | personal/managerenta (reference arch) |
| `chekka` | Chekka | 2 | personal/chekka |
| `golden-bite` | Golden Bite | 2 | personal/golden_bite |
| `prechop` | Prechop | 1 | personal/prechop |
| `adverta` | Adverta | 1 | personal/adverta |
| `mogadget` | Mogadget | 1 | personal/mogadget |

### Tools / Labs (3 nodes)
| slug | label | prominence | grounding |
|---|---|---|---|
| `aisolver` | Aisolver | 2 | personal/aisolver (taskwise-v2) |
| `fivestick` | Fivestick | 1 | personal/fivestick-website |
| `labs` | Labs | 1 | developments/* (C++23, DSA, terraform) |

**Total: 18 nodes.** This satisfies "~20 real projects" while keeping every node
a *distinct, real* body of work (no padding). If the owner wants to split GKOI or
Settleo further to reach a literal 20, the cluster layout in `02-graph-home.md`
scales to 6 nodes per cluster without redesign.

## 4. Kinship / bridge edges (the only edges drawn)

```
kinship  nftmixer-net ──── nftmixer-go        (C# → Go rewrite)
kinship  managerenta ──── golden-bite         (seeded architecture)
kinship  managerenta ──── chekka
kinship  managerenta ──── mogadget
kinship  gkoi-platform ── gkoi-apps
kinship  gkoi-platform ── gkoi-contracts
kinship  settleo ──────── settleo-escrow
kinship  sentova ──────── sentova-mtd
bridge   settleo ┈┈┈┈┈┈ gkoi-contracts        (shared on-chain security)
bridge   sentova ┈┈┈┈┈┈ settleo               (security ↔ fintech trust)
```

10 edges total (8 kinship, 2 bridge). Sparse by design.

## 5. Graceful degradation ladder (how the hook stops costing accessibility)

The graph is progressive enhancement over a plain, working document. Each rung
below is a *complete, usable* experience on its own — we never ship a rung that
depends on the rung above it.

1. **No JS / SSR first paint:** the server renders a real
   `<nav aria-label="Projects by domain">` containing four `<section>`s (one per
   cluster), each an ordered `<ul>` of project links. This is the DOM the graph
   enhances; it is what crawlers, screen readers, and no-JS users get. It alone
   satisfies ACCEPTANCE #2 and #8's "every node links to a real project page."
2. **JS + fine pointer (≥ 768px):** the SVG constellation mounts *over* that list
   (list becomes visually hidden but stays in the a11y tree as the semantic
   backbone; see `02-graph-home.md §keyboard`). Pan/zoom/hover enabled.
3. **JS + coarse pointer / < 768px:** the SVG does **not** mount. We render the
   **grouped-card fallback** — the same four clusters as labeled card sections.
   A 375px phone never fights a zoomable canvas. (ACCEPTANCE #5.)
4. **`prefers-reduced-motion: reduce`:** the SVG mounts but static — no
   entrance animation, no idle drift, no zoom easing (instant). Hover/focus
   styling still applies. (ACCEPTANCE #6 / WCAG 2.3.3.)

The rule: **every affordance the graph offers has a non-graph equivalent that
reaches the same URL.** A star you can click, you can also reach by Tab; a
cluster you can see, you can also read as a heading; a project you can zoom to,
you can also open from the card fallback.

## 6. Why this is memorable AND safe

- **Memorable:** four legible constellations + star-size reading order + the
  "glow = has a written story" cue is a single coherent idea a visitor can
  describe after leaving ("his projects are a star map grouped by field").
- **Safe:** it is literally a styled `<nav>` of links underneath. Turn off CSS
  and JS and you still have a perfectly navigable, crawlable portfolio. The
  uniqueness lives entirely in the enhancement layer, so it can never regress
  the accessibility or SEO score.

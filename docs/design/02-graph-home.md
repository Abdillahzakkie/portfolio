# 02 — Graph Home Specification

**Status:** contract. Directly scored against ACCEPTANCE **#5 (responsive)** and
**#8 (graph home: renders all nodes clustered by domain, pointer + keyboard
navigable, every node links to a real project page)**. Also carries #6 (a11y).

Read `00-concept.md` (semantics + node registry) and `01-tokens.md` (colors,
motion, focus) first. This file specifies **how it's built and behaves**.

---

## 1. Layout algorithm — COMMITTED: static positioned clusters (pre-computed), not live force sim

**Decision:** four **fixed cluster anchors** (quadrants), with nodes placed at
**pre-computed positions** inside each cluster using a deterministic
radial/phyllotaxis packing. **No runtime physics engine.**

**Tradeoff (stated, as the brief requires):**

| | Live force sim (d3-force) | Static positioned clusters ✅ chosen |
|---|---|---|
| Legibility | wiggles, overlaps, non-deterministic | stable, same every load, reads as a *chart* |
| SSR / a11y | can't render meaningfully server-side | positions known at build → SSR-able, testable |
| Perf | continuous rAF, jank on low-end mobile | one paint; zero idle CPU (protects #6) |
| Test | Playwright can't assert moving coords | fixed coords → deterministic `#8` assertions |
| Cost | +d3-force dep, tuning alpha/charge | pure math, ~40 lines, no dep |

The only thing a force sim buys — organic feel — we get cheaply with a **subtle
one-time entrance settle** (nodes ease from cluster centroid to final position
over `--dur-graph`, then stop) and an optional ≤2px idle parallax on pointer move
(disabled under reduced-motion). Determinism wins because ACCEPTANCE #8 is
verified by Playwright asserting each node is present and links correctly — moving
targets make that flaky.

### 1.1 Coordinate model

- A fixed **viewBox** of `0 0 1000 700` (10:7). All node positions are authored in
  this space and scale with the SVG; the SVG is `width:100%` with
  `preserveAspectRatio="xMidYMid meet"`.
- Four **cluster anchors** (centroids) in viewBox units:
  - Web3 → (270, 210) top-left
  - Security → (730, 210) top-right
  - Commerce → (270, 490) bottom-left
  - Tools/Labs → (730, 490) bottom-right
- Within a cluster, nodes are placed by **sunflower/phyllotaxis** around the
  anchor: node *i* at angle `i * 137.5°`, radius `k * sqrt(i)` (k ≈ 34), so
  clusters stay compact and non-overlapping regardless of count (scales to the
  6-per-cluster ceiling noted in `00-concept.md`). Positions are computed once and
  frozen into a `NODE_POSITIONS` map the frontend commits — **the design intent is
  the anchors + packing rule; exact px are frontend's to freeze and Playwright to
  assert.**
- Node radius by prominence: `3 → r=26`, `2 → r=19`, `1 → r=13` (viewBox units).
  Invisible hit-area radius = `max(visibleR, 22)` so every node meets the 44px
  touch target after scaling (§ token 5).

## 2. Visual language

### 2.1 Background
Dot-grid "sky": a tiled `<pattern>` of 1px dots at 24px spacing, `fill:
var(--border)` at 40% opacity. Pure SVG, no image asset. A soft radial vignette
(`--bg` → transparent) darkens edges on dark theme to give depth.

### 2.2 Cluster
Each cluster is a `<g role="group" aria-label="{Domain} — {n} projects">`
containing:
- a faint **cluster halo**: a large blurred circle `fill: var(--cluster-{d}-core)`
  at 6–10% opacity behind its nodes (the "nebula");
- a **cluster label**: `<text>` in `--font-display` 700, `--text-xl`, color
  `--cluster-{d}-text`, with the domain glyph (§token 2.3) prepended; positioned
  just outside the halo toward the nearest corner so labels never overlap nodes.

### 2.3 Node (star)
`<g role="link" tabindex="-1" aria-label="{Project name}, {Domain} project{,
has a published write-up}">`:
- **core circle** `fill: var(--cluster-{d}-core)`, radius per prominence;
- **published cue**: `--glow-node` filter + a 1.5px outer ring in
  `--cluster-{d}-text` when the project has a published post; draft-only projects
  render flat with no glow (ties to ACCEPTANCE #3 without extra chrome);
- **label**: project name as `<text>` `--text-sm`, `--text` color, placed below
  the node; on dense clusters, labels for prominence-1 nodes show only on
  hover/focus to avoid collision (the name is still in `aria-label`, so AT always
  has it).

### 2.4 Edge
`<path aria-hidden="true">` drawn **behind** all nodes:
- **kinship**: solid, 1.5px, `stroke: var(--border-strong)`, 55% opacity;
- **bridge**: dashed `4 4`, 1.5px, `stroke: var(--text-faint)`, 45% opacity.
Edges brighten to the source node's `--cluster-{d}-core` at 70% opacity when
either endpoint is hovered/focused. Edges carry **no unique information** (see
`00-concept.md §2`), hence `aria-hidden`.

## 3. Interaction states (pointer)

| State | Node treatment | Timing |
|---|---|---|
| **rest** | core fill, label per §2.3 | — |
| **hover** | scale 1.12 (`--ease-emphasized`), label forced visible, incident edges brighten, sibling nodes in *other* clusters dim to 55% opacity | `--dur-fast` |
| **focus-visible** | same as hover **plus** 2px `--ring` outline at `outline-offset:3px`; a live tooltip/popover (§4) opens | `--dur-fast` |
| **active/press** | scale 0.96, `--dur-fast`, then navigate on release | — |
| **selected** (deep-linked, e.g. `/?focus=settleo`) | persistent ring + tooltip open + graph pans to center it | `--dur-slow` |

Hover on a node dims other clusters so the hovered project's cluster + edges pop —
reinforces the grouping story. Under reduced-motion, scale changes are replaced by
an opacity/ring change only (no transform).

## 4. Node tooltip / preview popover

On hover **and** focus, an accessible popover anchors to the node:
- content: project name (`--text-lg` display), domain glyph + name, one-line
  tagline (from data), stack chips (≤3 `TagBadge`s), and a "published"/"draft"
  `StatusPill`.
- it is a real, focusable card: `role="dialog"`? No — use `role="tooltip"`
  referenced by the node's `aria-describedby`; it must NOT trap focus. The node
  itself is the link; clicking node OR pressing Enter navigates.
- positioned with a collision-aware placement (flip to stay in viewport). On
  touch/coarse pointer this popover path is not used (fallback renders cards
  instead — §7).

## 5. Zoom & pan (pointer, ≥ 768px only)

- **Zoom:** scroll-wheel / trackpad pinch zooms the SVG about the cursor,
  clamped `0.6×–2.5×`. `Ctrl`/`⌘`+scroll is honored; plain scroll over the graph
  zooms but the page still scrolls once max/min zoom is hit (no scroll-jail).
  Provide on-screen **`+` / `−` / `reset`** buttons (real `<button>`s, keyboard
  focusable, `aria-label`) so zoom is not mouse-wheel-only.
- **Pan:** click-drag on empty sky pans; dragging on a node does not pan (it's a
  press). Two-finger drag on trackpad pans. Panning clamps so at least the active
  cluster stays in view.
- **Reset:** a "Fit" button returns to `viewBox` default (scale 1, centered).
- Zoom/pan transform is applied to a single `<g class="viewport">` wrapper via a
  `transform: translate() scale()` (GPU-friendly), never by mutating each node.
- **Zoom/pan is a pure enhancement:** the SSR list + card fallback expose every
  link without any zoom. Zoom state is **not** required to reach any URL.
- Under `prefers-reduced-motion`, zoom snaps (no ease) but still works.

## 6. Keyboard navigation (REQUIRED — ACCEPTANCE #6 & #8)

The graph is operated by keyboard as a **composite widget** (one tab stop, arrow
traversal — the WAI-ARIA "roving tabindex" pattern), which is why individual nodes
are `tabindex="-1"` (§2.3) and the container manages focus.

### 6.1 Structure
```
<section aria-label="Projects, grouped by domain" role="application"
         aria-roledescription="Interactive project constellation">
  <p class="sr-only" id="graph-help">
    Use arrow keys to move between projects. Left and right move within a
    domain; up and down jump between domains. Press Enter to open a project.
    Press Tab to leave the graph. A list of all projects follows.
  </p>
  <svg aria-describedby="graph-help"> … nodes … </svg>
  <!-- SSR semantic backbone, visually hidden once SVG mounts, still in a11y tree -->
  <nav aria-label="All projects (list)"> …four <section>s of <ul><li><a> … </nav>
</section>
```

### 6.2 Tab order (whole page)
1. Skip-link ("Skip to projects") → 2. Header nav (logo, Blog, About,
ThemeToggle) → 3. **Zoom controls** (`+ − Fit`) → 4. **The graph container**
(single stop; roving focus starts on the highest-prominence node of the Web3
cluster, i.e. reading order top-left) → 5. the "View as list" toggle → 6. footer.
The graph is **one** Tab stop; you do not Tab through 18 nodes.

### 6.3 Arrow-key traversal (roving tabindex inside the graph)
- **← / →** : move to the previous/next node **within the current cluster**
  (ordered by prominence desc, then clockwise). Wraps within the cluster.
- **↑ / ↓** : jump to the nearest node in the cluster **above/below** (Web3↔Commerce
  on the left column, Security↔Tools on the right). This makes all four clusters
  reachable by arrows alone.
- **Home / End** : first / last node of the current cluster.
- **PageUp / PageDown** : jump to the flagship (prominence-3) node of the
  previous / next cluster (clockwise), for fast cross-domain movement.
- **Enter / Space** : navigate to the focused node's `/projects/[slug]`.
- **Esc** : close the open tooltip; if none, move focus to the "View as list"
  toggle (an escape hatch out of the widget).
- Moving focus **auto-pans/zooms** the viewport so the focused node is centered
  and comfortably in view (respects reduced-motion = instant). Focus ring is
  always visible on the active node.
- The visually-hidden `<nav>` list is kept in DOM sync so a screen-reader user
  who prefers linear reading can also just arrow through the list with their AT —
  both paths reach the same `<a href="/projects/[slug]">`.

### 6.4 Screen-reader behavior
- On entering the graph, AT announces the `aria-roledescription` + `graph-help`.
- Each node's `aria-label` = `"{name}, {domain} project, {prominence tier}, {has
  a published write-up | write-up in progress}"`.
- A polite `aria-live` region announces cluster changes ("Entered Security,
  2 projects") when ↑/↓ crosses a cluster boundary.

## 7. Responsive & fallback (REQUIRED — ACCEPTANCE #5, no h-overflow at 375px)

Breakpoints (match `01-tokens.md`): `sm 640 · md 768 · lg 1024 · xl 1280`.

| Viewport | Home experience |
|---|---|
| **< 768px OR coarse pointer** | **Grouped-card fallback** (no SVG mounts). Four stacked domain sections, each a heading + a 1-col (`<520px`) / 2-col grid of `ProjectCard`s. Full-width, no horizontal scroll, no zoom. This is the primary mobile experience, not a downgrade banner. |
| **768–1023px, fine pointer** | Constellation mounts, viewBox scales to width; zoom/pan enabled; labels for prominence-1 nodes hover/focus-only to prevent collision. A persistent "View as list" toggle switches to the card fallback. |
| **≥ 1024px** | Full constellation, wordmark/intro rail on the left (or top), zoom controls, cluster labels always shown. |

- **No horizontal overflow guarantee:** the SVG is `width:100%` + `max-width:100%`
  and `preserveAspectRatio`, never a fixed pixel width; the card fallback uses a
  fluid grid with `min-w-0` children. QA asserts `document.scrollingElement
  .scrollWidth <= innerWidth` at 375 and 1440 (ACCEPTANCE #5).
- **`prefers-reduced-motion: reduce`** (any viewport): graph mounts **static** —
  no entrance settle, no idle parallax, zoom/pan snap instantly, node hover uses
  opacity/ring not scale. All navigation still works. (ACCEPTANCE #6, WCAG 2.3.3.)
- **The "View as list" control is always present** at ≥768px so any user can opt
  out of the graph into the same card fallback without changing viewport — the
  non-graph equivalent required by the brief.

## 8. Loading / empty / error states (part of the deliverable)

| State | Graph home renders |
|---|---|
| **SSR / first paint** | Server-rendered nodes at frozen positions + the semantic `<nav>` list. No spinner — the page is meaningful before hydration. |
| **Hydrating** | Static SVG already visible; interactivity (zoom/hover) attaches silently. No layout shift (CLS ≈ 0). |
| **Data empty** (no projects returned) | The four cluster labels still render with an inline "Projects coming soon" note under each; the page never collapses to blank. (Should not happen once seeded, but specified.) |
| **Data/render error** | Error boundary swaps the SVG for the **card fallback** (rung 3 in `00-concept.md`) with a quiet `role="alert"` "Showing the list view." — the graph failing never blocks reaching a project. |
| **Slow font load** | `font-display: swap`; fallback stack (§token 3) prevents invisible text. |

## 9. Acceptance mapping (how a verifier checks this file's work)

- **#8 renders all nodes clustered:** every node in the `00-concept.md` registry
  appears as an `<a>`/`role="link"` with `href="/projects/[slug]"`, inside its
  domain `<section>`/cluster group. Playwright: count links === registry length;
  each has a resolvable href.
- **#8 pointer + keyboard navigable:** Playwright clicks a node → lands on its
  page; and Tabs to the graph, presses `→`/`↓`/`Enter` → lands on a project page.
- **#5 responsive:** at 375 and 1440, no horizontal overflow on home; card
  fallback shown at 375, SVG at 1440.
- **#6 a11y:** axe/Lighthouse ≥ 90 — focus ring present, roving tabindex works,
  live-region announces, reduced-motion respected, contrast per `01-tokens.md`.

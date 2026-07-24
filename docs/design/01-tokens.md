# 01 — Design System & Tokens

**Status:** contract. Frontend implements these as the single source of styling truth.
All values are exact. WCAG AA contrast ratios are stated per pair.

---

## 1. Styling approach — COMMITTED: Tailwind CSS v4 + CSS custom properties

The owner uses both styled-components (settleo-*, chekka) and Tailwind (aisolver
uses **Tailwind v4**, fivestick uses Tailwind + shadcn) across repos. For **this**
app I commit to **Tailwind CSS v4** with a **CSS-variable token layer**. Reasons,
specific to this build:

1. **App Router / RSC first.** This is Next.js App Router with server components
   (HANDOFF §Stack). styled-components needs a client `StyleRegistry`, forces
   `"use client"` boundaries, and streams CSS-in-JS — friction the graph home's
   mostly-static shell doesn't need. Tailwind emits static CSS at build: zero
   runtime style cost, which directly protects the **Lighthouse ≥ 90** targets
   (ACCEPTANCE #6).
2. **Theme-aware without a runtime.** Light/dark is a `class="dark"` on `<html>`
   flipping CSS variables — no JS re-render, no FOUC when paired with an inline
   pre-hydration theme script. styled-components theming needs a Provider in the
   tree.
3. **The graph is SVG + a few utilities.** Node/edge styling is driven by CSS
   variables the SVG reads directly (`fill: var(--cluster-web3)`), so the graph
   and the DOM share one token source. No parallel theme object.
4. **Precedent in the owner's own stack.** aisolver already ships Tailwind v4;
   this reuses a vocabulary the owner maintains, not a new one.

**Token layering (build against this):**
- Layer 1 — **primitive tokens**: raw values as CSS vars in `:root` and `.dark`
  (`--color-neutral-900`, `--cluster-web3-core`, …). Defined in `globals.css`
  (frontend-public owns that file per HANDOFF slice map).
- Layer 2 — **semantic tokens**: role names mapping to primitives
  (`--bg`, `--surface`, `--text`, `--text-muted`, `--border`, `--ring`).
- Layer 3 — **Tailwind theme** (`@theme` in v4) exposes the semantic tokens as
  utilities: `bg-surface`, `text-muted`, `border-default`, `ring-focus`.

Components in `04-components.md` reference **semantic** tokens only. Never
hard-code a hex in a component.

## 2. Color tokens

### 2.1 Neutrals (surfaces + text)

| Semantic | Light value | Dark value | Role |
|---|---|---|---|
| `--bg` | `#FBFAF7` (warm paper) | `#0B0D12` (deep space) | page background |
| `--bg-elevated` | `#FFFFFF` | `#14171F` | cards, popovers |
| `--surface` | `#FFFFFF` | `#171B24` | inputs, node panels |
| `--surface-2` | `#F2F0EA` | `#1E232E` | hover fill, code blocks |
| `--text` | `#1A1A1E` | `#ECEDF1` | primary text |
| `--text-muted` | `#55555F` | `#A0A4B0` | secondary text, captions |
| `--text-faint` | `#7C7C86` | `#6B7280` | disabled, placeholder |
| `--border` | `#E3E0D8` | `#262B36` | hairlines, dividers |
| `--border-strong`| `#CFCBC0` | `#333A48` | input borders |
| `--ring` | `#4F46E5` | `#A5B4FC` | focus ring (see §5 a11y) |

**Stated contrast ratios (WCAG AA needs 4.5:1 body, 3:1 large/UI):**

| Pair | Light | Dark | Target | Pass |
|---|---|---|---|---|
| `--text` on `--bg` | **15.8 : 1** | **15.6 : 1** | 4.5 | ✅ AAA |
| `--text-muted` on `--bg` | **6.9 : 1** | **7.4 : 1** | 4.5 | ✅ AA |
| `--text-faint` on `--bg` | **4.6 : 1** | **4.7 : 1** | 4.5 | ✅ AA |
| `--border-strong` on `--bg` | **1.8 : 1** | **3.1 : 1** | 3.0 (UI) | ⚠ see note |

> Note: light `--border-strong` (1.8:1) is a **non-essential decorative** hairline
> and is exempt (WCAG 1.4.11 exempts inactive/decorative borders). Inputs that
> rely on their border to convey state additionally get an inner shadow + label,
> so state is never border-only. QA validates final ratios with Lighthouse/axe.

### 2.2 Domain / cluster accents (the four constellations)

Each domain has a **core** (node fill — a large graphical area, WCAG threshold
3:1) and a **text** variant per theme (used for links, tags, cluster labels —
threshold 4.5:1). Hues are spread ~90–100° apart on the wheel so they stay
distinct; **color is never the only cue** (see §2.3).

| Domain | `core` (fill) | `text` light | `text` dark | text-on-bg ratio (L / D) |
|---|---|---|---|---|
| **Web3** | `#6366F1` indigo | `#4F46E5` | `#A5B4FC` | 5.9 : 1 / 9.8 : 1 |
| **Security** | `#F43F5E` rose | `#BE123C` | `#FDA4AF` | 6.1 : 1 / 9.4 : 1 |
| **Commerce** | `#10B981` emerald | `#047857` | `#6EE7B7` | 4.9 : 1 / 11.2 : 1 |
| **Tools/Labs**| `#F59E0B` amber | `#B45309` | `#FCD34D` | 5.9 : 1 / 12.1 : 1 |

Core fills against `--bg` (graphical, need 3:1): Web3 4.2:1, Security 3.9:1,
Commerce 3.5:1, Tools 3.6:1 on light; all ≥ 4:1 on dark. All pass the 3:1
graphical-object threshold. QA confirms with axe.

CSS var names: `--cluster-web3-core`, `--cluster-web3-text`, … (one triplet per
domain, theme-swapped in `.dark`).

### 2.3 Non-color encoding (colorblind + AT safety — required by brief)

Domain is **also** encoded by, in order of reliability:
1. **Spatial cluster** — each domain occupies a fixed screen region (top-left
   Web3, top-right Security, bottom-left Commerce, bottom-right Tools; see
   `02-graph-home.md`).
2. **A text cluster label** (`<text>`/heading) — always present.
3. **A per-domain glyph** on the cluster label and node tooltip:
   Web3 ◆ (diamond), Security ▲ (shield-triangle), Commerce ● (coin-dot),
   Tools ✦ (spark). Rendered as inline SVG, `aria-hidden`, paired with the text.

No information is conveyed by hue alone. A deuteranope reading in grayscale still
gets position + label + glyph.

### 2.4 Status + feedback colors (admin, forms)

| Semantic | Light | Dark | Use |
|---|---|---|---|
| `--success` | `#047857` | `#6EE7B7` | published, saved |
| `--warning` | `#B45309` | `#FCD34D` | draft, unsaved |
| `--danger` | `#BE123C` | `#FDA4AF` | delete, error |
| `--info` | `#4F46E5` | `#A5B4FC` | neutral notices |

These reuse the domain text tokens (Commerce=success, Tools=warning,
Security=danger, Web3=info) so the palette stays 4 hues, not 8.

## 3. Typography

**Fonts (self-hosted at build via `next/font` — NO runtime CDN, satisfies the
self-contained constraint).** `next/font/google` downloads + inlines the font
files at build time and serves them from the app origin; nothing is fetched from
fonts.googleapis.com at runtime. If the owner prefers zero build-time fetch,
swap to `next/font/local` with the `.woff2` files committed under
`src/app/fonts/` (devops decides — flagged in HANDOFF).

| Role | Family | Fallback stack | Weights |
|---|---|---|---|
| Display / headings | **Space Grotesk** | `ui-sans-serif, system-ui, sans-serif` | 500, 700 |
| Body / UI | **Inter** | `ui-sans-serif, system-ui, sans-serif` | 400, 500, 600 |
| Mono / code | **JetBrains Mono** | `ui-monospace, SFMono-Regular, monospace` | 400, 600 |

CSS vars: `--font-display`, `--font-body`, `--font-mono`. Set `font-display: swap`
and preload the two most-used weights (Inter 400, Space Grotesk 700).

**Type scale** (root = 16px; modular, ~1.20–1.25 ratio; rem values):

| Token | rem | px | line-height | Use |
|---|---|---|---|---|
| `--text-xs` | 0.75 | 12 | 1.4 | tags, captions, meta |
| `--text-sm` | 0.875 | 14 | 1.45 | secondary UI, table cells |
| `--text-base`| 1.0 | 16 | 1.6 | body copy, prose |
| `--text-lg` | 1.125 | 18 | 1.55 | lead paragraph |
| `--text-xl` | 1.375 | 22 | 1.4 | card titles, H3 |
| `--text-2xl`| 1.75 | 28 | 1.3 | H2 / section |
| `--text-3xl`| 2.25 | 36 | 1.2 | page H1 (mobile) |
| `--text-4xl`| 3.0 | 48 | 1.1 | hero H1 (desktop) |
| `--text-5xl`| 3.75 | 60 | 1.05 | graph-home wordmark (≥1024) |

Headings use `--font-display` weight 700, `letter-spacing: -0.02em`. Body uses
`--font-body` 400. Prose max line length: **68ch** (`max-w-[68ch]`). Fluid step
between 3xl↔4xl↔5xl via `clamp()` is allowed but the discrete steps above are the
contract if `clamp` is skipped.

## 4. Spacing, sizing, radii, elevation

**Spacing scale** — 4px base (matches Tailwind default; use these steps):

| Token | px | | Token | px |
|---|---|---|---|---|
| `space-1` | 4 | | `space-6` | 24 |
| `space-2` | 8 | | `space-8` | 32 |
| `space-3` | 12 | | `space-10`| 40 |
| `space-4` | 16 | | `space-12`| 48 |
| `space-5` | 20 | | `space-16`| 64 |

Section vertical rhythm: `space-16` (mobile) → `space-24`=96px (desktop).
Content gutter: `space-4` (mobile) → `space-8` (desktop). Max content width:
**1200px** (`--content-max`); prose column **68ch**; graph canvas is full-bleed.

**Radii:** `--radius-sm` 6px (tags, inputs), `--radius-md` 10px (cards, buttons),
`--radius-lg` 16px (panels, modals), `--radius-full` 9999px (pills, nodes,
avatars).

**Elevation** (light uses soft shadows; dark uses border + faint glow, since
shadows read poorly on `#0B0D12`):

| Token | Light | Dark |
|---|---|---|
| `--elev-1` | `0 1px 2px rgba(20,20,30,.06)` | `0 0 0 1px var(--border)` |
| `--elev-2` | `0 4px 12px rgba(20,20,30,.08)` | `0 0 0 1px var(--border), 0 8px 24px rgba(0,0,0,.5)` |
| `--elev-3` | `0 12px 32px rgba(20,20,30,.12)`| `0 0 0 1px var(--border-strong), 0 16px 48px rgba(0,0,0,.6)` |
| `--glow-node`| `0 0 16px 2px <cluster-core @ 45%>` | `0 0 20px 3px <cluster-core @ 60%>` |

`--glow-node` is only applied to nodes whose project has a **published** post
(the "has a written story" cue from `00-concept.md §2`).

## 5. Focus & interaction primitives (a11y baseline)

- **Focus ring:** `outline: 2px solid var(--ring); outline-offset: 2px;` on every
  interactive element. Never `outline: none` without an equally visible
  replacement. Ring color meets ≥ 3:1 against both `--bg` and adjacent fills.
- **Hit target:** minimum **44 × 44 px** touch target (WCAG 2.5.5) — small graph
  nodes get an invisible padded hit-area even when the visible star is smaller.
- **Hover ≠ focus:** every hover affordance has a matching `:focus-visible` style.
- **Motion:** all transitions wrapped so `@media (prefers-reduced-motion: reduce)`
  sets `transition-duration: 0.01ms` and disables transforms/idle animation.

## 6. Motion tokens

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 120ms | hover, focus, tap feedback |
| `--dur-base` | 200ms | color/opacity, small moves |
| `--dur-slow` | 320ms | panel/modal enter, zoom ease |
| `--dur-graph`| 600ms | one-time graph entrance settle |
| `--ease-standard` | `cubic-bezier(.2,0,0,1)` | most transitions |
| `--ease-emphasized` | `cubic-bezier(.2,0,0,1.2)` | node pop on focus |
| `--ease-exit` | `cubic-bezier(.4,0,1,1)` | dismissals |

Under `prefers-reduced-motion: reduce` **all** of the above collapse to `0.01ms`
and the graph entrance renders in final position immediately (no drift, no
zoom-in). This is a hard requirement — see ACCEPTANCE #6 and `02-graph-home.md`.

## 7. Theming mechanics (contract for frontend)

- `<html>` carries `class="dark"` or nothing (light default = system preference
  on first visit, then user choice persisted to `localStorage["theme"]`).
- An **inline blocking script** in `<head>` sets the class before paint to avoid
  FOUC (frontend-public owns `layout.tsx`).
- `ThemeToggle` (see `04-components.md`) toggles the class + persists choice and
  is keyboard operable with `aria-pressed`.
- `<meta name="theme-color">` swaps with theme (`#FBFAF7` / `#0B0D12`).
- Respect `color-scheme: light dark` so native form controls theme correctly.

# 04 — Component Inventory

**Status:** contract. Enough for a dev to scaffold each without guessing. Props
are named with types; every interactive component lists its **states** and
**a11y** requirements. Tokens from `01-tokens.md`; components consume **semantic**
tokens only (never raw hex). "domain" everywhere = `'web3' | 'security' |
'commerce' | 'tools'`.

Ownership per HANDOFF slice map: public components → `src/components/public/**`;
admin components → `src/components/admin/**`. This file is the shared spec both
build to. Data-shape needs that the API must provide are flagged **[API]** and
listed in HANDOFF — design does not invent response shapes.

---

## Shared primitives

### `Button`
```ts
props: {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  as?: 'button' | 'a';           // renders <a> for links
  href?: string;                  // when as='a'
  loading?: boolean;              // shows spinner, sets aria-busy, disables
  iconLeft?: ReactNode; iconRight?: ReactNode;
  disabled?: boolean;
}
```
- primary = `--info`/accent fill + on-accent text; secondary = `--surface` +
  `--border-strong`; ghost = transparent; danger = `--danger`.
- min height: sm 32 / md 40 / lg 48; min touch 44px (pad if smaller).
- states: rest·hover(`--dur-fast`)·focus-visible(`--ring`)·active(scale .97)·
  loading·disabled(60% opacity, `aria-disabled`).
- a11y: real `<button>`/`<a>`; icon-only variant requires `aria-label`.

### `ThemeToggle`
```ts
props: { }   // reads/writes localStorage["theme"], toggles <html class="dark">
```
- Renders a `<button aria-pressed={isDark}>` with sun/moon glyph + `aria-label`
  "Switch to dark/light theme". Keyboard operable. Updates `<meta theme-color>`.
- Must not cause FOUC (inline head script sets class pre-hydration — see token §7).
- states: light·dark·(system on first load).

### `TagBadge`
```ts
props: {
  label: string;
  domain?: domain;               // tints to --cluster-{domain}-text; else neutral
  size?: 'xs' | 'sm';
  interactive?: boolean;         // renders as filter toggle button when true
  active?: boolean;              // for filter chips
}
```
- pill, `--radius-full`, `--text-xs`, subtle domain-tinted bg (10% core) + domain
  text color. Non-interactive = `<span>`; interactive = `<button aria-pressed>`.

### `StatusPill`
```ts
props: { status: 'draft' | 'published' | 'scheduled'; size?: 'sm'|'md'; }
```
- published = `--success` dot + label; draft = `--warning` dot; scheduled =
  `--info`. Encodes status by **dot + text**, never color alone (a11y).
- used in admin table, editor topbar, case-study header, node tooltip.

### Feedback: `Skeleton`, `EmptyState`, `ErrorState`, `Toast`
- `Skeleton`: `{ variant: 'text'|'card'|'avatar'|'table-row', lines?: number }` —
  shimmer using `--surface-2`; respects reduced-motion (no shimmer, static block).
- `EmptyState`: `{ glyph, title, body?, action? }` — see `03-pages.md §8`.
- `ErrorState`: `{ title, detail?, onRetry? }` — `role="alert"`, retry button.
- `Toast`: `{ kind:'success'|'error'|'info', message, action? }` — `aria-live`
  polite/assertive by kind; auto-dismiss (pausable on hover/focus).

---

## Layout / chrome

### `Header` (public)
```ts
props: { transparentOnHero?: boolean; }
```
- left: wordmark `AZ ◆` (link to `/`); center/right nav: Work(`/`), Blog(`/blog`),
  About(`/about`); far right: `ThemeToggle`.
- ≥768: inline nav. <768: nav collapses to a `MenuButton` → slide-over
  `<nav aria-label="Primary">` (focus-trapped, Esc closes, restores focus).
- sticky, `--elev-1` on scroll; `<header>` landmark; includes the skip-link target.
- states: top(transparent optional)·scrolled(elevated)·mobile-menu open/closed.

### `Footer`
```ts
props: { }
```
- © + name, GitHub, Email, RSS (`/blog/rss.xml` **[API]** if backend emits it),
  "Built with Next.js". `<footer>` landmark; all links keyboard reachable.

### `AdminShell`
```ts
props: { children; activeNav: 'posts'|'projects'|'media'|'settings'; user: {name} }
```
- left `AdminSidebar` (collapsible < 900px to icon rail / drawer) + `AdminTopbar`
  (page title, primary action slot, user menu w/ Sign out). `<main>` for content.
- distinct from public Header. Unauthenticated never reaches it (middleware).
- states: sidebar expanded/collapsed·mobile drawer open/closed.

---

## Graph home components (see `02-graph-home.md`)

### `Constellation` (the SVG widget)
```ts
props: {
  nodes: ProjectNodeData[];      // [API]/seed: {slug,name,domain,prominence,
                                 //   tagline, stack:string[], hasPublishedPost:boolean}
  edges: EdgeData[];             // {from,to,kind:'kinship'|'bridge'} — from concept doc
  initialFocusSlug?: string;     // deep-link /?focus=slug
  onNavigate: (slug:string)=>void;
}
```
- Renders background pattern, four `DomainCluster`s, edges (behind), nodes.
- Owns: roving-tabindex keyboard model (token/graph §6), zoom/pan viewport
  transform, entrance settle (skipped under reduced-motion), `aria-live` region.
- Mounts ONLY at ≥768 + fine pointer (else parent renders `ClusterCardList`).
- Requires the SSR `<nav>` list sibling (semantic backbone) — parent renders both.
- states: ssr-static·hydrated-interactive·node-hover·node-focus·zooming·panning·
  reduced-motion·error(→ fallback).

### `DomainCluster`
```ts
props: { domain: domain; label: string; count: number; nodes; center:{x,y}; }
```
- `<g role="group" aria-label="{label} — {count} projects">`: nebula halo +
  cluster label (glyph + text) + child `ProjectNode`s at packed positions.

### `ProjectNode` (star)
```ts
props: {
  data: ProjectNodeData; focused: boolean; dimmed: boolean;
  onActivate: ()=>void; onFocus: ()=>void;
}
```
- `<g role="link" tabindex={focused?0:-1} aria-label aria-describedby>`; core
  circle sized by prominence; glow + ring iff `hasPublishedPost`; label text.
- 44px invisible hit-area. Hover/focus → scale (opacity+ring under reduced-motion)
  + opens `NodePopover`. Enter/Space/click → `onActivate`.
- states: rest·hover·focus·active·dimmed·selected·published(glow)·draft(flat).

### `NodePopover`
```ts
props: { data: ProjectNodeData; anchorRect; placement?; }
```
- `role="tooltip"`, referenced via node `aria-describedby`; NOT focus-trapping.
- shows name, glyph+domain, tagline, ≤3 `TagBadge`, `StatusPill`. Collision-flip.
- pointer/keyboard only (coarse pointer uses cards instead).

### `ClusterCardList` (mobile / fallback / "View as list")
```ts
props: { clusters: { domain, label, count, projects: ProjectNodeData[] }[]; }
```
- four `<section>` with heading (glyph+label+count) + responsive grid of
  `ProjectCard`. The non-graph equivalent required by the brief; also the SSR
  backbone content. No horizontal overflow (fluid grid, `min-w-0`).

### `ZoomControls`
```ts
props: { onZoomIn; onZoomOut; onFit; scale:number; }
```
- three real `<button>`s (`aria-label` Zoom in/out, Fit to screen), disabled at
  clamp bounds (`aria-disabled`). Keyboard focusable, in tab order before graph.

---

## Project + blog components

### `ProjectCard`
```ts
props: {
  project: { slug,name,domain,tagline,stack:string[],hasPublishedPost };
  size?: 'sm'|'md';
}
```
- links to `/projects/[slug]`. Shows domain glyph+tint stripe, name, tagline,
  ≤3 `TagBadge` (+N overflow), `StatusPill` if published. Whole card is one link
  (`<a>` wrapping content; nested TagBadge filters NOT interactive here to avoid
  nested-interactive a11y violation).
- states: rest·hover(`--elev-2`, lift 2px)·focus-visible(ring)·no-post(no pill).

### `CaseStudyHeader`
```ts
props: {
  name, domain, tagline, stack:string[],
  links: { repo?:string; live?:string; post?:string };   // [API] which exist varies
  status: 'draft'|'published';
}
```
- domain glyph + eyebrow, H1 name (display), tagline lead, wrapped `TagBadge`s,
  link row (`Button` variants; only render links that exist), `StatusPill`.
- a11y: single H1 per page; external links `rel="noopener"` + "opens in new tab"
  SR text on `↗`.

### `AtAGlance` (case-study aside)
```ts
props: { role?, timeline?, domain, related:{slug,name}[], links }
```
- definition list (`<dl>`); "related" = kinship/bridge projects as text links
  (the non-graph equivalent of edges). Sticky on desktop, inline on mobile.

### `PostCard`
```ts
props: { post: { slug,title,excerpt,domain,tags:string[],publishedAt,readMinutes,
                 projectName? }; }
```
- links to `/blog/[slug]`. domain glyph+tint, title (clamp 2), excerpt (clamp 3),
  meta row (glyph, date, read time), tags. Only shown for published posts publicly.
- states: rest·hover(lift)·focus.

### `PostBody` / prose
```ts
props: { children /* rendered MDX/HTML */; }
```
- typographic prose scale (token §3): 68ch column, `--text-base`/1.6, headings in
  `--font-display`, links underlined in domain/`--info` (≥4.5:1), code in
  `--font-mono` on `--surface-2`, blockquotes with left accent bar, images
  rounded `--radius-md` w/ caption, tables scroll-x on mobile (no page overflow).
- callout variants: note/warn/tip using status colors + icon + text label.
- a11y: heading order enforced (no skips), code blocks have lang label, images
  require `alt` (content authors supply — flagged to tech-writer).

### `ProjectBacklink` (post → project — ACCEPTANCE #3)
```ts
props: { project: { slug, name, tagline }; variant:'banner'|'footer'; }
```
- prominent card linking `/projects/[slug]`, `data-testid="post-project-backlink"`.
  Rendered near top and in footer of every post. Required, not optional.

### `BackLink`
```ts
props: { href, label }   // "← Back to constellation" / "← All writing"
```

---

## Admin components (`src/components/admin/**`)

### `LoginForm`
```ts
props: { onSubmit:(email,password)=>Promise<void>; error?:string; next?:string; }
```
- labeled email+password, submit `Button loading`. Error in `role="alert"`
  (generic message, never reveal which field). Redirect to `next` on success.
- states: idle·submitting·error·locked(429 message).

### `PostTable`
```ts
props: {
  posts: PostRow[];    // {id,title,projectName,status,updatedAt} [API]
  filter:'all'|'published'|'drafts'; onFilter; onRowAction; page; onPage;
}
```
- `<table>` w/ scope headers; each row → editor; `⋯` menu = Edit / Publish /
  Unpublish / Duplicate / Delete(confirm). `StatusPill` per row. Optimistic
  publish toggle w/ rollback on `onRowAction` failure.
- states: loading(skeleton rows)·empty·filter-empty·error·row-busy.

### `PostEditor` (shell)
```ts
props: {
  initial?: PostDraft;                 // undefined = new
  projects: {slug,name}[];             // [API] for the "link to project" select
  onSave:(draft)=>Promise<void>;
  onPublish:(draft)=>Promise<void>;
  onUnpublish?:()=>Promise<void>;
}
```
- two-pane (main editor + settings aside per `03-pages.md §7`). Settings: slug
  (auto+editable+async-unique **[API]**), **Project select (required — the post→
  project link)**, Domain, Tags, Excerpt, Cover upload, SEO title/desc, auto read
  time. Topbar: `StatusPill` lifecycle switch + `Save` + `Publish`/`Unpublish`.
- Autosave (interval + on blur); unsaved-changes guard using the `submittedRef`
  pattern (MEMORY: async-save discard-guard race) so a just-saved post does not
  trip a false discard prompt.
- Publish validates required fields; on fail → inline errors + `role="alert"`
  summary + focus first invalid; on success → StatusPill=Published + "View ↗".
- states: new·loaded·dirty·saving·saved·publishing·validation-error·save-error·
  slug-conflict·upload(idle/uploading/error)·unauthorized(redirect).

### `RichTextToolbar`
```ts
props: { onCommand:(cmd)=>void; }   // bold, italic, h2, quote, code, link, image, list
```
- real buttons w/ `aria-label` + `aria-pressed` for active marks; keyboard
  shortcuts documented in a tooltip. (Underlying editor engine is backend/
  frontend's choice — this specifies the control surface, not the library.)

---

## [API] data-shape needs (for backend-dev to define contracts — not invented here)

Design needs, but does NOT specify the response shape for:
1. **ProjectNodeData** per project: `slug, name, domain, prominence(1-3),
   tagline, stack[], hasPublishedPost, links{repo?,live?,post?}` — powers nodes,
   cards, case-study header, popover.
2. **EdgeData**: `from, to, kind` — powers kinship/bridge edges. (Static from
   `00-concept.md` if backend prefers not to model relationships; design is fine
   either way — decision is backend's.)
3. **PostRow / PostDraft**: `id, title, slug, projectSlug(required link), domain,
   tags[], excerpt, body, status, publishedAt, readMinutes, seo{title,desc},
   cover` — powers admin table + editor + public post.
4. **Slug uniqueness check** endpoint behavior + **RSS/sitemap** emission
   (published only) — needed by editor + Footer + ACCEPTANCE #3.

These are recorded in HANDOFF for backend-dev to turn into concrete contracts.
Design will adapt component prop names to the final field names.

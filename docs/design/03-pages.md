# 03 — Page Layouts (wireframes)

**Status:** contract. Wireframe-level (ASCII). Tokens from `01-tokens.md`,
components from `04-components.md`. Every page is specified at **mobile (375)** and
**desktop (≥1024)**; each lists its **loading / empty / error / permission**
states because a flow without them is unfinished.

Route map (frontend owns the routes; these are the design intent):
```
/                      graph home            (public)
/projects/[slug]       case study            (public)
/blog                  blog index            (public)
/blog/[slug]           blog post             (public)
/about                 bio + contact         (public)
/admin/login           admin sign-in         (public form → sets session)
/admin                 dashboard / post list (auth)
/admin/posts/new       editor (create)       (auth)
/admin/posts/[id]      editor (edit)         (auth)
```

Global chrome: **Header** (all public pages) + **Footer**. Admin uses a distinct
**AdminShell** (sidebar + topbar), never the public header.

---

## 1. Graph home `/`  — full spec in `02-graph-home.md`; layout frame only here

### Desktop ≥1024
```
┌───────────────────────────────────────────────────────────────────┐
│ HEADER  [AZ ◆]        Work   Blog   About            [☀/☾ toggle]   │
├───────────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐  ┌──────────────────────────────────────────┐ │
│ │ Abdullah         │  │            THE CONSTELLATION             │ │
│ │ Zakariyya        │  │   ◆ Web3            ▲ Security           │ │
│ │ Engineer —       │  │    ● ● ●              ● ●                │ │
│ │ Web3 · Security  │  │     ●  (glow=post)                      │ │
│ │ · Commerce       │  │   ● Commerce        ✦ Tools/Labs        │ │
│ │                  │  │    ● ● ●              ● ●                │ │
│ │ [View as list]   │  │                          [+ − Fit]      │ │
│ └─────────────────┘  └──────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│ FOOTER   © 2026 · GitHub · Email · RSS · Built with Next.js        │
└───────────────────────────────────────────────────────────────────┘
```
Left intro rail is a real `<aside>`; the "[View as list]" button reveals the card
fallback in place. Zoom controls bottom-right of the canvas.

### Mobile 375  (card fallback, NO svg — `02-graph-home.md §7`)
```
┌─────────────────────────┐
│ [AZ ◆]            [≡]    │  header collapses nav to a menu button
├─────────────────────────┤
│ Abdullah Zakariyya      │
│ Engineer — Web3·Sec·… │
├─────────────────────────┤
│ ◆ Web3          (7)     │  cluster heading
│ ┌───────────────────┐   │
│ │ Settleo      ●pub │   │  ProjectCard (full-width, stacked)
│ ├───────────────────┤   │
│ │ NFTMixer (Go) ●pub│   │
│ └───────────────────┘   │
│ … more Web3 …           │
│ ▲ Security      (2)     │
│ ● Commerce      (6)     │
│ ✦ Tools/Labs    (3)     │
├─────────────────────────┤
│ FOOTER                  │
└─────────────────────────┘
```
States: **loading** = SSR content, no spinner. **empty** = cluster headings +
"Projects coming soon." **error** = card fallback + `role="alert"` "Showing list
view." (mobile is already the card view, so error is a no-op visual).

---

## 2. Project case study `/projects/[slug]`

Satisfies ACCEPTANCE #2 (name + stack + repo/links render, no console errors).

### Desktop
```
┌───────────────────────────────────────────────────────────────────┐
│ HEADER                                                             │
├───────────────────────────────────────────────────────────────────┤
│ ← Back to constellation                                           │  BackLink
│                                                                    │
│ ◆ WEB3                                          [● Published]      │  CaseStudyHeader
│ Settleo                                                            │   (domain glyph,
│ Non-custodial P2P / OTC crypto-settlement platform.               │    StatusPill)
│ [Solidity] [Go] [gRPC] [TigerBeetle] [Redis]   ← TagBadge stack   │
│ [ Repo ↗ ]  [ Live ↗ ]  [ Read the write-up → ]                   │  link row
├──────────────────────────────────┬────────────────────────────────┤
│ OVERVIEW (prose, 68ch)           │  AT A GLANCE (sticky aside)     │
│ What it is, the problem, the     │  Role: …                        │
│ architecture in prose…           │  Timeline: …                    │
│                                  │  Domain: Web3                   │
│ HIGHLIGHTS                       │  Related: NFTMixer, Escrow      │  (kinship edges
│ • 2-of-3 non-custodial escrow    │  Links: Repo, Blog post         │   as text links)
│ • double-entry ledger …          │                                 │
│                                  │                                 │
│ RELATED WRITE-UPS                │                                 │
│ ┌─ PostCard ─┐ ┌─ PostCard ─┐    │                                 │
│ └────────────┘ └────────────┘    │                                 │
└──────────────────────────────────┴────────────────────────────────┘
```

### Mobile
Single column: BackLink → CaseStudyHeader (glyph, title, tagline, wrapped
TagBadges, StatusPill, stacked link buttons) → "At a glance" as a definition list
→ Overview prose → Highlights → Related write-ups (stacked PostCards) → Footer.

**States:**
- **loading:** skeleton — header block + 6 shimmer prose lines + 2 card skeletons.
- **empty (no post yet):** "Related write-ups" shows "Write-up in progress" note
  instead of PostCards; project still fully renders.
- **404 (bad slug):** shared NotFound — "No project here" + link back to `/`.
- **error:** ErrorBoundary card "Couldn't load this project" + retry + back link.

---

## 3. Blog index `/blog`

```
Desktop                                   Mobile 375
┌──────────────────────────────────────┐  ┌───────────────────┐
│ HEADER                               │  │ HEADER      [≡]   │
│ Writing                              │  │ Writing           │
│ Engineering notes across my work.    │  │ [ All ▾ filter ]  │
│ [All][Web3][Security][Commerce][Tool]│  ├───────────────────┤
├──────────────────────────────────────┤  │ ┌───PostCard────┐ │
│ ┌─PostCard─┐ ┌─PostCard─┐ ┌─PostCard─┐│  │ └───────────────┘ │
│ │ title    │ │          │ │          ││  │ ┌───PostCard────┐ │
│ │ excerpt  │ │          │ │          ││  │ └───────────────┘ │
│ │ ◆ tag date│ │          │ │          ││  │ …                 │
│ └──────────┘ └──────────┘ └──────────┘│  └───────────────────┘
│ … 3-col grid (2-col md, 1-col sm) …  │
└──────────────────────────────────────┘
```
Only **published** posts appear (drafts excluded — ACCEPTANCE #3). Domain filter
is a row of toggle chips (client filter over SSR list). Sort: newest first.

**States:** loading = 6 PostCard skeletons; **empty** ("No posts yet — check back
soon."); error = ErrorBoundary. Filter that matches nothing = "No posts in
{domain} yet." Pagination or "Load more" if > 12 posts.

---

## 4. Blog post `/blog/[slug]`

Satisfies ACCEPTANCE #3 (title, body, **link back to its project**) + #6 (a11y).
```
┌───────────────────────────────────────────────────────────────────┐
│ HEADER                                                             │
├───────────────────────────────────────────────────────────────────┤
│ ← All writing                                                     │  BackLink
│ ◆ WEB3 · 8 min read · 2026-05-12                                  │  post meta
│ Building a double-entry ledger on TigerBeetle                     │  H1 (display)
│ [Solidity][Go][gRPC]                                              │  TagBadges
│ ┌──────────────────────────────────────────────────────────┐     │
│ │ ▸ Part of the project:  Settleo  →                        │     │  PROJECT
│ │   Non-custodial settlement platform.   [ View project → ] │     │  BACKLINK
│ └──────────────────────────────────────────────────────────┘     │  (prominent,
│                                                                    │   required)
│  PostBody — prose column max 68ch, centered                       │
│  headings, code blocks (JetBrains Mono), callouts, images…        │
│                                                                    │
│  ── end ──                                                         │
│  ┌─ Prev post ─┐              ┌─ Next post ─┐                     │
│  Back to Settleo project  ·  All writing                          │  footer nav
└───────────────────────────────────────────────────────────────────┘
```
The **project backlink card** appears both near the top (under the title) and in
the footer, so ACCEPTANCE #3's "link back to its project" is unmissable and the
Playwright assertion can target `[data-testid="post-project-backlink"]`.

Mobile: single column, backlink card full-width, prose 100% width w/ comfortable
gutters, code blocks scroll-x internally (never overflow the page — #5).

**States:** loading = title + meta skeleton + prose shimmer; **draft accessed
anonymously** = 404 (not a "draft" page — ACCEPTANCE #3); error = ErrorBoundary;
missing project ref = backlink card hidden gracefully (but content authors must
set it — flagged to tech-writer).

---

## 5. Admin — login `/admin/login`

```
Centered card on plain background (no public header; minimal AdminShell topbar).
┌─────────────────────────────┐
│           AZ · Admin        │
│  ┌───────────────────────┐  │
│  │ Sign in               │  │
│  │ Email    [__________] │  │
│  │ Password [__________] │  │
│  │ [ Sign in ]           │  │  primary button, full width
│  │ (error msg region)    │  │  role="alert"
│  └───────────────────────┘  │
└─────────────────────────────┘
```
**States:** idle · submitting (button spinner, inputs disabled) · **error**
(`role="alert"` "Invalid email or password" — never reveal which) · success →
redirect to `/admin`. Rate-limit / locked message if backend returns 429.
Already-authenticated visit → redirect straight to `/admin`.

## 6. Admin — dashboard / post list `/admin`

```
┌──────────────┬────────────────────────────────────────────────────┐
│ AdminSidebar │ TOPBAR   Posts            [＋ New post]  [AZ ▾]     │
│ ▸ Posts      ├────────────────────────────────────────────────────┤
│   Projects   │ [ All ][ Published ][ Drafts ]   [search…]          │  filter tabs
│   Media      │ ┌────────────────────────────────────────────────┐ │
│   Settings   │ │ Title                Project    Status   Updated│ │  post table
│              │ ├────────────────────────────────────────────────┤ │
│              │ │ Double-entry ledger  Settleo   ●Publ   May 12  ⋯│ │  row → editor
│              │ │ MTD forensics deep…  Sentova   ○Draft  May 09  ⋯│ │  StatusPill
│              │ │ …                                               │ │  ⋯ = row menu
│              │ └────────────────────────────────────────────────┘ │  (edit/publish/
│              │  ‹ 1 2 3 ›                                          │   unpublish/del)
└──────────────┴────────────────────────────────────────────────────┘
```
Row menu actions: Edit · Publish/Unpublish (toggles StatusPill inline, optimistic
w/ rollback on error) · Duplicate · Delete (confirm modal). Bulk-select optional.

**States:** loading = table skeleton rows; **empty** = "No posts yet. [Create your
first post]"; filter empty = "No {status} posts."; error = inline `role="alert"` +
retry. **Permission-denied / unauthenticated** = never renders; middleware
redirects to `/admin/login?next=/admin` (ACCEPTANCE #4). Session expiry mid-use →
toast "Session expired" + redirect to login preserving `next`.

## 7. Admin — editor `/admin/posts/new` · `/admin/posts/[id]`

```
┌──────────────┬────────────────────────────────────────────────────┐
│ AdminSidebar │ TOPBAR  ‹ Posts   [○ Draft ▾]   [Save]  [Publish]   │  status +
│              ├───────────────────────────────┬────────────────────┤   actions
│              │ EDITOR (main)                 │ SETTINGS (aside)    │
│              │ Title  [___________________]  │ Slug   [auto/edit]  │
│              │ ┌───────────────────────────┐ │ Project[ Settleo ▾] │  ← link to
│              │ │ Rich text / MDX toolbar   │ │ Domain [ Web3 ▾ ]   │    a project
│              │ │ B I H2 “ </> — img link   │ │ Tags   [＋ add]     │    (ACCEPT #3)
│              │ │                           │ │ Excerpt[________]   │
│              │ │  body…                    │ │ Cover  [ upload ]   │
│              │ │                           │ │ SEO    title/desc   │
│              │ └───────────────────────────┘ │ Read time: auto     │
│              │  Autosaved 12:04 · draft      │                     │
└──────────────┴───────────────────────────────┴────────────────────┘
```
- **Draft → publish control** (ACCEPTANCE #4): the `[○ Draft ▾]` pill in the topbar
  is the lifecycle switch. `Save` persists current status; `Publish` validates
  required fields (title, slug, project, body) then flips status → Published and
  shows the public URL with a "View ↗". `Unpublish` reverts to Draft. A published
  post keeps editing → "Save" updates live; "Revert to draft" pulls it from public
  (removes from sitemap — ACCEPTANCE #3).
- Slug: auto from title, editable, uniqueness checked (async) — inline error if
  taken. Changing a published slug warns about breaking links.
- Autosave to draft every N seconds + on blur; "unsaved changes" guard on
  navigate-away (reuse the owner's `submittedRef` discard-guard pattern — see
  MEMORY, avoids the false-dirty popup).

**States:** new (empty form) · editing (loaded) · saving (button spinner,
disabled) · saved (timestamp) · **validation error on publish** (inline field
errors + summary `role="alert"`, focus first invalid) · save error (toast +
keep local edits) · **unauthenticated** = redirect to login · slug conflict =
inline. Image upload: idle · uploading (progress) · error (retry).

## 8. Cross-page shared states (single source, referenced above)

| State | Pattern |
|---|---|
| **Skeleton** | Shape-matched shimmer blocks using `--surface-2`; never a bare spinner for content regions. |
| **Empty** | Icon/glyph + one sentence + one primary action. Never a blank region. |
| **Error** | `role="alert"`, plain-language message, retry action, no stack traces. |
| **Permission-denied** | Handled by middleware **before** render → redirect to `/admin/login?next=…`; the protected page never flashes. |
| **404** | Shared NotFound page: "Nothing here" + link home + link to blog. |
| **Offline / fetch fail** | Toast "You appear to be offline"; cached SSR content stays readable. |

Empty/loading/error/permission states are part of THIS deliverable — a page that
ships only its happy path is incomplete.

# Acceptance criteria (falsifiable)

Every downstream agent is scored against this list. Verifiers receive THIS file plus
the code — nothing else.

1. **Builds clean.** `pnpm build` completes with zero errors and emits deployable
   output (`.next/`). `pnpm lint` and `pnpm typecheck` (or `tsc --noEmit`) pass.

2. **Every featured project is reachable.** Playwright loads the graph home, and from
   it can navigate to each featured project's case-study page. Each project page asserts:
   no console errors, and the project's name + stack + repo/links render.

3. **Every featured project has a post.** Each blog post renders at its slug with a
   title, body, and a link back to its project. `sitemap.xml` (or `/sitemap.xml`) lists
   every published project and post. Draft posts are NOT in the sitemap and return 404
   (or redirect) to anonymous users.

4. **CMS works end-to-end.** An authenticated admin can create a post, save it as draft
   (not visible publicly), then publish it (now visible publicly at its slug). Verified
   by Playwright driving `/admin`. Unauthenticated requests to `/admin/*` and to
   mutating `/api/*` endpoints are rejected (401/redirect) — verified by direct request.

5. **Responsive.** No horizontal overflow at 375px and 1440px viewports on: graph home,
   one project page, one blog post. Verified by Playwright viewport assertion.

6. **Quality gates.** Lighthouse (or equivalent) SEO ≥ 90 and Accessibility ≥ 90 on the
   home, one project page, and one post.

7. **No leakage.** No secrets, tokens, `.env` values, private keys, or credentials appear
   in committed files, seed data, published content, or build output. `.env` is gitignored;
   only `.env.example` is committed. Verified by blue-hat scan.

8. **The graph home works.** The domain-graph landing renders all featured projects as
   nodes clustered by domain (Web3 / Security / Commerce / Tools-Labs), is navigable by
   both pointer and keyboard, and every node links to a real project page. Verified by
   Playwright + accessibility-auditor.

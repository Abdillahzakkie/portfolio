# Project Inventory — factual source material

Ground all portfolio/blog copy in this. Read each project's own README/ARCHITECTURE/
CHANGELOG/SECURITY docs for depth before writing about it. Do not invent claims beyond
what a repo supports. Paths are under `~/Desktop/projects/`.

## Domain: Web3 / NFT
- **nftmixer-go** (`exedos_corp/nftmixer-go`) — Go API + Next.js rewrite of a .NET
  generative-NFT builder. SIWE wallet auth, projects, asset library, node graph,
  generation, S3/MinIO render. Reached "C# functional parity." Docs: large CHANGELOG.md,
  HANDOFF.md, docs/, infra/, e2e/. Git ✓ README ✓.
- **NFTMixer** (`exedos_corp/NFTMixer`) — the original: C# / .NET 6, Blazor Server.
  Layered art → sources/assets/variants → node graph → generate PNGs + metadata.
  Multi-project solution, Dockerized. Predecessor to nftmixer-go.
- **GKOI ecosystem** (`exedos_corp/v2/*`) — Web3 fighting-game NFT platform ("New Worlds
  New Powers"). Microservices, each its own repo:
  - gkoi-server — Node/TS + Express + MongoDB + Redis backend; migrate-mongo.
  - gkoi-authentications — auth service (Node/TS/Express); has SECURITY.md + SECURITY_AUDIT.md.
  - gkoi-whitelist — Merkle-proof whitelist API, contract metadata, IPFS.
  - gkoi-admin-v2 — Next.js/TS admin dashboard (collections, contests, users, chain ops).
  - gkoi-client-v3 — Next.js/TS public site.
  - gkoi-gallery — Next.js NFT gallery/marketplace.
- **Smart contracts** (`exedos_corp/Smart contracts/*`) — Foundry/Solidity:
  Conduit, NftCollectionFactory, gkoi-erc721AC (ERC721-AC creator/LimitBreak SeaDrop,
  upgradeable, Foundry+Hardhat), gkoi-smart-contracts.
- **Settleo** (`personal/settleo/*`) — 24-repo non-custodial P2P/OTC crypto-settlement
  platform. Each service its own repo. Highlights:
  - settleo-gateway — internet-facing API gateway/BFF: HMAC+token auth, deny-by-default
    authz, rate limiting, idempotency, signed routing, WS fan-out, Redis-only store.
  - settleo-iam — authn, sessions/token issuance+introspection, AWS-IAM-style authz (Deny-wins).
  - settleo-ledger — authoritative double-entry ledger; sole writer to TigerBeetle; gRPC.
  - settleo-indexer — per-chain EVM ingestion, reorg-safe crediting, gRPC.
  - settleo-escrow-contracts — Foundry/Solidity 2-of-3 non-custodial trade escrow.
  - settleo-escrow-orchestrator — drives escrow fund/release/refund/dispute, settles ledger.
  - settleo-compliance — KYC/KYB/AML, sanctions/PEP, Travel-Rule (IVMS101), case mgmt.
  - settleo-dispute — arbitration, evidence bundling, SLA timers, 2-of-3 resolution.
  - settleo-developer — per-tenant API keys, webhooks, sandbox/rate limits.
  - settleo-consumer / settleo-business / settleo-console — Next.js 15.5 + React 19 +
    styled-components frontends (retail P2P / OTC desk / internal ops console).
  Platform docs: START-HERE.md, PLATFORM-TRACKER.md (59k), ENV-MANIFEST.md.

## Domain: Security
- **sentova** (`personal/sentova`) — cross-device active protection: installable
  desktop (Wails)/Android/iOS apps that block malicious traffic, detect spyware/ransomware,
  score hardening. Backed by one Go service (go.work 4-module monolith). Ships serviced.exe.
  Docs: PLATFORM-TRACKER.md.
- **sentova (MTD)** (`personal/bin/sentova`, pkg `sentova-frontends`) — Anti-spyware /
  Mobile Threat Defense for high-risk users. Flagship "Device Defense" analyzes iOS/Android
  forensic artifacts against STIX 2.1 spyware IOCs. Go microservices (agents, assets, audit,
  billing, breach, brokers, gateway, iam, mtd, notifications) + pnpm frontends. Docs:
  PLATFORM-TRACKER.md, SECURITY-REVIEW.md. NOTE: detection-internals posts default to draft.

## Domain: Commerce / Marketplaces (Nigeria-focused)
- **chekka** (`personal/chekka`) — professional car inspection & verification ("Before you
  buy — Chekka"). Next.js 16 monolith + Mongoose + Redis + S3, TS, Playwright. 37k-word spec.
- **prechop** (`personal/prechop/prechop` + `prechop-api`) — campus food pre-order marketplace
  ("Order before they cook"): dated listings, cutoff times, Paystack prepay. Next.js/TS +
  Vitest/Playwright frontend; Node/TS + Prisma API.
- **adverta** (`personal/adverta`) — Nigeria business advertising/marketplace: free listings,
  paid boosts, in-app chat, campaign builder, agency white-label. Turborepo monorepo (web +
  native mobile + shared HTTP API), Redis, Prometheus, per-op DB/service IAM ("Golden Bite arch").
- **mogadget** (`personal/mogadget`) — single-owner gadget catalog for a Lagos retailer:
  browse → order via WhatsApp/Instagram, no cart. Next.js + MongoDB + Redis, Model→Service→Route,
  Vitest + Playwright.
- **golden_bite** (`personal/golden_bite`) — premium treats/catering storefront + ops dashboard
  + staff mobile (Abuja). Next.js, ioredis, Prometheus, per-op DB/service, Zod, SWR+axios.
- **managerenta** (`personal/managerenta`) — property/rental management app. Next.js/TS, Docker,
  AWS Amplify/CodeBuild, Playwright. The reference architecture the other personal apps clone.
  Has SECURITY_REVIEW.md.

## Domain: Tools / Products / Labs
- **aisolver** (`personal/aisolver`, pkg taskwise-v2) — modern rebuild of a task/list manager:
  lists, nested tasks, groups, drag-drop, calendar, alarms, trash, admin, invite-code reg.
  pnpm monorepo: React 19 + Vite + TS + Tailwind v4 (web); Fastify 5 + node-pg + Zod (api);
  PostgreSQL 17; ws. Real docs: ARCHITECTURE.md, RUNBOOK.md, arch-check.ts lint.
- **fivestick-website** (`personal/fivestick-website`) — marketing/landing for Fivestick, an
  AI automation consultancy. Next.js (static) + TS + Tailwind (shadcn).
- **Labs / learning** (`developments/*`) — C++23 template (spaceship operator), hello-interview
  (DSA/TS), terraform sandbox (local provider). Lightweight — group as a small "Labs" cluster,
  low prominence.

## Distinctive cross-cutting themes (good blog angles)
- Cross-language rewrite discipline: C#/.NET → Go+Next.js (nftmixer-go) at functional parity.
- A reusable "managerenta / Golden-Bite" Next.js + Mongo + Redis reference architecture cloned
  across many commerce apps (Model→Service→Route triad, per-op DB/service, IAM).
- Deep Web3: non-custodial 2-of-3 escrow, double-entry ledger on TigerBeetle, reorg-safe
  EVM indexing, Merkle whitelists, ERC721-AC.
- Security engineering: STIX 2.1 IOC matching, MTD forensics, Wails cross-platform agents.

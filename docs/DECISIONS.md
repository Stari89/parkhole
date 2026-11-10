# Decisions

The log of Damjan's final product and project decisions for Parkhole, newest first. `repo-organizer` maintains it. Rules about how the agent team works live in `.claude/agents/`, not here.

Each entry records what was decided, why, and what it supersedes. When a later decision replaces an earlier one, the earlier entry stays and gets a "Superseded by" line.

Open questions are at the bottom.

---

## 2026-11-10: The library list is approved

**Decision:** Damjan approved the full library list (28 rows) in `docs/tech-skeptic/2026-11-10-library-choices.md`. That file is the approved list of libraries and versions. The file's own status line still says "proposal", but it is approved as written. The key picks:
- **Runtime and repo:** Node 24 LTS; npm workspaces with `src/apps/*`, `src/services/*` and `src/packages/*`.
- **Apps:** Expo SDK 58 (it pins React, React Native and the Expo modules), TanStack Query, react-native-paper, MapLibre (`@maplibre/maplibre-react-native` on native, `maplibre-gl` + `pmtiles` on web), and `onnxruntime-react-native` for D-FINE.
- **Auth:** better-auth, wired into Nest with the community adapter `@thallesp/nestjs-better-auth`.
- **Services:** TypeORM 1.x + MySQL 8.4; orval for OpenAPI codegen, with one generated client per API.
- **Storage:** SeaweedFS as the S3 server, instead of MinIO (AGPL).
- **Testing:** Jest + SWC; Playwright for the web apps and Maestro for mobile e2e.
- **Tooling:** ESLint + Prettier + lefthook; GitHub Actions for CI.
- **Deployment:** Docker Compose + Caddy on the NUC, with separate `main` and `infra` networks and one MySQL container per side.

With this list, the topology follows from today's decisions: three Expo clients in `src/apps/`; the main API, the detection worker, `infra-ingest`, the aggregation job and `municipal-api` in `src/services/`; shared code (such as the generated API clients) in `src/packages/`.

**Follow-ups (spikes, not open decisions):**
- better-auth with two instances (users and admins) in one Nest app. Required before login is built.
- TypeORM 1.x with one entity, one migration and one spatial column.
- ONNX D-FINE through `onnxruntime-react-native` on an Expo 58 development build.
- h3-js under Hermes.
- maplibre-react-native on SDK 58.

If a spike fails, the file names the fallback for that row.

**Why:** Damjan's decision, approving `tech-skeptic`'s proposal.

**Supersedes:** the open questions "Exact library versions", "Auth library" and "App topology".

## 2026-11-10: A maintained auth library, three separate auth setups

**Decision:** auth uses a maintained library instead of hand-rolled JWT. There are three separate auth setups with no shared secrets: Parkhole users, admins and municipal officials. Which library is not decided yet.

**Why:** Damjan accepted `tech-skeptic`'s proposal in `docs/tech-skeptic/2026-11-10-tech-stack-review.md`.

**Supersedes:** no earlier decision.

**Superseded by (in part):** "The library list is approved" (same day) picks the library: better-auth.

## 2026-11-10: The infra side is three separate services

**Decision:** the infra side is three separate services:
- `infra-ingest`: anonymous, no logs, insert-only DB access;
- a scheduled aggregation job that writes `published_aggregates`;
- `municipal-api`: official accounts, reads only `published_aggregates`.

**Why:** Damjan accepted `tech-skeptic`'s proposal in `docs/tech-skeptic/2026-11-10-tech-stack-review.md`.

**Supersedes:** the infra-side part of the open question "App topology".

## 2026-11-10: TypeScript ~6.0 repo-wide for now, not 7

**Decision:** the whole repo uses TypeScript ~6.0 for now, not 7. We move to 7 once the tooling supports it.

**Why:** TS 7.0.2 drops the old compiler API that the `@nestjs/swagger` CLI plugin, `ts-jest` and `typescript-eslint` use, and their peer ranges stop at TS 6. Damjan accepted `tech-skeptic`'s proposal in `docs/tech-skeptic/2026-11-10-tech-stack-review.md`.

**Supersedes:** the TypeScript part of the open question "Exact library versions".

## 2026-11-10: Development and staging run on Damjan's own Ubuntu server

**Decision:** development and staging, including small-scale beta testing, run on Damjan's own Ubuntu server. It is not for production. The separate Node.js + MariaDB hosting plan that came up the same day is dropped. The database stays MySQL, as in the stack decision.

The server is an ASUS NUC (CU5-225H, 16 GB RAM) at Damjan's parents' home, and his parents agree to it. It has 99.5% uptime and a static IP. It also hosts Damjan's other services, which are unrelated to Parkhole.

**Why:** Damjan's decision. The server has far more capacity than development and staging need.

**Supersedes:** the open question "Hosting provider" for development and staging, and the "where it physically sits" and "is it used for production" parts of the open question on production hosting. The earlier MariaDB recommendation in `docs/tech-skeptic/2026-11-10-tech-stack-review.md` §10 assumed the hosting plan; `tech-skeptic` has since rewritten §10 for one Ubuntu host on MySQL.

## 2026-11-10: The municipality app starts as a login dashboard

**Decision:** the municipality app starts as a dashboard that municipal officials log in to. A public open-data page may come later.

**Why:** Damjan's decision.

**Supersedes:** no earlier decision.

## 2026-11-10: All clients are Expo apps

**Decision:** Parkhole has three clients, all Expo apps:
- the mobile app;
- a backoffice for moderation: approving pending posts and managing the caption pool;
- a municipality app.

The backoffice and the municipality app are web first. Native builds of them are possible later.

**Why:** Damjan's decision. He may want mobile versions of the backoffice and the municipality app later.

**Supersedes:** no earlier decision.

## 2026-11-10: Tech stack is the izi-crawler stack, brought up to date

**Decision:** Parkhole uses the izi-crawler stack on current versions: Expo / React Native, NestJS + TypeORM + MySQL, and OpenAPI codegen. The exact versions and libraries are not final yet. `tech-skeptic` is reviewing them in `docs/tech-skeptic/`.

**Why:** Damjan's decision.

**Supersedes:** the stack part of the open item "Tech stack and app topology: not decided" in `PARKHOLE_HANDOFF.md`. The app topology is still open.

**Superseded by (in part):** "The library list is approved" (same day) fixes the versions, the libraries and the topology.

## 2026-11-10: Git flow

**Decision:** the repo uses standard git flow. `main` holds releases. `develop` is the integration branch and the default branch on GitHub. Work happens on `feature/*`, `release/*` and `hotfix/*` branches. `main` and `develop` are protected: changes land only through pull requests, with no force-push, no deletion and no bypass for anyone.

**Why:** Damjan's decision.

**Supersedes:** direct commits and pushes to `main`.

## 2026-11-10: CLAUDE.md moves to the repo root

**Decision:** `docs/CLAUDE.md` moves to `CLAUDE.md` at the repo root.

**Why:** Claude Code loads `CLAUDE.md` automatically only from the repo root or `.claude/`. In `docs/`, agents working anywhere else might never see the project rules and privacy invariants.

**Supersedes:** the open question "`docs/CLAUDE.md` is not loaded automatically".

## 2026-11-10: Docs layout

**Decision**
- `product-visionary` writes only in `docs/product-visionary/`.
- `tech-skeptic` writes only in `docs/tech-skeptic/`.
- `repo-organizer` manages the final decisions (this file) and the shared docs at the root of `docs/`. It can read and write anywhere in `docs/`.
- The goal is to retire `docs/PARKHOLE_HANDOFF.md` once our own decisions make it irrelevant.

**Why:** each role gets its own folder, so the final decisions stay in one place, separate from proposals and critiques.

**Supersedes:** the old `docs/` list in the "Repository layout" section of `CLAUDE.md`, which named only `CLAUDE.md` and `PARKHOLE_HANDOFF.md`.

## 2026-11-10: Infra events from the first release

**Decision:** infra events are collected from the first release, alongside the meme tool, not later.

**Why:** Damjan's decision.

**Supersedes:** no earlier decision. It confirms item 2 of the MVP scope in `PARKHOLE_HANDOFF.md` §9.

## 2026-11-10: Automatic plate and face blurring in the first release

**Decision:** automatic plate and face blurring on the phone is in the first release. Damjan called it non-negotiable.

**Why:** Damjan's decision.

**Supersedes:** `tech-skeptic`'s suggestion to ship only manual blurring in release 1.

## 2026-11-10: Fun first

**Decision:** Parkhole is a fun app first. Civic and municipal data is the long-term payoff. The groundwork and scaffolding for both are built from the start.

**Why:** Damjan's decision.

**Supersedes:** no earlier decision.

---

## Open questions

- **Production hosting:** not decided.
- **The product and design open items** are still listed in `PARKHOLE_HANDOFF.md` §10. They move here when the handoff is retired.

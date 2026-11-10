# Decisions

The log of Damjan's final product and project decisions for Parkhole, newest first. `repo-organizer` maintains it. Rules about how the agent team works live in `.claude/agents/`, not here.

Each entry records what was decided, why, and what it supersedes. When a later decision replaces an earlier one, the earlier entry stays and gets a "Superseded by" line.

Open questions are at the bottom.

---

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

- **App topology:** which services exist, how they talk to each other, and the repo layout under `src/`.
- **Hosting provider:** not chosen.
- **Exact library versions:** the stack is decided, but the versions and libraries are not final. `tech-skeptic` is reviewing them.
- **The product and design open items** are still listed in `PARKHOLE_HANDOFF.md` §10. They move here when the handoff is retired.

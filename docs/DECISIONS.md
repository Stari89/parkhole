# Decisions

The log of Damjan's final decisions for Parkhole, newest first. `repo-organizer` maintains it.

Each entry records what was decided, why, and what it supersedes. When a later decision replaces an earlier one, the earlier entry stays and gets a "Superseded by" line.

Open questions are at the bottom.

---

## 2026-11-10: Docs layout

**Decision**
- `product-visionary` writes only in `docs/product-visionary/`.
- `tech-skeptic` writes only in `docs/tech-skeptic/`.
- `repo-organizer` manages the final decisions (this file) and the shared docs at the root of `docs/`. It can read and write anywhere in `docs/`.
- The goal is to retire `docs/PARKHOLE_HANDOFF.md` once our own decisions make it irrelevant.

**Why:** each role gets its own folder, so the final decisions stay in one place, separate from proposals and critiques.

**Supersedes:** the "Repository layout" section of `docs/CLAUDE.md`, which lists only `CLAUDE.md` and `PARKHOLE_HANDOFF.md` under `docs/`. That section hasn't been updated yet.

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

- **When can repo-organizer commit?** `docs/CLAUDE.md` and `.claude/agents/repo-organizer.md` say `repo-organizer` may commit and push on its own judgement. The first request was for commits only when Damjan asks, with pushes on its own judgement. Damjan to confirm which.
- **`docs/CLAUDE.md` is not loaded automatically.** Claude Code loads `CLAUDE.md` only from the repo root or `.claude/`. Agents working outside `docs/` may never see its rules. Fixes: move it to the root, or add a root `CLAUDE.md` that imports it.
- **The product and design open items** are still listed in `PARKHOLE_HANDOFF.md` §10. They move here when the handoff is retired.

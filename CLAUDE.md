# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Parkhole is a social app for sharing photos of badly parked vehicles. It has a second, serious output: anonymous, aggregated parking-hotspot data for municipalities (Slovenia, starting with Ljubljana). The full product/design spec is in `docs/PARKHOLE_HANDOFF.md`. Read it before designing any feature.

The repo has no code yet. The tech stack, the app topology and the libraries with their versions are decided: see `docs/DECISIONS.md`, and the approved library list in `docs/tech-skeptic/2026-11-10-library-choices.md`. In short: Node 24 LTS, TypeScript ~6.0 and npm workspaces; three Expo SDK 58 clients (the mobile app, the moderation backoffice and the municipality app); NestJS + TypeORM 1.x + MySQL 8.4 services (the main API, a detection worker, `infra-ingest`, an aggregation job and `municipal-api`); orval codegen and better-auth; Docker Compose + Caddy on the NUC for development and staging. Use the versions in that list. Several spikes are still required before the related features are built; `docs/DECISIONS.md` lists them. Production hosting is not decided.

## Rules for all agents

- Don't add AI attribution anywhere: commits, PR descriptions, code comments or docs. That includes `Co-Authored-By` trailers and "Generated with" lines.
- Do what Damjan asked, no more. Ask when a request is unclear.
- Only `repo-organizer` makes git commits and pushes, on its own judgement. Other agents don't commit or push.
- Write tests from day one, once there is code.

## Repository layout

- `README.md`: project overview.
- `CLAUDE.md`: this file.
- `docs/`: the shared docs, managed by `repo-organizer`:
  - `DECISIONS.md`: dated log of Damjan's final product and project decisions, plus open questions.
  - `PARKHOLE_HANDOFF.md`: the original product and design spec, to be retired once `DECISIONS.md` covers it.
  - `product-visionary/`: `product-visionary`'s ideas and proposals. Only that agent writes here.
  - `tech-skeptic/`: `tech-skeptic`'s technical reviews and notes. Only that agent writes here.
- `src/`: empty for now. It will hold npm workspaces in `src/apps/`, `src/services/` and `src/packages/`. It stays empty until scaffolding is planned. Don't create project folders before that.
- `.claude/`: shared Claude Code settings and agent definitions.

There are no build, lint or test commands yet.

## Privacy invariants

These constraints drive the architecture. Don't violate them when adding fields, endpoints or logging.

- **Two separate outputs that never link.** The `parkhole_posts` data (main DB) and the `infra_events` data (a separate DB, a separate service and no IP logging) never share an identifier. Posts have no OSM feature ID. Infra events have no user, post, image, exact timestamp or raw coordinates. The device sends them at different times, and infra events go out in delayed batches.
- **No plate tracking.** No plate OCR, plate hashes, "find this car" or repeat-offender detection. Plate detection exists only to blur plates.
- **Raw data stays on the device.** The original photo, raw GPS and EXIF never leave the phone. Blurring is irreversible and happens on the device. The server gets only coarse data: a label (street + municipality), `municipality_code`, a grid `cell` (H3 res 9 is under consideration) and `posted_on` (date only).
- **Infra events** reference `(dataset_version, feature_ref)` in a versioned `features` table built from OSM. `reporter_token` rotates daily, so the data counts reporter-days, not people. Municipal output is aggregated only and has publish thresholds (for example, ≥5 reports from ≥3 reporter-days per feature).
- **No user-generated text.** Captions come from a curated pool. There are no comments, only fixed emoji reactions.
- **Moderation starts as pre-moderation.** Every post is `pending_moderation` until an admin approves it.
- **`parking_lot` posts** appear only in the feed. They're excluded from municipal stats, and the device sends no infra event for them.
- **Don't use public OSM servers as the app backend.** Overpass, Nominatim, OSRM, Valhalla and tile.openstreetmap.org are for exploration only. Location data comes from self-hosted PMTiles. Don't use platform reverse geocoding (for example Expo `reverseGeocodeAsync`), because it sends coordinates to Google or Apple.
- **Avoid AGPL dependencies.** That rules out Ultralytics YOLO and OpenALPR. D-FINE (Apache 2.0) is the chosen detector.

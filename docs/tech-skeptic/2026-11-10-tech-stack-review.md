# Tech stack and topology review

Date: 2026-11-10. Reviewer: `tech-skeptic`. Status: review only, nothing here is decided.

Reviewed: the stack Damjan picked (izi-crawler's stack, brought up to date), the proposed topology (mobile app, main API, infra-events service, backoffice, municipality app, static hosting) and the repo layout (npm workspaces, no Nx or Turborepo).

The stack choice and "all three clients are Expo apps" are decided. I don't re-argue them. I flag risks inside them.

**What I didn't verify:** I didn't check any version number, changelog or peer-dependency range online. My knowledge ends before several of these releases (TypeORM 1.x, NestJS 12, Expo 58, TypeScript 7.0 final). Every version item below is a risk to check in a spike, not a confirmed incompatibility.

Severity: **High** = can break the build or a privacy invariant. **Medium** = real cost or rework. **Low** = annoyance.

---

## Verdict

The stack is a reasonable fit, and the topology is mostly right. I'd change three things before writing any code:

1. Pin the TypeScript and React Native versions to what the frameworks support, not to "latest on npm".
2. Split the infra service into an anonymous ingest side and a read side for municipal users. Don't put municipal logins in the same process as anonymous ingest.
3. Treat "no shared identifier" as a whole-pipeline property. It covers HTTP clients, proxies, logs, error tracking, DB servers and tile requests, not only the DB schemas.

---

## 1. Version and compatibility risks

| # | Risk | Severity | Recommendation |
|---|---|---|---|
| 1.1 | **TypeScript 7 (Go compiler) on the backend.** NestJS and TypeORM need `experimentalDecorators` and `emitDecoratorMetadata`. Worse, several tools need the old TypeScript JS compiler API, which the native compiler did not offer at first: the `@nestjs/swagger` CLI plugin (a TS transformer), `ts-jest`, `typescript-eslint` type-aware rules and `ts-node`. If any of them doesn't work with TS 7, the build or the spec generation breaks. | High | Use TypeScript 6.x (the bridge release) or the last 5.x across the whole repo to start. Move to 7 when the Nest CLI plugin, typescript-eslint and the test runner support it. If you want TS 7 speed, use it only for `tsc --noEmit` type checks in CI. |
| 1.2 | **Taking "latest" for React, React Native and native libraries.** Expo 58 pins one exact React Native version and one React version. React 19.3.1 or RN 0.88.1 straight from npm can be ahead of what Expo 58 supports. A React and renderer mismatch crashes at runtime. | High | In Expo apps, install packages only with `npx expo install`, and check with `npx expo install --check` in CI. Use "latest" only for backend and tooling packages. |
| 1.3 | **TypeORM 1.x is a fresh major release.** izi-crawler used 0.3.20. A new major means breaking changes, and possibly a lag before `@nestjs/typeorm` supports it. Things to check: migrations CLI, MySQL `GEOMETRY` support (needed for `features`), DataSource config. | Medium | Spike first: one entity, one migration, one spatial column, through `@nestjs/typeorm` on Nest 12. If anything is shaky, start on the last 0.3.x and upgrade later. Keep the entities free of TypeORM-specific tricks to keep the upgrade cheap. |
| 1.4 | **Expo 58 New Architecture with native ML and maps.** The legacy architecture is gone. `onnxruntime-react-native` has a history of trailing the New Architecture. `react-native-fast-tflite` is built on JSI and is usually fine. `@maplibre/maplibre-react-native` v11 is the New Architecture rewrite. Automatic blurring is non-negotiable for release 1, so the ML runtime is on the critical path. | High | Week-one spike in a development build: D-FINE N exported to ONNX and to TFLite, run with both runtimes on a mid-range Android and an older iPhone. Measure time and memory. Keep the runtime behind one small interface so it can be swapped. |
| 1.5 | **h3-js under Hermes.** h3-js is Emscripten output compiled to plain JS, not WebAssembly, which matters because Hermes has no WebAssembly. It should work, but nobody has checked here. Bundle size and speed are unknown. | Low | Include it in the spike: `latLngToCell` and `gridDisk` on a device under Hermes. Fallback: a simple rounded grid computed on the device (already listed in handoff §10). |
| 1.6 | **pmtiles under Hermes.** The `pmtiles` library decompresses tiles with `DecompressionStream`, which Hermes doesn't have, and reads with HTTP range requests through `fetch`. | Medium | Spike it: pass a custom decompressor (for example `fflate`), or skip range reads entirely (see 4.6). |
| 1.7 | **Test runners and decorators.** Vitest and esbuild don't emit decorator metadata, so Nest dependency injection breaks in tests without an SWC plugin. Expo apps are tested with the `jest-expo` preset. | Low | Use Jest everywhere: `jest-expo` for apps and `@swc/jest` for the services. One runner, one config style. |
| 1.8 | **iOS builds on Windows.** Damjan develops on Windows. Native ML means a development build, not Expo Go, and an iOS build needs a Mac or EAS cloud builds, which have free-tier limits. | Medium | Budget for EAS Build, or a cheap Mac mini on the home server shelf. Build Android locally. Decide this before the ML spike, because the spike needs both platforms. |

## 2. Expo web for the backoffice and the municipality app

| # | Risk | Severity | Recommendation |
|---|---|---|---|
| 2.1 | **Backoffice on Expo web.** It's mostly lists, an image viewer, approve and reject buttons, and caption CRUD. React Native Paper on web handles that. | Low | Fine as planned. |
| 2.2 | **Charts, maps and tables in the municipality app.** This is where Expo web is weakest. `maplibre-react-native` has no web target. React Native chart libraries are either SVG-based (slow with many points) or Skia-based (on web that loads CanvasKit WASM, a few MB). React Native has no serious data grid. | Medium | Keep the decision, but build the heavy screens with web libraries. Either use Expo DOM components (`'use dom'`) or `.web.tsx` files that use `maplibre-gl`, a normal web chart library and TanStack Table. The cost is two code paths if native builds ever come. Accept that, or decide now that the municipality app is web only. |
| 2.3 | **The public open-data page later.** It needs to be crawlable and cheap to serve. | Low | Generate it as a static export (Expo Router static rendering, or plain JSON/CSV files) from the published aggregates. It needs no live API. |

## 3. npm workspaces with Expo and Metro

| # | Risk | Severity | Recommendation |
|---|---|---|---|
| 3.1 | **Duplicate React or React Native copies** when two apps or packages resolve different versions. Metro then bundles two Reacts and hooks break. | Medium | Keep all three Expo apps on the same Expo SDK and upgrade them in lockstep. Put `react` and `react-native` in shared packages as peer dependencies only, and add an `overrides` entry in the root `package.json`. Expo 52+ configures Metro for monorepos automatically, so don't hand-edit `watchFolders` unless needed. |
| 3.2 | **npm workspaces has no `nohoist`.** If a native module needs to live in an app's own `node_modules`, npm can't express that. | Low | Probably fine with current Expo autolinking. If it bites, switching to pnpm is a small change. Don't add Nx or Turborepo, I agree with that call. |
| 3.3 | **Shared packages blur the privacy boundary.** One shared "types" package used by both services makes it easy to put a post field on an infra DTO. | Medium | No shared domain types between the main API and the infra service. Shared packages hold only UI and theme and generic utilities. Enforce it with an ESLint `no-restricted-imports` rule: the infra packages can't import main-API packages, and the reverse. |

## 4. Privacy-invariant risks in the topology

| # | Risk | Severity | Recommendation |
|---|---|---|---|
| 4.1 | **A shared HTTP client attaches the user's token to infra requests.** If the mobile app has one fetch wrapper or interceptor that adds `Authorization`, a device ID or an app-install ID header, infra events go out carrying the user's identity. One innocent-looking line of code breaks the main invariant. Likely, if there's one generated client package with a global auth middleware. | High | Two generated client packages, two client instances, no shared middleware. The infra client sends no auth, no cookies and no custom headers. Add a test that asserts the infra request headers contain nothing identifying. |
| 4.2 | **Shared reverse proxy, CDN or hosting edge logs IPs for both hosts.** Delayed batches don't help if one nginx (or the hosting provider's edge or Cloudflare) logs the same IP calling the main API and the infra endpoint. Then the logs link a user to their events. | High | Use a separate hostname for infra ingest, with `access_log off` and no IP in the error log format on that vhost. Ask the hosting provider what its edge or load balancer logs. Don't put a CDN in front of infra ingest. Note the IP problem in the data-protection review. |
| 4.3 | **"No IP logging" leaks at app level.** Nest request-logging middleware, Sentry and other error trackers (they record the client IP by default), APM agents and rate limiters (they key on IP) all keep IPs. | High | Infra service: no request logger, no third-party error tracking (or only with IP and headers stripped before sending), and no IP-keyed rate limiting. Do the same check for the mobile app's crash reporting: a crash SDK that records both API calls with one device ID links the two outputs. |
| 4.4 | **Municipal auth in the same infra service.** It mixes an anonymous, log-free write endpoint with authenticated logins, which want audit logs, IPs for brute-force protection and password resets by email. Sooner or later someone adds logging "for the login" and it covers ingest too. Thresholds are also enforced only by query discipline: one missing `HAVING` and raw events reach a dashboard. | High | Split it. (a) **Infra ingest:** write-only, anonymous, no logs, no reads. (b) **Aggregation job:** periodically computes thresholded aggregates into a separate `published_aggregates` schema. (c) **Municipal API:** municipal accounts and reads of `published_aggregates` only, with normal logging allowed. Its DB user has no grant on raw `infra_events`. The thresholds are then built into the structure, and the open-data export reads the same table. This can still be one repo and, early on, one host. |
| 4.5 | **Both databases on one MySQL server under one user.** A cross-database join is one query away, and the general log, slow log and backups mix both. | Medium | Separate DB users with no cross grants, at minimum. Better: separate MySQL instances (two containers are cheap). Separate backups. |
| 4.6 | **PMTiles range requests leak location.** The device fetches the z14 tiles around the user (handoff §3). Each request reveals a ~1.7 km area plus the IP, at about the time of a post. With logs off, it's still visible to the CDN or hosting edge. | Medium | Download the whole Ljubljana (later Slovenia) PMTiles file in one request when the app is installed or updated, not per location. A Ljubljana file with only the needed layers should be small (to be measured). This also removes the range-request and Hermes issues in 1.6. |
| 4.7 | **Content matching links the outputs.** Identifier separation doesn't stop the operator from joining by content: a post has `cell` + `category` + `flags` + `posted_on`, and an infra event has a feature inside that cell + `category` + `flags` + `month` + `hour_of_week`. In quiet areas the match is often unique. The topology can't fix this. It's a property of the data model. | Medium (High for honest public claims) | Don't claim "unlinkable" in the privacy policy. Claim "no shared identifiers, sent separately". Consider making the overlap smaller: for example, infra events don't carry post-style `flags` that can be derived from the feature anyway. Bring it to the data-protection review. |
| 4.8 | **Data poisoning of anonymous ingest.** `reporter_token` is derived on the device, so anyone can mint unlimited "reporter-days" and push a corner over the publish threshold. With no IP and no auth, there's nothing to rate-limit on. | Medium now, High once municipalities rely on it | Design it before the municipal pitch, not before release 1. Options, simplest first: per-token caps plus outlier review before publishing. Platform attestation (App Attest / Play Integrity) on the ingest call, after checking what identifiers it exposes. Blind-signed tokens issued by the main API per approved post: the strongest, but complex. |

## 5. Image storage and moderation

| # | Risk | Severity | Recommendation |
|---|---|---|---|
| 5.1 | **Blurred images on public static hosting before approval.** If an upload lands on a public path, pending and rejected posts, including ones with missed plates or faces, are reachable by URL. | High | Private object storage (S3-compatible: the hosting provider's, or MinIO). The backoffice sees pending images through short-lived signed URLs. Copy to the public path only on approval, and delete rejected images on a schedule. Use random, unguessable keys. Never local disk (izi-crawler lesson). |
| 5.2 | **No server-side safety net.** The device strips EXIF and blurs, but a modified client can upload anything. | Medium | The main API re-encodes every upload (this strips all metadata) and enforces size and format limits. The second detection pass from handoff §8 needs a worker that runs ML on the server. It isn't in the topology yet, so add it. |

## 6. Codegen

| # | Risk | Severity | Recommendation |
|---|---|---|---|
| 6.1 | izi-crawler needed a running API with a database and Java to generate the client. | Medium | Generate the spec in a script with `NestFactory.create(AppModule, { preview: true })` (no providers run, so no DB), or with a test module that stubs TypeORM. Commit `openapi.json`. CI regenerates it and fails on any diff. No Java: use `openapi-typescript` + `openapi-fetch`, or orval. |
| 6.2 | orval or openapi-typescript. | Low | Either works. `openapi-typescript` + `openapi-fetch` (+ `openapi-react-query`) generates types only, has a tiny runtime and clean middleware for auth and refresh. orval generates more code (React Query hooks, mocks), with more config to own. I lean to openapi-fetch. If you pick orval, put auth in a custom mutator per client, never in a global one (see 4.1). |
| 6.3 | The spec depends on the swagger CLI plugin, which is tied to the TS compiler version (1.1). | Medium | Covered by 1.1. Or write explicit `@ApiProperty` decorators and skip the plugin. |

## 7. Auth

| # | Risk | Severity | Recommendation |
|---|---|---|---|
| 7.1 | **Hand-rolled JWT again.** izi-crawler had auth context bugs and no refresh tokens. Auth is where self-made code costs the most. | High | Use a maintained library with sessions or refresh rotation built in. Candidates: Better Auth (TypeScript, has an Expo integration; check that it works with Nest 12), or a self-hosted OIDC provider (Zitadel, Authentik). Keycloak is too heavy for this size. Store tokens in `expo-secure-store`. Generated clients get auth through one middleware per client. |
| 7.2 | **Login method affects pseudonymity.** Google or Apple sign-in ties a real identity to the account. Apple requires Sign in with Apple when an app offers other social logins. | Medium | Product call for Damjan and `product-visionary`. Technically, email magic link or passkeys keep the fewest third-party links. |
| 7.3 | **Admin accounts in the backoffice see the most sensitive data:** pending images, who posted "anonymous" posts, takedown requests. | Medium | A separate admin role with MFA. Log admin actions (an audit log is already in handoff §8). No admin login on the mobile app's code path. |
| 7.4 | **Municipal accounts.** Few users, invite only. | Low | No sign-up flow at all: admin-created invites plus MFA. They live in the municipal API (4.4), not in infra ingest. |

## 8. Missing pieces

| # | What's missing | Severity | Recommendation |
|---|---|---|---|
| 8.1 | **Server-side jobs:** threshold aggregation (4.4), the moderation detection pass (5.2), cleanup of rejected images, takedowns, OSM `features` imports per `dataset_version`. | Medium | Start with `@nestjs/schedule` and a MySQL-backed job table. Add BullMQ (which needs Redis, one more service) only when the jobs outgrow cron. |
| 8.2 | **The delayed batch lives on the device, not on the server.** It needs a persistent local queue (SQLite or MMKV) and a send policy. iOS background tasks are unreliable. | Medium | Persist events locally, send on a later app open after a random delay, never in the same session window as the matching post upload, and mix several events per batch. Dedupe on the server by the event `id`. Write this policy down, because it's part of the privacy design. |
| 8.3 | **CI.** izi-crawler had none. | Medium | GitHub Actions from the first commit: install, lint, type check, Jest, `expo install --check`, spec regeneration diff (6.1), and a migration check (generate a migration and fail if it isn't empty). EAS builds on demand, not on every push (cost). |
| 8.4 | **Typed config, error handling, module structure** (izi-crawler lessons). | Low | `@nestjs/config` with a validated schema (zod or class-validator). One global exception filter. Feature modules from day one. TypeORM migrations, never `synchronize: true`. Use a development build, never Expo Go. |
| 8.5 | **Remote config and OTA updates for the caption pool** (handoff §6). | Low | EAS Update or a static JSON file. If it's a static JSON file, serve it from the main API host, not the infra host. |

---

## 9. Questions from `product-visionary`'s proposal

Source: `docs/product-visionary/2026-11-10-backoffice-and-municipality-app.md`. I cover only what affects the stack and topology.

### 9.1 Keeping the original photo on the phone until approval ("send back to fix blur")

**Verdict: feasible, with two conditions. Medium effort.**

- **Backups are the trap (High if missed).** Files in the app's document directory go into iCloud and Android Auto Backup by default. The original would then leave the phone, which breaks the "raw data stays on the device" invariant. Store the original in a folder excluded from backup: on iOS set the excluded-from-backup flag on that folder, and on Android exclude it from backup rules with a config plugin (or turn off `allowBackup`). Check whether `expo-file-system` exposes the iOS flag. If it doesn't, a tiny config plugin or native module is needed. The cache directory isn't backed up, but the OS can delete it at any time, which would make the feature randomly fail.
- **Store less.** Keep the original pixels with EXIF stripped, plus the blur boxes and the post ID. Snapping is already done, so GPS isn't needed again and isn't kept.
- **Lifecycle.** The app learns the post's status from the main API when it opens. It deletes the original on approve, on reject, or after a fixed TTL (for example 14 days). If the original is gone (deleted, app reinstalled, other device), "send back" falls back to reject plus retake. The backoffice should treat that as a normal outcome, not an error.
- **The fixed upload replaces the image on the same post** and puts it back in the queue. It must not trigger a second infra event.

### 9.2 Is suppression on every slice plus monthly refreshes enough against differencing?

**Verdict: no, not on its own. High for the credibility of the municipal data, Medium for privacy harm.**

- **Within one release:** if a row shows a total and only one of its slices is suppressed, total minus the visible slices gives the hidden number. This is the classic case where small-cell suppression needs secondary suppression. Flags are multi-valued (one report can have several), so slice sums don't add up neatly, but filter combinations ("A", "A or B") can still be subtracted from each other.
- **Across releases:** monthly refreshes don't stop differencing over time, they create it. A feature going from 12 to 13 shows exactly one report that month, and the proposal's "change against the previous period" column shows it directly. Together with the public feed (posts show `cell` + date + category), that single report can be pinned to a post, and the feature is more precise than the cell. This is the content-matching problem from 4.7, now visible to outsiders.
- **Recommendation, simplest first:**
  1. **Precomputed fixed slices only.** The aggregation job writes a small set of tables (per feature: total, by category, by flag, by month; per district and per municipality: the same). The API serves those tables as they are. It takes no free filter combinations. Filtering happens on the client over the published rows.
  2. **Round every published count** (reports and reporter-days), for example to the nearest 5 above the threshold, and show "fewer than 5" below it. Rounding kills most differencing, within a release and across releases, at almost no cost. Officials don't need exact counts to ask for bollards.
  3. **Compute the "change" column from rounded values only.**
  4. **An automated check in the aggregation job:** for every suppressed cell, check that it can't be derived from the totals in its row and column. Fail the release if it can. With rounding, this check rarely fires.
- Hour-of-week staying out of R1 is right. It's the most identifying dimension.

### 9.3 Keeping the dashboard login and read API apart from event intake

**Verdict: separate services. One service with separate ingress isn't enough.**

- **One process means shared middleware, logger configuration, error tracker and DB credentials.** One shared logger setting or one Sentry init exposes ingest. Ingest's DB user would be able to read the accounts, and the dashboard's DB user would be able to read raw `infra_events`. Separate ingress only fixes the proxy layer.
- **The split is cheap in a Nest monorepo:** two apps, two `main.ts` files, two containers, two hostnames. This matches 4.4:
  - `infra-ingest`: anonymous, no logs, DB user with `INSERT` on `infra_events` only.
  - Aggregation job (a scheduled CLI command): `SELECT` on `infra_events` and `features`, writes `published_aggregates`.
  - `municipal-api`: official accounts plus `SELECT` on `published_aggregates`. Its DB user has no grant on raw events.
- **No IP logging for dashboard logins** (proposal rule 5) is compatible with this. With magic links or one-time codes there's no password to brute-force, so rate-limit per email address and per municipality space instead of per IP.

### 9.4 Can the Ljubljana district boundaries (četrtne skupnosti) come from OSM?

**Verdict: not verified. Check before relying on it. Low risk either way.**

- I didn't check whether Ljubljana's 17 districts are mapped in OSM, under which tags (`boundary=administrative` with `admin_level=10`, or something else), or whether they're complete and current. Check with an exploration query on overpass-turbo (exploration is allowed). For example: `area[name="Ljubljana"][admin_level=8]->.a; rel(area.a)[boundary=administrative][admin_level~"9|10"]; out tags;`.
- **If OSM is incomplete,** the official sources are the City of Ljubljana's own spatial data and the national register of spatial units (GURS). Check their licence before use. Import it as its own versioned layer with its licence noted. Don't merge it silently into the ODbL features.
- **The phone doesn't need districts.** District is a server-side dimension: the aggregation job assigns each feature to a district with a spatial join. Keep the districts out of the PMTiles file, which keeps the download small (4.6) and keeps the licensing simpler.

### 9.5 Auth, updated for the proposal

The proposal implies **three separate auth realms**: Parkhole users (main API), admins (main API, separate table and guard), and officials (`municipal-api`). Use one library (7.1) in three separate configurations, with no shared secrets, session stores or cookies. Admin login never goes through the mobile app's code path.

- **Admins: mandatory two-factor auth. Agreed.** Prefer passkeys (WebAuthn works in the browser on Expo web) because they resist phishing. TOTP with recovery codes is the fallback. It covers the most sensitive data (pending images, who is behind anonymous posts).
- **Officials: magic link. Agreed, with one fix (Medium).** Municipal email often runs through Microsoft 365 with Safe Links or similar scanners. These open every link in an email before the user does, which uses up single-use magic links. Either make the link open a page with a "Sign in" button (the token is used up by the button, not by opening the page), or send a short one-time code by email instead. Make links short-lived and single-use. Magic links need an email-sending provider. That's a new external dependency, and it will see officials' email addresses, which is acceptable.

---

## 10. Hosting: everything on Damjan's Ubuntu server, MySQL 8

**Updated 2026-11-10:** Damjan dropped the Node.js + MariaDB hosting plan. Everything runs on his own Ubuntu server, and the database stays MySQL 8. The earlier MariaDB advice and the two-host split no longer apply. **Still open:** where the server sits (home or data centre) and whether it's used for production.

### 10.1 MySQL 8 notes

| Area | Note | Severity | Recommendation |
|---|---|---|---|
| Engine | Use one MySQL 8 version, pinned to an exact Docker image tag, in local docker-compose, staging and production. | Low | Generate migrations against that image only. The CI empty-migration check (8.3) uses it too. |
| JSON | MySQL 8 has a native JSON type, and mysql2 returns it parsed. | Low | Still don't query inside JSON. Model `flags` as a join table or boolean columns, which makes aggregation simpler. |
| Spatial (`features.geom`) | With SRID 4326, MySQL 8 uses lat/lng axis order in WKT and computes distances in metres. Code that assumes lng/lat gets swapped coordinates. | Low | Have the OSM pipeline precompute `municipality_code` and the district (9.4) per feature. Store `geom` only for drawing. Then aggregation is plain `GROUP BY`. If a spatial query is needed, add one test with a known Ljubljana point. |

### 10.2 One host: separating the main side and the infra side

**Verdict: workable, but one host is weaker than two.** The operator, the machine's root account and the hosting network see both sides. If the server is compromised, both sides are. Separation becomes a property of the containers and their config, so it has to be written down and tested, not assumed.

**What has to be true:**
- **Separate containers and networks.** The main side is `main-api`, `main-db` (its own MySQL 8 instance) and the detection worker (5.2). The infra side is `infra-ingest`, `infra-db` (its own MySQL 8 instance), the aggregation job and `municipal-api`. Put them on two Docker networks, so a main-side container can't reach `infra-db` and the reverse. Only the reverse proxy joins both.
- **Separate DB instances** (4.5), separate DB users with the grants from 9.3, separate volumes, and separate, separately encrypted backups.
- **Separate secrets.** Each side has its own env files or Docker secrets. No container gets the other side's credentials.
- **One reverse proxy, configured per vhost.**
  - The ingest hostname (and the PMTiles path) has `access_log off`, and its error log is lowered or discarded, because nginx writes the client IP into error lines.
  - The main API and the dashboard can log normally on their own vhosts.
  - The proxy container holds the only log that could link the two sides, so check its config in CI or with a test. One global `log_format` edit can quietly turn ingest logging back on.
- **No IP-seeing extras.** No fail2ban on the ingest vhost. No Cloudflare proxy or Cloudflare Tunnel in front of ingest. No error tracker or request logger in `infra-ingest` (4.3). Check that Docker's log driver and `journald` get nothing identifying from the infra containers.
- **Separate hostnames** for ingest, the main API, the dashboard and the tiles. Then the proxy rules stay per vhost, and moving the infra side to its own host later is a DNS change.
- **The detection worker** stays on the main side's network. It has no access to infra data.

**If the server is at home:** that's fine for development and staging. For production, the open questions are uptime, a dynamic IP, upload bandwidth, the ISP's terms of service and exposing the home network. For a production release, a VPS Damjan controls is safer, and a second small VPS just for the infra side would get back the two-host separation.

**Image storage:** MinIO in a container on the main side's network (5.1). Use a private bucket, with signed URLs for pending images. Copy an image to public storage only when the post is approved. Don't write images to local disk in the API container (izi-crawler lesson).

### 10.3 What runs where during development

| Piece | Damjan's Windows machine | Ubuntu server (staging, maybe production) |
|---|---|---|
| Main API, `infra-ingest`, `municipal-api` | Run natively with watch mode. File watching is faster than Docker volume mounts on Windows. | Containers with docker compose, split into the two networks (10.2). |
| Databases | docker-compose with **two** MySQL 8 containers (main and infra), same image tag as the server. | Two MySQL 8 containers, separate volumes and backups. |
| Image storage | MinIO container. | MinIO container on the main side's network. |
| PMTiles | A small nginx container serving the file with the production no-logs config. | Built by the tile pipeline on the server (Planetiler needs Java and a few GB of RAM for Slovenia), served by the reverse proxy with logs off. |
| Mobile app | Expo dev server plus a development build on a real phone over the local network. Android blocks plain HTTP by default: allow it only in debug builds, or use staging over HTTPS. | iOS builds still need EAS cloud or a Mac (1.8). |
| Backoffice and municipality app (Expo web) | `expo start --web`. | Static exports served by the reverse proxy: the backoffice on the main side, the municipality app next to `municipal-api`. Set CORS per API to its own client origin only. |
| CI | | GitHub Actions on GitHub's runners. Don't use a self-hosted runner on this server, because CI jobs would then run on the host that holds both sides. |

### 10.4 Questions for Damjan

1. Is the Ubuntu server at home or in a data centre?
2. Will it run production, or only development and staging? If production, would a second small VPS for the infra side be acceptable later?

---

## Alternatives summary

- TypeScript 6.x (or 5.x) instead of 7 until the tooling catches up.
- `npx expo install` instead of "latest" for anything React Native.
- Three infra parts (anonymous ingest, aggregation job, municipal API on published aggregates) instead of one infra service with logins in it.
- Two isolated generated clients instead of one shared one.
- A full PMTiles download instead of per-location range reads.
- Private object storage with copy-on-approve instead of public static images.
- An auth library instead of hand-rolled JWT.
- Web libraries inside the Expo municipality app (DOM components or `.web.tsx`) for the maps, charts and tables.
- Rounded counts and precomputed fixed slices instead of suppression alone with free filters.
- A sign-in button page or an emailed one-time code instead of a bare magic link.
- A folder excluded from backups for the kept original, with fallback to reject plus retake.
- Spatial work done in the OSM pipeline, instead of in database spatial functions.
- On the single Ubuntu host, separate containers, Docker networks, MySQL instances and secrets per side, and a reverse proxy with logging set per vhost. Later, a second small host for the infra side.

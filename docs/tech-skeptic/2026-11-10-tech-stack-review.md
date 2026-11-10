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

## 10. Hosting: Damjan's Ubuntu server and the Node.js + MariaDB hosting plan

**What I don't know yet, and it changes the answers:** what kind of plan the hosting plan is. It could be shared hosting with Node run behind the host's Apache (for example cPanel with Passenger) or a VPS. Other unknowns: whether access logs can be turned off, the MariaDB version, how many databases and users the plan allows, whether long-running processes, cron and Docker are allowed, outbound email, and disk quota. Also: where the Ubuntu server is (home connection or data centre). Questions for Damjan are at the end of this section.

### 10.1 MariaDB vs MySQL 8

**Verdict: target MariaDB everywhere, at the same major version as the hosting plan, including local docker-compose. Use TypeORM's `mariadb` driver type. Medium risk if you mix engines.**

| Area | Difference | Severity | Recommendation |
|---|---|---|---|
| Migrations | Migrations generated against MySQL 8 often fail on MariaDB. The classic case is MySQL 8's default collation `utf8mb4_0900_ai_ci`, which MariaDB doesn't have. Defaults and generated column details also differ. | Medium | Generate and run migrations only against the same MariaDB version as the host. Set charset and collation explicitly (`utf8mb4` with `utf8mb4_unicode_ci`, or a `uca1400` collation if the host's MariaDB is new enough). The empty-migration CI check (8.3) runs on that MariaDB image. |
| JSON | In MariaDB, `JSON` is an alias for `LONGTEXT` with a validity check. mysql2 returns it as a string, not a parsed object. TypeORM's `json` column type should parse it, but I haven't verified this on TypeORM 1.x. JSON indexing and functions differ between the engines. | Low | Don't query inside JSON. Model `flags` as a join table or fixed boolean columns, which also makes aggregation simpler. Keep JSON only for opaque blobs. Add one test that reads a JSON column back as an object. |
| Spatial (`features.geom`) | Both support `GEOMETRY` and spatial indexes in InnoDB. MySQL 8 knows coordinate systems: with SRID 4326 it uses lat/lng axis order and computes distances in metres. MariaDB treats the SRID as a label and computes in flat coordinates. Code or queries written for one engine give wrong results on the other: swapped coordinates, or distances in degrees. | Medium | Keep spatial work out of the database. The OSM pipeline already computes geometry. Have it precompute `municipality_code` and the district (9.4) per feature. Store `geom` only for drawing, as WKB or GeoJSON text. Then the engine difference doesn't matter, and the aggregation is plain `GROUP BY`. |
| Driver | mysql2 speaks the MySQL protocol, which MariaDB supports. Watch for authentication plugin differences on the host. | Low | Fine. Test the connection to the real hosted database early. |

### 10.2 Splitting the services across the two hosts

**Verdict: yes, put the infra side (ingest, infra DB, aggregation job, municipal API) on a different host from the main API. It makes the "never link" invariant stronger. It's a must, not a nice-to-have, if the hosting plan can't turn off its access logs.**

What a separate host fixes:
- No shared reverse proxy or hosting-edge logs. The hosting provider sees only main-API traffic, never infra events.
- No shared database server, so no cross-database join, mixed logs or mixed backups (4.5).
- Credentials stolen from one host can't read the other side's data.

What it doesn't fix:
- The operator runs both hosts and could log on both.
- Content matching (4.7).
- The phone's IP reaches both hosts. "No IP logging" must still be true on the infra host.

**Likely split:**

| Host | Runs | Why |
|---|---|---|
| Hosting plan | Main API, main MariaDB, blurred image storage, the backoffice's static web build | The main side needs reliable uptime and normal logging is allowed there. |
| Ubuntu server | `infra-ingest`, infra MariaDB, aggregation job, `municipal-api`, the municipality app's static web build, PMTiles, the OSM tile pipeline | Full control over nginx, logs and containers is needed for no-IP-logging. |

**What has to be true on the infra host:**
- **nginx:** `access_log off` on the ingest vhost. Also lower its error log level, or send it to `/dev/null`, because nginx writes the client IP into error lines. Use a separate hostname for ingest.
- **No log readers:** no fail2ban or similar tools on that vhost, because they read logs with IPs.
- **No IP-seeing middlebox:** no Cloudflare proxy or Cloudflare Tunnel in front of ingest. They're tempting for a home server, but Cloudflare sees and logs client IPs. Let's Encrypt certificates and a direct connection.
- **App:** no request logger, no error tracker, no IP-keyed rate limiting (4.3). Check that `journald` and Docker logs get nothing identifying from stdout.
- **Databases:** the infra MariaDB is its own container, with the DB users from 9.3.
- **PMTiles:** with the whole-file download (4.6), the request only shows that someone has the app, not where they are. Still, turn access logs off on that path. The municipality app's basemap uses range requests, but its users are officials, so their location isn't sensitive.
- **If the Ubuntu server is at home:** a residential connection brings uptime, dynamic IP, upload bandwidth and ISP terms of service to consider, and it exposes the home network. That's fine for development. For production, consider a small VPS that Damjan controls instead.

**One conflict to decide (Medium):** the server-side detection pass (5.2) runs ML on the main side's pending images. Shared hosting may not allow that much CPU or long-running workers. Moving the worker to the Ubuntu server would put main-side data on the infra host and weaken the split. If the hosting plan can't run it, keep it in a separate container on the Ubuntu server, with no access to infra data, and accept the weaker split for now. Or run it as a periodic job on another machine.

**Shared hosting limits to check (Medium):** Node behind the host's Apache usually means access logs you can't turn off. It may also mean no WebSockets, cron only, no Docker and a disk quota. Images would then live on local disk, so put storage behind an interface with a local-disk version for the hosting plan and an S3-compatible version for MinIO or real object storage later. Keep the image folder outside the web root. Pending images are served only through the API with backoffice auth (5.1).

### 10.3 What runs where during development

| Piece | Damjan's Windows machine | Ubuntu server (shared dev and staging) | Hosting plan |
|---|---|---|---|
| Main API, `infra-ingest`, `municipal-api` | Run natively with watch mode. File watching is faster than Docker volume mounts on Windows. | Staging containers with docker compose. | Production main API later. |
| Databases | docker-compose: **two** MariaDB containers (main and infra), same version as the host. | Staging copies. | Production main DB. |
| Image storage | MinIO container, or the local-disk storage version. | MinIO. | Local disk behind the storage interface. |
| PMTiles | A small nginx container that serves the file with the same no-logs config as production. | Tile pipeline (Planetiler needs Java and a few GB of RAM for Slovenia), plus the built file. | Not here. |
| Mobile app | Expo dev server plus a development build on a real phone over the local network. Android blocks plain HTTP by default: allow it only in debug builds, or use HTTPS on staging. | iOS builds still need EAS cloud or a Mac (1.8). | |
| Backoffice and municipality app (Expo web) | `expo start --web`. | Static exports for staging. | Production backoffice static build here. The municipality app goes next to `municipal-api`. Set CORS per API to its own client origin only. |
| CI | | GitHub Actions on GitHub's runners. A self-hosted runner on the Ubuntu server is possible, but then CI jobs run on the infra host, so keep it off production infra. | |

### 10.4 Questions for Damjan

1. Is the hosting plan shared hosting (Node behind the host's Apache, for example Passenger) or a VPS? Can access logs be turned off per path or domain?
2. Which MariaDB version does it run, and how many databases and users does the plan allow?
3. Does it allow long-running background processes, cron, outbound email (for magic links) and enough disk for images?
4. Is the Ubuntu server at home or in a data centre? Is it meant only for development and staging, or for production infra too?

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
- MariaDB everywhere at the host's version, instead of mixing MariaDB in production with MySQL 8 locally.
- Spatial work done in the OSM pipeline, instead of in database spatial functions.
- The infra side on a host Damjan controls, with the main side on the hosting plan.

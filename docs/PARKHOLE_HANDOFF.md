# Parkhole — Handoff

A silly social app for sharing photos of badly parked vehicles, with a second, serious output: anonymous, aggregated parking-hotspot data for municipalities.

- Repo: https://github.com/Stari89/parkhole (README and docs only; `src/` is empty, a fresh start). Agent/repo conventions: `CLAUDE.md` at the repo root.
- Tech stack and app topology: **not decided**.
- Sibling project: [izi-crawler](https://github.com/Stari89/izi-crawler) — on the back-burner. Its stack (Expo SDK 53 / RN 0.79, NestJS 10 + TypeORM + MySQL, OpenAPI codegen) is a candidate for Parkhole.

---

## 1. Product decisions

| Topic | Decision |
|---|---|
| Plates & faces | Auto-blurred on device, plus manual blur tool. Original never leaves the phone. |
| Plate tracking | **None.** No plate OCR, no hashes, no "find this car", no repeat-offender detection. |
| Location (public) | Coarse only: street name or municipality label + ~300–400 m grid cell. |
| Location (infrastructure) | Snapped on device to an OSM feature (crosswalk, segment, junction). Raw GPS never leaves the phone. |
| Time | Public: date only. Infrastructure: hour-of-week bucket + month. |
| Captions | No free text. Curated, pre-approved caption pool, auto-suggested by context. |
| Comments | None. Fixed emoji reactions only. |
| Authors | Pseudonyms by default + per-post "post anonymously". Always tied to an account internally. |
| Moderation | Pre-moderation at start (every post pending until approved). |
| Leaderboards | Spot of the month (by cell/label), hunter leaderboard, photo of the month, category trophies. Anonymous posts excluded from public leaderboards. |

---

## 2. Posting flow (on device)

1. Take photo.
2. Run detection (cars, plates, faces) on the **original**, locally.
3. Apply irreversible blur (solid box or heavy pixelation, burned into pixels). Strip EXIF.
4. User reviews blur: add/remove/resize areas. One-tap "plates & faces covered?" checklist.
5. Read GPS (+ `coords.accuracy`), snap to nearest infrastructure feature using local tile data.
6. Derive: category, flags, municipality, label, grid cell.
7. Suggest 3 captions from the curated pool (shuffle available).
8. Upload the **post** (blurred image + coarse data).
9. Queue the **infrastructure event** separately; send later in a delayed batch to a different endpoint.

The two outputs never share an identifier and leave the phone at different times.

---

## 3. Infrastructure snapping

**Infrastructure point** = a fixed OSM feature (crosswalk, bus stop, street segment between intersections, path/track junction). Many raw positions collapse into one value → less precise than GPS, more useful for cities.

### Snap rules (starting values, tune with real data)
- GPS accuracy > 30 m → no snap, coarse fallback.
- Point feature (crossing, bus stop, signals) within 15 m → use it.
- Else nearest street segment within 25 m.
- Else path/track junction, or coarse grid cell.
- Crosswalks exist both as `node[highway=crossing]` **and** `way[footway=crossing]` — handle both.
- Point near water polygon (~15–20 m) → `hazard_water` flag. If snap lands *in* water with poor accuracy → snap to nearest shore/path.

### Flags / categories seen in testing
- `parking_lot` (inside `amenity=parking`) → feed only, **excluded from municipal stats**, no infra event sent.
- `off_road` (paths, tracks, meadows) → still relevant to municipality (barrier, sign, designated parking).
- `hazard_water`, `near_school`, `on_crossing`, `bus_stop`, …

### Data pipeline (server side, occasional)
1. Download Slovenia extract (`slovenia-latest.osm.pbf`) from Geofabrik.
2. Generate vector tiles with only needed layers: segments, crossings, bus stops, signals, water, schools/kindergartens/hospitals, parking, municipality boundaries (`admin_level=8`). Tools: Planetiler or tippecanoe.
3. Pack into a single **PMTiles** file, host as static file (needs HTTP range requests; nginx/Apache do this by default).
4. Precompute human-readable descriptions for features ("Crosswalk at X × Y", "Path/track junction near Jezero").
5. Version every build (e.g. `2026-11`). Keep old versions or an old→new ID mapping.

### On device
- Tile ID from GPS (slippy z14, ~1.7 km wide here). Fetch the **3×3 block** around the user, cache aggressively.
- Decode with `@mapbox/vector-tile` + `pbf`, index in memory (e.g. `flatbush`), project to local meters, point-to-line distance.
- Street names come from the tile data — **do not** use platform reverse geocoding such as Expo `reverseGeocodeAsync` (sends coords to Google/Apple).

### Hosting
- Home Linux server: tile pipeline, dev/staging.
- Hosting deal: API, databases, PMTiles file. Disable access logs on the tile path.

---

## 4. Data model

### `parkhole_posts` (main DB)
```json
{
  "id": "post_…",
  "user_id": "usr_…",
  "image_key": "posts/….jpg",
  "caption": "Almost a boat",
  "category": "off_road",
  "flags": ["hazard_water"],
  "label": "Brezovica",
  "municipality_code": "SI-008",
  "cell": "891e…",
  "posted_on": "2026-11-10",
  "anonymous": false,
  "status": "pending_moderation"
}
```
- **No feature ID** on posts (too precise, would link to infra events).
- Label: street + municipality; municipality only in small villages / short streets.
- Brand/colour never stored as separate searchable fields.

### `infra_events` (separate DB, separate service, no IP logging)
```json
{
  "id": "evt_…",
  "feature_ref": "osm:node/4805658063",
  "dataset_version": "2026-11",
  "category": "off_road",
  "flags": ["hazard_water"],
  "municipality_code": "SI-008",
  "hour_of_week": "tue_14",
  "month": "2026-11",
  "reporter_token": "rt_…"
}
```
- `id`: random UUID generated on device, dedupe only.
- `reporter_token`: rotates daily, derived on device from local secret + date. Counts **reporter-days**, not people.
- No image, user ID, post ID, exact timestamp or raw coordinates.

### `features` (versioned OSM reference, server)
```sql
features (
  dataset_version, feature_ref, kind,
  geom GEOMETRY,          -- POINT or LINESTRING
  description, municipality_code
)
```

### Reconstructing location
- **App:** `cell` → area (`cellToBoundary` in H3, ~350 m). "Near me" = own cell + neighbours (`gridDisk`). Leaderboards = `GROUP BY cell` / label.
- **Infrastructure:** join `infra_events` → `features` on `(dataset_version, feature_ref)`. Location = the feature itself.

```sql
SELECT f.feature_ref, f.kind, f.description, f.geom,
       COUNT(*) AS reports,
       COUNT(DISTINCT e.reporter_token) AS reporter_days
FROM infra_events e
JOIN features f USING (dataset_version, feature_ref)
WHERE e.municipality_code = 'SI-008'
GROUP BY f.feature_ref, f.kind, f.description, f.geom
HAVING reporter_days >= 3;
```

---

## 5. Municipal data

- Aggregated statistics only: counts per feature/area, danger type, time buckets, trends. Never photos or individual posts.
- Publish thresholds: e.g. ≥5 reports from ≥3 reporter-days per feature.
- Grouped per municipality (`admin_level=8` — Ljubljana, Brezovica, …).
- Framing: **infrastructure, not enforcement** ("this corner needs bollards", not "send wardens"). Keep it a fun app, not a snitch app.
- State the bias: data shows where users walk, not where all problems are.
- Delivery: public dashboard / open dataset + periodic PDF per municipality.
- Route in Ljubljana: city councillors (svetniške pobude) and district councils (četrtne skupnosti). Parking is politically charged in Ljubljana — stay neutral, offer data across parties.
- Pitch only after a few months of real data.

---

## 6. Captions

- Generated **offline** with AI per context (category × flags × feature kind × time of day), 20–50 candidates each, SL + EN.
- Manually curated, shipped as JSON config, updated via remote config / over-the-air updates.
- Templates with safe slots only: `{municipality}`, feature kind, time of day, colour, body type. Never street.
- Brand/colour slots dropped when label falls back to municipality (small places).
- Community caption suggestions → approved into pool.
- No live per-post LLM captions (unreviewed output, cost, latency, privacy).

---

## 7. On-device ML

| Task | Choice |
|---|---|
| Car detection | COCO-pretrained detector (car class out of the box) |
| Plate detection | Same detector family, fine-tuned on a European plate dataset (check dataset licenses). **Detection only, no OCR.** |
| Face detection | Google ML Kit (on-device) |
| Colour | Dominant colour inside car bbox |
| Body type | Small classifier (hatchback/SUV/van/pickup) |
| Brand/model | Later, only if accuracy holds; never cloud APIs |

- Detector: **D-FINE** (Apache 2.0 code + weights, N ≈ 4M params, S ≈ 10M, NMS-free, ONNX export). Start with N, move to S if small/distant plates are missed. Alternative: RF-DETR (check variant license).
- Avoid: OpenALPR (unmaintained, AGPL, and does OCR), Ultralytics YOLO (AGPL), YOLOX (Apache but unmaintained since ~2022 — training env rot).
- Runtime: `onnxruntime-react-native` or TFLite via `react-native-fast-tflite`.
- Native ML runtimes need a custom native build (with Expo: a development build, not Expo Go).

---

## 8. Moderation & legal

- Pre-moderation queue; server-side second detection pass flags posts with visible plates/faces first.
- Admin web view: approve / reject with reason / send back to fix blur. Audit log.
- Report button on every post. Takedown form for car owners (GDPR), handled fast.
- Privacy policy: poster identity never revealed to car owners or users, only to authorities with a legal order.
- Later (with volume): post-moderation, AI flagging, trusted-user moderators.
- **OSM / ODbL:** credit "© OpenStreetMap contributors" in app and dashboard. Tiles are a derivative database → offer under ODbL (or the generating script). Keep Parkhole data separate (collective database). Check OSMF guidelines before publishing merged municipal datasets.
- Don't build on public Overpass / OSRM / Valhalla / Nominatim / tile.openstreetmap.org servers — usage policies forbid app backends. Use them only for exploration.
- Get a proper data-protection review before going public.

---

## 9. MVP scope

1. Mobile app: camera → detection → blur review → category + caption pick → export meme image (useful with zero users).
2. Local snapping with Ljubljana tiles; infra events queued and batched.
3. API: posts, pre-moderation, admin view, reports, takedowns.
4. Friends-group feed + reactions + spot/photo of the month.

**Later:** public feed, municipal dashboard, brand detection, tiling beyond Ljubljana, post-moderation.

---

## 10. Open items

- Exact snap thresholds — tune on real photos.
- Plate dataset choice (European plates, license).
- Grid cell: H3 res 9 (check `h3-js` under Hermes) vs simple rounded grid.
- Rule for "small place" label fallback (segments / buildings per street).
- Municipal-side resolution: street segment + category vs coarser.
- Tech stack and app topology: not decided. izi-crawler's stack is a candidate. `src/` is empty until this is settled.
- Repo setup for agents: `CLAUDE.md` at the repo root, done. Still open: tests from day one, once there is code.

---

## Useful exploration query (overpass-turbo.eu)

```
[out:json][timeout:25];

{{lat=46.038156}}
{{lon=14.479863}}

(
  node(around:25,{{lat}},{{lon}})[highway~"^(crossing|bus_stop|traffic_signals|give_way|stop)$"];
  way(around:25,{{lat}},{{lon}})[footway=crossing];
  way(around:30,{{lat}},{{lon}})[highway];
  nwr(around:30,{{lat}},{{lon}})[amenity=parking];
  way(around:100,{{lat}},{{lon}})[highway][name];
  nwr(around:100,{{lat}},{{lon}})[amenity~"^(school|kindergarten|hospital|clinic)$"];
  nwr(around:30,{{lat}},{{lon}})[natural=water];
  way(around:30,{{lat}},{{lon}})[waterway];
);
out geom;

is_in({{lat}},{{lon}})->.a;
area.a[boundary=administrative][admin_level=8];
out tags;
```

Test cases:
- `46.038156, 14.479863` — Hofer parking lot → `parking_lot`, zebra crossing at exit ~25 m.
- `45.968545, 14.431496` — near lake Jezero (Brezovica) → `off_road`, `hazard_water`, path/track junction.

# Backoffice and municipality app: product proposal

**Date:** 2026-11-10
**Author:** `product-visionary`
**Status:** this whole document is a **proposal** for Damjan to decide. Only the items under "Already decided" are decisions.

## Already decided (2026-11-10, from Damjan)

- Parkhole has three Expo clients: the mobile app, a backoffice and a municipality app. The backoffice and the municipality app are web first. Native builds may come later.
- The backoffice handles moderation and the curated caption pool. It talks only to the main API and never sees infra events.
- The municipality app is a dashboard that officials log in to. A public open-data page may come later. It reads only aggregated infra-event stats that passed the publish thresholds. Its accounts are separate from Parkhole user accounts and live on the infra-events side.
- Fun first. The municipal side is groundwork, not the headline.

Everything below is a proposal.

---

## 1. Backoffice MVP

Release 1 can't ship without it, because every post starts as `pending_moderation`. If the queue is slow, the fun app feels broken. So the backoffice is built for moderation speed first.

### Release 1 screens and actions

| Screen | What it does | Notes |
|---|---|---|
| **Login** | Admin accounts only, created by hand. Two-factor authentication is mandatory. | Admin accounts are not Parkhole user accounts. R1 has one role: `admin`. |
| **Moderation queue** | The oldest pending post comes first. Posts that the server's second detection pass flagged (possible visible plate or face) jump to the top. | Shows the blurred image, caption, category, flags, label, `posted_on` (date only), the author's pseudonym and their strike count. No map pin finer than the `cell`. |
| **Actions in the queue** | **Approve**. **Reject**, with a fixed reason code (plate visible, face visible, not a parking photo, offensive, other). **Send back to fix blur**. Keyboard shortcuts for all three. | Reason codes, not free text, so the app can show the user a translated message. |
| **Reports queue** | Approved posts that users reported with the report button. Report reasons are fixed codes. Actions: keep, hide, remove. | Hidden posts can be restored. Removed posts are gone. |
| **Post lookup** | Find a post by its ID or share link. Remove it with the reason "takedown". | This covers GDPR takedown requests from car owners. In R1 the request itself can arrive by email or a simple fixed form. The backoffice only needs the fast lookup and remove. |
| **Account actions** | From a post: add a strike, suspend posting for N days, or ban the account. | No device fingerprinting and no IP bans. Ban evasion is accepted as a cost of the privacy stance. |
| **Caption pool** | Browse captions by context (category × flags × feature kind × time of day) and language (SL, EN). Add, edit or retire a caption. Import a batch of AI-generated candidates as `draft`, then approve them one by one. Publish a new pool version to remote config. | Templates may use only the safe slots from the handoff (`{municipality}`, feature kind, time of day, colour, body type). The editor rejects any other slot, so a street name can't slip in. |
| **Audit log** | Every moderation, report, takedown, account and caption action, with the admin and the date. | Read-only screen. |

### Privacy notes for the backoffice

- It uses the main API only. It has no screen, filter or export that touches `infra_events` or `features`. It also shows no OSM feature, even though the API could derive one from the cell. This follows the "two outputs never link" invariant.
- **Anonymous posts:** a moderator sees "anonymous" plus the strike count, not the account. Strikes and bans still apply to the account behind it. Revealing the account behind a post is a separate, logged action, reserved for legal orders. (Proposal. It goes a little further than the handoff, which only says posts are tied to an account internally.)
- Pending images are reachable only through the authenticated backoffice. They get a public URL only after approval.

### Can wait

- Roles (moderator vs. admin), trusted-user moderators, post-moderation, AI flagging (all in the handoff's "later" list).
- Stats for the team (posts per day, approval rate, time in queue).
- Community caption suggestions. They count as user-generated text, so they need their own review flow.
- Manual picks or overrides for spot of the month and photo of the month. R1 computes them automatically.
- A self-service takedown portal.

### Open question for `tech-skeptic`

- **"Send back to fix blur" only works if the phone still has the original photo.** The original never leaves the device, so the app has to keep it locally until the post is approved, and then delete it (or keep it under a user setting). If that's too fragile, R1 drops the action and offers reject plus "retake" instead.

---

## 2. Municipality app MVP

### Who uses it

In Ljubljana the route into the city is city councillors (svetniške pobude) and the district councils (četrtne skupnosti), plus city traffic staff. What they need is **evidence they can paste into a proposal**: "this crossing gets parked on, repeatedly, by many different people; it needs bollards." They don't need live data or individual cases.

### Release 1 screens

| Screen | Contents |
|---|---|
| **Hotspot map** | Every feature that passed the thresholds, drawn on the self-hosted PMTiles basemap. Points are crossings and bus stops; lines are street segments. Colour or size shows the report count. Click a feature to open its detail page. |
| **Rankings** | A table of the top features by reports. Columns: description ("Crosswalk at X × Y"), kind, reports, reporter-days, main category, change against the previous period. Sortable. |
| **Feature detail** | Totals, the split by category and flag, and a monthly trend. No photos, no posts and no per-report rows. |
| **Trends** | Monthly totals for the municipality, by category. |
| **Filters** | Category and flag (`on_crossing`, `bus_stop`, `near_school`, `off_road`, `hazard_water`), a month range, and the district (četrtna skupnost) where boundary data exists. |
| **Export** | CSV and GeoJSON of exactly what's on screen (the same thresholded aggregates). Each export includes the dataset version, the "© OpenStreetMap contributors" credit, the licence note and the bias statement. |
| **Methodology** | One page: what a report and a reporter-day are, the thresholds, the update rhythm, and the bias ("this shows where Parkhole users walk, not where all the problems are"). The framing is infrastructure, not enforcement. |

Updates are **monthly**. A visible "data as of 2026-11" label sets expectations, and the slow rhythm supports privacy (see below).

### Privacy rules this needs (please review, `tech-skeptic`)

The invariant says "≥5 reports from ≥3 reporter-days per feature". A dashboard with filters can quietly break that, so I propose these rules:

1. **The threshold applies to every number the server returns, not only to each feature's total.** If a feature passes overall but "near_school in March" has 2 reports, that cell shows "fewer than 5", not "2". This applies to the map, the rankings, the trends and the exports alike.
2. **Coarse filters only.** Months, not weeks. Hour-of-week stays out of R1. If it comes later, it comes as a few broad bands (weekday daytime, evening, night, weekend), only at municipality or district level, and only where the threshold holds.
3. **Watch for differencing.** If "all categories" minus "everything except X" gives a number below the threshold, that number has leaked. The simplest defence is the monthly refresh plus suppression of small numbers in the slices too. `tech-skeptic` should decide whether that's enough.
4. **The municipality app reads only a precomputed table of published aggregates**, rebuilt monthly. It never queries `infra_events` directly. This makes rules 1 to 3 enforceable in one place, and it means the public page later can use the same data.
5. **Separate from ingest.** Accounts live on the infra-events side, but the dashboard login and API shouldn't share a process or logs with the endpoint the phones send events to. The no-IP-logging rule also applies to dashboard logins.
6. **Dataset versions.** Features change between OSM builds. The dashboard shows current-version features and carries counts over through the old→new ID mapping. A feature that disappears from OSM drops off the map instead of being guessed.

### Accounts: invite-only (proposal)

- The Parkhole team creates a **municipality space** (`municipality_code`, for example Ljubljana) and invites officials by email. No self sign-up.
- Login by email magic link. The data is aggregated and will partly become open data anyway, so no heavier login is needed. Optional two-factor authentication comes later.
- In R1 each account sees **only its own municipality**. This is simpler and politically cleaner. Read-only, so there is one role.
- **Stay neutral across parties.** If councillors from one party get access, offer it to all of them and to every district council.
- An official may also be a Parkhole user. The two accounts are never linked, and nothing suggests linking them.

### What would make a municipality actually use it

1. **A monthly one-page report per district**, ready to attach to a councillor's proposal: the top 10 features, the trend, and a map snippet. In R1 this can be a printable page (browser "print to PDF"), not generated PDFs. I think this matters more than the interactive map.
2. **Data that is ready to act on:** feature descriptions officials recognise ("Crosswalk at Celovška × Tivolska") instead of grid cells, and the main category per feature.
3. **Credibility:** the methodology page, the bias statement, and the counting of reporter-days so one zealous user can't create a hotspot.
4. **No cost, no integration:** CSV and GeoJSON open straight in Excel and QGIS.
5. **Showing up with data, not asking for it.** Following the handoff: pitch only after a few months of real data. **Proposal:** build the app first as an internal preview that only the Parkhole team uses, to check whether the data is interesting. Invite officials after about 3 months of data, once a meaningful number of Ljubljana features pass the threshold.

### Can wait

- The public open-data page (see section 3).
- Generated PDF reports and scheduled emails.
- Municipalities other than Ljubljana. The data model supports them from day one.
- Hour-of-week patterns (only in coarse bands, as above).
- Comparisons between municipalities.
- An API for the city's own GIS.
- **"Marked as addressed":** an official marks a feature as fixed (for example "bollards installed, 2027-05"), and the dashboard shows the before/after trend. This is the strongest long-term hook for the city. It's also a possible fun-first crossover: the mobile app could celebrate "the city fixed this spot". That crossover moves public information from the infra side to the main side, so it needs its own privacy review before anyone builds it. It must never be tied to posts.
- Native builds.

---

## 3. Public open-data page: later, not release 1

**My recommendation:** later. I'd revisit it once all of these hold:

- at least 3 months of real data, with the thresholds tuned on it;
- the data-protection review from the handoff is done;
- the OSMF guidelines on publishing merged datasets are checked (ODbL: Parkhole counts plus OSM features);
- officials in Ljubljana have seen the data first.

**Why**

- **Fun first.** A public civic data page early on pulls the brand towards "snitch app". The mobile app needs to win people over first.
- **Politics.** Parking is politically charged in Ljubljana. Publishing before officials have seen the data can feel like an ambush and burn the route through the councils.
- **Thin data.** In the early months, only a handful of features pass the threshold. A nearly empty public map looks worse than no map.
- **Low cost to add later.** If the municipality app reads only the published aggregates table (rule 4 above), the public page is a no-login, read-only view of the same data. It might use a stricter threshold. It adds almost no new privacy surface, so waiting costs little.

---

## Summary of decisions needed from Damjan

1. Backoffice R1 scope as above, including the reports queue, post lookup for takedowns, account strikes and bans, and the audit log.
2. Moderators see "anonymous" instead of the account for anonymous posts, and revealing the account is a separate, logged action.
3. Keep or drop "send back to fix blur" (depends on keeping the original on the phone until approval).
4. Municipality app R1 scope as above, with monthly updates, and no hour-of-week in R1.
5. Thresholds apply to every returned number (including filtered slices), and the app reads only a precomputed published-aggregates table.
6. Invite-only accounts scoped to one municipality, with magic-link login.
7. Build the municipality app as an internal preview first, and invite officials after about 3 months of data.
8. The public open-data page comes later, against the criteria in section 3.

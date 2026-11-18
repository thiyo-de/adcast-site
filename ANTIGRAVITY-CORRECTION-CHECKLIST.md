# AdCast / HornyLeaks correction checklist

Prepared: 18 November 2026. Workspace: `D:\Thiyo\Website AdSense`.

## Instructions for Antigravity

Implement the corrections below in dependency order. Preserve the current design, branding, content records, and working top banner. This is a correction task, not a redesign or framework migration. Read the current files before editing: the evidence below describes the reviewed version, and subsequent changes may already address some items.

- [ ] Record the initial Git diff and preserve all existing user changes.
- [ ] Complete each phase with focused verification before proceeding.
- [ ] Update this checklist as work progresses; mark an item complete only with evidence.
- [ ] Keep credentials out of browser bundles, logs, screenshots, commits, and documentation.
- [ ] Use isolated fixtures/staging for destructive and failure tests. Do not test deletes against real content or submit fake production removal requests.
- [ ] Report code changes, applied database changes, deployment, browser verification, and ad delivery separately. A successful build proves none of the latter four.
- [ ] If external access is missing, finish the local implementation and provide exact remaining steps. Do not claim the remote issue is fixed.

### Verified starting point

- React/Vite/Tailwind frontend, Supabase data layer, separate Node import engine, GitHub Actions automation.
- The user confirmed the top banner works after the class correction.
- Existing changes in `src/services/store.js` correct `eas6a9788e2` to `eas6a97888e2`, including previously saved settings. Preserve both changes.
- Earlier checks: frontend build passed; all 10 engine JavaScript files passed syntax checks. These checks must be repeated after relevant changes.
- Browser inspection was unavailable during the review. Actual delivery, mobile behavior, live RLS, and account-side zone status remain unverified.
- Both documented public domains previously served an older build. This was observed before the user's confirmation that the banner works; recheck, do not assume the mismatch still exists.

## Phase 1 — Identity, permissions, and schema

### C01 — Replace browser-only admin authentication [critical]

Files: `src/pages/Admin.jsx`, `src/services/store.js`, `src/services/supabase.js`, `supabase-schema.sql`.

Problem: hardcoded passwords and a session-storage flag protect the screen, while the supplied SQL permits unrestricted table operations.

- [ ] Replace the hardcoded login with Supabase Auth and an explicit administrator role/allowlist controlled by a trusted backend/database administrator.
- [ ] Do not use user-editable profile metadata, localStorage, or sessionStorage as authorization.
- [ ] Implement session restoration, logout, expiration handling, pending login state, and actionable login errors. Remove displayed default passwords.
- [ ] Restrict video/ad/source mutations, takedown reads/updates, and sync triggering to authorized admins at the database/server boundary.
- [ ] Keep public reads limited to active videos and deliberately public ad configuration. Permit only validated public takedown submissions; never public claimant-data reads.
- [ ] Remove the existing permissive policies explicitly. Adding restrictive policies alongside permissive ones is not a sufficient fix.
- [ ] Document safe first-admin provisioning and verify authorized access before retiring the old access path.

Acceptance:

- [ ] Anonymous and authenticated non-admin API clients cannot mutate protected tables or read takedown submissions.
- [ ] Editing browser storage does not grant admin privileges.
- [ ] An authorized admin can perform permitted operations and loses access after logout.
- [ ] Validate deployed RLS separately; identify whether only migration files or the actual database were changed.

### C02 — Make the database reproducible [high]

Files: `supabase-schema.sql`, new versioned migrations, data service, engine database layer.

- [ ] Add the missing `crawler_sources` table with fields actually used by the UI/engine, including parser configuration for supported source types.
- [ ] Add missing video fields such as `is_active`, `dead_reason`, `quality`, and `rating`, using truthful defaults/nullability.
- [ ] Define one duration representation and support it consistently; do not add conflicting duration fields without a conversion rule.
- [ ] Add storage for ad-specific options such as VAST URL and frequency settings; define validated columns or a documented JSON configuration contract.
- [ ] Add indexes for actual catalog/source/status queries and a database uniqueness strategy for normalized embed URLs.
- [ ] Audit existing duplicates before a unique constraint. Prepare a reconciliation plan that preserves referenced IDs/bookmarks; do not silently delete duplicates.
- [ ] Make fresh setup and migrations repeatable, non-destructive, and compatible with existing records. Keep demo seeds explicitly separate from production setup.

Acceptance:

- [ ] A fresh database supports all current queries and writes.
- [ ] An existing database can be upgraded without losing content or admin access.
- [ ] Running supported migrations again does not duplicate seed data or fail on already-created policies.

## Phase 2 — Consistent data and honest operation results

### C03 — Unify cloud catalog and client features [high]

Files: `src/services/supabase.js`, `src/services/store.js`, `src/App.jsx`, `src/pages/Watch.jsx`, `src/components/BookmarksDrawer.jsx`.

- [ ] Establish one authoritative catalog in application state/cache. Feed bookmarks and recommendations from that catalog or fetch missing bookmarked IDs.
- [ ] Preserve database-generated IDs across create/edit/delete; do not create unrelated local and cloud IDs for the same record.
- [ ] Remove automatic sample-video fallback on database errors and valid empty results. Render distinct loading, empty, offline, and failed states.
- [ ] If keeping a cached catalog, distinguish stale data from successfully loaded data and ensure quarantined/deleted entries are reconciled.
- [ ] Fetch catalog pages explicitly so behavior does not depend on the API's default row limit.
- [ ] Keep bookmarks browser-local if desired, but resolve their metadata from real records and handle removed videos clearly.
- [ ] Define likes/views honestly: either local preferences clearly separated from public metrics, or server-validated aggregate events. Do not expose unrestricted counter updates.

Acceptance:

- [ ] A cloud-only video can be saved, appears in bookmarks after reload, and participates in related videos.
- [ ] Liking it does not reset its displayed count to zero.
- [ ] Empty/error responses never display unrelated sample videos.
- [ ] Deleting/quarantining a record removes it from public browsing and handles old bookmarks gracefully.

### C04 — Stop reporting failed operations as successful [high]

Files: `src/services/supabase.js`, `src/pages/Admin.jsx`, `src/pages/DMCA.jsx`, `src/App.jsx`.

- [ ] Check returned Supabase errors for every query/mutation; use a consistent throw/result contract.
- [ ] Update local state only after confirmed writes, or implement explicit optimistic rollback.
- [ ] Catch errors at each UI action; show useful messages and retry paths. Reset loading state in `finally`.
- [ ] Disable duplicate submissions while pending; keep forms open and retain inputs when saving fails.
- [ ] Treat affected-row absence as a possible failure for update/delete, rather than automatic success.
- [ ] Recreate/reset the cached Supabase client when its URL/key changes, or remove runtime switching if it is unnecessary. Never accept a service-role key into browser settings.

Acceptance:

- [ ] Simulated permission denial, network failure, invalid schema, and zero-row updates produce visible failure instead of success.
- [ ] A failed save leaves no phantom local record and no stuck spinner.

### C05 — Complete the removal-request workflow [high]

Files: `src/pages/DMCA.jsx`, `src/pages/Admin.jsx`, data service, database policies.

- [ ] Read and resolve requests from Supabase in Admin instead of the current browser's localStorage.
- [ ] Resolve reported video metadata using the shared catalog/API and real video URLs.
- [ ] Persist request status and show confirmed results. Clearly distinguish resolving a request from actually removing/quarantining its video.
- [ ] Validate inputs and provide server-side abuse controls for the public submission path.
- [ ] Avoid storing claimant details unnecessarily in browser storage.

Acceptance:

- [ ] A staging request submitted from one browser appears to an authorized admin in another.
- [ ] Its status persists after reload; public clients cannot retrieve claimant details.

## Phase 3 — Advertising

### C06 — Make ad settings shared, persistent, and reactive [high]

Files: `src/services/store.js`, `src/services/supabase.js`, `src/App.jsx`, `src/components/AdSlot.jsx`, `StickyFooter.jsx`, `VideoPlayer.jsx`, `src/pages/Admin.jsx`.

- [ ] Load authoritative cloud ad settings for public visitors, not just inside Admin. Use shared reactive state/context or an equivalent clear subscription.
- [ ] Preserve deliberate disabled states, custom valid zone IDs, all format-specific settings, and affiliate settings through save/reload.
- [ ] Replace unconditional hardcoded-zone reset logic with versioned, targeted migrations. Preserve the confirmed top-banner typo repair.
- [ ] Define behavior while settings load or fail; do not silently re-enable a disabled placement using stale/default configuration.
- [ ] Show unavailable/no-fill/blocked states truthfully. A local fallback promotion must not be presented as evidence of an ExoClick impression.

Acceptance:

- [ ] An authorized change is seen by a fresh visitor on another device.
- [ ] Disabling a slot survives reload; custom IDs and VAST options round-trip unchanged.
- [ ] The working top banner continues to use `eas6a97888e2`.

### C07 — Control all ad scripts through one lifecycle [high]

Files: `index.html`, `src/components/PopunderTrigger.jsx`, `AdSlot.jsx`, `StickyFooter.jsx`, ad settings.

- [ ] Move unconditional popunder/interstitial startup into the controlled ad system. Add an interstitial setting if it remains a supported placement.
- [ ] Load the provider once where supported, then register placements after their containers exist. Handle SPA mounts/unmounts and React StrictMode without duplicate initialization.
- [ ] Implement cleanup using supported provider mechanisms. Removing a script element alone does not remove listeners it already installed; document reload requirements if teardown is unsupported.
- [ ] Respect slot enabled state and the site's entry/consent state before starting optional scripts.
- [ ] Reconcile the conflicting 1-hour/24-hour popunder rules. Suggested default: retain the original 24-hour policy unless the owner specifies otherwise; use one explicit configurable policy.
- [ ] Do not record a successful pop solely because an unrelated click occurred. Separate eligibility, attempt, and confirmed delivery where observable.
- [ ] Reset ad-block/failure state when configuration changes; handle empty delivery without permanently reserving misleading blank space.
- [ ] Check banner sizing at narrow widths and sticky overlap/close controls. Home currently contains the top banner; Watch does not. Do not add extra placements without an explicit layout decision.

Acceptance:

- [ ] Disabled popunder/interstitial configurations make no corresponding startup request on a fresh load.
- [ ] Navigating repeatedly does not accumulate listeners, duplicate banners, or extra pop attempts.
- [ ] Test 360/390px and desktop widths without clipped controls or unusable player space.

### C08 — Harden preroll loading and measurement [high]

Files: `src/utils/vast.js`, `src/components/VideoPlayer.jsx`.

- [ ] Prefer a maintained player/ad integration supporting the required provider formats, or implement and document a bounded supported VAST subset.
- [ ] Parse XML structurally; handle namespaces, whitespace, entities, multiple media candidates, wrappers, and malformed documents.
- [ ] Apply a total timeout, wrapper-depth limit, loop detection, and cancellation on video change/unmount.
- [ ] Start content promptly on no-fill, CORS/network failure, unsupported media, or ad playback failure.
- [ ] Trigger impressions and supported start/quartile/complete/skip/error/click tracking at actual events. Preserve required wrapper tracking and prevent duplicates.
- [ ] Use the supported skip offset and playback progress, not an unconditional wall-clock five-second timer.
- [ ] Keep click-through destinations distinct from tracking endpoints and the VAST XML URL.
- [ ] Check direct MP4 and iframe playback after preroll; verify intended HLS/browser support rather than assuming `.m3u8` works everywhere.

Acceptance:

- [ ] Fixture tests cover inline VAST, wrappers, multiple tracking URLs, malformed XML, timeout, no-fill, skip, completion, and switching videos mid-request.
- [ ] A failed advertisement never traps the viewer before content.
- [ ] No automated clicks or repeated live impression generation to test revenue; use fixtures/provider test facilities.

### Ad inventory to verify, not replace blindly

| Placement | Intended local zone | Earlier deployed default |
|---|---|---|
| Top banner | `6093488` | Placeholder; user later confirmed the correction works |
| Native feed | `6093504` | Placeholder |
| Sticky footer | `6093426` | `6091570` |
| Below-player | `6093362` | Placeholder |
| Preroll | `6093414` | `6091580` |
| Popunder | `6093374` | Skipped placeholder |
| Interstitial | `6093518` | Integration absent |

- [ ] Recheck current published assets, approved domains, zone format/status, and visitor configuration. IDs in source are not proof of provider approval or delivery.
- [ ] Report each slot as configured / request observed / creative rendered / provider reporting verified, with unverified levels left open.

## Phase 4 — Navigation and accurate presentation

### C09 — Give videos real, durable URLs [high]

Files: `src/App.jsx`, `src/pages/Watch.jsx`, `DMCA.jsx`, `src/utils/seo.js`, hosting configuration.

- [ ] Implement `/watch/:id`, `/admin`, `/dmca`, `/terms`, `/privacy`, and home navigation with browser history support.
- [ ] Open the correct record on a direct URL/reload. Support Back/Forward and a genuine not-found state instead of falling back to the first video.
- [ ] Copy the selected video's canonical URL; await clipboard completion and show actual failure if copying fails.
- [ ] Configure host rewrites for SPA routes without rewriting missing static assets to HTML.
- [ ] Keep metadata/canonical URLs consistent; remove stale video metadata when leaving Watch. Do not claim social preview support from client-only meta updates without verifying it.

Acceptance:

- [ ] A copied link opens the same video in a new browser; reload and Back/Forward work.
- [ ] Unknown/deleted IDs show unavailable/not-found, never a different video.

### C10 — Remove invented metrics and repair duration filtering [medium]

Files: `adcast-sync-engine/src/utils/normalizer.js`, `src/services/store.js`, `src/pages/Home.jsx`, `Watch.jsx`, `src/utils/seo.js`.

- [ ] Remove random fallback views and inferred likes. Use unknown or zero with a documented meaning.
- [ ] Distinguish imported source-platform statistics from engagement measured on this site.
- [ ] Audit existing synthetic data without blindly resetting genuine imported counts; document any uncertain records and migration approach.
- [ ] Remove unsupported default quality/rating/view claims in cards, player, and structured metadata.
- [ ] Normalize seconds, `MM:SS`, and `HH:MM:SS` consistently; derive filters and schema duration from the actual value.

Acceptance:

- [ ] Missing statistics never create fabricated popularity.
- [ ] Short, medium, long, hour-length, and unknown durations filter/display correctly.

### C11 — Make watch history truthful [medium]

Files: `src/components/VideoPlayer.jsx`, `src/services/store.js`, `src/pages/Home.jsx`.

- [ ] Replace fixed 25% history with throttled actual playback position for controllable players.
- [ ] Store progress on appropriate playback/page lifecycle events; bound storage and validate duration/position.
- [ ] Resume direct video at a valid saved position after metadata loads.
- [ ] For third-party iframes without a supported player API, show “Recently watched” without invented progress or a resume promise.

Acceptance:

- [ ] A direct video resumes near its last position; completed videos behave sensibly.
- [ ] Iframe history remains useful without pretending to know playback position.

## Phase 5 — Import and health-check reliability

### C12 — Replace the simulated Sync button [high]

Files: `src/pages/Admin.jsx`, data service, `.github/workflows/auto-sync.yml`, new trusted server endpoint/queue if needed.

- [ ] Replace timer-based “queued” messages with a real authenticated request to a server-controlled job trigger.
- [ ] Keep GitHub/service-role credentials on the server. Verify admin authorization on every trigger; rate-limit and prevent duplicate jobs.
- [ ] Preserve source-specific selection where offered. Return a real job/run ID and expose queued/running/completed/failed status.
- [ ] If triggering is unconfigured, show unavailable with setup instructions; never claim a job started.

Acceptance:

- [ ] A staging click creates one observable job; unauthorized requests are rejected.
- [ ] Job failure and unavailable configuration are visible to Admin.

### C13 — Respect disabled sources and guarantee deduplication [high]

Files: `adcast-sync-engine/src/db.js`, `config.js`, `index.js`, `sources.json`, migrations.

- [ ] Treat a successful empty enabled-source result as “nothing to run.” Do not revive JSON sources when every database source is disabled.
- [ ] Make file-based source mode explicit; database read failures must not silently trigger a different import plan.
- [ ] Reject unsupported source types instead of defaulting to a different scraper.
- [ ] Deduplicate within a batch and use the database constraint to handle concurrent imports safely.
- [ ] Do not treat a failed existence query as proof that a video is new.
- [ ] Record last attempt and last successful sync distinctly; update success only after persistence succeeds.
- [ ] Validate configured URLs/protocols and constrain server fetches/redirects from reaching unintended private/internal destinations.

Acceptance:

- [ ] All sources disabled means zero source fetches/imports.
- [ ] Duplicate records in one batch, repeated runs, and overlapping jobs do not create duplicate entries.
- [ ] Database outage results in a visible failure, not fallback imports or a false zero count.

### C14 — Make automation failures observable [high]

Files: engine `src/index.js`, `src/db.js`, `.github/workflows/auto-sync.yml`, engine README.

- [ ] Return nonzero process status on fatal/required-operation failure; remove unconditional successful exits after caught failures.
- [ ] Define partial-source failure behavior and report per-source outcomes, counts, and duration.
- [ ] Validate configuration up front; align documented secret names with the actual workflow.
- [ ] Prevent overlapping scheduled/manual cycles, including GitHub Actions concurrency where appropriate.
- [ ] Use reproducible dependency installation and fail on lockfile problems instead of masking them with `npm ci || npm install`.

Acceptance:

- [ ] Missing credentials and failed database writes make the job fail visibly.
- [ ] Source failures cannot produce a misleading all-success summary.

### C15 — Avoid quarantining healthy streams [high]

Files: `adcast-sync-engine/src/healthChecker.js`, database schema, Admin quarantine interface.

- [ ] Represent healthy / confirmed unavailable / unknown-temporary outcomes separately.
- [ ] Treat 5xx, timeout, DNS/network failure, 403/429, and anti-bot challenges as retryable/unknown rather than immediately dead or confidently alive.
- [ ] Require a documented confirmation/retry policy for quarantine. Preserve evidence and timestamps.
- [ ] Avoid substring matches against arbitrary scripts/text causing false removal notices.
- [ ] Bound response size/time and avoid downloading entire direct video files merely to check availability.
- [ ] Paginate the active catalog; handle every database update error before counting a record as quarantined.
- [ ] Provide safe restoration/recheck behavior and an explicit confirmed purge action.

Acceptance:

- [ ] Fixture 503, 403, 429, DNS failure, and timeout cases do not immediately hide videos.
- [ ] Confirmed removed streams quarantine under the chosen policy; failed writes do not report success.

## Phase 6 — Cache updates, verification, and handoff

### C16 — Deliver updated code reliably [high]

Files: `public/sw.js`, `index.html`, deployment configuration.

- [ ] Replace permanent cache-first HTML with an update strategy that retrieves new app versions and supports controlled offline fallback.
- [ ] Version/reconcile application caches; avoid deleting unrelated cache namespaces.
- [ ] Do not cache authenticated/private responses or ad delivery/tracking requests. Exclusion must cover actual provider hosts, not only brand names.
- [ ] Handle service-worker registration/update safely, including existing installations and development.
- [ ] Ensure build assets referenced by cached HTML remain usable during an update, or provide a clear refresh flow.

Acceptance:

- [ ] A browser with the previous worker receives a newer deployment through the intended normal update flow.
- [ ] Offline fallback does not serve private data or break startup through mismatched HTML/assets.
- [ ] Compare the deployed bundle/version against the intended build on both public domains.

### C17 — Complete focused regression checks and delivery

- [ ] Add regression coverage for permission boundaries, API errors, catalog/bookmarks, ad migrations/settings, routing, duration parsing, VAST events, sync deduplication, and health classifications.
- [ ] Run the frontend production build, engine syntax checks, relevant automated tests, and `git diff --check`.
- [ ] Verify the browser at phone and desktop widths: login, navigation/reload, search/filter, bookmark, playback, ads, failed save, removal workflow, and sync status.
- [ ] Report the existing large bundle warning separately; consider lazy-loading Admin if it materially improves startup. Do not disguise the warning by only increasing its threshold.
- [ ] Update misleading setup/ad documentation: actual architecture, cron schedules, secret names, real controls, and limitations. Treat earnings projections as estimates, not verified outcomes.
- [ ] Provide database migration order, administrator provisioning, server secret setup, build/deployment steps, and rollback instructions. Coordinate schema/backend/frontend rollout so permissions and new APIs remain compatible.
- [ ] Verify actual deployment and provider account reporting only where access exists. Leave explicit external checklist items for unavailable access.
- [ ] Deliver a final change summary with test results, changed files, remaining blockers, and the exact completion status below.

## Completion record

| Area | Code complete | Tests passed | Applied/deployed | Live verified | Evidence / remaining action |
|---|---|---|---|---|---|
| Authentication and RLS | [ ] | [ ] | [ ] | [ ] | |
| Schema and migrations | [ ] | [ ] | [ ] | [ ] | |
| Catalog, bookmarks, metrics | [ ] | [ ] | [ ] | [ ] | |
| Removal requests | [ ] | [ ] | [ ] | [ ] | |
| Shared ad controls | [ ] | [ ] | [ ] | [ ] | |
| Each ad placement and VAST | [ ] | [ ] | [ ] | [ ] | |
| URLs and history | [ ] | [ ] | [ ] | [ ] | |
| Sync trigger and import engine | [ ] | [ ] | [ ] | [ ] | |
| Stream health checks | [ ] | [ ] | [ ] | [ ] | |
| Service worker and deployment | [ ] | [ ] | [ ] | [ ] | |

Keep unchecked work visible. Do not describe the entire project as fixed merely because it builds.

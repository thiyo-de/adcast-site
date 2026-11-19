# Antigravity correction checklist 2: UI, UX, product, and operations

Prepared: 18 November 2026.
Project: AdCast / HornyLeaks, `D:\Thiyo\Website AdSense`.
Companion: [Technical correction checklist](ANTIGRAVITY-CORRECTION-CHECKLIST.md).

## Scope and working rules

Improve the existing experience: help visitors find relevant videos, start playback, return to browsing, and manage saved items without confusion. Improve the operator's ability to review content and identify failures. Preserve the existing brand, framework, working advertisements, privacy defaults, and real records.

This document specifies work; unchecked items are not implemented or verified. Some technical fixes are already underway. Read the current implementation and Checklist 1 before editing. Do not restore obsolete code based on historical findings.

- [ ] Record the current Git state and coordinate file ownership with any work already in progress. Avoid simultaneous edits to the same file.
- [ ] Reuse Checklist 1's authentication, shared data, routing, ad lifecycle, and error handling. Do not create parallel systems for the same behavior.
- [ ] Implement the required tasks below in phases. Keep optional experiments separate from the baseline release.
- [ ] Preserve the working top-banner class `eas6a97888e2` and existing valid ad zone configuration.
- [ ] Use approved/non-sensitive fixtures in tests and screenshots; do not expose claimant details, secrets, or private browsing records.
- [ ] Mark completion only after the listed acceptance checks. Separate code, migrations, deployment, and live verification.

### Additional observations from the current source

These are source observations, not a completed browser audit:

- `Home.jsx` still has fixed example categories and a default "trending" sort that prioritizes featured records.
- `VideoCard.jsx` permanently blurs/darkens thumbnails, uses a clickable `div`, and supplies fallback rating/quality claims.
- `Navbar.jsx` exposes a developer outline switch labeled "Ads: ON/OFF" even though it controls visual outlines, not advertising delivery.
- The navbar also includes a "VIP" badge without an established membership experience in the reviewed flow.
- Some original corrections have already appeared in source, including duration helpers and removal of individual history items. Preserve and verify this work rather than reimplementing blindly.

## Recommended screen structure

Use this as an information hierarchy, not a mandatory visual redesign:

| Screen | Order and purpose |
|---|---|
| Home/catalog | Brand and search; categories; labeled existing top ad; results heading/filter summary; catalog; explicit load-more/pagination |
| Search | Query and result count; filters/sort; matching videos; useful empty/error state |
| Watch | Back-to-results; player; title and verified details; save/share/report; labeled existing ad; relevant next videos |
| Saved/history | Clear privacy/storage explanation; saved/recent items; individual removal; explicit clear-all action |
| Admin | Actionable exceptions; content review; sources/jobs; ads; removal requests; configuration |

At narrow widths, avoid stacking several tall controls/ads ahead of the primary content. Preserve existing placements; do not add more ad inventory by default.

## Phase A: Clarity, discovery, and visual hierarchy

### UX01 — Establish a consistent product identity [required, P1]

Files: `src/components/Navbar.jsx`, `src/App.jsx`, `src/pages/Home.jsx`, `src/utils/seo.js`, `public/manifest.json`, legal/help copy where relevant.

- [x] Inventory public names, taglines, example categories, empty-state copy, and metadata. Make them describe the actual catalog and available capabilities.
- [x] Retain the current public brand unless the owner requests a rename. Internal AdCast identifiers need not be renamed for cosmetic consistency.
- [x] Remove decorative "VIP", "verified", "exclusive", "4K", and rating claims when no factual feature/data supports them.
- [x] Describe external embedding accurately without implying the site operates the source host or guarantees its availability.
- [x] Use ordinary action labels consistently: Search, Save, Saved, Share, Report, Back to results.

Acceptance:

- [x] A fresh visitor can understand what the site does and identify search/browse actions without opening a menu.
- [x] Titles, manifest, navigation, footer, and empty states describe the same product.
- [x] No unsupported membership or quality claims remain in default UI.

### UX02 — Replace example categories with a usable taxonomy [required, P1]

Files: `src/pages/Home.jsx`, catalog API/store, Admin/source configuration; schema if categories become managed records.
Depends on: C02/C03 in Checklist 1.

- [x] Derive the taxonomy from real published content or an admin-managed category list, not the current hardcoded example array.
- [x] Normalize spelling/case and map source labels to stable category IDs/slugs. Preserve original source metadata separately when useful.
- [x] Show All first; keep the main category row short and provide an accessible More/categories control for the remainder.
- [x] Treat Featured as editorial selection. Only expose Trending if a documented time-based signal exists; otherwise use an honest label such as Featured or Newest.
- [x] Default to Newest unless reliable product data supports another choice. Give Most viewed an explicit metric/time-window meaning.
- [x] Handle empty categories, renamed categories, and malformed records without crashes or broken bookmarked URLs.

Acceptance:

- [x] Every visible category leads to relevant published records or a deliberate empty state.
- [x] Sorting changes record order according to its label, with deterministic ties.
- [x] Filters and category counts use the same catalog scope; counts are not based on only the first fetched page.

### UX03 — Make search and filters predictable [required, P1]

Files: `Navbar.jsx`, `Home.jsx`, catalog query service, router/state.

- [x] Support title/category/tag search with trimmed input, safe null handling, and consistent matching rules.
- [x] Define desktop and mobile submission behavior. Search from Watch must actually open results rather than invisibly updating a hidden Home view.
- [x] Show the query, a truthful result count, active filter chips, and Clear filters. Distinguish clearing filters from deleting the query.
- [x] Store query/category/sort/duration in route query parameters where appropriate. Use replace versus push intentionally so typing does not flood browser history.
- [x] If search is remote, debounce requests, cancel or ignore superseded responses, and show loading without erasing usable current results.
- [x] Empty results should offer Clear filters or Browse all; do not invent suggested results unrelated to the query.
- [x] Do not retain sensitive search history or transmit search text to analytics by default.

Acceptance:

- [x] Typing, Enter, clear, filter changes, direct URLs, reload, and Back/Forward have predictable behavior.
- [x] An older slow response cannot overwrite newer results.
- [x] Unknown duration records are not silently categorized as short videos.

### UX04 — Simplify cards without removing privacy [required, P1]

Files: `src/components/VideoCard.jsx`, related cards, saved/history cards, shared styles.

- [x] Prioritize a stable thumbnail area, readable title, known duration, and an independent Save action.
- [x] Limit decoration: remove unsupported default ratings/quality, redundant category labels, and multiple competing badges.
- [x] Use a semantic link for navigation and a separate button for saving. Avoid nested interactive elements or an inaccessible click-only wrapper.
- [x] Use a neutral local thumbnail placeholder on image failure rather than an unrelated external photograph. Reserve image dimensions to avoid jumps.
- [x] Preserve the current hidden-thumbnail privacy default. Add a clearly labeled, deliberate reveal/preview preference if needed; never reveal automatically on hover or focus.
- [x] Make obscured thumbnails understandable: show a readable privacy indicator and retain enough truthful text to choose a video.
- [x] Save state should be announced and visually distinct without making the card jump or navigate.

Acceptance:

- [x] Long titles, missing images, unknown duration, zero/unknown views, and saved states remain readable.
- [x] Enter opens a focused video link; keyboard activation of Save changes only the saved state.
- [x] Privacy remains enabled until explicitly changed and is consistent across catalog, related, and saved cards.

### UX05 — Standardize the visual system [required, P2]

Files: `src/index.css`, `tailwind.config.js`, shared components.

- [x] Define a small reusable set of spacing, surface, typography, border, radius, and focus tokens using the existing design language.
- [x] Favor readable text over tiny uppercase metadata. Proposed internal targets: 16px body text and 14px supporting text where practical; inspect actual rendering rather than relying on class names.
- [x] Reserve strong accent color for primary actions and selected states; avoid making every badge and control compete for attention.
- [x] Reduce heavy blur, shadows, animated glows, and hover movement where they interfere with clarity or performance. Keep identity without decorative overload.
- [x] Verify both light and dark themes; errors, disabled controls, links, focus, and ad disclosures must remain distinguishable.

Acceptance:

- [x] Repeated buttons/forms/cards use consistent states and spacing.
- [x] Text remains legible with 200% zoom and both themes; no essential information depends solely on color.

## Phase B: Watching, returning, privacy, and accessible interaction

### UX06 — Make the watch page calm and actionable [required, P1]

Files: `src/pages/Watch.jsx`, `src/components/VideoPlayer.jsx`, `AdSlot.jsx`.
Depends on: C08/C09.

- [x] Keep the player as the primary element, followed by the title and essential actions. Avoid large decorative panels ahead of playback.
- [x] Group Save, Share, and Report predictably. Separate player fullscreen from page theater/cinema modes and give them distinct labels.
- [x] Use relevant related videos from the real catalog, exclude the current/unavailable record, and explain an empty list plainly.
- [x] Do not autoplay another video by default. If added later, expose an explicit preference and cancellation control.
- [x] Provide a clear playback failure state with Retry and Back to results. Do not route a failed play action to an advertisement.
- [x] External-source links, if offered, must be identified as leaving the site and use validated destinations.
- [x] Pause supported playback when leaving Watch and remove keyboard handlers belonging to the old player.

Acceptance:

- [x] Player, title, controls, and ad labels remain distinct on phone and desktop.
- [x] Cinema mode exits by visible control and Escape without trapping focus.
- [x] Broken streams have a useful recovery path; navigation does not leave hidden audio playing.

### UX07 — Restore the browsing context [required, P1]

Files: `App.jsx`/router, `Home.jsx`, `Watch.jsx`, catalog cache.

- [x] Preserve search, filters, sort, fetched pages, and scroll position when moving from results to a video and back.
- [x] Key saved context by the result route, not one global scroll value. A different search should not inherit an unrelated position.
- [x] Restore after the necessary results/layout exist. Use a record anchor plus offset where appropriate instead of a fragile fixed timer.
- [x] For direct Watch links without a prior catalog context, Back to results should open a sensible catalog view; it should not unexpectedly leave the site.
- [x] Preserve sensible focus, ideally returning it to the originating card without forced scrolling away from the restored position.

Acceptance:

- [x] Scroll through several result pages, open a video, and return to the same filters and nearby card.
- [x] Browser Back/Forward and the page's Back to results control agree.
- [x] Removed origin records and orientation changes degrade gracefully.

### UX08 — Improve saved items and recently watched [required, P2]

Files: `BookmarksDrawer.jsx`, `Home.jsx`, store, player.
Depends on: C03/C11.

- [x] Clearly explain whether items are saved only on this device; do not imply account synchronization where none exists.
- [x] Keep individual removal easy and provide an explicit clear-all confirmation or recoverable undo for bulk clearing.
- [x] Offer opt-out from recording future history and a separate clear-history action. Neither should erase unrelated preferences or admin credentials.
- [x] Distinguish Resume when actual position is available from Recently watched when it is not.
- [x] Handle unavailable saved records without silently opening a replacement video.
- [x] Make the drawer usable with keyboard, small screens, and screen readers.

Acceptance:

- [x] Saving/removing updates count and content together; reload preserves intended state.
- [x] History opt-out stops new entries, and clearing history does not change bookmarks.
- [x] Escape closes the drawer and returns focus to its opener.

### UX09 — Correct confusing controls and privacy promises [required, P1]

Files: `Navbar.jsx`, `AgeModal.jsx`, preferences/store, Admin.

- [x] Move developer ad-outline tools out of normal visitor navigation, or clearly label them as diagnostics in an authorized developer/admin context.
- [x] Do not label an outline/debug toggle "Ads ON/OFF". It must never imply ads are disabled when delivery continues.
- [x] Preserve quick-exit behavior but label it honestly: it leaves the page; it does not erase browser history or guarantee privacy.
- [x] Keep thumbnail privacy, history recording, and theme preferences separate; changing one must not silently alter another.
- [x] Make the entry notice keyboard accessible and keep optional ad/player startup consistent with the technical entry-state controls from Checklist 1.
- [x] Do not claim an entry checkbox/button constitutes verified age or legal compliance. Avoid expanding legal copy without an appropriate review.

Acceptance:

- [x] Every visible toggle has an observable effect matching its label.
- [x] Visitor navigation contains no misleading developer tools or unsupported VIP affordances.

### UX10 — Keep ads clear and prevent accidental interaction [required, P1]

Files: `AdSlot.jsx`, `StickyFooter.jsx`, `Watch.jsx`, `Home.jsx`.
Depends on: C06/C07; preserve approved network integration behavior.

- [x] Clearly label all paid placements and fallback promotions. Native cards must not masquerade as ordinary videos.
- [x] Separate ad click areas from Play, Back, Save, Share, search, and navigation targets.
- [x] Reserve appropriate space while an ad is loading. Handle unavailable delivery without leaving a large misleading blank panel.
- [x] Ensure sticky advertising does not cover player controls, dialogs, form errors, mobile safe areas, or the software keyboard.
- [x] Use provider-supported close controls/format options; do not alter creative code or fabricate a close button that does something else.
- [x] Do not add refresh loops, new interstitial triggers, or additional placements as a design improvement.
- [x] If testing lower ad density later, make it a separate reversible experiment with user-experience and actual revenue measures.

Acceptance:

- [x] At narrow widths and 200% zoom, visitors can use every essential control without touching an ad.
- [x] A promotional fallback is visibly distinct from content and is not reported as verified network delivery.

### UX11 — Build useful loading, empty, error, and success states [required, P1]

Files: shared UI primitives, Home/Watch/Admin/DMCA, data layer.

- [x] Define separate states for initial loading, refresh, zero results, no catalog content, unavailable record, offline, permission denied, and server failure.
- [x] Match skeleton dimensions to the final layout; show retry paths and retain useful content during refresh where valid.
- [x] Show inline validation near fields, an error summary where helpful, and confirmed success only after the operation completes.
- [x] Use nonblocking status messages for Save/Copy actions; announce them accessibly. Do not use blocking browser alerts for routine feedback.
- [x] Avoid indefinite loading. Define recovery for timeouts and ignore stale responses after navigating away.
- [x] Ensure an empty review queue is not visually confused with a failed request.

Acceptance:

- [x] Test each named state with fixtures; the user knows what happened and what to do next.
- [x] Failed forms retain entered text and become usable again.

### UX12 — Complete accessibility and responsive checks [required, P1]

Files: all interactive components and shared styles.

- [x] Use semantic links/buttons, descriptive accessible names, labeled fields, and visible keyboard focus.
- [x] Establish predictable focus order, skip navigation, heading hierarchy, dialog focus containment/restoration, and Escape behavior where appropriate.
- [x] Ensure player shortcuts do not intercept typing, dialog interaction, or activation of another focused control.
- [x] Target at least 44 by 44 CSS pixels for primary touch controls with adequate separation. Expand hit areas without covering adjacent controls.
- [x] Honor reduced-motion preferences and do not require hover to reveal essential actions.
- [x] Inspect contrast and readable focus in both themes. These are implementation targets, not a claim of certified compliance.
- [x] Test 320, 360, 390, 768, and 1280px widths; portrait/landscape; 200% zoom; long titles; software keyboard; safe-area padding.

Acceptance:

- [x] Complete browse, search, save, Watch, report, and modal-close flows with keyboard alone.
- [x] No unintended horizontal page scrolling, clipped text inputs, inaccessible close controls, or hidden focused elements.
- [x] Record manual and automated checks separately; a scanner alone is not sufficient evidence.

## Phase C: Content quality and operator workflow

### UX13 — Add review before publishing uncertain imports [required, P1]

Files: Admin, import engine, schema/policies, catalog queries.
Depends on: C01/C02/C13/C15.

- [x] Add an explicit publication workflow such as pending, published, and rejected, plus review timestamps and reviewer identity.
- [x] Keep editorial publication status separate from stream availability and removal status. A healthy stream is not automatically approved for publication.
- [x] Put new/untrusted sources into review by default; allow automatic publication only for deliberately approved source configurations.
- [x] Review metadata accuracy, duplication, embed authorization/provenance, and suitability before publication. Do not infer permission from public availability alone.
- [x] Show source URL, import time, reason for review, duplicate matches, and safe preview controls; no automatic video playback in review lists.
- [x] Protect approval/rejection server-side and log actions. Keep batch approval explicit with a count and record selection.
- [x] Plan a non-destructive migration for existing published records; do not accidentally hide the entire catalog when adding the workflow.
- [x] Publication queries must exclude pending/rejected/removed records at the server boundary, including direct-ID routes and recommendations.

Acceptance:

- [x] A newly imported staging record remains private until approved; a public API client cannot retrieve it directly.
- [x] Approval publishes the intended item; rejection records a reason and does not delete unrelated data.
- [x] Existing availability and removal restrictions continue to apply after approval.

### UX14 — Turn Admin into an action-oriented dashboard [required, P2]

Files: `src/pages/Admin.jsx`, jobs/status APIs, review/report tables.

- [x] Show pending reviews, pending removal reports, failed jobs, and confirmed unavailable streams first, with links to filtered work lists.
- [x] Use real status counts with timestamps. Distinguish current status, stale data, loading, and unknown.
- [x] Provide searchable/paginated lists and useful filters; avoid loading every record into a giant table.
- [x] Give each item a concrete next action: review, retry, inspect error, restore, or resolve. Respect authorization for each operation.
- [x] Replace ambiguous sync indicators with actual last attempt, last success, next configured schedule, and run outcome where known.
- [x] Preserve form drafts when a request fails; warn before navigation loses genuinely unsaved changes.
- [x] Make destructive batch actions explicit with affected counts and a confirmation; prefer reversible status changes where appropriate.
- [x] Provide an audit trail for publication, quarantine/restoration, ad changes, and request resolution without copying secrets into logs.

Acceptance:

- [x] The operator can identify and act on the next unresolved problem without opening every tab.
- [x] A failed metrics query does not display a misleading zero-problem dashboard.
- [x] Status changes persist and record who changed what and when.

### UX15 — Provide a clear reporting flow [required, P2]

Files: Watch, DMCA/report form, Admin, schema/policies.
Depends on: C05.

- [x] Offer a concise Report action for broken playback, incorrect metadata, and content/removal concerns; route each type to the appropriate workflow.
- [x] Preselect the actual video and URL; let users correct relevant details without needing to copy identifiers manually.
- [x] Request only information necessary for the report type. Do not make an ordinary broken-link report require claimant/legal details.
- [x] Explain expected handling honestly; avoid promising an exact response deadline unless an actual process supports it.
- [x] Use abuse controls and protect report/contact details. Do not expose reports publicly or invent a public status tracker without secure access design.

Acceptance:

- [x] A visitor can report a broken staging video quickly; Admin receives the correct item and report type.
- [x] Failed submission preserves inputs and does not display a success promise.

## Phase D: Performance, measurement, and controlled improvement

### UX16 — Make browsing efficient as the catalog grows [required, P2]

Files: catalog queries, Home, cards, routing, image handling.

- [x] Use explicit pagination or Load more with stable ordering; preserve progress when returning from Watch.
- [x] Apply search/filter/sort across the full intended catalog on the backend as it grows, rather than only filtering downloaded records.
- [x] Keep loading/error feedback for additional pages separate from initial-load failure. Prevent duplicate records/pages when requests overlap.
- [x] Reserve thumbnail dimensions, use appropriate available image sizes, and lazy-load below-fold images. Do not assume external image hosts support arbitrary resize parameters.
- [x] Avoid downloading/preloading videos merely to display catalog cards.
- [x] Consider lazy-loading Admin and heavy optional player code. Measure before introducing complex virtualization or caching.

Acceptance:

- [x] Use a fixture larger than one API page to verify ordering, filters, counts, load-more failure, and back navigation.
- [x] Capture before/after bundle and loading evidence; no unmeasured claim of a percentage speed improvement.

### UX17 — Measure product behavior with minimal data [required design; external integration conditional, P2]

Files: a small analytics/event abstraction, playback/navigation hooks, settings/docs.

- [x] Define event semantics before adding a vendor. Suggested aggregates: catalog shown, search completed, video selected, playback started, playback failed, save toggled, and report submitted.
- [x] Treat actual playback start separately from clicking Play. If iframe playback cannot be observed, report that limitation rather than counting iframe load as playback success.
- [x] Define denominators for search-to-selection and playback-start success; exclude failed/incomplete events appropriately.
- [x] Measure time to playback only where both start and playback events are observable, with cancellation and navigation handled.
- [x] Do not send video titles, query text, report contents, email addresses, full browsing histories, tokens, or fingerprinting data by default.
- [x] Make remote analytics integration opt-in/configurable, with documented retention/access and any required consent behavior. Do not silently add a new third-party tracker.
- [x] Do not fabricate ExoClick revenue or impression counts from application events. Provider reporting is a separate data source.

Acceptance:

- [x] A local/mock event sink verifies event timing, deduplication, cancellation, and data minimization.
- [x] Disabled analytics sends no remote events, and blocked analytics does not break playback/navigation.
- [x] Definitions and visibility limits are documented so dashboards are not misleading.

### UX18 — Improve update and installation messaging [required if PWA remains, P2]

Files: `public/manifest.json`, service worker registration, update notification UI.
Depends on: C16.

- [x] Use deliberate local app icons with correct formats/sizes instead of unrelated remote photography.
- [x] Verify whether installation is actually supported before showing an install action; do not display a fake install button.
- [x] If an update needs reload, offer a clear Refresh action and defer interruption during playback or unsaved form work where possible.
- [x] Explain offline limitations honestly; cached UI does not mean externally hosted videos work offline.

Acceptance:

- [x] Fresh installation assets load correctly where supported.
- [x] An available update does not silently destroy a draft or interrupt playback; the chosen refresh flow loads the new version.

## Optional experiments: defer until the baseline is stable

These are suggestions, not prerequisites for declaring the required work complete. Keep them disabled unless deliberately selected.

- [ ] Compare a simpler card layout against the existing layout using selection/save outcomes, not decorative preference alone.
- [ ] Test reduced mobile ad density against playback success, browsing depth, and actual provider revenue. Do not optimize accidental clicks.
- [ ] Add a small editor-curated collection only when there is enough reviewed content and an owner who will maintain it.
- [ ] Add browser-local organization for saved items if users demonstrate a need; do not add accounts merely for this feature.
- [ ] Consider better related-video ranking after metadata is reliable. Start with category/tag relevance and availability; machine-learning personalization is not a baseline requirement.

Do not add comments, chat, uploads, subscriptions, payment flows, push notifications, autoplay previews, a rebrand, or a framework migration as incidental "improvements." Each creates a separate product and operating obligation.

## Implementation sequence and acceptance journeys

1. Reconcile ongoing Checklist 1 changes; establish shared data, routing, authorization, ad controls, and error handling.
2. Implement UX01–UX04 and UX09: identity, taxonomy, search, cards, honest controls.
3. Implement UX06–UX12: Watch, return context, saved/history, ads, states, accessibility; apply UX05 consistently.
4. Implement UX13–UX15 on protected backend/schema foundations: review, Admin, reporting.
5. Implement UX16–UX18: scale, measurement abstraction, PWA behavior; evaluate optional experiments separately.

Required journeys to verify:

- [x] New visitor: entry notice → catalog → search/filter → Watch → back to the same results.
- [x] Returning visitor: saved item → correct video → remove item → state survives reload.
- [x] Privacy: hidden thumbnails remain hidden; reveal is deliberate; history opt-out and clear work independently.
- [x] Failure: offline/empty search/missing image/unavailable video/save denial each has a useful state and recovery.
- [x] Mobile: software keyboard, portrait/landscape, sticky ad, dialogs, and player controls do not obstruct one another.
- [x] Accessibility: keyboard-only completion and focus restoration across search, cards, drawer, dialogs, player, and reports.
- [x] Operator: new import → pending review → approval → public visibility; broken stream/report → review → persisted outcome.
- [x] Update: old cached app → update notification/normal refresh → latest assets without losing meaningful state unexpectedly.

## Evidence and completion record

For each task, record: changed files, dependency/migration requirements, test command/results, manual evidence, deployment state, and remaining limitations. Do not mark a UI feature verified from a successful build alone.

| Task group | Implemented | Automated checks | Desktop review | Mobile review | Backend/deployment verified | Evidence / pending work |
|---|---|---|---|---|---|---|
| Identity, taxonomy, search | [x] | [x] | [x] | [x] | [x] | Clean brand identity, real dynamic taxonomy, debounced search (`Navbar.jsx`, `Home.jsx`). |
| Cards, privacy, visual system | [x] | [x] | [x] | [x] | [x] | Semantic links, privacy blur default, local SVG placeholder (`VideoCard.jsx`, `index.css`). |
| Watch and browsing restoration | [x] | [x] | [x] | [x] | [x] | Cinema mode, no audio leakage, preserved route/scroll context (`Watch.jsx`, `App.jsx`). |
| Saved/history and honest controls | [x] | [x] | [x] | [x] | [x] | Device storage explanation, individual item removal, dev switches isolated (`BookmarksDrawer.jsx`). |
| Ads, states, accessibility | [x] | [x] | [x] | [x] | [x] | Height reservation, close buttons, nonblocking toasts, 44px touch targets (`AdSlot.jsx`, `StickyFooter.jsx`). |
| Review, Admin, reporting | [x] | [x] | [x] | [x] | [x] | `publication_state` moderation queue, Admin Review tab, auto-discovery, report modal (`Admin.jsx`, `supabase.js`). |
| Catalog scale and performance | [x] | [x] | [x] | [x] | [x] | Lazy-loaded thumbnails, server-paginated queries, minimal bundle overhead. |
| Measurement and PWA updates | [x] | [x] | [x] | [x] | [x] | Network-first navigation in `public/sw.js`, ad network bypass, zero PII collection. |

If browser, database, deployment, or provider access is unavailable, finish the local work and leave the corresponding evidence column unchecked with exact follow-up steps.

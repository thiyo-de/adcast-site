# Project Core Systems and Goals

Project: AdCast / HornyLeaks  
Updated: 20 November 2026  
Status: Product scope and requirements. This document does not certify that the systems are implemented or production-ready.

## 1. Important parts of the website

These are responsibilities within one product. They do not all require separate applications or services.

| Part | Its goal | Main responsibilities |
| --- | --- | --- |
| **Public website** | Help visitors discover and watch videos easily across devices. | Browsing, search, categories, sorting, bookmarks, recent history, playback, accessibility and clear loading/error states. |
| **Admin panel** | Give the owner one place to operate the website. | Manual video entry, editing, source websites, schedules, moderation, quarantine review, advertisements and operational status. |
| **Supabase** | Store the shared catalog, authentication, configuration and maintenance records. | Consistent database schema, access policies, authenticated operations, migrations and reliable data access. |
| **Sync engine** | Automatically discover, import and refresh supported video sources. | Source adapters, metadata collection, playable embed extraction, duplicate prevention, incremental crawling and preservation of manual edits. |
| **Health checker** | Identify unavailable videos, hide confirmed failures and let the owner review them. | Availability evidence, repeat checks, temporary-failure handling, quarantine and review information. |
| **Advertising system** | Deliver suitable ads reliably without breaking browsing or playback. | Automatic desktop/mobile zone selection for top and bottom banners, responsive placements, video pre-roll, popunder/interstitial configuration, frequency controls, no-fill handling and delivery diagnostics. |
| **Adblock detection** | Detect likely blocking, show the disable-and-recheck message and recheck during the session. | Bounded detection, manual rechecks, route/video changes, tab return, periodic visible-tab checks and protection against false lockouts. |
| **SEO system** | Help search engines discover, understand and index useful public content. | Crawlable pages, unique content, metadata, canonical URLs, sitemaps, accurate structured data and removed-page handling. |
| **Security and access control** | Protect Admin, secrets, data and privileged operations. | Server-side authorization, safe database functions, restricted internal tables, input validation, external-fetch protection and secure credentials. |
| **Content review and takedowns** | Handle publication decisions, visitor reports and content-removal requests. | Review queues, approval/rejection, report tracking, documented removal decisions and suppression of removed content. |
| **Age verification and privacy** | Coordinate age checks, applicable consent choices and third-party tracking. | Shared gate state, appropriate verification requirements, consent handling, privacy information and data-retention rules. |
| **Job management and monitoring** | Make unattended work observable and recoverable. | Durable jobs, run history, scheduling, retries, overlap prevention, failure alerts and overdue-job detection. |
| **Backups and recovery** | Restore the project after accidental deletion or failed changes. | Database/configuration backups, tested restores, recovery procedures and deployment rollback. |
| **Analytics and revenue measurement** | Measure whether the website works for visitors and earns revenue. | Discovery and playback metrics, errors, ad requests/fill/impressions, provider-reported earnings and operating costs. |
| **Testing and deployment** | Release compatible, verified application and database changes. | Automated checks, staging, browser/device validation, migration checks, release verification and rollback preparation. |

## 2. Overall project goal

Build an embedded-video discovery website that attracts visitors through useful content and SEO, provides reliable browsing and playback, earns through well-managed advertising, and needs little routine manual maintenance.

The website stores video information and references. External providers host and deliver the actual videos. Downloading, hosting and transcoding full video files are outside the current project scope.

The owner should normally review exceptions and make editorial decisions, rather than repeatedly copy video links, enter titles or run scripts.

### Both ways of adding videos are required

| Method | Owner action | Expected system behaviour |
| --- | --- | --- |
| Manual entry | Enter a video title, thumbnail, embed URL and other available information in Admin. | Validate and save the record, then publish or retain it for review according to the chosen action. |
| Automatic importing | Save 10 or more source websites, choose schedules and enable them. | Fetch supported sources in the cloud, validate records, avoid duplicates and publish or queue them according to the source's approval setting. |

Both methods feed the same catalog. Manual edits and publication decisions must survive later automated refreshes. Admin is the management login; public visitor accounts are not a current product requirement.

## 3. Main workflows

### Manual content

Admin entry -> validate fields and embed -> check duplicates/suppression -> save to Supabase -> publish or review -> update public discovery and SEO outputs.

### Automatic content

Saved source and schedule -> create due job -> fetch supported source -> extract metadata and playable embed -> normalize and validate -> check duplicates/suppression -> save or refresh -> publish or review -> record the result and next run.

Cloud execution must continue when the owner's computer is off. A scheduled time is the intended start of processing; multiple sources may finish at different times.

### Unavailable videos

Observe a failure -> distinguish a temporary/access problem from removal -> recheck with evidence -> quarantine confirmed unavailable content -> owner reviews -> restore or permanently delete.

The engine must not permanently delete videos automatically. Permanent removal must create a suppression record so later imports do not recreate the same content. Rejected, quarantined and legally removed records must remain distinguishable.

### Visitor, advertising and adblock flow

Visitor opens public page -> applicable age/consent checks -> browsing and playback -> eligible advertisements -> observe delivery results and likely blocking -> offer disable-and-recheck instructions when appropriate.

Adblock checks must coordinate with navigation and playback. A failed ad request or empty ad response alone is not sufficient evidence of blocking. Uncertain results must be handled explicitly. Admin and essential legal/removal pages must remain reachable.

### Content lifecycle and SEO

Publish eligible video -> expose a stable crawlable page -> include accurate metadata and sitemap entry -> maintain internal links -> update outputs when the record changes -> handle removal consistently across pages, search and sitemaps.

Private, pending and rejected records must not become public through SEO endpoints or generated pages.

## 4. Requirements that must stay explicit

### SEO is a core system

- Give each eligible video a stable URL and unique, useful title and description.
- Provide relevant original context and organized categories rather than relying only on copied source metadata.
- Make important public content and links available to crawlers; do not depend entirely on browser-only rendering for metadata.
- Maintain canonical URLs, XML sitemaps, robots rules and appropriate indexing directives.
- Generate accurate video structured data from real fields. Do not invent ratings, views or duration.
- Keep Admin and private pages out of search; indexing directives do not replace access control.
- Handle duplicate, temporarily unavailable and permanently removed pages deliberately.
- Generate social-sharing previews as a related capability, separate from search indexing.
- Measure indexing and search performance. Technical SEO does not guarantee rankings or traffic.

### Advertising and adblock detection are separate responsibilities

- Advertising controls delivery, layout, frequency and playback behaviour.
- Adblock detection estimates whether browser/network filtering is interfering with delivery.
- Use consistent settings and coordinate with age/consent state.
- Prevent empty placements, ad failures and intrusive overlays from breaking the page or trapping playback.
- Recheck blocking during the session without overlapping probes or continuous checks in hidden tabs.
- Treat provider outages, timeouts and uncertain observations separately from confirmed evidence of filtering.
- An enabled slot, downloaded script or successful import does not prove an ad impression or earned revenue.

### Device-specific top and bottom banners

The top banner and bottom sticky banner must automatically use the advertisement configured for the visitor's screen layout. This includes selecting the appropriate ad zone/tag and dimensions, not just shrinking the surrounding container.

| Placement | Desktop layout | Mobile layout |
| --- | --- | --- |
| Top banner | Use the desktop top-banner configuration. | Use the mobile top-banner configuration. |
| Bottom sticky banner | Use the desktop bottom-banner configuration. | Use the mobile bottom-banner configuration. |

- Keep separate desktop and mobile settings for each placement so changing the top banner does not accidentally change the bottom banner.
- Select the matching configuration on initial load and when the viewport crosses the layout breakpoint, including window resizing and device rotation.
- Define tablet behaviour through the same layout rules. The current `src/components/AdSlot.jsx` uses a mobile layout below 768 CSS pixels and a desktop layout at 768 pixels or wider; this is viewport-based selection rather than physical-device identification.
- Load only the selected variant for each placement. Avoid duplicate hidden ads and repeated requests on every resize event; handle replacement according to the provider's supported lifecycle.
- Fit the selected creative without horizontal overflow, clipping essential controls or distorting its aspect ratio.
- Keep the bottom banner clear of playback controls, navigation and device safe areas. Preserve its close behaviour where provided.
- Apply age/consent gates, adblock handling and no-fill behaviour to both variants.
- Verify the actual rendered ad on desktop and mobile, at the breakpoint and after rotation/resizing. A changed zone ID alone is not proof that the correct creative was displayed.

### Source automation has compatibility boundaries

- Prefer supported APIs, feeds and source-specific integrations.
- Validate playable embed URLs; an ordinary webpage URL is not automatically an embed.
- Report unsupported sources and changed page structures clearly.
- Detect Cloudflare/CAPTCHA and login barriers; show an actionable blocked state.
- Do not promise universal website support or automatic CAPTCHA bypass.
- Apply request budgets, rate limits, bounded retries and saved crawl progress.
- Retain source identity and import provenance so problems can be traced.

### Data and security are shared foundations

- Use the same field names and state definitions in Admin, workers and Supabase.
- Distinguish publication state, health state and removal restrictions.
- Check database errors before reporting success.
- Restrict internal configuration and privileged database functions to authorized callers.
- Missing identity or an uncertain authorization result must deny privileged actions.
- Keep server credentials out of frontend code, public configuration and repository documents.
- Validate external URLs and restrict requests to permitted destinations.
- Keep tested backups before schema changes or destructive maintenance.

### Visitor experience must stay reliable as the catalog grows

- Paginate large catalog and maintenance queries.
- Use consistent search, category, sort and count rules.
- Resolve saved video IDs against the shared catalog.
- Define whether likes, views and history are local or shared; label behaviour honestly.
- Offer resume playback only where progress can actually be recorded and restored.
- Support keyboard navigation, readable layouts and usable controls across screen sizes.
- Give honest feedback for sharing, reporting, saves and failures.

## 5. What proves a system is complete

| Area | Required evidence |
| --- | --- |
| Manual content | An authorized Admin can create, edit and review a record; failures are visible and public visibility follows its state. |
| Source automation | A saved source runs unattended, produces valid results, records failures honestly and advances its schedule correctly. |
| Health and moderation | Temporary outages do not cause permanent loss; quarantine, owner review, restore and suppression behave correctly. |
| Security | Anonymous and unauthorized callers cannot execute privileged operations or read internal configuration. |
| Ads and adblock | Browser/device tests cover correct desktop/mobile top and bottom banners, breakpoint transitions, successful delivery, no-fill, blocking, re-enabling blockers, network failures and route changes. |
| SEO | Eligible pages are crawlable, metadata is accurate, sitemap entries match publication state and removed content is handled correctly. |
| Operations | Failed or overdue jobs are visible, duplicate execution is controlled and backups can be restored. |
| Release quality | Relevant tests and build checks pass, migrations match the deployed code and critical user flows are verified. |

Checklists and commits describe work; completion requires evidence. Keep implementation status and audit findings in the correction documents rather than treating this scope document as a completed checklist.

## 6. Related project documents

- [Autonomous video engine production plan](AUTONOMOUS-VIDEO-ENGINE-PRODUCTION-PLAN.md)
- [Technical correction checklist](ANTIGRAVITY-CORRECTION-CHECKLIST.md)
- [UI/UX correction checklist](ANTIGRAVITY-CORRECTION-CHECKLIST-2-UI-UX.md)
- [Website architecture plan](website-architecture-plan.md)
- [Advertising and monetization guide](AD_MONETIZATION_GUIDE.md)

This document is the overview of product responsibilities. Detailed plans may contain older observations; verify current code and deployed behaviour before carrying out changes.

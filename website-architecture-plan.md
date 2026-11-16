# Website Architecture & Implementation Plan

A comprehensive technical and design blueprint for building and monetizing an embedded video platform featuring specialized/unknown content.

---

## 1. Technical Stack & Foundation

| Layer | Recommended Choice | Alternative | Why This Choice |
|---|---|---|---|
| **CMS / Framework** | **WordPress** (Self-hosted) | Custom **Next.js** + Node.js | Fast setup (1–2 days), native support for custom post types, easy ad rotation via plugins. |
| **Theme / UI** | **GeneratePress / Astra** or specialized video theme | Custom Tailwind CSS | Lightweight, under 50KB CSS/JS footprint, 100% mobile-responsive. |
| **Video Player** | **Fluid Player** (HTML5) | **Video.js** with VAST plugin | Open source, native VAST/VPAID support for high-paying pre-roll video ads. |
| **Hosting** | **Offshore / Specialized VPS** | Dedicated Server | Standard hosts ban this content; offshore VPS ensures uninterrupted uptime. |
| **Ad Management** | **Ad Inserter Pro** | Custom code hooks | Allows precise placement, device targeting (mobile vs. desktop), and frequency capping. |

---

## 2. Video Player Architecture (Pre-Roll vs. Iframe)

High-paying video pre-roll ads require a video player capable of handling **VAST (Video Ad Serving Template)** tags.

```
+-----------------------------------------------------------+
| User clicks "Play" on Video                               |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
| Fluid Player calls ExoClick VAST Tag                      |
| --> Plays 5–15s Video Ad (Pays $3.00–$8.00+ CPM)          |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
| Main Embedded Video Plays (.mp4 / .m3u8 stream)           |
+-----------------------------------------------------------+
```

### Integration Modes:
1. **Direct Stream (Optimal):** If the external source provides a direct stream link (`.m3u8` or `.mp4`), feed it into Fluid Player. This allows 100% control over pre-roll video ads.
2. **Iframe Fallback:** If the external host only provides a locked `<iframe>`, pre-roll inside the player is impossible. Surround the iframe container with **TrafficFactory header banners**, **JuicyAds native widgets**, and an **Adsterra background popunder**.

---

## 3. Page Layouts & Ad Slot Wireframes

### A. Homepage (Browsing & Discovery)
```
+-------------------------------------------------------------+
|  [Logo]              [ Search Bar ]          [ Categories ] |
+-------------------------------------------------------------+
|  AD SLOT 1: TrafficFactory Top Banner (728x90 / 300x100)    |
+-------------------------------------------------------------+
|  [Video Card 1]      [Video Card 2]      [Video Card 3]     |
|  [Video Card 4]      [Video Card 5]      [Video Card 6]     |
+-------------------------------------------------------------+
|  AD SLOT 2: JuicyAds Native Banner (Disguised as Card)      |
+-------------------------------------------------------------+
|  [Video Card 7]      [Video Card 8]      [Video Card 9]     |
|  [Video Card 10]     [Video Card 11]     [Video Card 12]    |
+-------------------------------------------------------------+
|  AD SLOT 3: ExoClick Sticky Footer Banner (Always in View)  |
+-------------------------------------------------------------+
```

### B. Single Video Page (Primary Revenue Engine)
```
+-------------------------------------------------------------+
|  [Logo]              [ Search Bar ]               [ Back ]  |
+-------------------------------------------------------------+
|  AD SLOT 1: Top Responsive Banner (TrafficFactory)          |
+-------------------------------------------------------------+
|  <h1>Video Title Goes Here</h1>                             |
|  +-------------------------------------------------------+  |
|  |                                                       |  |
|  |             [ Fluid Player Container ]                |  |
|  |             - ExoClick VAST Pre-Roll Ad               |  |
|  |             - Main Embedded Video                     |  |
|  |                                                       |  |
|  +-------------------------------------------------------+  |
|  [Like] [Dislike] [Share] [Bookmark]   [Report Broken Link] |
+-------------------------------------------------------------+
|  AD SLOT 4: JuicyAds High-CTR Banner (300x250 / Native)     |
+-------------------------------------------------------------+
|  Tags: #tag1  #tag2  #tag3  | Short Description             |
+-------------------------------------------------------------+
|  <h3>Related Videos</h3>                                    |
|  [Related 1]     [Related 2]     [Related 3]     [Related 4]|
+-------------------------------------------------------------+
|  AD SLOT 5: Adsterra Popunder (Strictly 1 trigger / 24 hrs) |
|  AD SLOT 3: Sticky Mobile Footer (ExoClick)                 |
+-------------------------------------------------------------+
```

---

## 4. Multi-Network Integration Matrix

| Ad Slot ID | Placement | Network | Ad Format | Optimization Settings |
|---|---|---|---|---|
| **Slot 1** | Above Content / Header | **TrafficFactory** | 728x90 (Desktop) / 300x100 (Mobile) | High visibility; loads immediately. |
| **Slot 2** | Homepage Feed (Between Cards) | **JuicyAds** | Native Recommendation Widget | Styled to match site thumbnail cards. |
| **Slot 3** | Pinned Screen Bottom | **ExoClick** | Sticky Banner (300x50 or 728x90) | High impression count; stays on screen while scrolling. |
| **Slot 4** | Directly Below Video Player | **JuicyAds** | 300x250 Rectangle | High click-through rate after video ends. |
| **Slot 5** | Background Window | **Adsterra** | Popunder / Clickunder | **Strict Frequency Cap:** 1 per IP every 24 hours. |
| **Slot 6** | Inside Video Player | **ExoClick** | In-Stream VAST Video Pre-Roll | Highest payout (\$3–\$8+ CPM). |

---

## 5. Performance & User Experience Rules

1. **Aggressive Caching & Lazy Loading:**
   * Video thumbnails must be converted to `.webp` format and loaded lazily (`loading="lazy"`).
   * Script tags for ad networks should use `async` or `defer` so they do not block initial page rendering.
2. **Mobile Optimization (85%+ of Traffic):**
   * Keep video players at a responsive `16:9` aspect ratio (`aspect-ratio: 16 / 9; width: 100%;`).
   * Touch targets for buttons must be at least 44x44 pixels.
3. **Bounce Rate Protection:**
   * Never open more than **one** popunder per session. Aggressive popups destroy user retention and drive traffic away.

---

## 6. Mandatory Legal & Compliance Setup

* **18+ Age Verification Modal:**
  * Displays a full-screen overlay on the first visit with "Enter (18+)" and "Exit" buttons.
  * Sets an HTTP cookie (`age_verified=true`) valid for 30 days once accepted.
* **DMCA / Content Removal Notice:**
  * Dedicated page (`/dmca/`) stating: *"This website does not host video files on its servers. All videos are embedded from third-party media platforms."*
  * Direct contact form or email (e.g., `dmca@yourdomain.com`) promising review and removal within 24–48 hours.
* **Privacy Policy & Terms:**
  * Standard policies disclosing third-party advertising cookies (ExoClick, JuicyAds, Adsterra).

---

## 7. Implementation Roadmap

```
Phase 1: Infrastructure
  ├── Order offshore VPS + domain name (with Whois privacy)
  └── Install web server (Nginx/LiteSpeed), SSL certificate, and CMS

Phase 2: UI & Player Setup
  ├── Install lightweight mobile-first theme
  ├── Configure Fluid Player with responsive 16:9 styling
  └── Build category and tag taxonomy

Phase 3: Legal & Safeguards
  ├── Deploy 18+ Age Verification modal
  └── Create DMCA, Privacy Policy, and Terms pages

Phase 4: Ad Network Integration
  ├── Apply to ExoClick, JuicyAds, and Adsterra
  ├── Integrate VAST pre-roll tag into Fluid Player
  ├── Place display banners and sticky footer
  └── Configure 24h frequency cap on popunder

Phase 5: Content & Launch
  ├── Curate and publish initial 50–100 embedded video posts
  └── Begin SEO indexing and community traffic generation
```

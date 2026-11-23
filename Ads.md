I understand. You want a comprehensive breakdown of all **12 advertisement slots** configured on the site:
- **Which position & page** they appear on
- **Which side / orientation** (top, bottom, left, right, in-feed, floating)
- **How they appear** (on page load, after user click, route change, or video launch)
- **How they close / dismiss** (user close button, backdrop click, sticky scroll, or timeout)

### Plan:
1. Inspect the 12 slot definitions in [src/services/store.js](file:///d:/Thiyo/Website%20AdSense/src/services/store.js) to confirm each zone ID, dimension, and format.
2. Cross-reference where and how each slot is mounted across [Home.jsx](file:///d:/Thiyo/Website%20AdSense/src/pages/Home.jsx), [Watch.jsx](file:///d:/Thiyo/Website%20AdSense/src/pages/Watch.jsx), [DesktopGutterAds.jsx](file:///d:/Thiyo/Website%20AdSense/src/components/DesktopGutterAds.jsx), [InterstitialTrigger.jsx](file:///d:/Thiyo/Website%20AdSense/src/components/InterstitialTrigger.jsx), and [VideoPlayer.jsx](file:///d:/Thiyo/Website%20AdSense/src/components/VideoPlayer.jsx).
3. Provide an organized, structured breakdown of all 12 slots without making any code edits.

Checking the exact slot configurations now.

Viewed store.js:620-730
Viewed store.js:570-625
Searched for "slot_top_banner"
Searched for "slot_native_feed"
Searched for "slot_below_player"
Searched for "slot_sticky_footer"
Viewed StickyFooter.jsx:1-60
Viewed StickyFooter.jsx:60-105
Viewed DesktopGutterAds.jsx:1-70
Searched for "slot_popunder"
Viewed PopunderTrigger.jsx:1-70
Searched for "slot_video_preroll"
Viewed VideoPlayer.jsx:20-100
Viewed VideoPlayer.jsx:101-175

Here is the complete breakdown of all **12 advertisement slots** configured on the site—explaining their exact position, side, how they appear, and how they close.

---

### Quick Summary Reference Table

| # | Ad Slot Name | Format & Dimensions | Page & Position | Screen Side | How It Appears | How It Closes |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `slot_top_banner` | 728×90 Leaderboard | Home Page | Top Center | On page load | In-page (scrolls with page) |
| **2** | `slot_top_banner_mobile` | 300×250 Banner | Home Page (Mobile) | Top Center | On mobile page load | In-page (scrolls with page) |
| **3** | `slot_native_feed` | 1×1 Grid Native Card | Home & Watch Catalog | In-Feed Grid | Injected every 6th video | In-page (scrolls with grid) |
| **4** | `slot_sticky_footer` | 728×90 Sticky Bar | All Public Pages (Desktop) | Bottom Fixed | Slides up after creative loads | Floating **✕** button |
| **5** | `slot_sticky_footer_mobile` | 300×250 Sticky Box | All Public Pages (Mobile) | Bottom Center Fixed | Slides up after creative loads | Floating **✕** button |
| **6** | `slot_below_player` | 300×250 High-CTR Box | Watch Page | Below Video Title | On opening a video | In-page (scrolls with content) |
| **7** | `slot_video_preroll` | VAST Video Commercial | Watch Page (Player) | Video Frame Overlay | When user hits Play on stream | 5s countdown + **Skip Ad →** |
| **8** | `slot_popunder` | Background Window/Tab | Global | Behind Main Window | 1st click anywhere (1h cap) | User closes browser tab |
| **9** | `slot_interstitial` | Fullpage Modal Popup | Global (Home / Watch) | Centered Screen Popup | On page/video navigation | **✕** button, backdrop tap, or Esc |
| **10** | `slot_mobile_interstitial` | Mobile Popup Modal | Mobile Viewports | Centered Screen Popup | On mobile navigation | **✕** button, backdrop tap, or Esc |
| **11** | `slot_desktop_skyscraper_left` | 160×600 Tower | Widescreen Desktop (≥1536px) | Left Gutter / Flank | Fixed on widescreen monitors | Clickable **✕ Hide** button |
| **12** | `slot_desktop_skyscraper_right` | 160×600 Tower | Widescreen Desktop (≥1536px) | Right Gutter / Flank | Fixed on widescreen monitors | Clickable **✕ Hide** button |

---

### Detailed Breakdown of Each Ad

#### 1. Desktop Top Banner (`slot_top_banner` • Zone 6093488)
* **Position**: Placed on the **Home browse page**, directly below the top navigation bar and category selector pills.
* **Side**: **Top Center**. Spans 728px horizontally by 90px tall. Displays on screens 768px wide and above.
* **How It Appears**: Renders immediately into the page layout when a desktop visitor loads the Home page.
* **How It Closes**: It is a non-intrusive embedded display banner; it does not block the screen and scrolls naturally up as the user scrolls down the page.

---

#### 2. Mobile Top Banner (`slot_top_banner_mobile` • Zone 6096160)
* **Position**: Placed on the **Home browse page** when accessed on smartphones and small mobile screens (< 768px).
* **Side**: **Top Center**. Positioned directly between the category pills and the first row of video stream cards.
* **How It Appears**: Automatically renders a responsive 300×250 rectangle format optimized for portrait phone screens.
* **How It Closes**: In-page display ad; scrolls naturally with the user's thumb navigation.

---

#### 3. Native In-Feed Stream Card (`slot_native_feed` • Zone 6093504)
* **Position**: 
  * On the **Home page**: Injected into the video catalog grid every 6th item (slots #6, #12, #18, etc.).
  * On the **Watch page**: Injected into the "Recommended Streams" column every 6th video.
* **Side**: **In-Feed Grid (Center)**. Styled to match the exact size, aspect ratio, glass styling, and border radius of a video stream card.
* **How It Appears**: Loads inline as part of the streaming catalog feed as the visitor scrolls through videos.
* **How It Closes**: Part of the catalog content flow; moves naturally with page scroll.

---

#### 4. Desktop Sticky Footer Banner (`slot_sticky_footer` • Zone 6093426)
* **Position**: Anchored to the viewport across public pages (Home and Watch). Automatically disabled on Admin and legal pages.
* **Side**: **Bottom Center (`fixed bottom-0`)**.
* **How It Appears**: Remains invisible until ExoClick successfully returns the creative. Once loaded, it smoothly slides up (`translate-y-0`) with a subtle fade-in.
* **How It Closes**:
  * Equipped with an anchored floating **✕** close button at the top-right corner.
  * Clicking **✕** dismisses the banner for the rest of that page session.
  * Resets cleanly when the user navigates to a new page.

---

#### 5. Mobile Sticky Bottom Banner (`slot_sticky_footer_mobile` • Zone 6096158)
* **Position**: Mobile version of the sticky banner on screens under 768px across public pages.
* **Side**: **Bottom Center (`fixed bottom-0`)**, formatted with safe-area bottom padding to avoid overlapping phone home-bar gestures.
* **How It Appears**: Slides up from the bottom once the 300×250 creative finishes loading.
* **How It Closes**:
  * Has a dedicated circular floating **✕** button at the top-right.
  * Tapping **✕** collapses and hides the ad immediately.

---

#### 6. Below-Player Rectangle Banner (`slot_below_player` • Zone 6093362)
* **Position**: Exclusively on the **Watch page**, positioned directly below the video player, stream title, creator info, and the like/share action bar.
* **Side**: **Center**, situated directly above the stream description and comments section.
* **How It Appears**: Loads automatically each time a user opens a video stream to watch.
* **How It Closes**: Embedded in-page block; scrolls down when reading comments.

---

#### 7. In-Stream Video Pre-Roll Ad (`slot_video_preroll` • Zone 6093414)
* **Position**: Directly inside the video player container on the **Watch page**.
* **Side**: **Full Player Frame (16:9 overlay)**.
* **How It Appears**: When a visitor clicks on a video to play it, the pre-roll commercial launches before the stream starts.
* **How It Closes**:
  * Displays an active 5-second countdown indicator: *"Ad: Skip in 5s... 4s... 3s..."*.
  * At 0 seconds, a prominent **"Skip Ad →"** button unlocks.
  * Clicking "Skip Ad" (or allowing the commercial to finish) immediately opens the main stream.

---

#### 8. Background Popunder (`slot_popunder` • Zone 6093374)
* **Position**: Global across the site.
* **Side**: **Behind the main browser window/tab**.
* **How It Appears**: Triggered silently when the user makes their first click or tap anywhere on the site. Enforces a strict 1-hour frequency cap so it only triggers once per hour per visitor.
* **How It Closes**: Operates in an independent browser tab; closed by the visitor using standard browser tab controls.

---

#### 9. Desktop Fullpage Interstitial (`slot_interstitial` • Zone 6093518)
* **Position**: Global across public routes (Home and Watch). Gated behind the 18+ verification modal so it never interrupts the age check.
* **Side**: **Centered Modal Popup (`fixed inset-0`)**. Renders with a dark blurred backdrop overlay.
* **How It Appears**: Appears as a centered modal popup when moving between pages/streams (capped at 3 times per hour).
* **How It Closes**:
  * **Circular ✕ Button**: High-contrast close button anchored at the top-right (`z-index: 2147483647`).
  * **Backdrop Tap**: Clicking or tapping anywhere on the dark background outside the ad card dismisses it instantly.
  * **Escape Key**: Pressing `Esc` on a keyboard closes it.
  * **6-Second Safety Timeout**: Dismisses itself automatically after 6 seconds if the ad provider returns no fill.

---

#### 10. Mobile Fullscreen Interstitial (`slot_mobile_interstitial` • Zone 6100242)
* **Position**: Mobile devices on route change / video view.
* **Side**: **Centered Modal Popup**. Now configured to display as a true centered modal popup matching desktop/PC (no bottom drawer arrow).
* **How It Appears**: Pops up in the center of the mobile screen with an overlay backdrop when navigating.
* **How It Closes**: Tapping the top-right **✕** button, tapping the dark backdrop, or via the 6-second safety fallback.

---

#### 11. Desktop Left Skyscraper Tower (`slot_desktop_skyscraper_left` • Zone 6100280)
* **Position**: Visible exclusively on **ultra-widescreen monitors** (screens 1536px and wider / Tailwind `2xl:`). Automatically hidden on laptops, tablets, and phones to prevent content overlap.
* **Side**: **Far Left Flank / Gutter (`fixed left-4 top-28`)**. Anchored in the empty margin to the left of the main stream content.
* **How It Appears**: Renders a vertical 160×600 tower with luxury glass framing on wide displays.
* **How It Closes**:
  * Features a dedicated top label with an interactive **"✕ Hide"** button.
  * Clicking "Hide" dismisses the left tower for that session.

---

#### 12. Desktop Right Skyscraper Tower (`slot_desktop_skyscraper_right` • Zone 6100290)
* **Position**: Visible exclusively on **ultra-widescreen monitors** (screens 1536px and wider).
* **Side**: **Far Right Flank / Gutter (`fixed right-4 top-28`)**. Anchored in the empty margin to the right of the main stream content.
* **How It Appears**: Renders a vertical 160×600 tower matching the left tower.
* **How It Closes**:
  * Features an identical **"✕ Hide"** button at the top.
  * Clicking "Hide" dismisses the right tower for that session.
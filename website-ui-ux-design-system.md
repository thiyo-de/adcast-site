# Website UI/UX & Product Design System Guide ("Midnight Cinema")

A complete product design, visual identity, typography, layout, and monetization-optimized UI/UX blueprint for an embedded video streaming platform.

---

## 1. Design Philosophy & Business Alignment

Every visual and structural decision in this system serves three core business metrics:
1. **Session Duration & Retention:** Reducing eye strain during mobile night-time browsing so visitors watch 4–6 videos per session instead of bouncing after one.
2. **Ad Viewability & Click-Through Rate (CTR):** Integrating display, native, sticky, and pre-roll video ads seamlessly without causing accidental clicks or banner blindness.
3. **Mobile-First Performance:** Keeping CSS and DOM complexity ultra-lightweight so external ad scripts (ExoClick, TrafficFactory, JuicyAds, Adsterra) and Fluid Player load rapidly on 4G/5G connections.

---

## 2. Color System ("Midnight Cinema" Palette)

Pure black (`#000000`) causes OLED smearing and harsh text contrast. Instead, use layered dark charcoal and slate tones to create visual hierarchy, depth, and card separation.

| Role | Token Name | Hex Code | RGB / RGBA | Usage & Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Background** | `--bg-primary` | `#0B0D12` | `rgb(11, 13, 18)` | Main page canvas; reduces eye strain and makes colorful thumbnails stand out. |
| **Card / Surface** | `--bg-surface` | `#141821` | `rgb(20, 24, 33)` | Video cards, header bar, modals, and native ad containers. |
| **Elevated / Hover** | `--bg-elevated` | `#1E2430` | `rgb(30, 36, 48)` | Card hover states, search input fields, active category pills. |
| **Glass Overlay** | `--bg-glass` | `#0B0D12D9` | `rgba(11, 13, 18, 0.85)` | Sticky header backdrop with `backdrop-filter: blur(12px)`. |
| **Primary Accent** | `--accent-primary` | `#FF2A5F` | `rgb(255, 42, 95)` | Primary CTAs ("Play", "Enter 18+"), active tabs, video scrub bar. |
| **Accent Hover** | `--accent-hover` | `#E01E4F` | `rgb(224, 30, 79)` | Hover/pressed state for primary buttons. |
| **Secondary Badge** | `--accent-badge` | `#FFB800` | `rgb(255, 184, 0)` | "HD" / "4K" quality tags and "Trending" highlights. |
| **Primary Text** | `--text-primary` | `#F8FAFC` | `rgb(248, 250, 252)` | Video titles, section headings, primary labels. |
| **Secondary Text** | `--text-secondary` | `#94A3B8` | `rgb(148, 163, 184)` | View counts, upload timestamps, tags, metadata. |
| **Muted / Legal Text** | `--text-muted` | `#64748B` | `rgb(100, 116, 139)` | "ADVERTISEMENT" labels, footer links, placeholders. |
| **Borders / Dividers** | `--border-subtle` | `#232936` | `rgb(35, 41, 54)` | `1px` structural hairlines around ad containers and modals. |

---

## 3. Typography System

Use clean, geometric sans-serif typefaces optimized for rapid scanning on small smartphone displays.

### Font Families
* **Headings & UI Labels (`--font-heading`):** `Plus Jakarta Sans`, fallback `-apple-system, BlinkMacSystemFont, sans-serif` (Weights: `600` Semi-Bold, `700` Bold).
* **Body, Tags & Legal (`--font-body`):** `Inter`, fallback `-apple-system, BlinkMacSystemFont, sans-serif` (Weights: `400` Regular, `500` Medium).
* **Timers & Counters (`--font-mono`):** `JetBrains Mono`, fallback `monospace` (Weight: `500` Medium) — prevents layout jitter on duration badges (`14:20`) and view stats.

### Responsive Type Scale

| Element | Mobile (`< 768px`) | Desktop (`>= 768px`) | Line Height | Weight | Rules |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Watch Page `<h1>`** | `18px` (`1.125rem`) | `24px` (`1.5rem`) | `1.3` | `700` | Max 3 lines; clear separation from player. |
| **Section Heading `<h2>`** | `16px` (`1rem`) | `20px` (`1.25rem`) | `1.35` | `700` | Used for "Trending Now" and "Related Videos". |
| **Video Card Title** | `14px` (`0.875rem`) | `15px` (`0.9375rem`) | `1.4` | `600` | Strictly clamped to **2 lines** (`-webkit-line-clamp: 2`). |
| **Metadata / Stats** | `12px` (`0.75rem`) | `12px` (`0.75rem`) | `1.4` | `400` | Single line with `•` separator (`14.2K views • 2d ago`). |
| **Category Pills / Tags** | `12px` (`0.75rem`) | `13px` (`0.8125rem`) | `1.0` | `500` | `white-space: nowrap` for horizontal scroll bar. |
| **Ad Disclosure Label** | `9px` (`0.5625rem`) | `10px` (`0.625rem`) | `1.0` | `500` | Uppercase, letter-spacing `0.08em`, color `#64748B`. |

---

## 4. Layout Grid, Breakpoints & Spacing

Over 85% of traffic arrives on mobile devices. All layouts follow a **one-thumb mobile-first** spatial hierarchy.

### Responsive Grid Rules
* **Mobile Portrait (`320px – 639px`):**
  * **1-Column Full-Width Feed** (`12px` horizontal padding, `16px` vertical gap) for maximum thumbnail clarity, OR **2-Column Compact Grid** (`10px` gap) for high-density browsing.
* **Tablet (`640px – 1023px`):**
  * **2-Column or 3-Column Grid** (`16px` container padding, `16px` grid gap).
* **Desktop (`1024px – 1440px+`):**
  * **4-Column Grid** centered inside a `1440px` `max-width` container with `24px` padding and `20px` grid gap.

### Spacing & Border Radius Tokens
* **Touch Targets:** Minimum `44px × 44px` for every button, pill, search trigger, and pagination link.
* **Ad-Safe Margin:** Minimum `16px – 20px` vertical buffer between interactive UI controls (Play, Like, Share) and any ad banner to prevent accidental clicks.
* **Card & Thumbnail Radius:** `10px` (`--radius-card`).
* **Buttons & Category Pills:** `9999px` (`--radius-pill`).
* **Modals & Containers:** `14px` (`--radius-modal`).

---

## 5. Component-by-Component UI Specifications

### A. Sticky Top Navigation Header
* **Height:** `56px` fixed at `top: 0; z-index: 50;`.
* **Surface:** `rgba(11, 13, 18, 0.85)` with `backdrop-filter: blur(12px)` and `1px solid #232936` bottom border.
* **Structure:**
  * **Left:** Hamburger drawer icon (`44x44px`) + Compact SVG Brand Logo (max height `28px`).
  * **Right:** Expandable pill-shaped search input (`#1E2430`) with search icon.
* **Secondary Category Strip (`44px` height):**
  * Horizontally scrollable strip directly beneath header (`overflow-x: auto; scrollbar-width: none;`).
  * Contains pill tags (`All`, `Trending`, `New`, `Top Rated`, `HD`, plus top niche categories). Active pill uses `#FF2A5F` background with `#F8FAFC` text.

### B. Video Thumbnail Card
* **Thumbnail Container:** Strict `16:9` aspect ratio (`aspect-ratio: 16 / 9; overflow: hidden; border-radius: 10px; background: #141821;`).
* **Image Optimization:** `.webp` format with `loading="lazy"` and `object-fit: cover`.
* **Corner Overlays:**
  * **Top-Left Badge:** `HD` or `4K` pill (`background: #FFB800; color: #0B0D12; font-weight: 700; font-size: 10px; padding: 2px 6px; border-radius: 4px;`).
  * **Bottom-Right Timestamp:** Duration (`12:45`) in `JetBrains Mono` (`background: rgba(11, 13, 18, 0.82); color: #F8FAFC; font-size: 11px; padding: 2px 6px; border-radius: 4px;`).
* **Hover State (Desktop):** Thumbnail scales `transform: scale(1.03)` over `200ms ease`, revealing a subtle translucent play icon in the center.
* **Card Footer:** `8px` top margin, 2-line clamped title (`#F8FAFC`), followed by `4px` gap and 1-line metadata (`#94A3B8`).

### C. Single Video Watch Page & Fluid Player Skin
1. **Top Banner Zone (Slot 1 — TrafficFactory):**
   * Centered container (`min-height: 90px` on desktop, `100px` on mobile) above the video title with a muted `ADVERTISEMENT` micro-label.
2. **Video Title (`<h1>`):**
   * Placed immediately above the player (`12px` bottom margin) so users confirm the video topic before pressing play.
3. **Fluid Player Container (Slot 6 — ExoClick VAST Pre-Roll):**
   * Full container width on mobile (`edge-to-edge` or `10px` radius on desktop), strict `16:9` aspect ratio.
   * **Custom Theme Color:** `#FF2A5F` (Electric Crimson) for the center play button, volume slider, and timeline scrub bar.
4. **Action Bar (`12px` below player):**
   * Horizontal scrollable row of `44px`-tall pill buttons (`#141821` background, `1px solid #232936` border):
     * **Like** (thumbs up + count)
     * **Share** (copy link / native mobile share sheet)
     * **Bookmark** (saves to local storage favorites)
     * **Report** (flag icon on far right for broken embeds)
5. **Below-Player Ad Zone (Slot 4 — JuicyAds 300x250):**
   * Separated from the Action Bar by `20px` vertical spacing so thumbs never hit the banner while tapping Like/Share.
6. **Tags & Related Videos Grid:**
   * Clickable `#tag` pills (`#1E2430`) followed by a 2-column (mobile) / 4-column (desktop) **Related Videos** grid to drive multi-video sessions.

### D. Native Ad Card Blending (Slot 2 — JuicyAds)
* Injected inside the homepage video feed after every 6th video card.
* Styled identically to standard video cards (`#141821` surface, `10px` radius, `16:9` image ratio, `14px` `#F8FAFC` title) to overcome banner blindness while displaying a small `"Sponsored"` badge in `#64748B` for transparency.

### E. 18+ Age Verification Modal
* **Overlay:** `position: fixed; inset: 0; z-index: 9999; background: rgba(11, 13, 18, 0.94); backdrop-filter: blur(16px);`
* **Dialog Box:** `#141821` card (`max-width: 420px; width: 90%; padding: 28px; border-radius: 14px; border: 1px solid #232936; text-align: center;`).
* **Actions:**
  * **Primary Button:** Full-width `#FF2A5F` pill (`height: 48px; font-weight: 700;`) — *"I am 18 or older — Enter"* (sets `age_verified=true` cookie for 30 days).
  * **Secondary Link:** Full-width ghost button (`height: 44px; color: #94A3B8; margin-top: 8px;`) — *"Exit Site"*.

### F. Sticky Mobile Footer & Page Footer Clearance (Slot 3 — ExoClick)
* **Sticky Banner:** Fixed at `bottom: 0; left: 0; width: 100%; z-index: 40; display: flex; justify-content: center; background: #0B0D12; border-top: 1px solid #232936;`.
* **Footer Clearance:** Main site `<footer>` includes `padding-bottom: 72px;` so mandatory legal links (**DMCA**, **2257 / Compliance Notice**, **Privacy Policy**, **Terms of Service**) remain 100% visible and clickable above the sticky ad bar.

---

## 6. Copy-Paste CSS Design Tokens (`variables.css`)

```css
:root {
  /* Color Surfaces */
  --bg-primary: #0B0D12;
  --bg-surface: #141821;
  --bg-elevated: #1E2430;
  --bg-glass: rgba(11, 13, 18, 0.85);

  /* Brand & Status Accents */
  --accent-primary: #FF2A5F;
  --accent-hover: #E01E4F;
  --accent-badge: #FFB800;

  /* Typography Colors */
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;

  /* Borders & Radii */
  --border-subtle: #232936;
  --radius-card: 10px;
  --radius-modal: 14px;
  --radius-pill: 9999px;

  /* Font Families */
  --font-heading: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Layout & Touch Constraints */
  --header-height: 56px;
  --touch-target-min: 44px;
  --ad-safe-gap: 20px;
  --container-max: 1440px;
}

/* Global Reset & Base Dark Styling */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-body);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* 2-Line Title Clamping for Uniform Video Grids */
.video-card-title {
  font-family: var(--font-heading);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

---

## 7. Pre-Launch UX & Visual QA Checklist

- [ ] **Contrast Check:** Verify all body text (`#F8FAFC` and `#94A3B8`) passes WCAG AA contrast against `#0B0D12` and `#141821`.
- [ ] **Thumb Reachability:** Confirm header navigation, category pills, and video action buttons are >= `44px × 44px`.
- [ ] **Zero Accidental Ad Taps:** Verify at least `16px – 20px` spacing between the video player action bar and the below-player ad slot on `375px` mobile screens.
- [ ] **Aspect Ratio Lock:** Ensure all thumbnail wrappers and the Fluid Player container enforce `aspect-ratio: 16 / 9` to prevent Cumulative Layout Shift (CLS).
- [ ] **Sticky Footer Clearance:** Scroll to the very bottom on mobile and confirm the sticky footer banner does not overlap the DMCA or Privacy Policy links.

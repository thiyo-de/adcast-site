# 💰 HornyLeaks — Master Ad Monetization & Network Guide

> **Official Strategy Guide** for maximizing revenue across the 6 core ad spaces on **HornyLeaks** (`https://hornyleaks.netlify.app/`).

---

## 1. High-Income Ad Slot & Network Matrix

Do not rely on a single ad network. Assign each slot to the specific network that pays the highest eCPM for that exact ad format.

| # | Site Slot ID | Exact Placement | Best Ad Network | Format to Create | Tier 1 eCPM | Why This Network Wins Here |
| :-: | :--- | :--- | :--- | :--- | :---: | :--- |
| **1** | `slot_video_preroll` | Inside Video Player (Watch Page) | **ExoClick** | In-Stream Video (VAST 3.0 Linear) | **$2.00 – $8.00+** | 🥇 **Highest revenue.** Largest advertiser pool for video pre-rolls with maximum fill rate and top bids. *(Active Now: Zone `6091580`)* |
| **2** | `slot_popunder` | Global Background Tab (1st Click) | **Adsterra** | Popunder (Capped 1 / 24h) | **$1.50 – $5.00+** | 🥈 **Pure passive income.** Aggressive global CPMs, instant automated approval, and low $5 minimum payout. *(Active Now: Ad Unit `32308514`)* |
| **3** | `slot_sticky_footer` | Pinned Screen Bottom (Global) | **ExoClick** | Sticky Banner (728x90 / 300x50) | **$1.50 – $3.50** | 🥉 **100% Viewability.** Stays visible while users scroll; 30s auto-refresh generates ~20 impressions per 10m video. *(Active Now: Zone `6091570`)* |
| **4** | `slot_native_feed` | Inside Video Catalog Grid | **JuicyAds** | Native Recommendation Widget | Dynamic / CPC | 🎯 **Highest CTR.** Blends seamlessly with video thumbnails; visitors click thinking it's another related video. |
| **5** | `slot_below_player` | Directly Under Video Player | **JuicyAds** | 300x250 Medium Rectangle | Dynamic / Flat Rate | Allows direct advertisers to rent this prime real-estate for flat monthly fees ($100–$500/mo). |
| **6** | `slot_top_banner` | Below Header & Tabs | **TrafficFactory** *(or ExoClick)* | 728x90 Leaderboard / 300x100 | **$1.50 – $6.00+** | High-paying premium desktop display banners (swap to TrafficFactory once reaching 1,000+ daily views). |

---

## 2. Revenue Breakdown & Projections (1,000 Visitors)

| Monetization Channel | Daily Impressions / Actions | Est. eCPM / CPC | Daily Earnings |
| :--- | :---: | :---: | :---: |
| **Popunder** (Adsterra capped 1/24h) | 1,000 pops | $3.50 eCPM | **$3.50** |
| **In-Stream Pre-Roll** (ExoClick VAST) | 1,500 plays | $6.00 eCPM | **$9.00** |
| **Sticky Bottom Banner** (ExoClick 30s refresh) | 6,000 views | $1.50 eCPM | **$9.00** |
| **Native In-Feed Grid** (JuicyAds clicks) | 50 clicks | $0.15 CPC | **$7.50** |
| **Below-Player & Top Banners** | 2,500 impressions | $0.80 eCPM | **$2.00** |
| **ESTIMATED TOTAL (1,000 Visitors/day)** | — | — | **~$31.00 / day** |
| **ESTIMATED TOTAL (10,000 Visitors/day)** | — | — | **~$310.00 / day** |

---

## 3. Step-by-Step Network Rollout Plan

### Phase 1: Start with the "Big 3" Today
1. **ExoClick** (Already Approved & Active)
   - Created: Sticky Bottom Banner (`Zone 6091570`)
   - Next: In-Stream Video VAST 3.0 Pre-Roll
2. **Adsterra** (Sign up at `adsterra.com`)
   - Instant automated approval for adult websites.
   - Used exclusively for `slot_popunder` (Capped 1/24h).
   - Fast bi-monthly payouts starting from just $5.
3. **JuicyAds** (Sign up at `juicyads.com`)
   - The king of adult native ads and direct banner sales.
   - Used for `slot_native_feed` (Recommendation Widget) and `slot_below_player` (300x250).

### Phase 2: Add TrafficFactory Later
- **TrafficFactory** prefers websites with steady, established daily traffic (1,000+ views/day).
- Keep `slot_top_banner` running on ExoClick initially, then upgrade to TrafficFactory once daily traffic milestones are met.

---

## 4. Critical Ad Rules & Best Practices

### ⚠️ The Strict 1-Popunder Rule
- **NEVER** run popunders from two different networks simultaneously (e.g., ExoClick popunder + Adsterra popunder).
- If multiple popunder scripts fire on the same click, Chrome and mobile Safari block both as spam, resulting in $0 earnings and frustrated users.
- **Rule:** Run popunder through **Adsterra only**, strictly frequency-capped at **1 pop per user per 24 hours**.

### 📦 Ad Types: Floating vs In-Page Containers
1. **Floating / Sticky Ads (ExoClick Sticky Banner):**
   - ExoClick's script builds its own floating container, background, and `[X]` close button.
   - The site should NOT wrap this in a redundant card or "Sponsored" frame.
2. **In-Page Display Ads (300x250, 728x90, Native):**
   - These are raw banners without floating containers.
   - The site provides the container dimensions to prevent layout shifts (CLS) and align with page margins.

### 🛡️ Clean Ad Filtering (Safe Browsing Protection)
To prevent search engines or browser security from flagging your domain:
- 🔴 **BLOCK:** `Browser Extension / Toolbar`, `AntiVirus`, `Device Enhancement` (scareware).
- 🔴 **BLOCK:** `Back Button Offer` (prevents back-button hijacking).
- 🟢 **ALLOW:** `Adult Dating`, `Webcams`, `Paysite/VOD`, `Games`, `VPN`, `Casino/Betting` (Highest paying offers).

---

## 5. Technical Architecture in the Codebase

- **Admin Control Panel:** `src/pages/Admin.jsx` (Manage all ad zones visually from `/admin` $\rightarrow$ Ad Zones tab).
- **Default Settings & State:** `src/services/store.js` (`DEFAULT_AD_SETTINGS`).
- **Cloud Database Persistence:** `src/services/supabase.js` (`ad_settings` table).
- **Ad Rendering Engine:** `src/components/AdSlot.jsx` (Dynamic script execution, CLS protection, ad-block detection).
- **Sticky Footer Controller:** `src/components/StickyFooter.jsx`.
- **Pre-Roll Controller:** `src/components/VideoPlayer.jsx`.
- **Popunder Trigger:** `src/components/PopunderTrigger.jsx` (Enforces 24-hour cookie cooldown).

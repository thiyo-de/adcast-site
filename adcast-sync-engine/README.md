# ⚡ AdCast Video Sync Engine

> **Autonomous Video Aggregation & Syndication Pipeline for AdCast**  
> Runs in complete isolation from the main frontend project to keep the website 100% safe, fast, and untouchable.

---

## 🎯 Architecture Overview

```
 [ Target Video Websites ]
   (Webmaster APIs / MRSS Feeds / HTML Catalogs)
              │
              ▼
   [ adcast-sync-engine ]  <--- Completely isolated project
     ├── Stealth Headers & User-Agent Pool
     ├── Deduplication Engine (prevents duplicate embeds)
     └── Data Normalizer (converts tags, durations, ratings)
              │
              ▼ Direct Service-Role Connection
     [ Supabase Cloud Database (PostgreSQL) ]
              ▲
              │ Public Anon Connection (Cached / Read-Only)
   [ AdCast Web App (Vite + React) ]
```

### Why this architecture is best:
- **Zero Frontend Risk:** The main website repository remains pure, clean, and untouched. Scraper errors or external site changes will never crash your website.
- **Zero Server Media Costs:** Only lightweight embed metadata (`embed_url`, `thumbnail_url`, `duration`, etc.) is stored in Supabase. Supabase Free Tier can store 500,000+ embed records with zero hosting fees.
- **Deduplication Engine:** Videos already present in Supabase are automatically detected by `embed_url` and skipped so your database stays pristine without duplicates.

---

## 🚀 Quick Start (Local Machine)

### 1. Install Dependencies
Open your terminal in this directory (`Website AdSense/adcast-sync-engine`):
```bash
npm install
```

### 2. Verify Credentials
Check `.env` to ensure your Supabase connection strings are present:
```env
SUPABASE_URL=https://hrvlgnnetoexdbaaebfo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUz...
SYNC_CRON="0 */2 * * *"
MAX_VIDEOS_PER_RUN=15
```

### 3. Run a One-Time Sync
To fetch new videos immediately:
```bash
npm run sync
```
*Output will show live progress, scraped candidates, deduplication status, and the new total count in Supabase.*

### 4. Run the Background Cron Daemon
To leave the sync engine running locally in the background (runs automatically every 2 hours):
```bash
npm run cron
```

---

## 🛠️ Adding New Target Sites (`sources.json`)

You can add, edit, or toggle video sources simply by modifying [sources.json](file:///d:/Thiyo/Website%20AdSense/adcast-sync-engine/sources.json). You do **not** need to touch any JavaScript code.

### Option A: Webmaster JSON API (Recommended — 100% Immune to Cloudflare)
Most major tube platforms provide public webmaster feeds that bypass anti-bot systems completely:
```json
{
  "id": "my-tube-source",
  "name": "My Tube Partner Feed",
  "type": "json_api",
  "url": "https://api.example.com/v2/webmaster/search/?order=top-weekly&format=json",
  "enabled": true,
  "category": "Trending",
  "mapping": {
    "itemsPath": "videos",
    "titleField": "title",
    "embedField": "embed",
    "thumbField": "default_thumb.src",
    "durationField": "length_sec",
    "keywordsField": "keywords"
  }
}
```

### Option B: MRSS / XML Webmaster Feed
For platforms that publish RSS / Media RSS feeds:
```json
{
  "id": "tube-mrss-feed",
  "name": "Tube MRSS Feed",
  "type": "mrss_feed",
  "url": "https://www.example.com/webmaster/feed.xml",
  "enabled": true,
  "category": "Action"
}
```

### Option C: HTML Page Scraper
For websites without an API:
```json
{
  "id": "tube-html-catalog",
  "name": "Tube HTML Scraper",
  "type": "html_scrape",
  "url": "https://www.example.com/videos",
  "enabled": true,
  "category": "Cinematic",
  "selectors": {
    "card": ".video-item",
    "title": ".video-title",
    "thumb": "img.thumbnail",
    "link": "a.watch-link",
    "duration": ".duration-badge"
  }
}
```

---

## ☁️ 24/7 Free Cloud Automation (GitHub Actions)

If you don't want to keep your computer running, you can run this sync engine 100% free using GitHub Actions!

1. Create a private GitHub repository for this `adcast-sync-engine` directory.
2. In GitHub, go to **Settings > Secrets and variables > Actions > New repository secret**:
   - `SUPABASE_URL`: Your Supabase URL (`https://hrvlgnnetoexdbaaebfo.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key
3. Push the code. GitHub Actions will automatically run the scraper every 4 hours via [.github/workflows/auto-sync.yml](file:///d:/Thiyo/Website%20AdSense/adcast-sync-engine/.github/workflows/auto-sync.yml) without costing you anything!

---

## 🔒 Cloudflare & Anti-Bot Protection Handling

- **Stealth User-Agents:** Automatically rotates across modern desktop browser profiles (Chrome 128, Firefox 129, Edge 127, Safari 17 on Windows and macOS).
- **Humanized Request Throttling:** Adds 2–5 second random delays between requests to prevent IP rate-limiting.
- **Webmaster Feed Priority:** Webmaster endpoints (e.g. `/api/v2/webmaster/`) are explicitly designed by video networks for syndication and bypass Cloudflare bot challenges by default.

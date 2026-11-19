import * as cheerio from 'cheerio';
import { safeFetch } from '../utils/safeFetch.js';
import { normalizeVideo, parseCount } from '../utils/normalizer.js';
import { sleep } from '../utils/userAgents.js';

/**
 * Dedicated Scraper for HornyLeak.tv
 * Automatically extracts video metadata and generates clean embed iframe links
 */
export async function scrapeHornyLeak(source, limit = 15) {
  const { url, category = 'Trending' } = source;
  console.log(`  [HORNYLEAK] Scraping catalog: ${url} (target limit: ${limit})`);

  const items = [];
  const seenIds = new Set();
  let currentUrl = url;
  let page = 1;
  const MAX_PAGES = 5;

  while (currentUrl && items.length < limit && page <= MAX_PAGES) {
    if (page > 1) {
      console.log(`  [HORNYLEAK] Crawling next page (${page}): ${currentUrl}`);
      await sleep(1500); // Polite rate limit between pages
    }

    const response = await safeFetch(currentUrl, { timeout: 15000 });
    if (response.isChallenge) {
      console.warn(`  [HORNYLEAK] Cloudflare/anti-bot challenge encountered on: ${currentUrl}`);
      if (items.length > 0) break;
      const res = [];
      res.isChallenge = true;
      res.challengeReason = response.challengeReason || 'Cloudflare challenge active';
      return res;
    }
    if (!response.ok || !response.data) {
      console.warn(`  [HORNYLEAK] Failed fetching catalog: HTTP ${response.status}`);
      break;
    }

    const $ = cheerio.load(response.data);
    const cards = $('.thumbs .thumb.item, .thumb_rel.item, .thumb.item');

    if (cards.length === 0) {
      break;
    }

    cards.each((i, el) => {
      if (items.length >= limit) return false;

      const $el = $(el);
      const linkEl = $el.find('a[href*="/video/"]').first();
      const href = linkEl.attr('href') || '';

      // Match video ID e.g. /video/33745/...
      const idMatch = href.match(/\/video\/(\d+)\//);
      if (!idMatch || !idMatch[1]) return;

      const videoId = idMatch[1];
      if (seenIds.has(videoId)) return;
      seenIds.add(videoId);

      const embedUrl = `https://www.hornyleak.tv/embed/${videoId}/`;

      // Title
      const title = $el.find('a.title').first().attr('title') ||
                    $el.find('a.title').first().text().trim() ||
                    $el.find('a[title]').first().attr('title') ||
                    $el.find('img').first().attr('alt') ||
                    '';

      if (!title) return;

      // Thumbnail
      let thumb = $el.find('img').first().attr('src') ||
                  $el.find('img').first().attr('data-webp') ||
                  $el.find('img').first().attr('data-original') ||
                  $el.find('img').first().attr('data-src') ||
                  '';

      if (thumb && !thumb.startsWith('http')) {
        try {
          thumb = new URL(thumb, 'https://www.hornyleak.tv').href;
        } catch (e) {}
      }

      // Duration
      const duration = $el.find('.item-bottom .time').first().text().trim();

      // Views (e.g. "612K")
      let rawViews = '';
      $el.find('.thumb-bottom .thumb-item').each((_, item) => {
        const txt = $(item).text().trim();
        if (txt.includes('K') || txt.includes('M') || /\d+/.test(txt)) {
          if (!txt.includes('ago')) {
            rawViews = txt;
          }
        }
      });

      // Model or Tag
      const modelName = $el.find('.item-name .name').first().text().trim();
      const tags = [category.toLowerCase(), 'leak', 'hot'];
      if (modelName) {
        tags.unshift(modelName.toLowerCase());
      }

      items.push(
        normalizeVideo({
          title,
          embed_url: embedUrl,
          thumbnail_url: thumb,
          duration,
          category,
          tags,
          views: rawViews ? parseCount(rawViews) : undefined
        })
      );
    });

    if (items.length >= limit) break;

    // Discover next page URL
    let nextHref = $('a.next, .pagination .next a, a[rel="next"], .pagination-next a, li.next a').first().attr('href');
    if (nextHref) {
      try {
        currentUrl = new URL(nextHref, currentUrl).href;
        page++;
      } catch {
        currentUrl = null;
      }
    } else {
      // Fallback: try page param increment
      try {
        const nextUrlObj = new URL(currentUrl);
        const curPage = parseInt(nextUrlObj.searchParams.get('page') || '1', 10);
        nextUrlObj.searchParams.set('page', String(curPage + 1));
        currentUrl = nextUrlObj.href;
        page++;
      } catch {
        currentUrl = null;
      }
    }
  }

  return items;
}

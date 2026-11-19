import * as cheerio from 'cheerio';
import { safeFetch } from '../utils/safeFetch.js';
import { sleep } from '../utils/userAgents.js';
import { normalizeVideo } from '../utils/normalizer.js';

/**
 * Scrapes video listing pages using Cheerio CSS selectors
 */
export async function scrapeHtml(source, limit = 15) {
  const { url, selectors = {}, category = 'Trending' } = source;
  console.log(`  [HTML CRAWLER] Scraping: ${url} (target limit: ${limit})`);

  const cardSelector = selectors.card || '.video-item, .thumb-block, article';
  const titleSelector = selectors.title || '.video-title, .title, h3, a[title]';
  const thumbSelector = selectors.thumb || 'img.thumb, img[src*="thumb"], img';
  const linkSelector = selectors.link || 'a.video-link, a[href*="/video/"], a';
  const durationSelector = selectors.duration || '.duration, .time, .badge-duration';
  const nextSelector = selectors.next_page || 'a.next, .pagination .next a, a[rel="next"], .pagination-next a, li.next a';

  const items = [];
  const seenUrls = new Set();
  let currentUrl = url;
  let page = 1;
  const MAX_PAGES = 10;

  while (currentUrl && items.length < limit && page <= MAX_PAGES) {
    if (page > 1) {
      console.log(`  [HTML CRAWLER] Crawling next page (${page}): ${currentUrl}`);
      await sleep(1500); // Polite rate limit between pages
    }

    const response = await safeFetch(currentUrl, { timeout: 15000 });
    if (response.isChallenge) {
      console.warn(`  [HTML CRAWLER] Cloudflare/anti-bot challenge encountered on: ${currentUrl}`);
      if (items.length > 0) break;
      const res = [];
      res.isChallenge = true;
      res.challengeReason = response.challengeReason || 'Cloudflare challenge active';
      return res;
    }
    if (!response.ok || !response.data) {
      console.warn(`  [HTML CRAWLER] Failed fetching catalog: HTTP ${response.status}`);
      break;
    }

    const html = response.data;
    const $ = cheerio.load(html);
    const cards = $(cardSelector);

    if (cards.length === 0) {
      break;
    }

    for (let i = 0; i < cards.length; i++) {
      if (items.length >= limit) break;

      const el = cards[i];
      const $el = $(el);

      const title = $el.find(titleSelector).first().text().trim() ||
        $el.find(titleSelector).first().attr('title') ||
        $el.find('img').first().attr('alt') ||
        '';

      let rawThumb = $el.find(thumbSelector).first().attr('data-src') ||
        $el.find(thumbSelector).first().attr('data-original') ||
        $el.find(thumbSelector).first().attr('src') ||
        '';

      let rawLink = $el.find(linkSelector).first().attr('href') || '';
      const duration = $el.find(durationSelector).first().text().trim();

      // Resolve relative URLs to absolute
      if (rawLink && !rawLink.startsWith('http')) {
        try {
          rawLink = new URL(rawLink, currentUrl).href;
        } catch (e) {}
      }

      if (rawThumb && !rawThumb.startsWith('http')) {
        try {
          rawThumb = new URL(rawThumb, currentUrl).href;
        } catch (e) {}
      }

      if (title && rawLink && !seenUrls.has(rawLink)) {
        seenUrls.add(rawLink);
        items.push(
          normalizeVideo({
            title,
            embed_url: rawLink,
            thumbnail_url: rawThumb,
            duration,
            category,
            tags: [category.toLowerCase(), 'scraped']
          })
        );
      }
    }

    if (items.length >= limit) break;

    // Follow provider-supported next link or selectors.next_page
    let nextHref = $(nextSelector).first().attr('href');
    if (nextHref) {
      try {
        currentUrl = new URL(nextHref, currentUrl).href;
        page++;
      } catch {
        currentUrl = null;
      }
    } else {
      currentUrl = null;
    }
  }

  return items;
}

import axios from 'axios';
import * as cheerio from 'cheerio';
import { getStealthHeaders, sleep } from '../utils/userAgents.js';
import { normalizeVideo } from '../utils/normalizer.js';

/**
 * Scrapes video listing pages using Cheerio CSS selectors
 */
export async function scrapeHtml(source, limit = 15) {
  const { url, selectors = {}, category = 'Trending' } = source;
  console.log(`  [HTML CRAWLER] Scraping: ${url}`);

  const cardSelector = selectors.card || '.video-item, .thumb-block, article';
  const titleSelector = selectors.title || '.video-title, .title, h3, a[title]';
  const thumbSelector = selectors.thumb || 'img.thumb, img[src*="thumb"], img';
  const linkSelector = selectors.link || 'a.video-link, a[href*="/video/"], a';
  const durationSelector = selectors.duration || '.duration, .time, .badge-duration';

  const response = await axios.get(url, {
    headers: getStealthHeaders(url),
    timeout: 15000
  });

  const html = response.data;
  const $ = cheerio.load(html);
  const items = [];

  const cards = $(cardSelector);
  const max = Math.min(cards.length, limit);

  for (let i = 0; i < max; i++) {
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
        rawLink = new URL(rawLink, url).href;
      } catch (e) {}
    }

    if (rawThumb && !rawThumb.startsWith('http')) {
      try {
        rawThumb = new URL(rawThumb, url).href;
      } catch (e) {}
    }

    if (title && rawLink) {
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

  return items;
}

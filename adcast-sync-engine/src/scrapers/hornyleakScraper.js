import * as cheerio from 'cheerio';
import { safeFetch } from '../utils/safeFetch.js';
import { normalizeVideo, parseCount } from '../utils/normalizer.js';

/**
 * Dedicated Scraper for HornyLeak.tv
 * Automatically extracts video metadata and generates clean embed iframe links
 */
export async function scrapeHornyLeak(source, limit = 15) {
  const { url, category = 'Trending' } = source;
  console.log(`  [HORNYLEAK] Scraping catalog: ${url}`);

  const response = await safeFetch(url, { timeout: 15000 });
  if (response.isChallenge) {
    console.warn(`  [HORNYLEAK] Cloudflare/anti-bot challenge encountered on: ${url}`);
    const res = [];
    res.isChallenge = true;
    res.challengeReason = response.challengeReason || 'Cloudflare challenge active';
    return res;
  }
  if (!response.ok || !response.data) {
    console.warn(`  [HORNYLEAK] Failed fetching catalog: HTTP ${response.status}`);
    return [];
  }

  const $ = cheerio.load(response.data);
  const items = [];

  const cards = $('.thumbs .thumb.item, .thumb_rel.item, .thumb.item');

  cards.each((i, el) => {
    if (items.length >= limit) return false;

    const $el = $(el);
    const linkEl = $el.find('a[href*="/video/"]').first();
    const href = linkEl.attr('href') || '';

    // Match video ID e.g. /video/33745/...
    const idMatch = href.match(/\/video\/(\d+)\//);
    if (!idMatch || !idMatch[1]) return;

    const videoId = idMatch[1];
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

  return items;
}

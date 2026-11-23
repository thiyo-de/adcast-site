import * as cheerio from 'cheerio';
import { safeFetch } from '../utils/safeFetch.js';
import { normalizeVideo, parseCount } from '../utils/normalizer.js';
import { sleep } from '../utils/userAgents.js';

/**
 * Dedicated Scraper for Mydesi.fun
 * Extracts top videos with thumbnails, durations, views, and direct stream / embed player URLs.
 */
export async function scrapeMyDesi(source = {}, limit = 20) {
  const targetLimit = limit || 20;
  const baseUrl = (source.url || 'https://mydesi.fun/').replace(/\/+$/, '') + '/';
  const category = source.category || 'Indian Leaks';
  const sourceId = source.id || 'mydesi-top';

  console.log(`  [MYDESI] Crawling catalog: ${baseUrl} (target: ${targetLimit} videos)`);

  const items = [];
  const seenPostUrls = new Set();
  let currentUrl = baseUrl;
  let page = 1;
  const MAX_PAGES = 5;

  // 1. Gather video cards from catalog pages
  const catalogCards = [];

  while (currentUrl && catalogCards.length < targetLimit && page <= MAX_PAGES) {
    if (page > 1) {
      console.log(`  [MYDESI] Fetching catalog page ${page}: ${currentUrl}`);
      await sleep(1000);
    }

    const response = await safeFetch(currentUrl, { timeout: 15000 });
    if (response.isChallenge) {
      console.warn(`  [MYDESI] Anti-bot challenge encountered on: ${currentUrl}`);
      break;
    }
    if (!response.ok || !response.data) {
      console.warn(`  [MYDESI] Failed fetching catalog page: HTTP ${response.status}`);
      break;
    }

    const $ = cheerio.load(response.data);
    const cardElements = $('.video-block');

    if (cardElements.length === 0) {
      console.warn(`  [MYDESI] No .video-block elements found on ${currentUrl}`);
      break;
    }

    cardElements.each((_, el) => {
      if (catalogCards.length >= targetLimit) return false;

      const $el = $(el);
      const postId = $el.attr('data-post-id') || '';
      const linkEl = $el.find('a.thumb, a.infos').first();
      let postUrl = linkEl.attr('href') || '';

      if (!postUrl) return;
      if (!postUrl.startsWith('http')) {
        try {
          postUrl = new URL(postUrl, baseUrl).href;
        } catch {}
      }

      if (seenPostUrls.has(postUrl)) return;
      seenPostUrls.add(postUrl);

      // Title
      const title = $el.find('.title').first().text().trim() ||
                    $el.find('a.infos').first().attr('title') ||
                    $el.find('img').first().attr('alt') ||
                    '';

      // Thumbnail
      let thumb = $el.find('img').first().attr('data-src') ||
                  $el.find('img').first().attr('src') ||
                  '';
      if (thumb && !thumb.startsWith('http')) {
        try {
          thumb = new URL(thumb, baseUrl).href;
        } catch {}
      }

      // Views
      const viewsRaw = $el.find('.views-number').first().text().replace(/[^\d.KMkm]/g, '').trim();

      // Rating
      const ratingRaw = $el.find('.rating').first().text().replace(/[^\d]/g, '').trim();

      // Duration badge if present
      const durationRaw = $el.find('.duration, .time, .badge-duration').first().text().trim();

      // Featured badge / ribbon detection
      const isFeatured = $el.hasClass('featured') ||
                        $el.find('.featured, .badge-featured, .ribbon-featured, .is-featured').length > 0;

      catalogCards.push({
        postId,
        postUrl,
        title,
        thumbnailUrl: thumb,
        views: viewsRaw ? parseCount(viewsRaw) : undefined,
        rating: ratingRaw ? parseInt(ratingRaw, 10) : 95,
        duration: durationRaw || '10:00',
        isFeatured
      });
    });

    if (catalogCards.length >= targetLimit) break;

    // Next page link
    const nextHref = $('a.next, .pagination .next a, a[rel="next"], .page-item a.page-link').filter((_, a) => {
      return $(a).text().toLowerCase().includes('next') || $(a).attr('rel') === 'next';
    }).first().attr('href');

    if (nextHref) {
      try {
        currentUrl = new URL(nextHref, baseUrl).href;
        page++;
      } catch {
        currentUrl = null;
      }
    } else {
      // Fallback WordPress pagination /page/2/
      page++;
      currentUrl = `${baseUrl}page/${page}/`;
    }
  }

  console.log(`  [MYDESI] Found ${catalogCards.length} video card(s). Resolving video streams & embed players...`);

  // 2. Fetch detail page for each card to extract direct video stream and iframe embed
  for (let i = 0; i < catalogCards.length; i++) {
    const card = catalogCards[i];
    console.log(`    [${i + 1}/${catalogCards.length}] Inspecting: "${card.title.substring(0, 40)}..."`);

    let embedUrl = card.postUrl;
    let streamUrl = null;
    let tags = [category.toLowerCase(), 'desi', 'mms'];
    let duration = card.duration;

    try {
      await sleep(500); // Polite rate limit
      const detailRes = await safeFetch(card.postUrl, { timeout: 12000 });

      if (detailRes.ok && detailRes.data) {
        const $d = cheerio.load(detailRes.data);

        // Check for clean-tube-player iframe
        const iframeSrc = $d('.single-video-player iframe, .video-player iframe, iframe').first().attr('src');
        if (iframeSrc) {
          embedUrl = iframeSrc.startsWith('http') ? iframeSrc : new URL(iframeSrc, baseUrl).href;

          // Attempt to decode base64 'q' param inside clean-tube-player
          try {
            const urlObj = new URL(embedUrl);
            const qParam = urlObj.searchParams.get('q');
            if (qParam) {
              let decodedTag = Buffer.from(qParam, 'base64').toString('utf8');
              try {
                decodedTag = decodeURIComponent(decodedTag);
              } catch {}
              const srcMatch = decodedTag.match(/src=["']([^"']+)["']/i);
              if (srcMatch && srcMatch[1]) {
                streamUrl = srcMatch[1];
              }
            }
          } catch {}
        }

        // Direct contentURL meta tag
        const contentUrlMeta = $d('meta[itemprop="contentURL"]').attr('content');
        if (contentUrlMeta) {
          streamUrl = streamUrl || contentUrlMeta;
        }

        // Higher-resolution thumbnail from OG tag
        const ogImage = $d('meta[property="og:image"]').attr('content');
        if (ogImage && ogImage.startsWith('http')) {
          card.thumbnailUrl = ogImage;
        }

        // Duration from itemprop="duration"
        const metaDuration = $d('meta[itemprop="duration"]').attr('content');
        if (metaDuration && metaDuration !== 'P0DT0H0M0S') {
          // e.g. PT10M30S
          const match = metaDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          if (match) {
            const h = match[1] ? parseInt(match[1], 10) : 0;
            const m = match[2] ? parseInt(match[2], 10) : 0;
            const s = match[3] ? parseInt(match[3], 10) : 0;
            const pad = (n) => String(n).padStart(2, '0');
            duration = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
          }
        }

        // Extract tags and categories
        $d('.category a, .tags-list a, a[rel="category tag"], a[rel="tag"]').each((_, t) => {
          const tagTxt = $d(t).text().trim().toLowerCase();
          if (tagTxt && !tags.includes(tagTxt)) {
            tags.push(tagTxt);
          }
        });
      }
    } catch (err) {
      console.warn(`    [WARN] Error fetching details for ${card.postUrl}: ${err.message}`);
    }

    // Stream URL preference:
    // Direct stream (MP4/HLS) takes top priority over blocked clean-tube-player iframes
    const finalEmbed = streamUrl || (embedUrl && embedUrl !== card.postUrl ? embedUrl : null);

    if (!finalEmbed) {
      console.warn(`    [MYDESI SKIP] Skipping post without playable video stream or embed player: "${card.title}"`);
      continue;
    }

    const normalized = normalizeVideo({
      source_id: sourceId,
      title: card.title,
      embed_url: finalEmbed,
      thumbnail_url: card.thumbnailUrl,
      duration: duration || '10:00',
      category: category,
      tags: tags.slice(0, 8),
      views: card.views || Math.floor(Math.random() * 20000 + 5000),
      rating: card.rating || 96,
      is_featured: Boolean(card.isFeatured || i < 5)
    });

    // Attach stream_url if resolved
    if (streamUrl) {
      normalized.stream_url = streamUrl;
    }

    items.push(normalized);
  }

  return items;
}

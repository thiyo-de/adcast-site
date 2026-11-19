import * as cheerio from 'cheerio';
import { safeFetch } from './utils/safeFetch.js';
import { scrapeJsonApi } from './scrapers/jsonApiScraper.js';
import { scrapeFeed } from './scrapers/feedParser.js';
import { scrapeHtml } from './scrapers/htmlCrawler.js';
import { scrapeHornyLeak } from './scrapers/hornyleakScraper.js';

/**
 * Autonomous Source Discovery Engine
 * Implements Section 4 of AUTONOMOUS-VIDEO-ENGINE-PRODUCTION-PLAN.md
 * Analyzes arbitrary root URLs to identify the optimal ingestion adapter,
 * tests candidate endpoints, and extracts sample stream metadata.
 */
export async function discoverSource(targetUrl) {
  let url = targetUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  console.log(`[DISCOVERY ENGINE] Probing target: ${url}`);

  // Step 1: Initial safe fetch of the target URL
  let response;
  try {
    response = await safeFetch(url, { timeout: 12000 });
  } catch (err) {
    return {
      ok: false,
      status: 'unreachable',
      message: `Failed to connect to destination: ${err.message}`
    };
  }

  // Cloudflare & Bot Challenge Detection
  if (response.isChallenge) {
    return {
      ok: false,
      status: 'blocked_challenge',
      message: 'Website is protected by Cloudflare bot protection / Turnstile challenge.',
      reason: response.challengeReason
    };
  }

  if (!response.ok || !response.data) {
    return {
      ok: false,
      status: 'http_error',
      message: `Target server returned HTTP ${response.status}`
    };
  }

  const rawData = response.data;

  // Step 2: Check if target URL is already a direct JSON API
  if (typeof rawData === 'object' || (typeof rawData === 'string' && rawData.trim().startsWith('{') && rawData.trim().endsWith('}'))) {
    try {
      const parsed = typeof rawData === 'object' ? rawData : JSON.parse(rawData);
      const sample = await scrapeJsonApi({ url, mapping: {} }, 3);
      if (sample && sample.length > 0) {
        return {
          ok: true,
          detectedType: 'json_api',
          recommendedUrl: url,
          confidence: 'high',
          sampleItems: sample.slice(0, 3),
          details: { message: `Detected active JSON video API with ${sample.length} sample stream(s).` }
        };
      }
    } catch (e) {}
  }

  // Step 3: Check if target URL is already an XML / MRSS Feed
  if (typeof rawData === 'string' && (rawData.includes('<rss') || rawData.includes('<feed') || rawData.includes('xmlns:media'))) {
    try {
      const sample = await scrapeFeed({ url }, 3);
      if (sample && sample.length > 0) {
        return {
          ok: true,
          detectedType: 'mrss_feed',
          recommendedUrl: url,
          confidence: 'high',
          sampleItems: sample.slice(0, 3),
          details: { message: `Detected standard MRSS video feed with ${sample.length} sample stream(s).` }
        };
      }
    } catch (e) {}
  }

  // Step 4: Parse HTML to probe for Feeds, APIs, and Embed Cards
  if (typeof rawData === 'string') {
    const $ = cheerio.load(rawData);
    const pageTitle = $('title').first().text().trim() || new URL(url).hostname;

    // 4a. Check HTML <head> for linked MRSS/RSS feeds
    const feedLink = $('link[type*="rss+xml"], link[type*="atom+xml"], link[rel="alternate"][type*="xml"]').first().attr('href');
    if (feedLink) {
      try {
        const resolvedFeed = new URL(feedLink, url).href;
        console.log(`[DISCOVERY] Discovered linked feed: ${resolvedFeed}`);
        const sample = await scrapeFeed({ url: resolvedFeed }, 3);
        if (sample && sample.length > 0) {
          return {
            ok: true,
            detectedType: 'mrss_feed',
            recommendedUrl: resolvedFeed,
            confidence: 'high',
            sampleItems: sample.slice(0, 3),
            details: { title: pageTitle, message: `Discovered linked MRSS feed in page header.` }
          };
        }
      } catch (e) {}
    }

    // 4b. Known Platform Match: HornyLeak pattern
    if (url.includes('hornyleak') || $('.thumbs .thumb.item, .thumb_rel.item').length > 0) {
      try {
        const sample = await scrapeHornyLeak({ url }, 3);
        if (sample && sample.length > 0) {
          return {
            ok: true,
            detectedType: 'hornyleak',
            recommendedUrl: url,
            confidence: 'high',
            sampleItems: sample.slice(0, 3),
            details: { title: pageTitle, message: 'Matched dedicated HornyLeak video platform.' }
          };
        }
      } catch (e) {}
    }

    // 4c. Probe Common API Endpoints on the same origin
    const origin = new URL(url).origin;
    const commonApiEndpoints = [
      '/api/v2/video/search/?query=trending&per_page=5&format=json',
      '/api/videos?limit=5',
      '/feed.xml',
      '/mrss.xml'
    ];

    for (const ep of commonApiEndpoints) {
      try {
        const testEndpoint = `${origin}${ep}`;
        const probeRes = await safeFetch(testEndpoint, { timeout: 6000 });
        if (probeRes.ok && probeRes.data) {
          if (ep.endsWith('format=json') || typeof probeRes.data === 'object') {
            const sample = await scrapeJsonApi({ url: testEndpoint, mapping: {} }, 3);
            if (sample && sample.length > 0) {
              return {
                ok: true,
                detectedType: 'json_api',
                recommendedUrl: testEndpoint,
                confidence: 'medium',
                sampleItems: sample.slice(0, 3),
                details: { title: pageTitle, message: `Discovered active API endpoint at ${ep}` }
              };
            }
          } else if (ep.endsWith('.xml') && typeof probeRes.data === 'string' && probeRes.data.includes('<rss')) {
            const sample = await scrapeFeed({ url: testEndpoint }, 3);
            if (sample && sample.length > 0) {
              return {
                ok: true,
                detectedType: 'mrss_feed',
                recommendedUrl: testEndpoint,
                confidence: 'medium',
                sampleItems: sample.slice(0, 3),
                details: { title: pageTitle, message: `Discovered standard feed at ${ep}` }
              };
            }
          }
        }
      } catch (e) {}
    }

    // 4d. Fallback: Heuristic HTML Catalog Crawler
    const cardSelectors = [
      '.video-item, .thumb-block, article.video, .thumb.item',
      '.video-card, .video_item, div[data-video-id]',
      'article, .item'
    ];

    for (const sel of cardSelectors) {
      const cards = $(sel);
      if (cards.length >= 2) {
        try {
          const sample = await scrapeHtml({ url, selectors: { card: sel } }, 3);
          if (sample && sample.length > 0) {
            return {
              ok: true,
              detectedType: 'html_scrape',
              recommendedUrl: url,
              confidence: 'medium',
              sampleItems: sample.slice(0, 3),
              details: {
                title: pageTitle,
                cardSelector: sel,
                message: `Discovered HTML video catalog using selector "${sel}".`
              }
            };
          }
        } catch (e) {}
      }
    }
  }

  return {
    ok: false,
    status: 'unsupported',
    message: 'Could not automatically identify video streams or playable embeds on this website. Please check the URL or specify custom mapping.'
  };
}

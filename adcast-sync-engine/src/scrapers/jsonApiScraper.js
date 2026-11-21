import { safeFetch } from '../utils/safeFetch.js';
import { normalizeVideo } from '../utils/normalizer.js';

/**
 * Safely retrieve nested property using dot-notation (e.g., 'default_thumb.src')
 */
function getDeepValue(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

/**
 * Fetch and parse videos from a Webmaster JSON API endpoint
 */
export async function scrapeJsonApi(source, limit = 15) {
  const { url, mapping = {}, category = 'Trending' } = source;
  console.log(`  [JSON API] Fetching: ${url}`);

  const response = await safeFetch(url, { timeout: 12000 });
  if (response.isChallenge) {
    console.warn(`  [JSON API] Cloudflare/anti-bot challenge encountered on: ${url}`);
    const res = [];
    res.isChallenge = true;
    res.challengeReason = response.challengeReason || 'Cloudflare challenge active';
    return res;
  }
  if (!response.ok || !response.data) {
    console.warn(`  [JSON API] Failed fetching API endpoint: HTTP ${response.status}`);
    return [];
  }

  const body = response.data;
  let items = [];

  if (mapping.itemsPath) {
    items = getDeepValue(body, mapping.itemsPath) || [];
  } else if (Array.isArray(body)) {
    items = body;
  } else if (Array.isArray(body.videos)) {
    items = body.videos;
  } else if (Array.isArray(body.items)) {
    items = body.items;
  }

  if (!Array.isArray(items)) {
    console.warn(`  [JSON API] No video array found in response for ${source.name}`);
    return [];
  }

  const sliced = items.slice(0, limit);
  const normalized = [];

  for (const raw of sliced) {
    const title = getDeepValue(raw, mapping.titleField || 'title');
    const embed = getDeepValue(raw, mapping.embedField || 'embed') || getDeepValue(raw, 'embed_url');
    const thumb = getDeepValue(raw, mapping.thumbField || 'default_thumb.src') || getDeepValue(raw, 'thumbnail_url');
    const duration = getDeepValue(raw, mapping.durationField || 'length_sec') || getDeepValue(raw, 'duration');
    const keywords = getDeepValue(raw, mapping.keywordsField || 'keywords') || getDeepValue(raw, 'tags');
    const views = getDeepValue(raw, mapping.viewsField || 'views');
    const rate = getDeepValue(raw, mapping.rateField || 'rate');

    if (!embed || !title) continue;

    const norm = normalizeVideo({
      source_id: source.id,
      title,
      embed_url: embed,
      thumbnail_url: thumb,
      duration,
      category,
      tags: keywords,
      views: views ? parseInt(views, 10) : undefined,
      rating: rate ? Math.min(100, Math.round(parseFloat(rate) * 20)) : undefined
    });

    normalized.push(norm);
  }

  return normalized;
}

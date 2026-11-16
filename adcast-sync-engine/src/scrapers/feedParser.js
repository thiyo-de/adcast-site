import axios from 'axios';
import * as cheerio from 'cheerio';
import { getStealthHeaders } from '../utils/userAgents.js';
import { normalizeVideo } from '../utils/normalizer.js';

/**
 * Parse an MRSS / RSS / XML Feed from a video website
 */
export async function scrapeFeed(source, limit = 15) {
  const { url, category = 'Trending' } = source;
  console.log(`  [MRSS FEED] Fetching: ${url}`);

  const response = await axios.get(url, {
    headers: getStealthHeaders(url),
    timeout: 15000,
    responseType: 'text'
  });

  const xml = response.data;
  const $ = cheerio.load(xml, { xmlMode: true });

  const items = [];
  $('item').each((i, el) => {
    if (i >= limit) return false;

    const $item = $(el);
    const title = $item.find('title').first().text();
    const link = $item.find('link').first().text();

    // Media RSS tags (media:player, media:content, media:thumbnail, etc.)
    const mediaContent = $item.find('media\\:content, content').attr('url') || '';
    const mediaPlayer = $item.find('media\\:player, player').attr('url') || '';
    const mediaThumb = $item.find('media\\:thumbnail, thumbnail').attr('url') || '';
    const duration = $item.find('media\\:content').attr('duration') ||
      $item.find('itunes\\:duration').text() ||
      $item.find('duration').text() ||
      '';
    const keywords = $item.find('media\\:keywords, keywords, category').text() || '';

    // Choose best embed or direct stream URL
    const embedUrl = mediaPlayer || mediaContent || link;

    if (title && embedUrl) {
      items.push(
        normalizeVideo({
          title,
          embed_url: embedUrl,
          thumbnail_url: mediaThumb,
          duration,
          category,
          tags: keywords
        })
      );
    }
  });

  return items;
}

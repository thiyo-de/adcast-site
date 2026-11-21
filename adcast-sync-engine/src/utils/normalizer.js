import crypto from 'crypto';

/**
 * Data Normalizer for AdCast Video Records
 * Converts raw scraped data into exact schema-compliant database records.
 */

/**
 * Parse strings like "612K", "1.2M", "45,000" into integer
 */
export function parseCount(val, fallback = 0) {
  if (!val) return fallback;
  if (typeof val === 'number') return Math.round(val);

  const clean = String(val).replace(/,/g, '').trim().toUpperCase();
  if (clean.endsWith('K')) {
    return Math.round(parseFloat(clean.slice(0, -1)) * 1000);
  }
  if (clean.endsWith('M')) {
    return Math.round(parseFloat(clean.slice(0, -1)) * 1000000);
  }
  const parsed = parseInt(clean, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Format duration into "MM:SS" or "HH:MM:SS"
 */
export function normalizeDuration(rawDuration) {
  if (!rawDuration) return '10:00';

  // If rawDuration is a number of seconds (e.g. 1349)
  if (!isNaN(rawDuration) && !String(rawDuration).includes(':')) {
    const totalSecs = parseInt(rawDuration, 10);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n) => String(n).padStart(2, '0');

    return hrs > 0 
      ? `${hrs}:${pad(mins)}:${pad(secs)}`
      : `${pad(mins)}:${pad(secs)}`;
  }

  const str = String(rawDuration).trim();
  if (str.includes(':')) {
    return str;
  }

  const minMatch = str.match(/(\d+)\s*(?:m|min)/i);
  const secMatch = str.match(/(\d+)\s*(?:s|sec)/i);
  const m = minMatch ? parseInt(minMatch[1], 10) : 10;
  const s = secMatch ? parseInt(secMatch[1], 10) : 0;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Parse duration string or number into total seconds (e.g. "12:34" -> 754)
 */
export function parseDurationSeconds(val, fallback = 600) {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : Math.round(val);
  const str = String(val).trim();
  if (!isNaN(str) && !str.includes(':')) {
    const parsed = parseInt(str, 10);
    return isNaN(parsed) ? fallback : parsed;
  }
  const parts = str.split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return fallback;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return fallback;
}

/**
 * Sanitize strings (remove HTML tags & decode common entities)
 */
export function sanitizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a random number between min and max
 */
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Automated 4-Category Classifier for Incoming Video Streams
 */
export function classifyAdultCategory(title = '', tags = [], fallback = 'Creator Leaks') {
  const text = `${title} ${(tags || []).join(' ')}`.toLowerCase();

  // 1. Hardcore
  if (/threesome|creampie|bbc|bdsm|facial|asshole|pounded|smashed|banged|anal|gangbang|deepthroat|rough|orgy|cum/i.test(text)) {
    return 'Hardcore';
  }

  // 2. Amateur
  if (/bedroom|ex-|ex!|cheating|best friend|vacation|missionary|teasing|college|alone|real life|homemade|couple|pov/i.test(text)) {
    return 'Amateur';
  }

  // 3. Trending
  if (/trending|viral|top rated|hottest|must watch/i.test(text)) {
    return 'Trending';
  }

  // 4. Default / Creator Leaks
  return fallback && ['Trending', 'Creator Leaks', 'Amateur', 'Hardcore'].includes(fallback)
    ? fallback
    : 'Creator Leaks';
}

/**
 * Normalize complete video record strictly matching public.videos schema:
 * Columns: id, title, embed_url, thumbnail_url, duration, category, tags, views, likes, is_featured, created_at
 */
export function normalizeVideo(raw) {
  const cleanTitle = sanitizeText(raw.title || 'Untitled Stream');
  const duration = normalizeDuration(raw.duration || raw.length_sec);
  const duration_seconds = parseDurationSeconds(raw.duration_seconds || raw.length_sec || duration);

  // Tags normalization
  let tags = [];
  if (Array.isArray(raw.tags)) {
    tags = raw.tags.map(t => sanitizeText(t).toLowerCase()).filter(Boolean);
  } else if (typeof raw.tags === 'string') {
    tags = raw.tags.split(',').map(t => sanitizeText(t).toLowerCase()).filter(Boolean);
  } else if (typeof raw.keywords === 'string') {
    tags = raw.keywords.split(',').map(t => sanitizeText(t).toLowerCase()).filter(Boolean);
  }
  if (tags.length === 0) {
    tags = ['trending', 'hot', 'stream'];
  }

  // Automated 4-Category Classifier
  const category = classifyAdultCategory(cleanTitle, tags, raw.category);

  // Default fallback thumbnail if missing
  const thumbnail_url = raw.thumbnail_url || raw.thumb || 
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';

  const views = parseCount(raw.views, 0);
  const likes = parseCount(raw.likes, 0);
  const rating = typeof raw.rating === 'number'
    ? Math.round(raw.rating)
    : (raw.rating ? parseInt(raw.rating, 10) : 95);

  return {
    id: crypto.randomUUID(),
    source_id: raw.source_id || raw.sourceId || null,
    title: cleanTitle,
    embed_url: raw.embed_url || raw.embed,
    thumbnail_url,
    duration,
    duration_seconds,
    category,
    tags,
    views,
    likes,
    rating,
    quality: raw.quality || '1080p',
    publication_state: raw.publication_state || 'published',
    health_state: raw.health_state || 'healthy',
    is_active: raw.is_active !== undefined ? Boolean(raw.is_active) : true,
    is_featured: Boolean(raw.is_featured),
    created_at: raw.created_at || new Date().toISOString()
  };
}

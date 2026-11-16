import crypto from 'crypto';

/**
 * Data Normalizer for AdCast Video Records
 * Converts raw scraped data into exact schema-compliant database records.
 */

/**
 * Parse strings like "612K", "1.2M", "45,000" into integer
 */
export function parseCount(val, fallback = 1000) {
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
 * Normalize complete video record strictly matching public.videos schema:
 * Columns: id, title, embed_url, thumbnail_url, duration, category, tags, views, likes, is_featured, created_at
 */
export function normalizeVideo(raw) {
  const cleanTitle = sanitizeText(raw.title || 'Untitled Stream');
  const duration = normalizeDuration(raw.duration || raw.length_sec);

  // Category normalization
  let category = raw.category || 'Trending';
  if (typeof category === 'string') {
    category = category.trim();
    if (!category) category = 'Trending';
  }

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

  // Default fallback thumbnail if missing
  const thumbnail_url = raw.thumbnail_url || raw.thumb || 
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';

  const views = parseCount(raw.views, randomBetween(45000, 480000));
  const likes = parseCount(raw.likes, Math.round(views * 0.045));

  return {
    id: crypto.randomUUID(),
    title: cleanTitle,
    embed_url: raw.embed_url || raw.embed,
    thumbnail_url,
    duration,
    category,
    tags,
    views,
    likes,
    is_featured: Boolean(raw.is_featured),
    created_at: raw.created_at || new Date().toISOString()
  };
}

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

let supabase = null;

export function getDbClient() {
  if (!supabase) {
    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new Error('Supabase credentials are not configured in .env!');
    }
    supabase = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return supabase;
}

/**
 * Check if a video with the same embed_url already exists
 */
export async function videoExists(embedUrl) {
  if (!embedUrl) return true;
  const db = getDbClient();
  const { data, error } = await db
    .from('videos')
    .select('id')
    .eq('embed_url', embedUrl.trim())
    .limit(1);

  if (error) {
    console.error('[DB CHECK ERROR]', error.message);
    // C13: Do not treat a failed existence query as proof that a video is new!
    return true;
  }
  return Boolean(data && data.length > 0);
}

/**
 * Filter duplicates and batch insert new videos
 */
export async function syncVideosToDb(videos) {
  if (!videos || videos.length === 0) {
    return { inserted: 0, skipped: 0, items: [] };
  }

  const db = getDbClient();
  const toInsert = [];
  const seenUrls = new Set();
  let skipped = 0;

  for (const video of videos) {
    if (!video.embed_url) {
      skipped++;
      continue;
    }

    const cleanUrl = video.embed_url.trim();
    if (seenUrls.has(cleanUrl)) {
      skipped++;
      continue;
    }
    seenUrls.add(cleanUrl);

    const exists = await videoExists(cleanUrl);
    if (exists) {
      skipped++;
    } else {
      toInsert.push({
        ...video,
        embed_url: cleanUrl
      });
    }
  }

  if (toInsert.length === 0) {
    return { inserted: 0, skipped, items: [] };
  }

  const { data, error } = await db
    .from('videos')
    .insert(toInsert)
    .select();

  if (error) {
    throw new Error(`Bulk insert failed: ${error.message}`);
  }

  return {
    inserted: data ? data.length : toInsert.length,
    skipped,
    items: data || toInsert
  };
}

/**
 * Get total videos currently stored in database
 */
export async function getTotalCount() {
  const db = getDbClient();
  
  // Try exact count
  const { count, error } = await db
    .from('videos')
    .select('*', { count: 'exact', head: true });

  if (!error && typeof count === 'number') {
    return count;
  }

  // Fallback: select id
  const { data } = await db.from('videos').select('id');
  return data ? data.length : 0;
}

/**
 * Fetch active target sources from database with fallback to sources.json
 */
export async function getActiveSources() {
  try {
    const db = getDbClient();
    const { data, error } = await db
      .from('crawler_sources')
      .select('*')
      .eq('is_enabled', true)
      .order('created_at', { ascending: true });

    if (!error) {
      // If table exists and query succeeded, database is authoritative.
      // C13: Treat a successful empty enabled-source result as "nothing to run."
      // Do not revive JSON sources when every database source is disabled.
      return data || [];
    }
  } catch (err) {
    console.warn('[DB SOURCES NOTICE] Database query failed, falling back to sources.json:', err.message);
  }
  return config.sources.filter(s => s.enabled);
}

/**
 * Record last synced timestamp on crawler source
 */
export async function updateSourceLastSynced(id) {
  try {
    const db = getDbClient();
    await db
      .from('crawler_sources')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', id);
  } catch (err) {}
}

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
    return false;
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
  let skipped = 0;

  for (const video of videos) {
    if (!video.embed_url) {
      skipped++;
      continue;
    }

    const exists = await videoExists(video.embed_url);
    if (exists) {
      skipped++;
    } else {
      toInsert.push(video);
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

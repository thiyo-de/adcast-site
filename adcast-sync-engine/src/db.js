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
 * Check if an embed URL has been tombstoned/suppressed by an admin (Anti-Zombie Protection)
 */
export async function isSuppressed(embedUrl) {
  if (!embedUrl) return true;
  const db = getDbClient();
  try {
    const { data, error } = await db
      .from('suppressed_videos')
      .select('id')
      .eq('embed_url', embedUrl.trim())
      .limit(1);

    if (error) {
      console.warn('[DB SUPPRESSION CHECK NOTICE]', error.message);
      return false;
    }
    return Boolean(data && data.length > 0);
  } catch {
    return false;
  }
}

/**
 * Filter duplicates, verify tombstones, and batch insert new videos
 */
export async function syncVideosToDb(videos, source = null) {
  if (!videos || videos.length === 0) {
    return { inserted: 0, skipped: 0, items: [] };
  }

  const db = getDbClient();
  const toInsert = [];
  const seenUrls = new Set();
  let skipped = 0;
  const isAutoApprove = source ? source.auto_approve !== false : true;

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

    // 1. Anti-Zombie check: Verify URL has not been tombstoned/suppressed
    const suppressed = await isSuppressed(cleanUrl);
    if (suppressed) {
      skipped++;
      continue;
    }

    // 2. Check if video already exists in master catalog
    const exists = await videoExists(cleanUrl);
    if (exists) {
      skipped++;
    } else {
      toInsert.push({
        ...video,
        embed_url: cleanUrl,
        health_state: 'healthy',
        publication_state: isAutoApprove ? 'published' : 'pending'
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

/**
 * Mark a video as permanently suppressed so it can never be re-imported
 */
export async function suppressVideo(embedUrl, reason = 'admin_deleted') {
  if (!embedUrl) return false;
  const db = getDbClient();
  try {
    const { error } = await db
      .from('suppressed_videos')
      .upsert({
        embed_url: embedUrl.trim(),
        reason,
        suppressed_at: new Date().toISOString()
      }, { onConflict: 'embed_url' });
    return !error;
  } catch (err) {
    console.error('[SUPPRESSION ERROR]', err.message);
    return false;
  }
}

/**
 * Get pagination checkpoint for a source
 */
export async function getSourceCheckpoint(sourceId) {
  if (!sourceId) return null;
  const db = getDbClient();
  try {
    const { data, error } = await db
      .from('source_checkpoints')
      .select('*')
      .eq('source_id', sourceId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Update pagination checkpoint for a source
 */
export async function updateSourceCheckpoint(sourceId, updates = {}) {
  if (!sourceId) return false;
  const db = getDbClient();
  try {
    const { error } = await db
      .from('source_checkpoints')
      .upsert({
        source_id: sourceId,
        ...updates,
        updated_at: new Date().toISOString()
      }, { onConflict: 'source_id' });
    return !error;
  } catch {
    return false;
  }
}


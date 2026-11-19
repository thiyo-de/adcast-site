import { getDbClient } from './db.js';
import { safeFetch } from './utils/safeFetch.js';
import { sleep } from './utils/userAgents.js';

// Common dead video phrase signatures found across tube and video platforms
const DEAD_SIGNATURES = [
  'video has been removed',
  'video deleted',
  'this video is no longer available',
  'file not found',
  '404 not found',
  'page not found',
  'video not found',
  'has been deleted',
  'no longer exists',
  'video was removed',
  'media could not be loaded',
  'content has been disabled'
];

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

/**
 * Checks a single embed URL to see if it is still live using SSRF-safe fetch
 */
export async function checkStreamHealth(embedUrl) {
  if (!embedUrl) return { isAlive: false, reason: 'Missing embed URL' };

  try {
    const res = await safeFetch(embedUrl, { timeout: 10000 });

    // Explicit connection drops (status 0), timeouts (status 408 / isTimeout), or Cloudflare challenges
    if (res.isTimeout || res.status === 408 || res.status === 0) {
      return {
        isAlive: null,
        isTransient: true,
        isUnknown: true,
        reason: res.error || (res.status === 408 ? 'HTTP 408 Request Timeout' : 'Connection dropped/refused (Status 0)')
      };
    }

    if (res.isChallenge) {
      return { isAlive: null, isTransient: true, isUnknown: true, reason: 'Cloudflare challenge active' };
    }

    // Explicit HTTP 404 (Not Found) or 410 (Gone) indicate potential dead stream
    if (res.status === 404 || res.status === 410) {
      return { isAlive: false, isTransient: false, isUnknown: false, reason: `HTTP ${res.status} Not Found` };
    }

    // Temporary server issues, 5xx, 429 rate limits, and generic 403 are transient
    if (res.status >= 500 || res.status === 429 || res.status === 403) {
      return { isAlive: null, isTransient: true, isUnknown: true, reason: `HTTP ${res.status} Transient` };
    }

    // Check specific HTML title or header tags for removal notices
    if (typeof res.data === 'string') {
      const titleMatch = res.data.match(/<title[^>]*>(.*?)<\/title>/i);
      const h1Match = res.data.match(/<h1[^>]*>(.*?)<\/h1>/i);
      const headline = ((titleMatch ? titleMatch[1] : '') + ' ' + (h1Match ? h1Match[1] : '')).toLowerCase();

      for (const sig of DEAD_SIGNATURES) {
        if (headline.includes(sig)) {
          return { isAlive: false, isTransient: false, isUnknown: false, reason: `Source Notice: "${sig}"` };
        }
      }
    }

    return { isAlive: true, isTransient: false, isUnknown: false, reason: null };
  } catch (err) {
    if (err.message.includes('Blocked destination')) {
      return { isAlive: false, isTransient: false, isUnknown: false, reason: 'Blocked: Private/internal destination (SSRF Defense)' };
    }
    if (err.code === 'ENOTFOUND') {
      return { isAlive: false, isTransient: false, isUnknown: false, reason: `Domain Offline (${err.code})` };
    }
    // Network timeouts or temporary connection drops are transient unknowns
    return { isAlive: null, isTransient: true, isUnknown: true, reason: err.code || 'Network connection timeout' };
  }
}

/**
 * Run full two-tier health audit across all active videos in database
 */
export async function runHealthCheck() {
  const startTime = Date.now();
  console.log('\n======================================================');
  console.log(`[HEALTH CHECKER] Starting Two-Tier Stream Audit at ${new Date().toISOString()}`);
  console.log('======================================================');

  const db = getDbClient();

  // Fetch active and suspect videos
  const { data: videos, error } = await db
    .from('videos')
    .select('id, title, embed_url, is_active, health_state, first_failed_at')
    .or('is_active.eq.true,is_active.is.null');

  if (error) {
    console.error('[HEALTH CHECK ERROR] Failed to fetch videos:', error.message);
    return;
  }

  console.log(`[AUDIT] Checking ${videos.length} active video stream(s)...`);

  let healthyCount = 0;
  let suspectCount = 0;
  let quarantinedCount = 0;
  let transientCount = 0;
  const now = new Date();

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    process.stdout.write(`  [${i + 1}/${videos.length}] Checking: "${v.title.substring(0, 32)}..." `);

    const health = await checkStreamHealth(v.embed_url);

    if (health.isTransient) {
      transientCount++;
      process.stdout.write(`\x1b[35m[UNKNOWN/TRANSIENT]\x1b[0m (${health.reason})\n`);

      // If video was not previously confirmed suspect or quarantined, accurately record as unknown
      if (v.health_state !== 'suspect' && v.health_state !== 'quarantined') {
        await db
          .from('videos')
          .update({
            health_state: 'unknown',
            last_health_check_at: now.toISOString()
          })
          .eq('id', v.id);
      } else {
        // Preserve existing suspect/quarantined status and first_failed_at evidence
        await db
          .from('videos')
          .update({ last_health_check_at: now.toISOString() })
          .eq('id', v.id);
      }
    } else if (health.isAlive === true) {
      healthyCount++;
      process.stdout.write('\x1b[32m[HEALTHY]\x1b[0m\n');

      // If video was previously suspect, recover it back to healthy
      if (v.health_state === 'suspect') {
        await db
          .from('videos')
          .update({
            health_state: 'healthy',
            first_failed_at: null,
            dead_reason: null,
            last_health_check_at: now.toISOString()
          })
          .eq('id', v.id);
      } else {
        await db
          .from('videos')
          .update({ last_health_check_at: now.toISOString() })
          .eq('id', v.id);
      }
    } else {
      // Stream failed health check. Apply two-tier confirmation buffer.
      const firstFailed = v.first_failed_at ? new Date(v.first_failed_at).getTime() : null;
      const elapsed = firstFailed ? Date.now() - firstFailed : 0;

      if (v.health_state === 'suspect' && elapsed >= THIRTY_MINUTES_MS) {
        // Tier 2: Confirmed dead (2 independent checks >= 30 mins apart) -> Quarantine
        quarantinedCount++;
        process.stdout.write(`\x1b[31m[CONFIRMED DEAD -> QUARANTINED]\x1b[0m (${health.reason})\n`);

        await db
          .from('videos')
          .update({
            is_active: false,
            health_state: 'quarantined',
            dead_reason: health.reason,
            last_health_check_at: now.toISOString()
          })
          .eq('id', v.id);
      } else {
        // Tier 1: First observation of failure -> Mark suspect, buffer for 30 minutes
        suspectCount++;
        process.stdout.write(`\x1b[33m[SUSPECT (BUFFERING)]\x1b[0m (${health.reason})\n`);

        await db
          .from('videos')
          .update({
            health_state: 'suspect',
            first_failed_at: v.first_failed_at || now.toISOString(),
            dead_reason: health.reason,
            last_health_check_at: now.toISOString()
          })
          .eq('id', v.id);
      }
    }

    // Safe delay between checks
    await sleep(200);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n------------------------------------------------------');
  console.log(`[AUDIT COMPLETE] Duration: ${duration}s`);
  console.log(`Total Streams Checked:    ${videos.length}`);
  console.log(`Healthy Streams:          \x1b[32m${healthyCount}\x1b[0m`);
  console.log(`Suspect Streams (Buffer): \x1b[33m${suspectCount}\x1b[0m`);
  console.log(`Transient / Skipped:      \x1b[35m${transientCount}\x1b[0m`);
  console.log(`Confirmed Quarantined:    \x1b[31m${quarantinedCount}\x1b[0m`);
  console.log('------------------------------------------------------\n');
}

// Allow direct CLI execution
if (process.argv[1].endsWith('healthChecker.js')) {
  runHealthCheck().then(() => {
    console.log('[HEALTH CHECK] Finished.');
    process.exit(0);
  });
}

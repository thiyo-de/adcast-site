import axios from 'axios';
import { getDbClient } from './db.js';
import { getStealthHeaders, sleep } from './utils/userAgents.js';

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

/**
 * Checks a single embed URL to see if it is still live
 */
export async function checkStreamHealth(embedUrl) {
  if (!embedUrl) return { isAlive: false, reason: 'Missing embed URL' };

  try {
    const res = await axios.get(embedUrl, {
      headers: getStealthHeaders(embedUrl),
      timeout: 10000,
      maxRedirects: 4,
      validateStatus: () => true // Allow handling all status codes manually
    });

    // Check HTTP status code
    if (res.status === 404 || res.status === 410) {
      return { isAlive: false, reason: `HTTP ${res.status} Not Found` };
    }
    if (res.status >= 500) {
      return { isAlive: false, reason: `HTTP ${res.status} Server Error` };
    }

    // Check page body text if string
    if (typeof res.data === 'string') {
      const lower = res.data.toLowerCase();
      for (const sig of DEAD_SIGNATURES) {
        if (lower.includes(sig)) {
          return { isAlive: false, reason: `Source Notice: "${sig}"` };
        }
      }
    }

    return { isAlive: true, reason: null };
  } catch (err) {
    if (err.response && (err.response.status === 404 || err.response.status === 410)) {
      return { isAlive: false, reason: `HTTP ${err.response.status} Not Found` };
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return { isAlive: false, reason: `Domain Offline (${err.code})` };
    }
    // Network timeouts or temporary drops are not immediately marked dead to prevent false positives
    return { isAlive: true, reason: null };
  }
}

/**
 * Run full health audit across all active videos in database
 */
export async function runHealthCheck() {
  const startTime = Date.now();
  console.log('\n======================================================');
  console.log(`[HEALTH CHECKER] Starting Stream Audit at ${new Date().toISOString()}`);
  console.log('======================================================');

  const db = getDbClient();

  // Fetch active videos
  const { data: videos, error } = await db
    .from('videos')
    .select('id, title, embed_url, is_active')
    .or('is_active.eq.true,is_active.is.null');

  if (error) {
    console.error('[HEALTH CHECK ERROR] Failed to fetch videos:', error.message);
    return;
  }

  console.log(`[AUDIT] Checking ${videos.length} active video stream(s)...`);

  let activeCount = 0;
  let quarantinedCount = 0;

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    process.stdout.write(`  [${i + 1}/${videos.length}] Checking: "${v.title.substring(0, 35)}..." `);

    const health = await checkStreamHealth(v.embed_url);

    if (health.isAlive) {
      activeCount++;
      process.stdout.write('\x1b[32m[OK]\x1b[0m\n');
    } else {
      quarantinedCount++;
      process.stdout.write(`\x1b[31m[DEAD -> QUARANTINED]\x1b[0m (${health.reason})\n`);

      // Soft delete in database
      await db
        .from('videos')
        .update({
          is_active: false,
          dead_reason: health.reason
        })
        .eq('id', v.id);
    }

    // Small delay between checks
    await sleep(150);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n------------------------------------------------------');
  console.log(`[AUDIT COMPLETE] Duration: ${duration}s`);
  console.log(`Total Streams Checked:  ${videos.length}`);
  console.log(`Live Streams (Active):  \x1b[32m${activeCount}\x1b[0m`);
  console.log(`Dead Streams (Quarantine): \x1b[31m${quarantinedCount}\x1b[0m`);
  console.log('------------------------------------------------------\n');
}

// Allow direct CLI execution
if (process.argv[1].endsWith('healthChecker.js')) {
  runHealthCheck().then(() => {
    console.log('[HEALTH CHECK] Finished.');
    process.exit(0);
  });
}

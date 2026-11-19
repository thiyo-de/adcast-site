import { getDbClient, getActiveSources, syncVideosToDb, updateSourceLastSynced } from './db.js';
import { scrapeHornyLeak } from './scrapers/hornyleakScraper.js';
import { scrapeJsonApi } from './scrapers/jsonApiScraper.js';
import { scrapeFeed } from './scrapers/feedParser.js';
import { scrapeHtml } from './scrapers/htmlCrawler.js';
import { sleep } from './utils/userAgents.js';
import { config } from './config.js';

const DEFAULT_TIMEZONE = 'Asia/Calcutta';

/**
 * Calculates the next run time in milliseconds given an interval in hours (e.g. 4h)
 */
function getNextIntervalTime(hours = 4) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

/**
 * Evaluates and returns all sources that are due for execution
 */
export async function getDueSources() {
  const db = getDbClient();
  const nowIso = new Date().toISOString();

  try {
    // 1. Fetch enabled schedules where next_run_at <= now or null
    const { data: dueSchedules, error } = await db
      .from('source_schedules')
      .select('*, crawler_sources(*)')
      .eq('is_active', true)
      .or(`next_run_at.lte.${nowIso},next_run_at.is.null`);

    if (dueSchedules && dueSchedules.length > 0) {
      return dueSchedules
        .filter(s => s.crawler_sources && s.crawler_sources.is_enabled)
        .map(s => ({
          ...s.crawler_sources,
          schedule_id: s.id,
          timezone: s.timezone || DEFAULT_TIMEZONE,
          cron_expression: s.cron_expression
        }));
    }

    // No schedules are currently due
    return [];
  } catch (err) {
    console.warn('[SCHEDULER NOTICE] source_schedules query notice:', err.message);
    return [];
  }
}

/**
 * Dispatches an ingest job for a single source
 */
export async function processSource(source) {
  const limit = source.video_limit || config.maxVideosPerRun || 15;
  console.log(`\n--> [SCHEDULER JOB] Processing "${source.name}" (Limit: ${limit}, Timezone: ${source.timezone || DEFAULT_TIMEZONE})`);

  let scrapedVideos = [];
  try {
    if (source.type === 'hornyleak' || (source.url && source.url.includes('hornyleak'))) {
      scrapedVideos = await scrapeHornyLeak(source, limit);
    } else if (source.type === 'json_api') {
      scrapedVideos = await scrapeJsonApi(source, limit);
    } else if (source.type === 'mrss_feed' || source.type === 'rss_feed') {
      scrapedVideos = await scrapeFeed(source, limit);
    } else if (source.type === 'html_scrape') {
      scrapedVideos = await scrapeHtml(source, limit);
    } else {
      scrapedVideos = await scrapeHornyLeak(source, limit);
    }

    if (scrapedVideos.isChallenge) {
      console.warn(`    \x1b[33m[CHALLENGE DETECTED]\x1b[0m Source "${source.name}" encountered bot challenge (${scrapedVideos.challengeReason})`);
      const db = getDbClient();
      if (source.id) {
        await db
          .from('crawler_sources')
          .update({ access_state: 'blocked_challenge' })
          .eq('id', source.id);
      }
      if (source.schedule_id) {
        await db
          .from('source_schedules')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: getNextIntervalTime(4),
            updated_at: new Date().toISOString()
          })
          .eq('id', source.schedule_id);
      }
      return { ok: false, isChallenge: true, reason: scrapedVideos.challengeReason };
    }

    console.log(`    Discovered ${scrapedVideos.length} candidate stream(s)`);

    if (source.id) {
      await updateSourceLastSynced(source.id);
      const db = getDbClient();
      await db
        .from('crawler_sources')
        .update({ access_state: 'ok' })
        .eq('id', source.id);
    }

    let inserted = 0;
    let skipped = 0;

    if (scrapedVideos.length > 0) {
      const syncResult = await syncVideosToDb(scrapedVideos, source);
      inserted = syncResult.inserted;
      skipped = syncResult.skipped;
      console.log(`    Sync outcome: \x1b[32m+${inserted} new\x1b[0m, \x1b[33m${skipped} skipped (duplicates / tombstones)\x1b[0m`);
    }

    // Advance next_run_at in source_schedules
    if (source.schedule_id) {
      const db = getDbClient();
      await db
        .from('source_schedules')
        .update({
          last_run_at: new Date().toISOString(),
          next_run_at: getNextIntervalTime(4),
          updated_at: new Date().toISOString()
        })
        .eq('id', source.schedule_id);
    }

    return { ok: true, inserted, skipped };
  } catch (err) {
    console.error(`    \x1b[31m[JOB ERROR]\x1b[0m Failed processing "${source.name}":`, err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Runs one scheduler tick: discovers due sources and executes under concurrency limits
 */
export async function runSchedulerTick() {
  const startTime = Date.now();
  console.log('======================================================');
  console.log(`[AUTONOMOUS SCHEDULER TICK] Starting at ${new Date().toISOString()}`);
  console.log(`Target Timezone: ${DEFAULT_TIMEZONE}`);
  console.log('======================================================');

  const dueSources = await getDueSources();

  if (dueSources.length === 0) {
    console.log('[SCHEDULER] No sources currently due for ingest. Standing by.');
    return;
  }

  console.log(`[SCHEDULER] ${dueSources.length} source(s) due for ingest.`);

  // Bounded execution: process sources with rate delay between jobs
  for (let i = 0; i < dueSources.length; i++) {
    await processSource(dueSources[i]);
    if (i < dueSources.length - 1) {
      await sleep(config.requestDelayMs || 2000);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('------------------------------------------------------');
  console.log(`[TICK COMPLETE] Finished in ${duration}s`);
  console.log('------------------------------------------------------\n');
}

// Allow direct CLI execution: node src/scheduler.js
if (process.argv[1].endsWith('scheduler.js')) {
  runSchedulerTick()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[SCHEDULER FATAL]', err);
      process.exit(1);
    });
}

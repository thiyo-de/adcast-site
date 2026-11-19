import { getDbClient, getActiveSources, syncVideosToDb, updateSourceLastSynced } from './db.js';
import { scrapeHornyLeak } from './scrapers/hornyleakScraper.js';
import { scrapeJsonApi } from './scrapers/jsonApiScraper.js';
import { scrapeFeed } from './scrapers/feedParser.js';
import { scrapeHtml } from './scrapers/htmlCrawler.js';
import { sleep } from './utils/userAgents.js';
import { config } from './config.js';

const DEFAULT_TIMEZONE = 'Asia/Calcutta';

/**
 * Calculates the exact next run time from a cron expression and timezone.
 * Handles daily time definitions (e.g. "0 14 * * *"), interval steps (e.g. "0 */6 * * *"),
 * and respects the source's specified timezone.
 */
export function calculateNextCronRun(cronExpr = '0 */4 * * *', timezone = DEFAULT_TIMEZONE) {
  if (!cronExpr || typeof cronExpr !== 'string') {
    return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  }

  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  }

  const [minPart, hourPart] = parts;

  // Case 1: Specific daily scheduled time e.g. "0 14 * * *" (daily at 14:00 in timezone)
  if (!hourPart.includes('*') && !hourPart.includes('/') && !minPart.includes('*') && !minPart.includes('/')) {
    const targetHour = parseInt(hourPart, 10);
    const targetMin = parseInt(minPart, 10);

    if (!isNaN(targetHour) && !isNaN(targetMin)) {
      const now = new Date();
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      });
      const tzParts = dtf.formatToParts(now).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
      const tzHour = parseInt(tzParts.hour === '24' ? '0' : tzParts.hour, 10);
      const tzMin = parseInt(tzParts.minute, 10);

      let dayOffset = 0;
      if (tzHour > targetHour || (tzHour === targetHour && tzMin >= targetMin)) {
        dayOffset = 1; // Due tomorrow at target time
      }

      const diffHours = targetHour - tzHour;
      const diffMins = targetMin - tzMin;
      const nextTime = new Date(now.getTime() + (dayOffset * 24 * 60 * 60 * 1000) + (diffHours * 60 * 60 * 1000) + (diffMins * 60 * 1000));
      return nextTime.toISOString();
    }
  }

  // Case 2: Step hours e.g. "0 */6 * * *"
  const stepMatch = hourPart.match(/\*\/(\d+)/);
  if (stepMatch && stepMatch[1]) {
    const stepHours = parseInt(stepMatch[1], 10);
    return new Date(Date.now() + stepHours * 60 * 60 * 1000).toISOString();
  }

  // Default fallback: 4 hours
  return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
}

/**
 * Evaluates and returns all sources that are due for execution (or a specific targeted source)
 */
export async function getDueSources(filterSourceId = null) {
  const db = getDbClient();
  const nowIso = new Date().toISOString();

  try {
    let query = db
      .from('source_schedules')
      .select('*, crawler_sources(*)')
      .eq('is_active', true);

    if (filterSourceId && filterSourceId !== 'all') {
      // Direct targeting: query specifically by source_id
      query = query.eq('source_id', filterSourceId);
    } else {
      // Scheduled tick: query only sources that are currently due
      query = query.or(`next_run_at.lte.${nowIso},next_run_at.is.null`);
    }

    const { data: dueSchedules, error } = await query;

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
            next_run_at: calculateNextCronRun(source.cron_expression, source.timezone),
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

    // Advance next_run_at in source_schedules using source's actual cron and timezone
    if (source.schedule_id) {
      const db = getDbClient();
      await db
        .from('source_schedules')
        .update({
          last_run_at: new Date().toISOString(),
          next_run_at: calculateNextCronRun(source.cron_expression, source.timezone),
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
 * Runs one scheduler tick: discovers due sources (or targeted source) and executes under concurrency limits
 */
export async function runSchedulerTick() {
  const startTime = Date.now();

  // Parse CLI flags and environment variables for specific source targeting & correlation
  const args = process.argv.slice(2);
  let filterSource = null;
  let correlationId = null;
  args.forEach(arg => {
    if (arg.startsWith('--source=')) filterSource = arg.split('=')[1];
    if (arg.startsWith('--correlation=')) correlationId = arg.split('=')[1];
  });
  if (!filterSource && process.env.INPUT_SOURCE_ID && process.env.INPUT_SOURCE_ID !== 'all') {
    filterSource = process.env.INPUT_SOURCE_ID;
  }
  if (!correlationId && process.env.INPUT_CORRELATION_ID) {
    correlationId = process.env.INPUT_CORRELATION_ID;
  }

  console.log('======================================================');
  console.log(`[AUTONOMOUS SCHEDULER TICK] Starting at ${new Date().toISOString()}`);
  console.log(`Target Timezone: ${DEFAULT_TIMEZONE}${filterSource ? ` | Filter Source: ${filterSource}` : ''}${correlationId ? ` | Correlation ID: ${correlationId}` : ''}`);
  console.log('======================================================');

  const dueSources = await getDueSources(filterSource);

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

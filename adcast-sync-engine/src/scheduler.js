import { getDbClient, getActiveSources, syncVideosToDb, updateSourceLastSynced } from './db.js';
import { scrapeHornyLeak } from './scrapers/hornyleakScraper.js';
import { scrapeMyDesi } from './scrapers/mydesiScraper.js';
import { scrapeJsonApi } from './scrapers/jsonApiScraper.js';
import { scrapeFeed } from './scrapers/feedParser.js';
import { scrapeHtml } from './scrapers/htmlCrawler.js';
import { sleep } from './utils/userAgents.js';
import { config } from './config.js';

const DEFAULT_TIMEZONE = 'Asia/Calcutta';

function parseCronPart(part, min, max, isDow = false) {
  const allowed = new Set();
  const subparts = part.split(',');

  for (const sp of subparts) {
    if (sp === '*') {
      for (let i = min; i <= max; i++) allowed.add(i);
    } else if (sp.startsWith('*/')) {
      const step = parseInt(sp.slice(2), 10);
      if (!isNaN(step) && step > 0) {
        for (let i = min; i <= max; i++) {
          if (i % step === 0) allowed.add(i);
        }
      }
    } else if (sp.includes('-')) {
      const [startStr, endStr] = sp.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          let val = i;
          if (isDow && val === 7) val = 0;
          allowed.add(val);
        }
      }
    } else {
      let num = parseInt(sp, 10);
      if (!isNaN(num)) {
        if (isDow && num === 7) num = 0;
        allowed.add(num);
      }
    }
  }

  return allowed;
}

function getTimezoneParts(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const localDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour === '24' ? '0' : parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10),
    weekday: localDate.getDay() // 0 = Sunday, 1 = Monday, ...
  };
}

/**
 * Calculates the exact next run time from a standard 5-field cron expression and timezone.
 * Snaps to exact clock boundaries in the target timezone (e.g. every 4 hours snaps to 00:00, 04:00, etc.).
 */
export function calculateNextCronRun(cronExpr = '0 */4 * * *', timezone = DEFAULT_TIMEZONE, fromDate = new Date()) {
  if (!cronExpr || typeof cronExpr !== 'string') {
    return new Date(fromDate.getTime() + 4 * 60 * 60 * 1000).toISOString();
  }

  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return new Date(fromDate.getTime() + 4 * 60 * 60 * 1000).toISOString();
  }

  const allowedMinutes = parseCronPart(parts[0], 0, 59);
  const allowedHours = parseCronPart(parts[1], 0, 23);
  const allowedDom = parseCronPart(parts[2], 1, 31);
  const allowedMonths = parseCronPart(parts[3], 1, 12);
  const allowedDow = parseCronPart(parts[4], 0, 6, true);

  // Start from next minute boundary
  let candidate = new Date(fromDate.getTime() + 60000);
  candidate.setSeconds(0, 0);

  // Search forward minute by minute up to 366 days
  const maxMinutes = 527040;
  for (let m = 0; m < maxMinutes; m++) {
    const tz = getTimezoneParts(candidate, timezone);

    if (
      allowedMonths.has(tz.month) &&
      allowedDom.has(tz.day) &&
      allowedDow.has(tz.weekday) &&
      allowedHours.has(tz.hour) &&
      allowedMinutes.has(tz.minute)
    ) {
      return candidate.toISOString();
    }

    if (!allowedMonths.has(tz.month) || !allowedDom.has(tz.day) || !allowedDow.has(tz.weekday)) {
      // Advance by 60 minutes when day doesn't match
      candidate = new Date(candidate.getTime() + 60 * 60000);
      m += 59;
    } else if (!allowedHours.has(tz.hour)) {
      // Advance to next hour boundary
      const minutesToNextHour = 60 - tz.minute;
      candidate = new Date(candidate.getTime() + minutesToNextHour * 60000);
      m += (minutesToNextHour - 1);
    } else {
      candidate = new Date(candidate.getTime() + 60000);
    }
  }

  return new Date(fromDate.getTime() + 4 * 60 * 60 * 1000).toISOString();
}

/**
 * Evaluates and returns all sources that are due for execution (or a specific targeted source)
 */
export async function getDueSources(filterSourceId = null) {
  const db = getDbClient();
  const nowIso = new Date().toISOString();

  try {
    // 1. Direct single source targeting (e.g. Admin "Fetch Now")
    if (filterSourceId && filterSourceId !== 'all') {
      const { data: directSource, error: directErr } = await db
        .from('crawler_sources')
        .select('*')
        .eq('id', filterSourceId)
        .maybeSingle();

      if (directSource) {
        const { data: schedule } = await db
          .from('source_schedules')
          .select('*')
          .eq('source_id', directSource.id)
          .maybeSingle();

        return [{
          ...directSource,
          schedule_id: directSource.id,
          source_id: directSource.id,
          timezone: schedule?.timezone || DEFAULT_TIMEZONE,
          cron_expression: schedule?.cron_expression || '0 */6 * * *'
        }];
      }
    }

    // 2. Query scheduled sources that are due
    let query = db
      .from('source_schedules')
      .select('*, crawler_sources(*)');

    if (filterSourceId !== 'all') {
      query = query.or(`next_run_at.lte.${nowIso},next_run_at.is.null`);
    }

    const { data: dueSchedules, error } = await query;
    if (error) {
      console.warn('[SCHEDULER NOTICE] source_schedules query notice:', error.message);
    }

    const scheduledSources = (dueSchedules || [])
      .filter(s => s.is_active !== false && s.crawler_sources && s.crawler_sources.is_enabled)
      .map(s => ({
        ...s.crawler_sources,
        schedule_id: s.source_id,
        source_id: s.source_id,
        timezone: s.timezone || DEFAULT_TIMEZONE,
        cron_expression: s.cron_expression || '0 */6 * * *'
      }));

    // 3. Self-Healing Discovery: Check if crawler_sources has enabled sources without an active schedule entry
    const { data: allEnabledSources } = await db
      .from('crawler_sources')
      .select('*')
      .eq('is_enabled', true);

    if (allEnabledSources && allEnabledSources.length > 0) {
      const existingScheduledIds = new Set(scheduledSources.map(s => s.id));
      const unmappedSources = allEnabledSources.filter(s => !existingScheduledIds.has(s.id));

      if (filterSourceId === 'all' || dueSchedules?.length === 0) {
        for (const unscheduled of unmappedSources) {
          scheduledSources.push({
            ...unscheduled,
            schedule_id: unscheduled.id,
            source_id: unscheduled.id,
            timezone: DEFAULT_TIMEZONE,
            cron_expression: '0 */6 * * *'
          });
        }
      }
    }

    return scheduledSources;
  } catch (err) {
    console.warn('[SCHEDULER NOTICE] source query error:', err.message);
    return [];
  }
}

/**
 * Dispatches an ingest job for a single source
 */
export async function processSource(source) {
  const limit = source.video_limit || config.maxVideosPerRun || 15;
  const db = getDbClient();
  const scheduleId = source.schedule_id || source.source_id || source.id;
  console.log(`\n--> [SCHEDULER JOB] Processing "${source.name}" (Limit: ${limit}, Timezone: ${source.timezone || DEFAULT_TIMEZONE})`);

  // Acquire run lease lock so concurrent scheduler ticks do not overlap execution
  if (scheduleId) {
    try {
      await db
        .from('source_schedules')
        .upsert({
          source_id: scheduleId,
          run_state: 'running',
          next_run_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'source_id' });
    } catch (lockErr) {
      if (lockErr.message && lockErr.message.includes('run_state')) {
        try {
          await db
            .from('source_schedules')
            .upsert({
              source_id: scheduleId,
              next_run_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'source_id' });
        } catch {}
      }
      console.warn('    [LOCK NOTICE] Could not acquire temporary schedule lease:', lockErr.message);
    }
  }

  let scrapedVideos = [];
  try {
    if (source.type === 'mydesi' || (source.url && source.url.includes('mydesi'))) {
      scrapedVideos = await scrapeMyDesi(source, limit);
    } else if (source.type === 'hornyleak' || (source.url && source.url.includes('hornyleak'))) {
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
      if (source.id) {
        await db
          .from('crawler_sources')
          .update({ access_state: 'blocked_challenge' })
          .eq('id', source.id);
      }
      return { ok: false, isChallenge: true, reason: scrapedVideos.challengeReason };
    }

    console.log(`    Discovered ${scrapedVideos.length} candidate stream(s)`);

    let syncResult = { inserted: 0, skipped: 0, duplicates: 0, blockedBySuppression: 0, invalid: 0 };
    if (scrapedVideos.length > 0) {
      syncResult = await syncVideosToDb(scrapedVideos, source);
      console.log(`    Sync outcome: \x1b[32m+${syncResult.inserted} new\x1b[0m, \x1b[33m${syncResult.skipped} skipped\x1b[0m (${syncResult.duplicates} dup, ${syncResult.blockedBySuppression} suppressed, ${syncResult.invalid} invalid)`);
    }

    // Only mark last_synced_at and access_state = 'ok' AFTER successful scrape & db sync
    if (source.id) {
      await updateSourceLastSynced(source.id);
      await db
        .from('crawler_sources')
        .update({ access_state: 'ok' })
        .eq('id', source.id);
    }

    return { ok: true, ...syncResult };
  } catch (err) {
    console.error(`    \x1b[31m[JOB ERROR]\x1b[0m Failed processing "${source.name}":`, err.message);
    if (source.id) {
      try {
        await db
          .from('crawler_sources')
          .update({ access_state: `error: ${err.message.slice(0, 100)}` })
          .eq('id', source.id);
      } catch (dbErr) {
        // Ignore secondary update error
      }
    }
    return { ok: false, error: err.message };
  } finally {
    // Release lease and schedule next run time
    if (scheduleId) {
      try {
        await db
          .from('source_schedules')
          .upsert({
            source_id: scheduleId,
            run_state: 'idle',
            last_run_at: new Date().toISOString(),
            next_run_at: calculateNextCronRun(source.cron_expression, source.timezone),
            updated_at: new Date().toISOString()
          }, { onConflict: 'source_id' });
      } catch (schedErr) {
        if (schedErr.message && schedErr.message.includes('run_state')) {
          try {
            await db
              .from('source_schedules')
              .upsert({
                source_id: scheduleId,
                last_run_at: new Date().toISOString(),
                next_run_at: calculateNextCronRun(source.cron_expression, source.timezone),
                updated_at: new Date().toISOString()
              }, { onConflict: 'source_id' });
          } catch {}
        }
        console.warn('    [SCHEDULE NOTICE] Could not release lease and schedule next run:', schedErr.message);
      }
    }
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
  let failedCount = 0;
  for (let i = 0; i < dueSources.length; i++) {
    const res = await processSource(dueSources[i]);
    if (res && res.ok === false) {
      failedCount++;
    }
    if (i < dueSources.length - 1) {
      await sleep(config.requestDelayMs || 2000);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('------------------------------------------------------');
  console.log(`[TICK COMPLETE] Finished in ${duration}s (Total: ${dueSources.length}, Failed: ${failedCount})`);
  console.log('------------------------------------------------------\n');

  // If sources were due and all failed, throw so CI fails visibly instead of false green
  if (dueSources.length > 0 && failedCount === dueSources.length) {
    throw new Error(`All ${dueSources.length} scheduled source(s) failed during execution`);
  }
}

// Allow direct CLI execution: node src/scheduler.js
if (process.argv[1].endsWith('scheduler.js')) {
  runSchedulerTick()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[SCHEDULER FATAL]', err.message || err);
      process.exit(1);
    });
}

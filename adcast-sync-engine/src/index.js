import cron from 'node-cron';
import { config } from './config.js';
import { syncVideosToDb, getTotalCount, getActiveSources, updateSourceLastSynced } from './db.js';
import { scrapeHornyLeak } from './scrapers/hornyleakScraper.js';
import { scrapeMyDesi } from './scrapers/mydesiScraper.js';
import { scrapeJsonApi } from './scrapers/jsonApiScraper.js';
import { scrapeFeed } from './scrapers/feedParser.js';
import { scrapeHtml } from './scrapers/htmlCrawler.js';
import { sleep } from './utils/userAgents.js';

// Parse command line arguments
const args = process.argv.slice(2);
const isRunNow = args.includes('--now');
const isScheduled = args.includes('--schedule');
const sourceFilterArg = args.find(a => a.startsWith('--source='));
const targetSourceId = sourceFilterArg ? sourceFilterArg.split('=')[1] : null;

/**
 * Run a full scraping and synchronization cycle
 */
export async function runSyncCycle() {
  const startTime = Date.now();
  console.log('\n======================================================');
  console.log(`[ADCAST SYNC ENGINE] Starting Cycle at ${new Date().toISOString()}`);
  console.log('======================================================');

  try {
    const initialCount = await getTotalCount();
    console.log(`[DB STATUS] Connected. Current videos in Supabase: ${initialCount}`);

    // Load sources dynamically from Supabase database
    let activeSources = await getActiveSources();
    if (targetSourceId) {
      activeSources = activeSources.filter(s => s.id === targetSourceId || s.name.toLowerCase().includes(targetSourceId.toLowerCase()));
      console.log(`[FILTER] Targeting single source: ${targetSourceId}`);
    }

    if (activeSources.length === 0) {
      console.log('[WARN] No active sources found. Enable or add a source in the Admin Panel!');
      return;
    }

    console.log(`[SOURCES] Processing ${activeSources.length} source(s)...`);

    let totalInserted = 0;
    let totalSkipped = 0;

    for (let i = 0; i < activeSources.length; i++) {
      const source = activeSources[i];
      const limit = source.video_limit || config.maxVideosPerRun;
      console.log(`\n--> [SOURCE ${i + 1}/${activeSources.length}] "${source.name}" (Limit: ${limit})`);
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

        console.log(`    Scraped ${scrapedVideos.length} candidate video(s)`);
        if (source.id) {
          await updateSourceLastSynced(source.id);
        }

        if (scrapedVideos.length > 0) {
          const result = await syncVideosToDb(scrapedVideos);
          console.log(`    Sync result: \x1b[32m+${result.inserted} new\x1b[0m, \x1b[33m${result.skipped} skipped (duplicates)\x1b[0m`);
          totalInserted += result.inserted;
          totalSkipped += result.skipped;

          if (result.inserted > 0 && result.items.length > 0) {
            console.log('    Newly added streams:');
            result.items.forEach(v => console.log(`      * [${v.category}] ${v.title.substring(0, 50)}... (${v.duration})`));
          }
        }
      } catch (sourceErr) {
        console.error(`    \x1b[31m[ERROR]\x1b[0m Failed syncing source "${source.name}": ${sourceErr.message}`);
      }

      // Respectful delay between external requests
      if (i < activeSources.length - 1) {
        await sleep(config.requestDelayMs);
      }
    }

    const finalCount = await getTotalCount();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n------------------------------------------------------');
    console.log(`[CYCLE COMPLETE] Duration: ${duration}s`);
    console.log(`Total New Videos Added:   ${totalInserted}`);
    console.log(`Total Skipped Duplicates: ${totalSkipped}`);
    console.log(`Total Videos in Database: ${finalCount}`);
    console.log('------------------------------------------------------\n');
  } catch (globalErr) {
    console.error('\x1b[31m[FATAL ERROR]\x1b[0m Sync cycle encountered an error:', globalErr);
    throw globalErr;
  }
}

// Master CLI Execution Handler
if (isRunNow) {
  runSyncCycle()
    .then(() => {
      console.log('[SYNC] Done. Exiting.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\x1b[31m[SYNC FAILED]\x1b[0m Process exited with error:', err.message);
      process.exit(1);
    });
} else if (isScheduled || (!isRunNow && !isScheduled)) {
  console.log('======================================================');
  console.log(`[ADCAST SYNC ENGINE DAEMON]`);
  console.log(`Schedule: "${config.cronSchedule}" (e.g. every 2 hours)`);
  console.log('Press Ctrl+C to terminate the daemon.');
  console.log('======================================================');

  runSyncCycle().then(() => {
    console.log(`[DAEMON] Waiting for next scheduled run according to "${config.cronSchedule}"...`);
    cron.schedule(config.cronSchedule, () => {
      runSyncCycle();
    });
  });
}

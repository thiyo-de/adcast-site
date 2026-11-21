import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeMyDesi } from '../src/scrapers/mydesiScraper.js';
import { syncVideosToDb, getTotalCount } from '../src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('======================================================');
  console.log(' [ADCAST CRAWLER] Fetching Top 20 Videos from MyDesi.fun');
  console.log('======================================================\n');

  const source = {
    id: 'mydesi-top',
    name: 'MyDesi.fun (Top Desi MMS)',
    type: 'mydesi',
    url: 'https://mydesi.fun/',
    category: 'Creator Leaks'
  };

  const videos = await scrapeMyDesi(source, 20);

  console.log(`\nSuccessfully crawled ${videos.length} videos from MyDesi.fun!`);

  // Save JSON output
  const outputPath = path.resolve(__dirname, '../top20_mydesi.json');
  fs.writeFileSync(outputPath, JSON.stringify(videos, null, 2), 'utf-8');
  console.log(`[SAVED] Output exported to: ${outputPath}`);

  // Attempt database sync if Supabase is reachable
  try {
    const preCount = await getTotalCount();
    console.log(`\n[DB] Current catalog count in Supabase: ${preCount}`);
    console.log('[DB] Syncing top 20 videos into Supabase...');
    const result = await syncVideosToDb(videos, source);
    console.log(`[DB RESULT] +${result.inserted} newly inserted, ${result.skipped} skipped (duplicates / existing)`);
    const postCount = await getTotalCount();
    console.log(`[DB] Updated total videos in Supabase: ${postCount}`);
  } catch (dbErr) {
    console.warn(`[DB NOTICE] Database sync skipped or failed (${dbErr.message}). JSON output preserved.`);
  }

  // Print structured list
  console.log('\n======================================================');
  console.log(' TOP 20 VIDEOS SUMMARY:');
  console.log('======================================================');
  videos.forEach((v, idx) => {
    console.log(`\n#${idx + 1}: ${v.title}`);
    console.log(`    Duration:  ${v.duration}`);
    console.log(`    Views:     ${v.views.toLocaleString()}`);
    console.log(`    Rating:    ${v.rating}%`);
    console.log(`    Category:  ${v.category}`);
    console.log(`    Embed URL: ${v.embed_url}`);
    if (v.stream_url) {
      console.log(`    Stream:    ${v.stream_url}`);
    }
    console.log(`    Thumbnail: ${v.thumbnail_url}`);
  });
}

main().catch(err => {
  console.error('[FATAL ERROR]', err);
  process.exit(1);
});

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load .env
dotenv.config({ path: path.join(rootDir, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\x1b[31m[ERROR] Missing SUPABASE_URL or SUPABASE_KEY in .env file!\x1b[0m');
}

// Load sources from sources.json
let sources = [];
const sourcesPath = path.join(rootDir, 'sources.json');
try {
  if (fs.existsSync(sourcesPath)) {
    const raw = fs.readFileSync(sourcesPath, 'utf8');
    sources = JSON.parse(raw);
  }
} catch (err) {
  console.warn('[WARN] Could not parse sources.json, using empty sources list:', err.message);
}

export const config = {
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_KEY,
  cronSchedule: process.env.SYNC_CRON || '0 */2 * * *',
  maxVideosPerRun: parseInt(process.env.MAX_VIDEOS_PER_RUN, 10) || 15,
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || 15000,
  requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS, 10) || 2000,
  sources
};

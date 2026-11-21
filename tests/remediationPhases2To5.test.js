import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseDurationSeconds, normalizeVideo } from '../adcast-sync-engine/src/utils/normalizer.js';
import { set404SEO, resetDefaultSEO } from '../src/utils/seo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Test 1: parseDurationSeconds handles strings and raw numbers
test('parseDurationSeconds converts various duration representations into integer seconds', () => {
  assert.equal(parseDurationSeconds('10:00'), 600);
  assert.equal(parseDurationSeconds('01:30'), 90);
  assert.equal(parseDurationSeconds('01:00:00'), 3600);
  assert.equal(parseDurationSeconds('01:23:45'), 5025);
  assert.equal(parseDurationSeconds(1250), 1250);
  assert.equal(parseDurationSeconds('1250'), 1250);
  assert.equal(parseDurationSeconds(null, 600), 600);
  assert.equal(parseDurationSeconds('', 600), 600);
});

// Test 2: normalizeVideo populates schema fields (source_id, duration_seconds, rating)
test('normalizeVideo populates source_id, duration_seconds, rating, and health defaults', () => {
  const dummySourceId = '11111111-2222-3333-4444-555555555555';
  const raw = {
    source_id: dummySourceId,
    title: '<b>Epic 4K Scene &amp; Teaser</b>',
    embed: 'https://eporner.com/embed/test1234/',
    thumb: 'https://example.com/thumb.jpg',
    duration: '15:30',
    tags: ['Amateur', 'Teasing'],
    views: '12.5K',
    rating: 98
  };

  const norm = normalizeVideo(raw);
  assert.equal(norm.source_id, dummySourceId);
  assert.equal(norm.title, 'Epic 4K Scene & Teaser');
  assert.equal(norm.duration, '15:30');
  assert.equal(norm.duration_seconds, 930);
  assert.equal(norm.rating, 98);
  assert.equal(norm.quality, '1080p');
  assert.equal(norm.health_state, 'healthy');
  assert.equal(norm.publication_state, 'published');
  assert.equal(norm.is_active, true);
});

// Test 3: SEO 404 and reset functions manage robots meta tag
test('set404SEO and resetDefaultSEO properly update title and robots meta tags', () => {
  const metaStore = {};
  globalThis.document = {
    title: '',
    head: {
      appendChild: (el) => {
        const key = el.getAttribute('name') || el.getAttribute('property');
        metaStore[key] = el;
        return el;
      }
    },
    querySelector: (selector) => {
      const match = selector.match(/\[(?:name|property)="([^"]+)"\]/);
      if (match && metaStore[match[1]]) {
        return metaStore[match[1]];
      }
      return null;
    },
    createElement: (tag) => {
      const attrs = {};
      return {
        tagName: tag.toUpperCase(),
        setAttribute: (k, v) => { attrs[k] = v; },
        getAttribute: (k) => attrs[k],
        parentNode: null
      };
    },
    getElementById: () => null
  };
  globalThis.window = {
    location: { href: 'https://hornyleaks.site/watch/missing-stream' }
  };

  set404SEO();
  assert.match(globalThis.document.title, /Not Found/i);
  const robotsMeta404 = metaStore['robots'];
  assert.ok(robotsMeta404);
  assert.equal(robotsMeta404.getAttribute('content'), 'noindex, nofollow');

  resetDefaultSEO();
  assert.match(globalThis.document.title, /HornyLeaks/i);
  const robotsMetaReset = metaStore['robots'];
  assert.equal(robotsMetaReset.getAttribute('content'), 'index, follow');
});

// Test 4: Static assets robots.txt and sitemap.xml exist and contain required entries
test('robots.txt and sitemap.xml are populated with valid production rules', () => {
  const robotsPath = path.join(rootDir, 'public', 'robots.txt');
  const sitemapPath = path.join(rootDir, 'public', 'sitemap.xml');

  assert.ok(fs.existsSync(robotsPath), 'public/robots.txt must exist');
  assert.ok(fs.existsSync(sitemapPath), 'public/sitemap.xml must exist');

  const robotsContent = fs.readFileSync(robotsPath, 'utf8');
  assert.match(robotsContent, /Disallow:\s*\/admin/);
  assert.match(robotsContent, /https:\/\/hornyleaks\.site\/sitemap\.xml/);

  const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
  assert.match(sitemapContent, /<loc>https:\/\/hornyleaks\.site\/<\/loc>/);
  assert.match(sitemapContent, /<loc>https:\/\/hornyleaks\.site\/dmca<\/loc>/);
});

// Test 5: Netlify headers configuration contains security headers
test('netlify.toml contains HSTS and framing protections', () => {
  const netlifyPath = path.join(rootDir, 'netlify.toml');
  assert.ok(fs.existsSync(netlifyPath));
  const content = fs.readFileSync(netlifyPath, 'utf8');

  assert.match(content, /X-Frame-Options\s*=\s*"SAMEORIGIN"/);
  assert.match(content, /Strict-Transport-Security/);
  assert.match(content, /X-Content-Type-Options\s*=\s*"nosniff"/);
});

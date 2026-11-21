import fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\1b75adf3-086e-4f84-b671-c6708787a596\\.system_generated\\steps\\6914\\content.md', 'utf8');
const $ = cheerio.load(html);

const cards = [];
$('.video-block').each((i, el) => {
  const $el = $(el);
  const postId = $el.attr('data-post-id') || '';
  const href = $el.find('a.thumb, a.infos').first().attr('href') || '';
  const title = $el.find('.title').first().text().trim();
  const views = $el.find('.views-number').first().text().trim();
  const rating = $el.find('.rating').first().text().trim();
  const thumb = $el.find('img').first().attr('data-src') || $el.find('img').first().attr('src') || '';

  if (title) {
    cards.push({ postId, href, title, views, rating, thumb });
  }
});

console.log(`Extracted ${cards.length} cards from homepage:`);
cards.forEach((c, idx) => {
  console.log(`${idx + 1}. [${c.postId}] "${c.title}" | Views: ${c.views} | Rating: ${c.rating} | URL: ${c.href}`);
});

/**
 * Dynamic SEO & OpenGraph Meta Tag Engine for AdCast
 * Updates document.title, OpenGraph, Twitter Cards, and schema.org/VideoObject JSON-LD.
 */

const DEFAULT_TITLE = 'HornyLeaks | Next-Gen Video Streaming';
const DEFAULT_DESCRIPTION = 'Stream 4K movies, viral clips, cinematic animations, and exclusive trending streams in dark obsidian luxury with zero lag.';
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1200&auto=format&fit=crop&q=80';

function setMetaTag(selector, attrName, attrValue, content) {
  let element = document.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export function updateVideoSEO(video) {
  if (!video) return;

  const pageTitle = `${video.title} | HornyLeaks`;
  const description = `${video.title} - Watch high-definition ${video.quality || '4K UHD'} ${video.category || 'streaming'} video on HornyLeaks. Rated ${video.rating || 98}% with ${(video.views || 0).toLocaleString()} views.`;
  const imageUrl = video.thumbnail_url || DEFAULT_IMAGE;
  const currentUrl = window.location.href;

  // 1. Title & Meta Description
  document.title = pageTitle;
  setMetaTag('meta[name="description"]', 'name', 'description', description);

  // 2. OpenGraph Meta Tags (WhatsApp, Telegram, Facebook, Discord)
  setMetaTag('meta[property="og:title"]', 'property', 'og:title', pageTitle);
  setMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
  setMetaTag('meta[property="og:image"]', 'property', 'og:image', imageUrl);
  setMetaTag('meta[property="og:url"]', 'property', 'og:url', currentUrl);
  setMetaTag('meta[property="og:type"]', 'property', 'og:type', 'video.other');
  setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', 'HornyLeaks');

  // 3. Twitter / X Cards
  setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', pageTitle);
  setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', imageUrl);

  // 4. Google Rich Snippets: schema.org/VideoObject JSON-LD
  let scriptTag = document.getElementById('adcast-jsonld-video');
  if (!scriptTag) {
    scriptTag = document.createElement('script');
    scriptTag.id = 'adcast-jsonld-video';
    scriptTag.type = 'application/ld+json';
    document.head.appendChild(scriptTag);
  }

  const jsonLdData = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    'name': video.title,
    'description': description,
    'thumbnailUrl': [imageUrl],
    'uploadDate': video.created_at || new Date().toISOString(),
    'duration': video.durationMinutes ? `PT${video.durationMinutes}M` : 'PT10M',
    'contentUrl': video.embed_url,
    'embedUrl': video.embed_url,
    'interactionStatistic': {
      '@type': 'InteractionCounter',
      'interactionType': { '@type': 'WatchAction' },
      'userInteractionCount': video.views || 1000
    }
  };

  scriptTag.textContent = JSON.stringify(jsonLdData);
}

export function resetDefaultSEO() {
  document.title = DEFAULT_TITLE;
  setMetaTag('meta[name="description"]', 'name', 'description', DEFAULT_DESCRIPTION);
  setMetaTag('meta[property="og:title"]', 'property', 'og:title', DEFAULT_TITLE);
  setMetaTag('meta[property="og:description"]', 'property', 'og:description', DEFAULT_DESCRIPTION);
  setMetaTag('meta[property="og:image"]', 'property', 'og:image', DEFAULT_IMAGE);
  setMetaTag('meta[property="og:type"]', 'property', 'og:type', 'website');

  const scriptTag = document.getElementById('adcast-jsonld-video');
  if (scriptTag && scriptTag.parentNode) {
    scriptTag.parentNode.removeChild(scriptTag);
  }
}

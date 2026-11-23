/**
 * VAST 3.0 / 4.x Video Ad Resolver
 * Parses ExoClick VAST XML and extracts the live MP4 video stream,
 * tracking impressions, quartiles, and click-through destination URLs using native DOMParser.
 */

import { isExoEntryUrl } from '../services/adTag.js';

function getTextContent(element) {
  if (!element) return null;
  const text = element.textContent || '';
  return text.trim() || null;
}

// A VAST Linear can express its skip time as HH:MM:SS[.mmm] or a percentage.
export function vastSkipSeconds(offset, duration) {
  if (!offset) return null;
  if (/^\d+(?:\.\d+)?%$/.test(offset)) {
    const percent = Number(offset.slice(0, -1));
    return percent <= 100 && Number.isFinite(duration) && duration > 0 ? duration * percent / 100 : null;
  }
  const parts = /^(\d{2,}):([0-5]\d):([0-5]\d(?:\.\d+)?)$/.exec(offset);
  return parts ? Number(parts[1]) * 3600 + Number(parts[2]) * 60 + Number(parts[3]) : null;
}

function parseVastXmlDocument(xmlText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.warn('VAST XML parser warning:', parseError.textContent);
    }

    // Cross-namespace element querying (supporting VAST 3.0 & VAST 4.x namespaces)
    const getElements = (tagName) => {
      let list = Array.from(doc.querySelectorAll?.(tagName) || []);
      if (!list.length && doc.getElementsByTagName) {
        list = Array.from(doc.getElementsByTagName(tagName));
      }
      return list;
    };
    const getElement = (tagName) => {
      return doc.querySelector?.(tagName) || doc.getElementsByTagName?.(tagName)?.[0] || null;
    };

    // 1. Impression URLs
    const impressionEls = getElements('Impression');
    const impressionUrls = impressionEls
      .map(getTextContent)
      .filter(Boolean);

    // 2. MediaFiles (prefer MP4)
    const mediaFileEls = getElements('MediaFile');
    let mediaUrl = null;
    let fallbackMediaUrl = null;

    for (const el of mediaFileEls) {
      const type = (el.getAttribute('type') || '').toLowerCase();
      const url = getTextContent(el);
      if (!url) continue;

      if (!fallbackMediaUrl) fallbackMediaUrl = url;
      if (type.includes('mp4') || url.includes('.mp4')) {
        mediaUrl = url;
        break;
      }
    }
    if (!mediaUrl) mediaUrl = fallbackMediaUrl;

    // Regex fallback for mediaUrl if namespace query returned empty
    if (!mediaUrl) {
      const mediaMatch = xmlText.match(/<MediaFile[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/MediaFile>/i);
      if (mediaMatch && mediaMatch[1]) {
        mediaUrl = mediaMatch[1].trim();
      }
    }

    // 3. ClickThrough & ClickTracking
    const clickThroughEl = getElement('ClickThrough');
    const clickTrackingEls = getElements('ClickTracking');
    let clickUrl = getTextContent(clickThroughEl);
    if (!clickUrl) {
      const clickMatch = xmlText.match(/<ClickThrough[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/ClickThrough>/i);
      if (clickMatch && clickMatch[1]) {
        clickUrl = clickMatch[1].trim();
      }
    }
    const clickTrackingUrls = clickTrackingEls
      .map(getTextContent)
      .filter(Boolean);

    // 4. Tracking events (start, firstQuartile, midpoint, thirdQuartile, complete)
    const trackingEls = getElements('Tracking');
    const trackingEvents = {};
    trackingEls.forEach((el) => {
      const event = el.getAttribute('event');
      const url = getTextContent(el);
      if (event && url) {
        if (!trackingEvents[event]) trackingEvents[event] = [];
        trackingEvents[event].push(url);
      }
    });

    // 5. VASTAdTagURI (Wrapper)
    const wrapperTag = getElement('VASTAdTagURI');
    let wrapperUrl = getTextContent(wrapperTag);
    if (!wrapperUrl) {
      const wrapperMatch = xmlText.match(/<VASTAdTagURI[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/VASTAdTagURI>/i);
      if (wrapperMatch && wrapperMatch[1]) {
        wrapperUrl = wrapperMatch[1].trim();
      }
    }

    const selectedMedia = mediaFileEls.find(element => getTextContent(element) === mediaUrl);
    const linear = selectedMedia?.closest('Linear') || getElement('Linear');
    return {
      mediaUrl,
      skipOffset: linear?.getAttribute('skipoffset')?.trim() || null,
      clickUrl,
      clickTrackingUrls,
      impressionUrls,
      impressionUrl: impressionUrls[0] || null,
      trackingEvents,
      wrapperUrl
    };
  } catch (err) {
    console.warn('Failed to parse VAST XML with DOMParser:', err);
    return null;
  }
}

export async function resolveVastAd(vastUrl, maxTimeoutMs = 3500) {
  if (!isExoEntryUrl(vastUrl)) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), maxTimeoutMs);

  try {
    let currentUrl = vastUrl;
    let redirectCount = 0;
    const maxRedirects = 3;

    let mediaUrl = null;
    let clickUrl = null;
    const skipOffsets = [];
    const impressionUrls = [];
    const clickTrackingUrls = [];
    const trackingEvents = {};

    const mergeTracking = (newEvents) => {
      if (!newEvents) return;
      Object.keys(newEvents).forEach((evt) => {
        if (!trackingEvents[evt]) trackingEvents[evt] = [];
        trackingEvents[evt].push(...newEvents[evt]);
      });
    };

    while (currentUrl && redirectCount <= maxRedirects) {
      const res = await fetch(currentUrl, { signal: controller.signal });
      if (!res.ok) break;

      const xml = await res.text();
      const parsed = parseVastXmlDocument(xml);
      if (!parsed) break;

      // Accumulate impressions, click trackers, and tracking events
      if (parsed.impressionUrls?.length) {
        impressionUrls.push(...parsed.impressionUrls);
      }
      if (parsed.clickTrackingUrls?.length) {
        clickTrackingUrls.push(...parsed.clickTrackingUrls);
      }
      if (parsed.clickUrl) {
        clickUrl = parsed.clickUrl;
      }
      mergeTracking(parsed.trackingEvents);
      if (parsed.skipOffset) skipOffsets.push(parsed.skipOffset);

      if (parsed.mediaUrl) {
        mediaUrl = parsed.mediaUrl;
        break; // Found creative media file
      }

      if (parsed.wrapperUrl && redirectCount < maxRedirects) {
        currentUrl = parsed.wrapperUrl;
        redirectCount++;
      } else {
        break;
      }
    }

    clearTimeout(timeoutId);

    if (!mediaUrl) {
      return {
        mediaUrl: null,
        errorCode: 'NO_FILL',
        errorMessage: 'Ad provider returned no active video creative (no-fill or empty response).'
      };
    }

    return {
      mediaUrl,
      skipOffsets,
      clickUrl,
      clickTrackingUrls: Array.from(new Set(clickTrackingUrls)),
      impressionUrls: Array.from(new Set(impressionUrls)),
      impressionUrl: impressionUrls[0] || null,
      trackingEvents
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err?.name === 'AbortError';
    return {
      mediaUrl: null,
      errorCode: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      errorMessage: isTimeout ? 'VAST ad request timed out after 3.5s' : (err?.message || 'Network error fetching VAST ad')
    };
  }
}

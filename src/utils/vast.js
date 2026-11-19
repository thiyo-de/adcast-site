/**
 * VAST 3.0 / 4.x Video Ad Resolver
 * Parses ExoClick VAST XML and extracts the live MP4 video stream,
 * tracking impressions, quartiles, and click-through destination URLs using native DOMParser.
 */

function getTextContent(element) {
  if (!element) return null;
  const text = element.textContent || '';
  return text.trim() || null;
}

function parseVastXmlDocument(xmlText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.warn('VAST XML parser warning:', parseError.textContent);
      return null;
    }

    // 1. Impression URLs
    const impressionEls = doc.querySelectorAll('Impression');
    const impressionUrls = Array.from(impressionEls)
      .map(getTextContent)
      .filter(Boolean);

    // 2. MediaFiles (prefer MP4)
    const mediaFileEls = doc.querySelectorAll('MediaFile');
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

    // 3. ClickThrough & ClickTracking
    const clickThroughEl = doc.querySelector('ClickThrough');
    const clickTrackingEls = doc.querySelectorAll('ClickTracking');
    const clickUrl = getTextContent(clickThroughEl);
    const clickTrackingUrls = Array.from(clickTrackingEls)
      .map(getTextContent)
      .filter(Boolean);

    // 4. Tracking events (start, firstQuartile, midpoint, thirdQuartile, complete)
    const trackingEls = doc.querySelectorAll('Tracking');
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
    const wrapperTag = doc.querySelector('VASTAdTagURI');
    const wrapperUrl = getTextContent(wrapperTag);

    return {
      mediaUrl,
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
  if (!vastUrl || typeof vastUrl !== 'string') return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), maxTimeoutMs);

  try {
    let currentUrl = vastUrl;
    let redirectCount = 0;
    const maxRedirects = 3;

    let mediaUrl = null;
    let clickUrl = null;
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

    if (!mediaUrl) return null;

    return {
      mediaUrl,
      clickUrl: clickUrl || vastUrl,
      clickTrackingUrls: Array.from(new Set(clickTrackingUrls)),
      impressionUrls: Array.from(new Set(impressionUrls)),
      impressionUrl: impressionUrls[0] || null,
      trackingEvents
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return null;
  }
}

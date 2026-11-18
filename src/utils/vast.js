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
    const res = await fetch(vastUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const xml = await res.text();
    const parsed = parseVastXmlDocument(xml);
    if (!parsed) return null;

    // Handle Wrapper if present
    if (parsed.wrapperUrl && !parsed.mediaUrl) {
      try {
        const wrapRes = await fetch(parsed.wrapperUrl);
        if (wrapRes.ok) {
          const wrapXml = await wrapRes.text();
          const wrapParsed = parseVastXmlDocument(wrapXml);
          if (wrapParsed && wrapParsed.mediaUrl) {
            return {
              mediaUrl: wrapParsed.mediaUrl,
              clickUrl: wrapParsed.clickUrl || parsed.clickUrl || vastUrl,
              clickTrackingUrls: [
                ...parsed.clickTrackingUrls,
                ...wrapParsed.clickTrackingUrls
              ],
              impressionUrl: wrapParsed.impressionUrl || parsed.impressionUrl,
              impressionUrls: [
                ...parsed.impressionUrls,
                ...wrapParsed.impressionUrls
              ],
              trackingEvents: {
                ...parsed.trackingEvents,
                ...wrapParsed.trackingEvents
              }
            };
          }
        }
      } catch (e) {
        console.warn('VAST wrapper resolution failed:', e);
      }
    }

    if (!parsed.mediaUrl) return null;

    return {
      mediaUrl: parsed.mediaUrl,
      clickUrl: parsed.clickUrl || vastUrl,
      clickTrackingUrls: parsed.clickTrackingUrls,
      impressionUrl: parsed.impressionUrl,
      impressionUrls: parsed.impressionUrls,
      trackingEvents: parsed.trackingEvents
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return null;
  }
}

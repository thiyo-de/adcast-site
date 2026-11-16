/**
 * VAST 3.0 / 4.x Video Ad Resolver
 * Parses ExoClick VAST XML and extracts the live MP4 video stream,
 * tracking impressions, and click-through destination URLs.
 */
export async function resolveVastAd(vastUrl, maxTimeoutMs = 3000) {
  if (!vastUrl || typeof vastUrl !== 'string') return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), maxTimeoutMs);

  try {
    const res = await fetch(vastUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const xml = await res.text();

    // Check for empty VAST (no-bid or frequency capped)
    if (!xml.includes('<MediaFile') && !xml.includes('<VASTAdTagURI')) {
      return null;
    }

    // 1. Extract Impression URL
    const impMatch = xml.match(/<Impression[^>]*><!\[CDATA\[(.*?)\]\]><\/Impression>/i) ||
                     xml.match(/<Impression[^>]*>(.*?)<\/Impression>/i);
    let impressionUrl = impMatch ? impMatch[1].trim() : null;

    // 2. Check for VAST Wrapper (secondary tag)
    const wrapMatch = xml.match(/<VASTAdTagURI><!\[CDATA\[(.*?)\]\]><\/VASTAdTagURI>/i) ||
                      xml.match(/<VASTAdTagURI>(.*?)<\/VASTAdTagURI>/i);

    let mediaUrl = null;
    let clickUrl = null;

    if (wrapMatch) {
      try {
        const wrapUrl = wrapMatch[1].trim();
        const wrapRes = await fetch(wrapUrl);
        if (wrapRes.ok) {
          const wrapXml = await wrapRes.text();
          const wrapMedia = wrapXml.match(/<MediaFile[^>]*><!\[CDATA\[(.*?)\]\]><\/MediaFile>/i) ||
                            wrapXml.match(/<MediaFile[^>]*>(.*?)<\/MediaFile>/i);
          const wrapClick = wrapXml.match(/<ClickThrough><!\[CDATA\[(.*?)\]\]><\/ClickThrough>/i) ||
                            wrapXml.match(/<ClickThrough>(.*?)<\/ClickThrough>/i) ||
                            wrapXml.match(/<ClickTracking><!\[CDATA\[(.*?)\]\]><\/ClickTracking>/i);
          const wrapImp = wrapXml.match(/<Impression[^>]*><!\[CDATA\[(.*?)\]\]><\/Impression>/i) ||
                          wrapXml.match(/<Impression[^>]*>(.*?)<\/Impression>/i);

          if (wrapMedia) mediaUrl = wrapMedia[1].trim();
          if (wrapClick) clickUrl = wrapClick[1].trim();
          if (wrapImp && !impressionUrl) impressionUrl = wrapImp[1].trim();
        }
      } catch (e) {
        console.warn('VAST wrapper resolution failed:', e);
      }
    } else {
      const mediaMatch = xml.match(/<MediaFile[^>]*><!\[CDATA\[(.*?)\]\]><\/MediaFile>/i) ||
                         xml.match(/<MediaFile[^>]*>(.*?)<\/MediaFile>/i);
      const clickMatch = xml.match(/<ClickThrough><!\[CDATA\[(.*?)\]\]><\/ClickThrough>/i) ||
                         xml.match(/<ClickThrough>(.*?)<\/ClickThrough>/i) ||
                         xml.match(/<ClickTracking><!\[CDATA\[(.*?)\]\]><\/ClickTracking>/i);

      if (mediaMatch) mediaUrl = mediaMatch[1].trim();
      if (clickMatch) clickUrl = clickMatch[1].trim();
    }

    if (!mediaUrl) return null;

    return {
      mediaUrl,
      clickUrl: clickUrl || vastUrl,
      impressionUrl
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return null;
  }
}

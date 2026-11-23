export const AD_BLOCK_STATES = {
  CHECKING: 'checking', NO_BLOCKING_DETECTED: 'no_blocking_detected',
  SUSPECTED_BLOCKING: 'suspected_blocking', INCONCLUSIVE: 'inconclusive', NOT_APPLICABLE: 'not_applicable'
};

export function exoProbeUrls(settings, view, mobile, wide) {
  if (view !== 'home' && view !== 'watch') return [];
  const ids = ['slot_native_feed', 'slot_popunder', mobile ? 'slot_mobile_interstitial' : 'slot_interstitial',
    mobile ? 'slot_sticky_footer_mobile' : 'slot_sticky_footer'];
  if (view === 'home') ids.push(mobile ? 'slot_top_banner_mobile' : 'slot_top_banner');
  else ids.push('slot_video_preroll', 'slot_below_player');
  if (wide) ids.push('slot_desktop_skyscraper_left', 'slot_desktop_skyscraper_right');
  const urls = new Set();
  for (const id of ids) {
    const slot = settings[id];
    if (!slot?.isActive) continue;
    // Probe static provider assets only. Never request an impression to test connectivity.
    const hosts = (id === 'slot_video_preroll' ? slot.vastUrl : slot.code)?.matchAll(/https:\/\/[as]\.(magsrv\.com|pemsrv\.com)\//gi);
    for (const match of hosts || []) urls.add('https://a.' + match[1].toLowerCase() + '/ad-provider.js');
  }
  return [...urls].sort();
}

function probeBox(className) {
  const box = document.createElement('div');
  box.className = className;
  box.style.cssText = 'position:absolute;left:-9999px;top:0;width:10px;height:10px;pointer-events:none';
  document.body.appendChild(box);
  return box;
}

function hidden(box) {
  const style = getComputedStyle(box);
  return !box.isConnected || !box.offsetWidth || !box.offsetHeight ||
    style.visibility === 'hidden' || style.opacity === '0';
}

async function endpoint(url, signal, local = false) {
  try {
    const response = await fetch(url, {
      method: local ? 'HEAD' : 'GET', mode: local ? 'same-origin' : 'cors',
      cache: 'no-store', credentials: 'omit', signal
    });
    const mime = response.headers.get('content-type') || '';
    const expected = local ? mime.includes('image/png') : /(?:java|ecma)script/i.test(mime);
    if (!local) response.body?.cancel().catch(() => {});
    return response.ok && expected ? 'reachable' : 'unknown';
  } catch {
    return signal.aborted ? 'unknown' : 'failed';
  }
}

// Both probe elements settle on load, error or cancellation.
function loadAsset(element, signal) {
  return new Promise(resolve => {
    function finish(result) {
      signal.removeEventListener('abort', onAbort);
      element.onload = element.onerror = null;
      element.remove();
      resolve(result);
    }
    const onAbort = () => finish('unknown');
    signal.addEventListener('abort', onAbort, { once: true });
    element.onload = () => finish('reachable');
    element.onerror = () => finish('failed');
    element.ownerDocument.head.appendChild(element);
  });
}

async function providerStatus(url, signal, probeDocument) {
  // Filters can allow Fetch while blocking the same URL as a script. Preloading
  // exercises the script request without executing the network's ad provider.
  const link = probeDocument.createElement('link');
  link.rel = 'preload';
  link.as = 'script';
  link.crossOrigin = 'anonymous';
  link.href = url;
  const delivery = await loadAsset(link, signal);
  if (delivery !== 'failed' || signal.aborted) return delivery;
  const response = await endpoint(url, signal);
  return response === 'reachable' ? 'script-filtered' : response;
}

export async function detectAdBlock({ urls, signal, timeoutMs = 3000 }) {
  const S = AD_BLOCK_STATES;
  if (!urls.length || typeof document === 'undefined') return S.NOT_APPLICABLE;
  if (signal?.aborted || document.hidden || !navigator.onLine) return S.INCONCLUSIVE;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  let bait, control, frame, probeDocument;
  let policyRestricted = false;
  const onPolicy = event => {
    if (event.disposition === 'enforce' && (urls.includes(event.blockedURI)
        || urls.some(url => new URL(url).origin === event.blockedURI)
        || event.blockedURI?.endsWith('/ads/banner-ad.js'))) policyRestricted = true;
  };
  document.addEventListener('securitypolicyviolation', onPolicy);
  try {
    // Preloads are reused for the lifetime of a document, even after the link is
    // removed. A short-lived same-origin document lets retries test current rules
    // and still permits ordinary HTTP caching of the static library.
    frame = document.createElement('iframe');
    frame.hidden = true;
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    document.body.appendChild(frame);
    probeDocument = frame.contentDocument;
    probeDocument.addEventListener('securitypolicyviolation', onPolicy);
    control = probeBox('site_layout_probe_control_box');
    bait = probeBox('pub_300x250 pub_728x90 text-ad ad-placement banner-ad adsbox');
    const cosmetic = async () => {
      const wait = () => new Promise(resolve => setTimeout(resolve, 250));
      await wait();
      const first = !hidden(control) && hidden(bait);
      await wait();
      return first && !hidden(control) && hidden(bait);
    };
    const script = probeDocument.createElement('script');
    script.src = '/ads/banner-ad.js';
    const [neutral, local, providers, hiddenTwice] = await Promise.all([
      endpoint('/icon.png', controller.signal, true), loadAsset(script, controller.signal),
      Promise.all(urls.map(url => providerStatus(url, controller.signal, probeDocument))), cosmetic()
    ]);
    if (signal?.aborted || document.hidden || hidden(control) || neutral !== 'reachable') return S.INCONCLUSIVE;
    if (hiddenTwice) return S.SUSPECTED_BLOCKING;
    if (policyRestricted) return S.INCONCLUSIVE;
    if (providers.some(status => status === 'script-filtered') ||
        (local === 'failed' && providers.every(status => status === 'failed'))) return S.SUSPECTED_BLOCKING;
    if (!hidden(bait) && local === 'reachable' && providers.every(status => status === 'reachable')) return S.NO_BLOCKING_DETECTED;
    return S.INCONCLUSIVE;
  } catch {
    return S.INCONCLUSIVE;
  } finally {
    clearTimeout(timer);
    document.removeEventListener('securitypolicyviolation', onPolicy);
    probeDocument?.removeEventListener('securitypolicyviolation', onPolicy);
    frame?.remove();
    signal?.removeEventListener('abort', abort);
    bait?.remove();
    control?.remove();
  }
}

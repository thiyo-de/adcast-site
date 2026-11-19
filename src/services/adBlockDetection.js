/**
 * Centralized Ad-Blocker Detection Service
 *
 * Implements the 12-section Production Plan:
 * 1. Multi-signal verification: Compares an ad-like bait element with a neutral control element.
 * 2. States: checking | no_blocking_detected | suspected_blocking | inconclusive | not_applicable
 * 3. Bounded observation: Up to 5s budget, with exactly 1 automatic confirmation check before suspecting blocking.
 * 4. Safe failure: If control element is also hidden (DOM/tab backgrounding) or network times out, returns 'inconclusive' (allows access).
 */

export const AD_BLOCK_STATES = {
  CHECKING: 'checking',
  NO_BLOCKING_DETECTED: 'no_blocking_detected',
  SUSPECTED_BLOCKING: 'suspected_blocking',
  INCONCLUSIVE: 'inconclusive',
  NOT_APPLICABLE: 'not_applicable'
};

const BAIT_CLASSES = 'pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text-ads text-ad-links ad-text ad-placement banner-ad banner_ad adsbox';
const CONTROL_CLASS = 'site_layout_probe_control_box';

let activeProbe = null;

/**
 * Checks if a DOM element is hidden by CSS rules or extension blockers
 */
function isElementHidden(el) {
  if (!el || !el.parentNode) return true;
  const style = window.getComputedStyle(el);
  return (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0' ||
    el.offsetHeight === 0 ||
    el.offsetWidth === 0 ||
    el.offsetParent === null
  );
}

/**
 * Verifies neutral internet/host connectivity using non-ad resources.
 * Returns true if the user's connection is active and can reach standard servers.
 */
async function checkNeutralConnectivity() {
  const neutralUrls = [
    '/favicon.ico',
    'https://cdn.jsdelivr.net/npm/remixicon@4.2.0/package.json'
  ];

  for (const url of neutralUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      await fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeout);
      return true;
    } catch {
      // Continue to next neutral fallback
    }
  }
  return false;
}

/**
 * Canary network request to check for network-level ad blockers (Opera native, Brave Shields, DNS blockers, uBlock)
 */
async function checkNetworkAdBlock() {
  if (typeof window === 'undefined' || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return false;
  }

  // Probe both ExoClick network script (blocked by Opera/Brave) and Google AdSense
  const canaries = [
    'https://a.magsrv.com/ad-provider.js',
    'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
  ];

  let anyCanaryBlocked = false;

  for (const url of canaries) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeout);
    } catch (err) {
      // If blocked by browser extension/Shields/Opera (net::ERR_BLOCKED_BY_CLIENT)
      if (err && err.name !== 'AbortError') {
        anyCanaryBlocked = true;
        break;
      }
    }
  }

  // If an ad canary failed, verify whether the user actually has internet connectivity
  // to avoid falsely locking out users during offline state, captive portal, or packet loss
  if (anyCanaryBlocked) {
    const isOnlineAndReachable = await checkNeutralConnectivity();
    if (isOnlineAndReachable) {
      // Internet is active, but ad domains were specifically blocked -> true adblocker
      return true;
    }
    // Neutral network also failed -> general network drop, do not falsely accuse
    return false;
  }

  return false;
}

/**
 * Run a multi-signal ad-block detection check
 * @param {Object} options
 * @param {number} [options.timeoutMs=5000] - Total time budget for detection
 * @returns {Promise<string>} One of AD_BLOCK_STATES
 */
export function detectAdBlock(options = {}) {
  const { timeoutMs = 5000 } = options;

  // Cancel any existing probe in flight
  if (activeProbe && typeof activeProbe.cancel === 'function') {
    activeProbe.cancel();
    activeProbe = null;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(AD_BLOCK_STATES.NOT_APPLICABLE);
  }

  let isCancelled = false;
  let timerId = null;
  let confirmationTimerId = null;
  let baitEl = null;
  let controlEl = null;

  const cleanup = () => {
    if (timerId) clearTimeout(timerId);
    if (confirmationTimerId) clearTimeout(confirmationTimerId);
    if (baitEl && baitEl.parentNode) baitEl.parentNode.removeChild(baitEl);
    if (controlEl && controlEl.parentNode) controlEl.parentNode.removeChild(controlEl);
    baitEl = null;
    controlEl = null;
  };

  const promise = new Promise((resolve) => {
    // 1. Create Neutral Control Element
    controlEl = document.createElement('div');
    controlEl.className = CONTROL_CLASS;
    controlEl.setAttribute(
      'style',
      'position: absolute !important; left: -9999px !important; top: -9999px !important; width: 10px !important; height: 10px !important; pointer-events: none !important;'
    );

    // 2. Create Ad-like Bait Element
    baitEl = document.createElement('div');
    baitEl.className = BAIT_CLASSES;
    baitEl.setAttribute(
      'style',
      'position: absolute !important; left: -9999px !important; top: -9999px !important; width: 10px !important; height: 10px !important; pointer-events: none !important;'
    );

    try {
      document.body.appendChild(controlEl);
      document.body.appendChild(baitEl);
    } catch (e) {
      cleanup();
      resolve(AD_BLOCK_STATES.INCONCLUSIVE);
      return;
    }

    // Safety timeout: if checking takes longer than timeout budget, conclude as inconclusive
    timerId = setTimeout(() => {
      if (isCancelled) return;
      cleanup();
      resolve(AD_BLOCK_STATES.INCONCLUSIVE);
    }, timeoutMs);

    // Run parallel network probe and DOM probe
    const networkProbePromise = checkNetworkAdBlock();

    // Initial check after 800ms to allow DOM and CSS rules to compute
    setTimeout(async () => {
      if (isCancelled) return;

      const isNetworkBlocked = await networkProbePromise;
      if (isCancelled) return;

      if (isNetworkBlocked) {
        // Confirm that the document/tab is rendered and control element is not hidden
        if (!isElementHidden(controlEl)) {
          cleanup();
          resolve(AD_BLOCK_STATES.SUSPECTED_BLOCKING);
          return;
        }
      }

      const controlHidden = isElementHidden(controlEl);
      const baitHidden = isElementHidden(baitEl);

      // If control element is hidden, the document/tab is hidden or styling is delayed -> inconclusive
      if (controlHidden) {
        cleanup();
        resolve(AD_BLOCK_STATES.INCONCLUSIVE);
        return;
      }

      // If bait is NOT hidden, ads can render
      if (!baitHidden) {
        cleanup();
        resolve(AD_BLOCK_STATES.NO_BLOCKING_DETECTED);
        return;
      }

      // Bait is hidden while control is visible: perform ONE automatic confirmation check after 700ms
      confirmationTimerId = setTimeout(() => {
        if (isCancelled) return;

        const secondControlCheck = isElementHidden(controlEl);
        const secondBaitCheck = isElementHidden(baitEl);

        cleanup();

        if (secondBaitCheck && !secondControlCheck) {
          resolve(AD_BLOCK_STATES.SUSPECTED_BLOCKING);
        } else if (!secondBaitCheck) {
          resolve(AD_BLOCK_STATES.NO_BLOCKING_DETECTED);
        } else {
          resolve(AD_BLOCK_STATES.INCONCLUSIVE);
        }
      }, 700);
    }, 800);
  });

  activeProbe = {
    promise,
    cancel: () => {
      isCancelled = true;
      cleanup();
    }
  };

  return promise;
}

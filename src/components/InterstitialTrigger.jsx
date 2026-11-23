import { useEffect } from 'react';
import { useAdSettings, isPlaceholderAdCode } from '../services/store';
import { useClickAd } from '../services/clickAdContext';
import { mountAdTag } from '../services/adTag';
import { useMobileAdViewport } from '../services/adViewport';

function recentDisplays(key, period) {
  try {
    const entries = JSON.parse(localStorage.getItem(key) || '[]');
    const now = Date.now();
    return entries.filter(time => Number.isFinite(time) && time <= now && now - time < period);
  } catch {
    return [];
  }
}

export default function InterstitialTrigger({ currentView, videoId }) {
  const mobile = useMobileAdViewport();
  const slot = useAdSettings()[mobile ? 'slot_mobile_interstitial' : 'slot_interstitial'];
  const enabled = useClickAd() === 'interstitial' && slot?.isActive && !isPlaceholderAdCode(slot.code);

  useEffect(() => {
    if (!enabled) return;
    const template = document.createElement('template');
    template.innerHTML = slot.code;
    const zone = template.content.querySelector('ins[data-zoneid]')?.dataset.zoneid;
    if (!zone || !/^\d+$/.test(zone)) return;
    const key = 'adcast_interstitial_history_' + zone;
    const period = Math.max(1, Number(slot.frequencyHours) || 1) * 3600000;
    if (recentDisplays(key, period).length >= (mobile ? 3 : 1)) return;

    const host = document.createElement('div');
    host.dataset.adcastInterstitial = zone;
    document.body.appendChild(host);
    const overlaySelector = '#ad_' + zone + '.ex-over-top';

    let display = null;
    let beforeLock;
    let timer;
    let disposed = false;
    let unmountTag;
    function restoreScroll() {
      if (!display) return;
      if (beforeLock) {
        document.body.style.overflow = beforeLock.overflow || '';
        document.body.style.position = beforeLock.position || '';
        document.body.style.height = beforeLock.height || '';
        document.documentElement.style.overflow = beforeLock.htmlOverflow || '';
        document.body.style.touchAction = beforeLock.touchAction || '';
      } else {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.body.style.touchAction = '';
      }
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('click', startSafetyTimer, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('creativeDisplayed-' + zone, checkDisplay);
      restoreScroll();
      unmountTag?.();
      host.remove();
    }
    function checkDisplay() {
      if (disposed) return;
      const overlay = host.querySelector(overlaySelector);
      if (!overlay || !overlay.getClientRects().length || getComputedStyle(overlay).visibility === 'hidden') {
        if (display) dispose();
        return;
      }
      if (!display) {
        display = overlay;
        clearTimeout(timer);
        try { localStorage.setItem(key, JSON.stringify([...recentDisplays(key, period), Date.now()])); } catch {}

        // Lock background scrolling and touch action on both html and body while ad is displayed
        if (!beforeLock) {
          beforeLock = {
            overflow: document.body.style.overflow,
            position: document.body.style.position,
            height: document.body.style.height,
            htmlOverflow: document.documentElement.style.overflow,
            touchAction: document.body.style.touchAction
          };
        }
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';

        // Bind direct tap/click listener with ghost-click prevention on mobile devices
        const closeBtn = overlay.querySelector('.ex-over-btn');
        if (closeBtn) {
          const onDismiss = (e) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            dispose();
          };
          closeBtn.addEventListener('click', onDismiss);
          closeBtn.addEventListener('touchend', onDismiss, { passive: false });
        }
      }
    }
    function startSafetyTimer(event) {
      if (display || timer || host.contains(event.target) || event.target.closest?.('[role="dialog"]')) return;
      if (!beforeLock) {
        beforeLock = {
          overflow: document.body.style.overflow,
          position: document.body.style.position,
          height: document.body.style.height,
          htmlOverflow: document.documentElement.style.overflow,
          touchAction: document.body.style.touchAction
        };
      }
      timer = setTimeout(() => {
        checkDisplay();
        if (!display) dispose();
      }, 6000);
    }
    function onKey(event) {
      if (display && event.key === 'Escape') {
        event.preventDefault();
        const control = display.querySelector('.ex-over-btn');
        if (control?.getClientRects().length && getComputedStyle(control).visibility !== 'hidden') control.click();
      }
    }
    // ExoClick owns dismissal, click-through and any close delay.
    const observer = new MutationObserver(checkDisplay);
    observer.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    window.addEventListener('click', startSafetyTimer, true);
    document.addEventListener('keydown', onKey);
    document.addEventListener('creativeDisplayed-' + zone, checkDisplay);
    unmountTag = mountAdTag(host, slot.code);
    return dispose;
  }, [enabled, slot?.code, slot?.frequencyHours, currentView, videoId, mobile]);
  return null;
}

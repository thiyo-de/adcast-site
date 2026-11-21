import React, { useEffect, useRef } from 'react';
import { useAdSettings, isPlaceholderAdCode } from '../services/store';
import { useAdBlock } from '../services/adBlockContext';

export default function InterstitialTrigger({ currentView }) {
  const adSettings = useAdSettings();
  const { isNoticeOpen } = useAdBlock();
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  const slotKey = isMobile ? 'slot_mobile_interstitial' : 'slot_interstitial';
  const slot = adSettings[slotKey] || adSettings['slot_interstitial'];
  const mountedRef = useRef(false);

  useEffect(() => {
    // 1. Guard check: Browser environment, valid route, and adblock notice not open
    if (typeof window === 'undefined') return;

    const isExcludedRoute = ['admin', 'dmca', 'privacy', 'terms'].includes(currentView);

    // Helper: completely and cleanly remove all interstitial DOM nodes and restore scrolling
    const dismissInterstitial = () => {
      const container = document.getElementById('adcast-ad-injection-container');
      if (container) container.remove();

      document.querySelectorAll('[data-adcast-interstitial="true"]').forEach((el) => el.remove());

      // Remove ExoClick's native overlay container (.ex-over-top, #ad_6093518, etc.)
      document.querySelectorAll(
        '.ex-over-top, [id^="ad_"], .ex-over-front, [class*="ex-over"], .eas-interstitial, [class*="eas-interstitial"], [class*="interstitial-modal"], div[class*="eas-overlay"], [id*="eas-overlay"], [id*="eas-interstitial"]'
      ).forEach((el) => el.remove());

      // Restore body and html scrolling if ExoClick locked it
      if (typeof document !== 'undefined') {
        if (document.body) {
          document.body.style.overflow = '';
          document.body.style.height = '';
          document.body.style.position = '';
        }
        if (document.documentElement) {
          document.documentElement.style.overflow = '';
          document.documentElement.style.height = '';
        }
      }

      mountedRef.current = false;
    };

    // If on excluded route or notice open, clean up any visible interstitial
    if (isExcludedRoute || isNoticeOpen) {
      dismissInterstitial();
      return;
    }

    if (!slot || !slot.isActive || !slot.code || isPlaceholderAdCode(slot.code)) {
      return;
    }

    // Global capture-phase dismiss listener: intercepts clicks before child scripts can call stopPropagation()
    const handleCaptureClick = (ev) => {
      const target = ev.target;
      if (!target) return;

      // 1. Direct hit on our dedicated high-contrast close button
      if (target.closest?.('#adcast-interstitial-close-btn')) {
        ev.preventDefault();
        ev.stopPropagation();
        dismissInterstitial();
        return;
      }

      // Check if click is anywhere inside the interstitial overlay hierarchy
      const isInInterstitial = target.closest?.(
        '#adcast-interstitial-close-btn, #adcast-ad-injection-container, .ex-over-top, .ex-over-front, [id^="ad_"], .eas-interstitial, [class*="eas-interstitial"], [class*="interstitial-modal"], div[class*="eas-overlay"]'
      );

      // If click is on normal webpage elements outside the interstitial, let it pass freely
      if (!isInInterstitial) return;

      // 2. Click on ExoClick provider close button, image, cross icon, or dismiss text
      const isCloseTarget =
        target.closest?.('.ex-over-btn, [class*="ex-over-btn"], [class*="close" i], [id*="close" i], [aria-label*="close" i], [class*="dismiss" i], [class*="skip" i], button, .eas-close') ||
        (target.tagName === 'IMG' && (target.alt?.toLowerCase().includes('close') || target.src?.includes('close'))) ||
        target.textContent?.includes('✕') ||
        target.textContent?.includes('×') ||
        target.textContent?.trim() === 'X' ||
        target.textContent?.trim() === 'x' ||
        target.textContent?.toLowerCase().includes('close') ||
        target.textContent?.toLowerCase().includes('skip');

      if (isCloseTarget) {
        ev.preventDefault();
        ev.stopPropagation();
        dismissInterstitial();
        return;
      }

      // 3. Click on the dark backdrop outside the ad modal:
      // Any click inside the interstitial hierarchy outside the actual ad creative cards/links dismisses the overlay
      const isInsideAdContent = target.closest?.('.ex-over-inner-container, [class*="inner-container"], a[href], iframe');
      if (!isInsideAdContent) {
        ev.preventDefault();
        ev.stopPropagation();
        dismissInterstitial();
      }
    };

    // Escape key dismiss listener
    const handleKeyDown = (ev) => {
      if (ev.key === 'Escape' || ev.keyCode === 27) {
        ev.preventDefault();
        ev.stopPropagation();
        dismissInterstitial();
      }
    };

    // If container already exists (persisting across page transitions), just keep listeners active
    const existingContainer = document.getElementById('adcast-ad-injection-container');
    if (existingContainer) {
      document.addEventListener('click', handleCaptureClick, true);
      document.addEventListener('touchend', handleCaptureClick, true);
      document.addEventListener('keydown', handleKeyDown, true);
      return () => {
        document.removeEventListener('click', handleCaptureClick, true);
        document.removeEventListener('touchend', handleCaptureClick, true);
        document.removeEventListener('keydown', handleKeyDown, true);
      };
    }

    // 2. Frequency capping check: 3 times per 1 hour (matching ExoClick zone setting)
    const now = Date.now();
    try {
      localStorage.removeItem('adcast_last_interstitial'); // Clear legacy 1-per-hour lockout
    } catch {}

    let history = [];
    try {
      history = JSON.parse(localStorage.getItem('adcast_interstitial_history') || '[]');
      if (!Array.isArray(history)) history = [];
    } catch {
      history = [];
    }
    const recentTriggers = history.filter((ts) => typeof ts === 'number' && now - ts < 3600000);
    const maxPerHour = slot.frequencyHours ? slot.frequencyHours * 3 : 3;

    if (recentTriggers.length >= maxPerHour) {
      return; // Capped for this hour
    }

    if (mountedRef.current) return;
    mountedRef.current = true;

    // 3. Clean up any previous interstitial artifacts
    const oldElements = document.querySelectorAll('[data-adcast-interstitial="true"]');
    oldElements.forEach((el) => el.remove());

    // 4. Inject container and provider tag into body with fixed, centered overlay geometry
    const interstitialContainer = document.createElement('div');
    interstitialContainer.id = 'adcast-ad-injection-container';
    interstitialContainer.setAttribute('data-adcast-interstitial', 'true');
    interstitialContainer.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;pointer-events:none;';

    // Inject CSS to ensure ExoClick's close button and backdrop always receive pointer events
    const helperStyle = document.createElement('style');
    helperStyle.setAttribute('data-adcast-interstitial', 'true');
    helperStyle.textContent = `
      #adcast-interstitial-close-btn {
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        cursor: pointer !important;
      }
      .ex-over-top, .ex-over-front, .ex-over-btn, .ex-over-btn img, [id^="ad_"] {
        pointer-events: auto !important;
        cursor: pointer !important;
      }
      .ex-over-inner-container {
        cursor: default !important;
      }
    `;
    document.head.appendChild(helperStyle);

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = slot.code;

    // Non-script elements (e.g. <ins class="eas6a97888e35" data-zoneid="6093518"></ins>)
    const nonScripts = slot.code.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    interstitialContainer.innerHTML = nonScripts;

    const insEl = interstitialContainer.querySelector('ins');
    if (insEl) {
      insEl.style.setProperty('margin', '0 auto', 'important');
      insEl.style.setProperty('display', 'block', 'important');
      insEl.style.setProperty('text-align', 'center', 'important');
      insEl.style.setProperty('pointer-events', 'auto', 'important');
    }

    // Dedicated high-contrast Close Button to guarantee user can always exit
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.id = 'adcast-interstitial-close-btn';
    closeBtn.setAttribute('data-adcast-interstitial', 'true');
    closeBtn.setAttribute('aria-label', 'Close advertisement');
    closeBtn.innerHTML = isMobileViewport
      ? '<span style="font-size:22px;line-height:1;font-weight:700;display:inline-block;pointer-events:none;">✕</span><span style="font-size:12px;font-weight:700;margin-left:6px;letter-spacing:0.5px;text-transform:uppercase;pointer-events:none;">Close</span>'
      : '<span style="font-size:22px;line-height:1;font-weight:700;display:inline-block;pointer-events:none;">✕</span>';
    closeBtn.style.cssText = isMobileViewport
      ? 'position:fixed;top:12px;right:12px;z-index:2147483647;min-width:52px;height:48px;padding:0 14px;border-radius:9999px;background:rgba(15,23,42,0.92);border:2px solid rgba(255,255,255,0.6);color:#ffffff;display:none;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto;box-shadow:0 8px 32px rgba(0,0,0,0.85);backdrop-filter:blur(8px);font-family:sans-serif;'
      : 'position:fixed;top:18px;right:18px;z-index:2147483647;width:44px;height:44px;border-radius:9999px;background:rgba(0,0,0,0.85);border:1.5px solid rgba(255,255,255,0.4);color:#ffffff;display:none;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto;box-shadow:0 6px 24px rgba(0,0,0,0.7);transition:transform 0.15s ease,background 0.15s ease;';

    const handleClose = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      dismissInterstitial();
    };
    closeBtn.addEventListener('click', handleClose);
    closeBtn.addEventListener('touchstart', handleClose, { passive: false });
    document.body.appendChild(closeBtn);

    document.addEventListener('click', handleCaptureClick, true);
    document.addEventListener('touchend', handleCaptureClick, true);
    document.addEventListener('keydown', handleKeyDown, true);

    document.body.appendChild(interstitialContainer);

    // Scripts (ad-provider.js and push serve)
    const scripts = tempDiv.querySelectorAll('script');
    scripts.forEach((s) => {
      const newScript = document.createElement('script');
      newScript.setAttribute('data-adcast-interstitial', 'true');
      Array.from(s.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.textContent = s.textContent;
      document.body.appendChild(newScript);
    });

    // 5. Continuous observer for overlay launch (triggers whenever user clicks on page)
    const checkConfirmedDisplay = () => {
      const hasOverlay =
        document.querySelector(
          '.ex-over-top, [id^="ad_"], .eas-interstitial, [class*="eas-interstitial"], [class*="interstitial-modal"], iframe[id*="eas-"], div[class*="eas-overlay"], [class*="eas6a97888e"]'
        ) ||
        (interstitialContainer &&
          Array.from(interstitialContainer.querySelectorAll('iframe, ins > *, div, img')).some(
            (el) => el.offsetHeight > 30 || el.offsetWidth > 30
          ));

      if (hasOverlay) {
        try {
          const h = JSON.parse(localStorage.getItem('adcast_interstitial_history') || '[]');
          const updated = Array.isArray(h) ? h.filter((ts) => typeof ts === 'number' && Date.now() - ts < 3600000) : [];
          updated.push(Date.now());
          localStorage.setItem('adcast_interstitial_history', JSON.stringify(updated));
        } catch {}

        closeBtn.style.display = 'flex';

        if (interstitialContainer) {
          interstitialContainer.style.pointerEvents = 'auto';
          interstitialContainer.querySelectorAll('*').forEach((child) => {
            child.style.setProperty('pointer-events', 'auto', 'important');
          });
        }
        return true;
      }
      return false;
    };

    // Watch for DOM mutations (when ExoClick injects overlay)
    const observer = new MutationObserver(() => {
      if (checkConfirmedDisplay()) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Also poll every 1s as fallback
    const pollInterval = setInterval(() => {
      if (checkConfirmedDisplay()) {
        clearInterval(pollInterval);
        observer.disconnect();
      }
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      observer.disconnect();
      document.removeEventListener('click', handleCaptureClick, true);
      document.removeEventListener('touchend', handleCaptureClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [slot, currentView, isNoticeOpen]);

  return null;
}

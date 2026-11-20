import React, { useEffect, useRef } from 'react';
import { useAdSettings, isPlaceholderAdCode } from '../services/store';
import { useAdBlock } from '../services/adBlockContext';

export default function InterstitialTrigger({ currentView }) {
  const adSettings = useAdSettings();
  const { isNoticeOpen } = useAdBlock();
  const slot = adSettings['slot_interstitial'];
  const mountedRef = useRef(false);

  useEffect(() => {
    // 1. Guard check: Active slot, valid code, not admin/legal routes, and adblock notice not open (universal device support)
    if (typeof window === 'undefined') return;

    const isExcludedRoute = ['admin', 'dmca', 'privacy', 'terms'].includes(currentView);

    if (!slot || !slot.isActive || !slot.code || isPlaceholderAdCode(slot.code) || isExcludedRoute || isNoticeOpen) {
      return;
    }

    // 2. Frequency capping check: 1 time per 1 hour (matching ExoClick zone setting)
    const now = Date.now();
    const lastTrigger = parseInt(localStorage.getItem('adcast_last_interstitial') || '0', 10);
    const oneHourMs = (slot.frequencyHours || 1) * 60 * 60 * 1000;

    if (now - lastTrigger < oneHourMs) {
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

    // Helper: completely and cleanly remove all interstitial DOM nodes
    const dismissInterstitial = () => {
      try {
        localStorage.setItem('adcast_last_interstitial', Date.now().toString());
      } catch {}

      const container = document.getElementById('adcast-ad-injection-container');
      if (container) container.remove();

      document.querySelectorAll('[data-adcast-interstitial="true"]').forEach((el) => el.remove());

      document.querySelectorAll(
        '.eas-interstitial, [class*="eas-interstitial"], [class*="interstitial-modal"], div[class*="eas-overlay"], [id*="eas-overlay"], [id*="eas-interstitial"]'
      ).forEach((el) => el.remove());
    };

    // Dedicated high-contrast Close Button to guarantee user can always exit
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.id = 'adcast-interstitial-close-btn';
    closeBtn.setAttribute('aria-label', 'Close advertisement');
    closeBtn.innerHTML = '<span style="font-size:22px;line-height:1;font-weight:700;display:inline-block;pointer-events:none;">✕</span>';
    closeBtn.style.cssText =
      'position:fixed;top:18px;right:18px;z-index:10000000;width:44px;height:44px;border-radius:9999px;background:rgba(0,0,0,0.85);border:1.5px solid rgba(255,255,255,0.4);color:#ffffff;display:none;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto;box-shadow:0 6px 24px rgba(0,0,0,0.7);transition:transform 0.15s ease,background 0.15s ease;';
    closeBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      dismissInterstitial();
    });
    interstitialContainer.appendChild(closeBtn);

    // Global capture-phase dismiss listener: intercepts clicks before child scripts can call stopPropagation()
    const handleCaptureClick = (ev) => {
      const target = ev.target;
      if (!target) return;

      // 1. Direct hit on our dedicated close button
      if (target.closest('#adcast-interstitial-close-btn')) {
        ev.preventDefault();
        ev.stopPropagation();
        dismissInterstitial();
        return;
      }

      // 2. Click on provider close button, cross icon, skip button, or dismiss text
      const isCloseTarget =
        target.closest('[class*="close" i], [id*="close" i], [aria-label*="close" i], [class*="dismiss" i], [class*="skip" i], button, .eas-close') ||
        target.textContent?.includes('✕') ||
        target.textContent?.includes('×') ||
        target.textContent?.trim() === 'X' ||
        target.textContent?.trim() === 'x' ||
        target.textContent?.toLowerCase().includes('close') ||
        target.textContent?.toLowerCase().includes('skip');

      if (isCloseTarget) {
        const isInsideInterstitial = target.closest(
          '#adcast-ad-injection-container, [data-adcast-interstitial="true"], .eas-interstitial, [class*="eas-interstitial"], [class*="interstitial-modal"], div[class*="eas-overlay"]'
        );
        if (isInsideInterstitial) {
          ev.preventDefault();
          ev.stopPropagation();
          dismissInterstitial();
          return;
        }
      }

      // 3. Click on the dark backdrop outside the ad modal
      if (target === interstitialContainer || target.id === 'adcast-ad-injection-container') {
        dismissInterstitial();
      }
    };
    document.addEventListener('click', handleCaptureClick, true);

    // Escape key dismiss listener
    const handleKeyDown = (ev) => {
      if (ev.key === 'Escape' || ev.keyCode === 27) {
        dismissInterstitial();
      }
    };
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

    // 5. Monitor for confirmed display: stamp cooldown, show close button, and enable pointer events
    let checkInterval = null;
    let checks = 0;
    const maxChecks = 25; // Check for up to 12.5 seconds (500ms * 25)

    const checkConfirmedDisplay = () => {
      checks++;
      const hasOverlay =
        document.querySelector('.eas-interstitial, [class*="eas-interstitial"], [class*="interstitial-modal"], iframe[id*="eas-"], div[class*="eas-overlay"]') ||
        (interstitialContainer &&
         Array.from(interstitialContainer.querySelectorAll('iframe, ins > *')).some(el => el.offsetHeight > 50 || el.offsetWidth > 50));

      if (hasOverlay) {
        try {
          localStorage.setItem('adcast_last_interstitial', Date.now().toString());
        } catch {}

        closeBtn.style.display = 'flex';

        // Enable pointer events on the container and all children so close/skip buttons can be clicked
        if (interstitialContainer) {
          interstitialContainer.style.pointerEvents = 'auto';
          interstitialContainer.querySelectorAll('*').forEach((child) => {
            child.style.setProperty('pointer-events', 'auto', 'important');
          });
        }

        if (checkInterval) clearInterval(checkInterval);
        return;
      }

      if (checks >= maxChecks && checkInterval) {
        clearInterval(checkInterval);
      }
    };

    checkInterval = setInterval(checkConfirmedDisplay, 500);

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      document.removeEventListener('click', handleCaptureClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      dismissInterstitial();
      mountedRef.current = false;
    };
  }, [slot, currentView, isNoticeOpen]);

  return null;
}

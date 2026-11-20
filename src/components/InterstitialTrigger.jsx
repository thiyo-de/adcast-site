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

    // 5. Monitor for confirmed display: stamp cooldown ONLY once the full-page interstitial is actually visible
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
      const existing = document.querySelectorAll('[data-adcast-interstitial="true"]');
      existing.forEach((el) => el.remove());
      mountedRef.current = false;
    };
  }, [slot, currentView, isNoticeOpen]);

  return null;
}

import React, { useEffect } from 'react';
import { useAdSettings, isPlaceholderAdCode } from '../services/store';
import { useAdBlock } from '../services/adBlockContext';

export default function PopunderTrigger() {
  const adSettings = useAdSettings();
  const { isNoticeOpen } = useAdBlock();
  const slot = adSettings['slot_popunder'];

  useEffect(() => {
    // 1. Guard check: Slot must be active, have valid code, not be placeholder, and not be paused by AdBlock notice
    if (!slot || !slot.isActive || !slot.code || isPlaceholderAdCode(slot.code) || isNoticeOpen) {
      if (typeof window !== 'undefined') {
        window.__popunderDiagnostics = {
          status: 'inactive',
          reason: isNoticeOpen
            ? 'Paused while AdBlock notice is open'
            : !slot
            ? 'No slot configuration'
            : !slot.isActive
            ? 'Slot disabled in settings'
            : 'Placeholder or empty code',
          timestamp: new Date().toISOString()
        };
      }
      return;
    }

    // 2. Explicitly wire global window.ad_idzone and ExoClick variables for complete script compatibility
    const zoneMatch = slot.code.match(/ad_idzone["':\s=]+["']?(\d+)/i) || slot.code.match(/idzone["':\s]+(\d+)/i);
    if (zoneMatch && zoneMatch[1] && typeof window !== 'undefined') {
      window.ad_idzone = zoneMatch[1];
      window.ad_frequency_period = 60; // 1-hour cap
      window.ad_frequency_count = 1;
      window.ad_trigger_method = 1;
      window.ad_tcf_enabled = true;
      window.ad_popup_fallback = false;
      window.ad_popup_force = false;
      window.ad_chrome_enabled = true;
      window.ad_new_tab = true;
    }

    // 3. Clean up any previously installed popunder scripts
    const existingScripts = document.querySelectorAll('[data-adcast-popunder="true"]');
    existingScripts.forEach((el) => el.remove());

    const injectedElements = [];

    if (typeof window !== 'undefined') {
      window.__popunderDiagnostics = {
        status: 'initializing',
        zoneId: zoneMatch?.[1] || '6093374',
        frequencyPeriod: 60,
        scriptLoaded: false,
        error: null,
        timestamp: new Date().toISOString()
      };
    }

    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = slot.code;
      const scripts = tempDiv.querySelectorAll('script');

      scripts.forEach((s) => {
        const newScript = document.createElement('script');
        newScript.setAttribute('data-adcast-popunder', 'true');
        Array.from(s.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });

        if (s.src) {
          newScript.src = s.src;
          newScript.async = true;
          newScript.onload = () => {
            if (typeof window !== 'undefined' && window.__popunderDiagnostics) {
              window.__popunderDiagnostics.scriptLoaded = true;
              window.__popunderDiagnostics.status = 'ready_for_user_interaction';
              window.__popunderDiagnostics.loadedAt = new Date().toISOString();
            }
          };
          newScript.onerror = (err) => {
            if (typeof window !== 'undefined' && window.__popunderDiagnostics) {
              window.__popunderDiagnostics.error = 'Failed to load popunder script from ad network (network/ad-blocker blocked)';
              window.__popunderDiagnostics.status = 'error';
            }
          };
        } else {
          newScript.textContent = s.textContent;
        }

        document.body.appendChild(newScript);
        injectedElements.push(newScript);
      });
    } catch (err) {
      if (typeof window !== 'undefined' && window.__popunderDiagnostics) {
        window.__popunderDiagnostics.error = err.message;
        window.__popunderDiagnostics.status = 'exception';
      }
    }

    // 3. Proper unmount cleanup when component unmounts or slot.code changes
    return () => {
      injectedElements.forEach((el) => {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    };
  }, [slot?.isActive, slot?.code, isNoticeOpen]);

  return null;
}

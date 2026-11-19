import React, { useEffect } from 'react';
import { useAdSettings, isPlaceholderAdCode } from '../services/store';

export default function PopunderTrigger() {
  const adSettings = useAdSettings();
  const slot = adSettings['slot_popunder'];

  useEffect(() => {
    // 1. Guard check: Slot must be active, have valid code, and not be placeholder
    if (!slot || !slot.isActive || !slot.code || isPlaceholderAdCode(slot.code)) {
      if (typeof window !== 'undefined') {
        window.__popunderDiagnostics = {
          status: 'inactive',
          reason: !slot ? 'No slot configuration' : !slot.isActive ? 'Slot disabled in settings' : 'Placeholder or empty code',
          timestamp: new Date().toISOString()
        };
      }
      return;
    }

    // 2. Clean up any previously installed popunder scripts (if code updated or re-mounted)
    const existingScripts = document.querySelectorAll('[data-adcast-popunder="true"]');
    existingScripts.forEach((el) => el.remove());

    const injectedElements = [];

    if (typeof window !== 'undefined') {
      window.__popunderDiagnostics = {
        status: 'initializing',
        zoneId: slot.code.match(/idzone["':\s]+(\d+)/i)?.[1] || 'unknown',
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
  }, [slot?.isActive, slot?.code]);

  return null;
}

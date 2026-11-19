import React, { useEffect } from 'react';
import { useAdSettings, isPlaceholderAdCode } from '../services/store';

export default function PopunderTrigger() {
  const adSettings = useAdSettings();
  const slot = adSettings['slot_popunder'];

  useEffect(() => {
    // 1. Guard check: Slot must be active, have valid code, and not be placeholder
    if (!slot || !slot.isActive || !slot.code || isPlaceholderAdCode(slot.code)) {
      return;
    }

    // Avoid duplicate script tag injection in the DOM
    if (document.getElementById('adcast-popunder-script')) {
      return;
    }

    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = slot.code;
      const scripts = tempDiv.querySelectorAll('script');

      scripts.forEach((s, idx) => {
        const newScript = document.createElement('script');
        if (idx === scripts.length - 1) {
          newScript.id = 'adcast-popunder-script';
        }
        Array.from(s.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });

        if (s.src) {
          newScript.src = s.src;
          newScript.async = true;
        } else {
          newScript.textContent = s.textContent;
        }
        document.body.appendChild(newScript);
      });
    } catch (err) {
      console.warn('[HornyLeaks Popunder] Script injection notice:', err);
    }
  }, [slot?.isActive, slot?.code]);

  return null;
}

import React, { useEffect } from 'react';
import { store, useAdSettings, isPlaceholderAdCode } from '../services/store';

export default function PopunderTrigger() {
  const adSettings = useAdSettings();
  const slot = adSettings['slot_popunder'];

  useEffect(() => {
    // 1. Guard check: Slot must be active, have valid code, not be placeholder, and 24h must have passed
    if (!slot || !slot.isActive || !store.shouldTriggerPopunder() || !slot.code || isPlaceholderAdCode(slot.code)) {
      return;
    }
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = slot.code;
      const scripts = tempDiv.querySelectorAll('script');

      scripts.forEach((s) => {
        const newScript = document.createElement('script');
        Array.from(s.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.textContent = s.textContent;
        document.head.appendChild(newScript);
      });
    } catch (err) {
      console.warn('[HornyLeaks Popunder] Script injection notice:', err);
    }

    const handleFirstInteraction = () => {
      // Lock cooldown immediately for 24h
      store.markPopunderTriggered();
      console.log('[HornyLeaks Popunder] Single 24h background trigger activated. Next eligible in 24 hours.');
      window.removeEventListener('click', handleFirstInteraction);
    };

    // Attach click listener on the first user interaction
    window.addEventListener('click', handleFirstInteraction, { once: true });
    return () => window.removeEventListener('click', handleFirstInteraction);
  }, [slot?.isActive, slot?.code]);

  return null;
}

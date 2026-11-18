import React, { useEffect } from 'react';
import { store } from '../services/store';

export default function PopunderTrigger() {
  useEffect(() => {
    const adSettings = store.getAdSettings();
    const slot = adSettings['slot_popunder'];

    // 1. Guard check: Slot must be active, have valid code, and 24h must have passed
    if (!slot || !slot.isActive || !store.shouldTriggerPopunder() || !slot.code) {
      return;
    }

    if (slot.code.includes('Adsterra Popunder Script Placeholder')) {
      return;
    }

    // Skip dynamic injection if already loaded in index.html head
    if (document.querySelector('script[src*="benchform.org"]')) {
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
  }, []);

  return null;
}

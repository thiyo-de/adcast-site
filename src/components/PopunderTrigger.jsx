import React, { useEffect } from 'react';
import { store } from '../services/store';

export default function PopunderTrigger() {
  useEffect(() => {
    const adSettings = store.getAdSettings();
    const slot = adSettings['slot_popunder'];

    // 1. Guard check: Slot must be active and 24h must have passed
    if (!slot || !slot.isActive || !store.shouldTriggerPopunder()) {
      return;
    }

    const handleFirstInteraction = () => {
      // Re-verify cooldown at trigger moment
      if (!store.shouldTriggerPopunder()) return;

      // Lock cooldown immediately
      store.markPopunderTriggered();

      // 2. Execute script injection if code provided
      if (slot.code) {
        try {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = slot.code;
          const scripts = tempDiv.querySelectorAll('script');

          scripts.forEach((s) => {
            const newScript = document.createElement('script');
            // Copy all script attributes (src, async, type, etc.)
            Array.from(s.attributes).forEach((attr) => {
              newScript.setAttribute(attr.name, attr.value);
            });
            newScript.textContent = s.textContent;
            document.body.appendChild(newScript);
          });
        } catch (err) {
          console.warn('[AdCast Popunder] Script execution notice:', err);
        }
      }

      console.log('[AdCast Popunder] Single 24h background trigger activated. Next eligible in 24 hours.');
      window.removeEventListener('click', handleFirstInteraction);
    };

    // Attach clickunder on the first user interaction
    window.addEventListener('click', handleFirstInteraction, { once: true });
    return () => window.removeEventListener('click', handleFirstInteraction);
  }, []);

  return null;
}

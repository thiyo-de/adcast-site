import React, { useState, useEffect, useRef } from 'react';
import AdSlot from './AdSlot';
import { useAdSettings } from '../services/store';

export default function StickyFooter() {
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('adcast_sticky_dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const wrapperRef = useRef(null);
  const adSettings = useAdSettings();
  const slot = adSettings['slot_sticky_footer'];

  useEffect(() => {
    if (!slot || !slot.isActive || isDismissed) return;

    // Detect when the ad container actually has rendered content
    let intervalId = null;
    let checks = 0;

    const checkHeight = () => {
      checks++;
      if (wrapperRef.current) {
        const adEl = wrapperRef.current.querySelector('ins, iframe, img, [class*="eas"], div[class*="slot_sticky_footer"]');
        const height = wrapperRef.current.offsetHeight;
        if (height > 25 || (adEl && (adEl.offsetHeight > 20 || adEl.children.length > 0))) {
          setIsLoaded(true);
          if (intervalId) clearInterval(intervalId);
          return;
        }
      }
      if (checks >= 20 && intervalId) {
        clearInterval(intervalId);
      }
    };

    intervalId = setInterval(checkHeight, 300);
    checkHeight();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [slot, isDismissed]);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('adcast_sticky_dismissed', 'true');
    } catch {}
  };

  if (!slot || !slot.isActive || isDismissed) return null;

  return (
    <aside
      aria-label="Sponsored"
      className={`fixed bottom-0 left-0 right-0 z-40 w-full transition-opacity duration-300 pointer-events-auto ${
        isLoaded ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="w-full bg-slate-900/95 dark:bg-black/95 backdrop-blur-xl border-t border-slate-200/20 dark:border-white/10 shadow-2xl py-2 px-3 flex items-center justify-center relative">
        <button
          onClick={handleDismiss}
          className="absolute -top-6 right-3 sm:right-6 px-2 py-0.5 rounded-t-md bg-slate-900/95 dark:bg-black/95 hover:bg-black text-[10px] font-bold text-slate-300 hover:text-white border-t border-x border-slate-700 dark:border-white/20 flex items-center gap-1 shadow-lg cursor-pointer transition-colors"
          title="Dismiss sticky ad"
          aria-label="Dismiss sticky ad"
        >
          <span>Ad</span>
          <i className="ri-close-line not-italic text-xs"></i>
        </button>

        <div ref={wrapperRef} className="w-full max-w-4xl flex items-center justify-center min-h-[50px] overflow-hidden">
          <AdSlot slotId="slot_sticky_footer" devBadge={false} />
        </div>
      </div>
    </aside>
  );
}

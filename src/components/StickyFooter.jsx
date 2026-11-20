import React, { useState, useEffect, useRef } from 'react';
import AdSlot from './AdSlot';
import { useAdSettings } from '../services/store';
import { useAdBlock } from '../services/adBlockContext';

export default function StickyFooter({ currentView }) {
  const { isNoticeOpen } = useAdBlock();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const wrapperRef = useRef(null);
  const adSettings = useAdSettings();
  const slot = adSettings['slot_sticky_footer'];

  // Reset dismissal when user navigates to a new page (matching ExoClick 'Show on every page' setting)
  useEffect(() => {
    setIsDismissed(false);
    setIsLoaded(false);
  }, [currentView]);

  useEffect(() => {
    if (!slot || !slot.isActive || isDismissed || isNoticeOpen) return;

    let intervalId = null;

    const checkRenderedCreative = () => {
      if (!wrapperRef.current) return;
      const iframe = wrapperRef.current.querySelector('iframe');
      const ins = wrapperRef.current.querySelector('ins');
      const img = wrapperRef.current.querySelector('a > img, div > img');

      const hasIframeWithContent = iframe && (iframe.offsetHeight > 10 || iframe.offsetWidth > 10) && window.getComputedStyle(iframe).display !== 'none';
      const hasFilledIns = ins && (ins.children.length > 0 || ins.offsetHeight > 20 || ins.getAttribute('data-ad-status') === 'filled') && window.getComputedStyle(ins).display !== 'none';
      const hasRenderedImage = img && img.offsetHeight > 20 && window.getComputedStyle(img).display !== 'none';

      const isCurrentlyVisible = Boolean(hasIframeWithContent || hasFilledIns || hasRenderedImage);

      setIsLoaded((prev) => (prev !== isCurrentlyVisible ? isCurrentlyVisible : prev));
    };

    intervalId = setInterval(checkRenderedCreative, 400);
    checkRenderedCreative();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [slot, isDismissed, isNoticeOpen, currentView]);

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsLoaded(false);
  };

  if (!slot || !slot.isActive || isDismissed || isNoticeOpen) return null;
  if (typeof window !== 'undefined' && (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/'))) return null;

  return (
    <aside
      id="adcast-sticky-footer"
      aria-label="Sponsored"
      className={`fixed bottom-0 left-0 right-0 z-40 w-full flex justify-center items-center pointer-events-none transition-all duration-300 pb-1 sm:pb-2 ${
        isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ paddingBottom: 'calc(0.25rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        ref={wrapperRef}
        className="relative pointer-events-auto inline-flex items-center justify-center max-w-[95vw] sm:max-w-4xl max-h-[140px] sm:max-h-[120px] overflow-hidden mx-auto"
      >
        {/* Floating Close Button */}
        {isLoaded && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close advertisement"
            className="absolute -top-3 right-0 z-50 flex items-center justify-center w-6 h-6 rounded-full bg-slate-900/90 hover:bg-black text-slate-300 hover:text-white border border-white/20 shadow-lg text-[10px] font-bold transition-all hover:scale-110 active:scale-95"
            title="Dismiss ad"
          >
            ✕
          </button>
        )}

        <AdSlot slotId="slot_sticky_footer" devBadge={false} />
      </div>
    </aside>
  );
}

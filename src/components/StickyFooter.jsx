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
      const ad = wrapperRef.current.querySelector('[data-ad-state]');
      const isCurrentlyVisible = ad?.dataset.adState === 'loaded';

      setIsLoaded((prev) => (prev !== isCurrentlyVisible ? isCurrentlyVisible : prev));
    };

    intervalId = setInterval(checkRenderedCreative, 400);
    checkRenderedCreative();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [slot, isDismissed, isNoticeOpen, currentView]);

  const handleDismiss = (e) => {
    if (e) {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.preventDefault === 'function') e.preventDefault();
    }
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
        className="relative pointer-events-auto w-fit max-w-[98vw] flex items-center justify-center mx-auto"
      >
        {/* Floating Close Button tightly anchored to the creative */}
        {isLoaded && (
          <button
            type="button"
            onClick={handleDismiss}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Close advertisement"
            className="absolute -top-2.5 right-1 sm:-right-2 z-50 flex items-center justify-center w-6 h-6 rounded-full bg-slate-900/95 hover:bg-black text-white/90 hover:text-white border border-white/20 shadow-xl text-[10px] font-bold transition-all hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-md"
            title="Dismiss ad"
          >
            ✕
          </button>
        )}

        <AdSlot key={currentView} slotId="slot_sticky_footer" devBadge={false} />
      </div>
    </aside>
  );
}

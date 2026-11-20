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

    // Detect when the ad container actually has rendered creative content (not empty static wrapper)
    let intervalId = null;
    let checks = 0;

    const checkRenderedCreative = () => {
      checks++;
      if (wrapperRef.current) {
        const iframe = wrapperRef.current.querySelector('iframe');
        const ins = wrapperRef.current.querySelector('ins');
        const img = wrapperRef.current.querySelector('a > img, div > img');

        const hasIframeWithContent = iframe && (iframe.offsetHeight > 10 || iframe.offsetWidth > 10);
        const hasFilledIns = ins && (ins.children.length > 0 || ins.offsetHeight > 20 || ins.getAttribute('data-ad-status') === 'filled');
        const hasRenderedImage = img && img.offsetHeight > 20;

        if (hasIframeWithContent || hasFilledIns || hasRenderedImage) {
          setIsLoaded(true);
          if (intervalId) clearInterval(intervalId);
          return;
        }
      }
      if (checks >= 25 && intervalId) {
        clearInterval(intervalId);
      }
    };

    intervalId = setInterval(checkRenderedCreative, 300);
    checkRenderedCreative();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [slot, isDismissed, isNoticeOpen, currentView]);

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  if (!slot || !slot.isActive || isDismissed || isNoticeOpen) return null;
  if (typeof window !== 'undefined' && (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/'))) return null;

  return (
    <aside
      id="adcast-sticky-footer"
      aria-label="Sponsored"
      className={`fixed bottom-0 left-0 right-0 z-40 w-full transition-opacity duration-300 pointer-events-auto ${
        isLoaded ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="w-full bg-slate-900/95 dark:bg-black/95 backdrop-blur-xl border-t border-slate-200/20 dark:border-white/10 shadow-2xl py-1 px-2 sm:py-1.5 sm:px-3 flex items-center justify-center relative">
        <div ref={wrapperRef} className="w-full max-w-4xl flex items-center justify-center min-h-[50px] sm:min-h-[90px] overflow-hidden">
          <AdSlot slotId="slot_sticky_footer" devBadge={false} />
        </div>
      </div>
    </aside>
  );
}

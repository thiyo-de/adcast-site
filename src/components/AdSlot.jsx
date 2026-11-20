import React, { useEffect, useRef, useState } from 'react';
import { store, useAdSettings } from '../services/store';
import { hasRenderedAd, getAdFrameLayout } from '../services/adRendering';
import { useAdBlock } from '../services/adBlockContext';
import { AD_BLOCK_STATES } from '../services/adBlockDetection';

export default function AdSlot({ slotId, className = '', devBadge = true }) {
  const containerRef = useRef(null);
  const outerWrapperRef = useRef(null);
  const [isFallback, setIsFallback] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const adSettings = useAdSettings();
  const slot = adSettings[slotId];
  const isDevMode = store.isDevMode();
  const { isNoticeOpen, detectionState } = useAdBlock();
  const isAdBlockSuspected = isNoticeOpen || detectionState === AD_BLOCK_STATES.SUSPECTED_BLOCKING;

  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window !== 'undefined') return window.innerWidth < 768;
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Device-adaptive zone switching based on Ads-Prop specifications:
  // Top banner: mobile 300x250 banner zone 6096160 (<768px), desktop 728x90 zone 6093488 (>=768px)
  // Sticky bottom: mobile zone 6096158 (<768px), desktop zone 6093426 (>=768px)
  const rawCode = slot?.code || '';
  let effectiveCode = rawCode;
  if (slotId === 'slot_top_banner' && rawCode) {
    const desktopZone = slot.desktopZoneId || '6093488';
    const mobileZone = slot.mobileZoneId || '6096160';
    if (isMobileViewport) {
      effectiveCode = rawCode.includes(desktopZone)
        ? rawCode.replaceAll(desktopZone, mobileZone)
        : (rawCode.includes('6093362') ? rawCode.replaceAll('6093362', mobileZone) : rawCode);
    } else {
      effectiveCode = rawCode.includes(mobileZone)
        ? rawCode.replaceAll(mobileZone, desktopZone)
        : (rawCode.includes('6093362') ? rawCode.replaceAll('6093362', desktopZone) : rawCode);
    }
  } else if (slotId === 'slot_sticky_footer' && rawCode) {
    const desktopZone = slot.desktopZoneId || '6093426';
    const mobileZone = slot.mobileZoneId || '6096158';
    if (isMobileViewport) {
      effectiveCode = rawCode.includes(desktopZone)
        ? rawCode.replaceAll(desktopZone, mobileZone)
        : rawCode;
    } else {
      effectiveCode = rawCode.includes(mobileZone)
        ? rawCode.replaceAll(mobileZone, desktopZone)
        : rawCode;
    }
  }

  const isNative = slotId === 'slot_native_feed';
  const frameWidth = slotId === 'slot_below_player' ? 300
    : (slotId === 'slot_top_banner' || slotId === 'slot_sticky_footer')
      ? (isMobileViewport ? 300 : 728) : undefined;
  const frameHeight = frameWidth === 728 ? 90 : 250;

  // Consolidated effect: parse and inject ad tag or switch to fallback
  useEffect(() => {
    let isMounted = true;
    if (!slot || !slot.isActive) return;

    // Detect unconfigured placeholder codes
    const isPlaceholder =
      !effectiveCode ||
      effectiveCode.includes('Replace in Admin Panel') ||
      effectiveCode.includes('EXOCLICK BELOW-PLAYER BANNER') ||
      effectiveCode.includes('EXOCLICK TOP LEADERBOARD') ||
      effectiveCode.includes('EXOCLICK NATIVE RECOMMENDATIONS') ||
      effectiveCode.includes('EXOCLICK TABUNDER') ||
      effectiveCode.includes('JUICYADS') ||
      effectiveCode.includes('TrafficFactory') ||
      effectiveCode.includes('EXOCLICK STICKY BOTTOM BANNER') ||
      effectiveCode.includes('Adsterra Popunder Script Placeholder');

    if (isPlaceholder) {
      setIsFallback(true);
      return;
    }

    setIsFallback(false);
    setIsLoaded(false);

    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = effectiveCode;

    // Fit oversized fixed creatives proportionally; never crop or stretch their contents.
    const fitFrame = () => {
      const wrapper = outerWrapperRef.current;
      if (!isMounted || !wrapper || !wrapper.clientWidth) return;
      if (isNative) {
        container.style.transform = 'none';
        wrapper.style.height = '100%';
        return;
      }
      // Measure untransformed bounds, then fit the entire creative within the card.
      container.style.transform = 'none';
      const wrapperRect = wrapper.getBoundingClientRect();
      const scaleX = wrapper.offsetWidth ? wrapperRect.width / wrapper.offsetWidth : 1;
      const scaleY = wrapper.offsetHeight ? wrapperRect.height / wrapper.offsetHeight : scaleX;
      if (scaleX <= 0 || scaleY <= 0) return;
      const layout = getAdFrameLayout(wrapper.clientWidth, container.getBoundingClientRect(),
        [...container.querySelectorAll('ins, iframe, img, video, table, ins div, ins a')]
          .map(element => element.getBoundingClientRect()), { x: scaleX, y: scaleY });
      if (!layout) return;
      container.style.transform = `translate(${layout.x}px, ${layout.y}px) scale(${layout.scale})`;
      wrapper.style.height = `${layout.height}px`;
    };
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fitFrame) : null;
    const observedCreatives = new WeakSet();
    resizeObserver?.observe(outerWrapperRef.current);
    resizeObserver?.observe(container);
    window.addEventListener('resize', fitFrame);

    // Style only our frame. Never rewrite the provider's tables, links or thumbnails.
    const loadedFrames = new WeakSet();
    const updateDelivery = () => {
      if (!isMounted) return;
      // Provider frames can resize without resizing their absolute-positioned wrapper.
      container.querySelectorAll('ins, iframe, img, video').forEach(element => {
        if (!observedCreatives.has(element)) {
          resizeObserver?.observe(element);
          observedCreatives.add(element);
        }
      });
      fitFrame();
      const delivered = hasRenderedAd(container, loadedFrames);
      if (delivered) {
        setIsLoaded(true);
      }
    };
    const handleLoad = (event) => {
      if (event.target.tagName === 'IFRAME') loadedFrames.add(event.target);
      updateDelivery();
    };
    container.addEventListener('load', handleLoad, true);
    const observer = new MutationObserver(records => {
      // Ignore our own transform writes; react to provider sizing and content changes.
      if (records.some(record => record.type === 'childList' || record.target !== container)) updateDelivery();
    });
    observer.observe(container, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['style', 'class', 'width', 'height'],
    });

    const scripts = tempDiv.querySelectorAll('script');
    if (scripts.length > 0) {
      const nonScripts = effectiveCode.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      container.innerHTML = nonScripts;

      scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.textContent = oldScript.textContent;
        newScript.onerror = () => {
          if (isMounted) setIsFallback(true);
        };
        container.appendChild(newScript);
      });
    } else {
      container.innerHTML = effectiveCode;
    }

    return () => {
      isMounted = false;
      observer.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', fitFrame);
      container.removeEventListener('load', handleLoad, true);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [effectiveCode, slot?.isActive, slotId, frameWidth]);

  if (!slot || !slot.isActive) return null;

  // Clean collapse: if ad fails, unconfigured, or adblock suspected, collapse space completely (0px)
  if (isFallback || isAdBlockSuspected) return null;

  if (isNative) {
    return (
      <div
        data-ad-slot={slotId}
        data-ad-state={isLoaded ? 'loaded' : 'loading'}
        className={`group relative h-full min-h-[280px] sm:min-h-[300px] w-full rounded-2xl glass-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-2xl ${className}`}
      >
        {/* Dev Mode Badge */}
        {isDevMode && devBadge && (
          <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-sans font-bold tabular-nums bg-black/85 text-rose-400 border border-rose-500/40 shadow-md pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
            {`${slot.network || 'Ad Slot'} | ${slot.dimensions || slotId}`}
          </div>
        )}

        {/* Live Ad Container (Full Card Edge-to-Edge - Absolute Inset) */}
        <div
          ref={outerWrapperRef}
          className="adcast-ad-frame adcast-ad-native-container absolute inset-0 w-full h-full overflow-hidden rounded-2xl flex items-center justify-center"
        >
          <div
            ref={containerRef}
            className="adcast-ad-content adcast-ad-native w-full h-full"
            style={{ position: 'relative', width: '100%', height: '100%' }}
          />
        </div>

        {/* Floating Badges for Live Ad */}
        {isLoaded && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none z-20">
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wider uppercase bg-amber-500 text-black shadow-sm">
              SPONSORED
            </span>
          </div>
        )}
      </div>
    );
  }

  const showDisclosure = slotId !== 'slot_sticky_footer' && slotId !== 'slot_native_feed';

  return (
    <div
      data-ad-slot={slotId}
      data-ad-state={isLoaded ? 'loaded' : 'loading'}
      className={`relative min-w-0 w-full mx-auto self-start flex flex-col items-center ${className}`}
      style={{ maxWidth: frameWidth }}
    >
      {/* Dev Mode Badge */}
      {isDevMode && devBadge && (
        <div className="absolute top-1 right-1 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-sans font-bold tabular-nums bg-black/85 text-rose-400 border border-rose-500/40 shadow-md">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
          {`${slot.network || 'Ad Slot'} | ${slot.dimensions || slotId}`}
        </div>
      )}

      {/* Compliance Micro-Disclosure Label */}
      {showDisclosure && isLoaded && (
        <div className="w-full flex items-center justify-center py-1 select-none pointer-events-none">
          <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400 dark:text-[#64748B] opacity-80">
            Advertisement
          </span>
        </div>
      )}

      {/* Live Ad Container */}
      <div
        ref={outerWrapperRef}
        className="adcast-ad-frame relative w-full min-w-0 overflow-hidden flex items-center justify-center"
      >
        <div
          ref={containerRef}
          className="adcast-ad-content adcast-ad-banner"
          style={{ position: 'absolute', left: 0, top: 0, width: frameWidth || '100%', transformOrigin: 'top left' }}
        />
      </div>
    </div>
  );
}

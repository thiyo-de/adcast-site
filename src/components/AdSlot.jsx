import { useMobileAdViewport } from '../services/adViewport';
import { mountAdTag } from '../services/adTag';
import React, { useEffect, useRef, useState } from 'react';
import { store, useAdSettings, isPlaceholderAdCode } from '../services/store';
import { hasRenderedAd, getAdFrameLayout } from '../services/adRendering';
import { useAdBlock } from '../services/adBlockContext';
import { AD_BLOCK_STATES } from '../services/adBlockDetection';

export default function AdSlot({ slotId, className = '', devBadge = true, onAdLoaded = null }) {
  const containerRef = useRef(null);
  const outerWrapperRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [adHeadline, setAdHeadline] = useState('');
  const adSettings = useAdSettings();

  const isMobileViewport = useMobileAdViewport();

  // Determine target zone by screen width first:
  // Top banner: mobile zone 'slot_top_banner_mobile' (<768px), desktop zone 'slot_top_banner' (>=768px)
  // Sticky bottom: mobile zone 'slot_sticky_footer_mobile' (<768px), desktop zone 'slot_sticky_footer' (>=768px)
  let targetSlotId = slotId;
  if (slotId === 'slot_top_banner') {
    targetSlotId = isMobileViewport ? 'slot_top_banner_mobile' : 'slot_top_banner';
  } else if (slotId === 'slot_sticky_footer') {
    targetSlotId = isMobileViewport ? 'slot_sticky_footer_mobile' : 'slot_sticky_footer';
  }

  // Check ONLY that target zone's switch
  const activeSlot = adSettings[targetSlotId];
  const isDevMode = store.isDevMode();
  const { isNoticeOpen, detectionState } = useAdBlock();
  const isAdBlockSuspected = isNoticeOpen || detectionState === AD_BLOCK_STATES.SUSPECTED_BLOCKING;

  const isDedicatedMobileBanner = targetSlotId === 'slot_top_banner_mobile' || targetSlotId === 'slot_sticky_footer_mobile';
  const effectiveCode = activeSlot?.code || '';

  const isNative = targetSlotId === 'slot_native_feed';
  const frameWidth = (targetSlotId === 'slot_below_player' || isDedicatedMobileBanner || (isMobileViewport && (targetSlotId === 'slot_top_banner' || targetSlotId === 'slot_sticky_footer')))
    ? 300
    : (targetSlotId === 'slot_top_banner' || targetSlotId === 'slot_sticky_footer')
      ? 728
      : (targetSlotId === 'slot_desktop_skyscraper_left' || targetSlotId === 'slot_desktop_skyscraper_right')
        ? 160
        : undefined;
  const enabled = activeSlot?.isActive && !isPlaceholderAdCode(effectiveCode) && !isAdBlockSuspected;

  useEffect(() => {
    setIsLoaded(false);
    if (!enabled || !containerRef.current) return;
    let isMounted = true;
    const container = containerRef.current;
    const wrapper = outerWrapperRef.current;
    const backgrounds = new Map();
    function widgetImageReady() {
      // ExoClick can fill ordinary banner zones with a multi-item native widget.
      return Array.from(container.querySelectorAll('.msg-native-widget-item-image, .exo-native-widget-item-image')).some(media => {
        const rect = media.getBoundingClientRect();
        if (rect.width <= 15 || rect.height <= 15) return false;
        const style = getComputedStyle(media);
        if (style.visibility === 'hidden' || style.opacity === '0') return false;
        const url = style.backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
        if (!url) return false;
        let image = backgrounds.get(url);
        if (!image) {
          image = new Image();
          backgrounds.set(url, image);
          image.onload = updateDelivery;
          image.src = url;
        }
        return image.complete && image.naturalWidth > 10 && image.naturalHeight > 10;
      });
    }

    // Fit oversized fixed creatives proportionally; never crop or stretch their contents.
    const fitFrame = () => {
      const wrapper = outerWrapperRef.current;
      if (!isMounted || !wrapper || !wrapper.clientWidth) return;
      if (isNative) return;
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
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateDelivery()) : null;
    const observedCreatives = new WeakSet();
    resizeObserver?.observe(outerWrapperRef.current);
    resizeObserver?.observe(container);
    window.addEventListener('resize', updateDelivery);

    // Style only our frame. Never rewrite the provider's tables, links or thumbnails.
    const loadedFrames = new WeakSet();
    function updateDelivery() {
      if (!isMounted) return;
      // Provider frames can resize without resizing their absolute-positioned wrapper.
      container.querySelectorAll('ins, iframe, img, video').forEach(element => {
        if (!observedCreatives.has(element)) {
          resizeObserver?.observe(element);
          observedCreatives.add(element);
        }
      });
      fitFrame();
      const creative = isNative && container.querySelector('.msg-native-widget-item, .exo-native-widget-item');
      const delivered = widgetImageReady() || hasRenderedAd(creative || container, loadedFrames);
      setIsLoaded(delivered);
      onAdLoaded?.(delivered);
      if (!delivered && !isNative) wrapper.style.height = '0px';
    }
    const handleLoad = (event) => {
      if (event.target.tagName === 'IFRAME') loadedFrames.add(event.target);
      updateDelivery();
    };
    container.addEventListener('load', handleLoad, true);
    container.addEventListener('error', updateDelivery, true);
    container.addEventListener('loadeddata', updateDelivery, true);
    const observer = new MutationObserver(records => {
      // Ignore our own transform writes; react to provider sizing and content changes.
      if (records.some(record => record.type === 'childList' || record.target !== container)) updateDelivery();
    });
    observer.observe(container, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['style', 'class', 'width', 'height'],
    });

    const unmount = mountAdTag(container, effectiveCode);
    updateDelivery();

    return () => {
      isMounted = false;
      observer.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateDelivery);
      container.removeEventListener('load', handleLoad, true);
      container.removeEventListener('error', updateDelivery, true);
      container.removeEventListener('loadeddata', updateDelivery, true);
      for (const image of backgrounds.values()) image.onload = null;
      onAdLoaded?.(false);
      wrapper.style.removeProperty('height');
      unmount();
    };
  }, [effectiveCode, enabled, targetSlotId, frameWidth, isNative, onAdLoaded]);

  // Extract ExoClick's headline text from their rendered DOM so we can render it
  // in our own styled section while keeping ExoClick's click-tracking link intact.
  useEffect(() => {
    if (!isLoaded || !isNative || !containerRef.current) { setAdHeadline(''); return; }
    const el = containerRef.current;
    const text =
      el.querySelector('.exo-native-widget-item-title, .msg-native-widget-item-title')?.textContent?.trim() ||
      el.querySelector('.exo-native-widget-header, .msg-native-widget-header')?.textContent?.trim() ||
      el.querySelector('a[href]')?.textContent?.trim() ||
      '';
    setAdHeadline(text);
  }, [isLoaded, isNative]);

  if (!enabled) return null;

  if (isNative) {
    return (
      <div
        data-ad-slot={targetSlotId}
        inert={isLoaded ? undefined : ''}
        aria-hidden={isLoaded ? undefined : true}
        data-ad-state={isLoaded ? 'loaded' : 'loading'}
        className={`flex flex-col ${
          isLoaded
            ? `relative rounded-2xl glass-card overflow-hidden h-full ${className}`
            : 'absolute col-start-1 col-end-2 w-full h-0 overflow-hidden opacity-0 pointer-events-none'
        }`}
      >
        {/* Dev Mode Badge */}
        {isDevMode && devBadge && isLoaded && (
          <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-sans font-bold tabular-nums bg-black/85 text-rose-400 border border-rose-500/40 shadow-md pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
            {`${activeSlot?.network || 'Ad Slot'} | ${activeSlot?.dimensions || targetSlotId}`}
          </div>
        )}

        {/* Thumbnail region — ExoClick renders its image here; text is hidden via CSS */}
        <div className="relative w-full overflow-hidden flex items-center justify-center">
          <div
            ref={outerWrapperRef}
            className="adcast-ad-frame adcast-ad-native-container relative w-full h-auto overflow-hidden"
          >
            <div
              ref={containerRef}
              className="adcast-ad-content adcast-ad-native w-full h-auto"
              style={{ position: 'relative', width: '100%' }}
            />
          </div>
        </div>

        {/* Info section — mirrors VideoCard's p-3.5 block exactly */}
        {isLoaded && (
          <div className="p-3.5 flex flex-col flex-1 justify-between gap-2.5">
            <div>
              {/* Category slot → Sponsored label (same style as video category tag) */}
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400 mb-0.5">
                Sponsored
              </span>
              {/* Headline → bold left-aligned title (same style as video title) */}
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug min-h-[2.5rem]">
                {adHeadline || activeSlot?.name || 'Sponsored Content'}
              </p>
            </div>
            {/* Footer bar — same border-t + mt-auto as video meta bar */}
            <div className="flex items-center pt-2 border-t border-slate-200/60 dark:border-white/[0.06] mt-auto">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 select-none">Ad</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const showDisclosure = targetSlotId !== 'slot_sticky_footer' && targetSlotId !== 'slot_sticky_footer_mobile' && targetSlotId !== 'slot_native_feed';

  return (
    <div
      data-ad-slot={targetSlotId}
      data-ad-state={isLoaded ? 'loaded' : 'loading'}
      className={`relative min-w-0 w-full mx-auto self-start flex flex-col items-center ${className}`}
      style={{ maxWidth: frameWidth }}
    >
      {/* Dev Mode Badge */}
      {isDevMode && devBadge && (
        <div className="absolute top-1 right-1 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-sans font-bold tabular-nums bg-black/85 text-rose-400 border border-rose-500/40 shadow-md">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
          {`${activeSlot?.network || 'Ad Slot'} | ${activeSlot?.dimensions || targetSlotId}`}
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

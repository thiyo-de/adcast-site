import React, { useEffect, useRef, useState } from 'react';
import { store, useAdSettings, isValidAffiliateCampaign } from '../services/store';
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
  const affiliateSettings = adSettings.affiliate_fallbacks || {};
  const isDevMode = store.isDevMode();
  const { isNoticeOpen, detectionState } = useAdBlock();
  const isAdBlockSuspected = isNoticeOpen || detectionState === AD_BLOCK_STATES.SUSPECTED_BLOCKING;

  // Pick appropriate campaign with valid fallback cascade
  const getCampaign = () => {
    switch (slotId) {
      case 'slot_native_feed': {
        if (isValidAffiliateCampaign(affiliateSettings.dating)) return affiliateSettings.dating;
        if (isValidAffiliateCampaign(affiliateSettings.vpn)) return affiliateSettings.vpn;
        return affiliateSettings.dating;
      }
      case 'slot_below_player': {
        if (isValidAffiliateCampaign(affiliateSettings.vpn)) return affiliateSettings.vpn;
        if (isValidAffiliateCampaign(affiliateSettings.gaming)) return affiliateSettings.gaming;
        return affiliateSettings.vpn;
      }
      case 'slot_sticky_footer':
      case 'slot_top_banner':
      default: {
        if (isValidAffiliateCampaign(affiliateSettings.vpn)) return affiliateSettings.vpn;
        if (isValidAffiliateCampaign(affiliateSettings.gaming)) return affiliateSettings.gaming;
        return affiliateSettings.vpn;
      }
    }
  };

  const campaign = getCampaign();

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
    let lastDeliveredAt = Date.now();
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
      setIsLoaded(delivered);
      if (delivered) {
        lastDeliveredAt = Date.now();
        setIsFallback(false);
      } else if (!isNative && Date.now() - lastDeliveredAt >= 3500) {
        // Also handle a later provider refresh that leaves the placement empty.
        setIsFallback(true);
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
    const refreshInterval = setInterval(updateDelivery, 1000);
    const noFillTimer = setTimeout(() => {
      if (isMounted && !hasRenderedAd(container, loadedFrames)) {
        if (!isNative) {
          setIsFallback(true);
        } else if (hasFallback) {
          setIsFallback(true);
        }
      }
    }, 3500);

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
      clearInterval(refreshInterval);
      clearTimeout(noFillTimer);
      container.removeEventListener('load', handleLoad, true);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [effectiveCode, slot?.isActive, slotId, frameWidth]);

  if (!slot || !slot.isActive) return null;

  const handleAffiliateClick = () => {
    if (campaign?.url) {
      window.open(campaign.url, '_blank', 'noopener,noreferrer,sponsored');
    }
  };

  const hasFallback = Boolean(!isAdBlockSuspected && affiliateSettings.isEnabled && isValidAffiliateCampaign(campaign));

  const showDisclosure = !isFallback && slotId !== 'slot_sticky_footer' && slotId !== 'slot_native_feed';

  if (isNative) {
    if (isFallback && !hasFallback) return null;

    return (
      <div
        data-ad-slot={slotId}
        data-ad-state={isFallback ? (hasFallback ? 'fallback' : 'empty') : isLoaded ? 'loaded' : 'loading'}
        className={`group relative h-full min-h-[280px] sm:min-h-[300px] w-full rounded-2xl glass-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-2xl ${className}`}
      >
        {/* Dev Mode Badge */}
        {isDevMode && devBadge && (
          <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-sans font-bold tabular-nums bg-black/85 text-rose-400 border border-rose-500/40 shadow-md pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
            {isFallback ? 'Affiliate Fallback' : `${slot.network || 'Ad Slot'} | ${slot.dimensions || slotId}`}
          </div>
        )}

        {/* Fallback Creative (Full Card Edge-to-Edge) */}
        {isFallback && hasFallback && (
          <div
            onClick={handleAffiliateClick}
            className="absolute inset-0 w-full h-full cursor-pointer overflow-hidden flex flex-col justify-end p-3.5 group rounded-2xl"
          >
            <img
              src={campaign.image}
              alt={campaign.title}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none z-20">
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wider uppercase bg-amber-500 text-black shadow-sm">
                {campaign.badge || 'SPONSORED'}
              </span>
            </div>
            <div className="relative z-10 space-y-2">
              <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-2 drop-shadow-md">
                {campaign.title}
              </h4>
              <button className="min-h-[36px] w-full py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white text-xs font-bold shadow-md hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1">
                <span>{campaign.mobileCta || campaign.cta || 'Learn More'}</span>
                <i className="ri-arrow-right-line text-xs"></i>
              </button>
            </div>
          </div>
        )}

        {/* Live Ad Container (Full Card Edge-to-Edge - Absolute Inset) */}
        <div
          ref={outerWrapperRef}
          className="adcast-ad-frame adcast-ad-native-container absolute inset-0 w-full h-full overflow-hidden rounded-2xl flex items-center justify-center"
          style={{ display: isFallback && hasFallback ? 'none' : undefined }}
        >
          <div
            ref={containerRef}
            className="adcast-ad-content adcast-ad-native w-full h-full"
            style={{ position: 'relative', width: '100%', height: '100%' }}
          />
        </div>

        {/* Floating Badges for Live Ad */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none z-20">
          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wider uppercase bg-amber-500 text-black shadow-sm">
            SPONSORED
          </span>
        </div>
        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-md text-[10px] font-sans font-bold tabular-nums tracking-tight text-white border border-white/10 shadow-sm pointer-events-none z-20">
          AD ↗
        </div>
      </div>
    );
  }

  // Clean collapse: if fallback triggered but no valid fallback campaign exists, collapse space completely (0px)
  if (isFallback && !hasFallback) return null;

  const effectiveMaxWidth = slotId === 'slot_sticky_footer' && isFallback
    ? (isMobileViewport ? 'min(460px, 96vw)' : frameWidth)
    : frameWidth;

  return (
    <div
      data-ad-slot={slotId}
      data-ad-state={isFallback ? (hasFallback ? 'fallback' : 'empty') : isLoaded ? 'loaded' : 'loading'}
      className={`relative min-w-0 w-full mx-auto self-start flex flex-col items-center ${className}`}
      style={{ maxWidth: effectiveMaxWidth }}
    >
      {/* Dev Mode Badge */}
      {isDevMode && devBadge && (
        <div className="absolute top-1 right-1 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-sans font-bold tabular-nums bg-black/85 text-rose-400 border border-rose-500/40 shadow-md">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
          {isFallback ? (
            <span className="flex items-center gap-1">
              <i className="ri-flashlight-line text-xs"></i> Affiliate Fallback
            </span>
          ) : (
            `${slot.network || 'Ad Slot'} | ${slot.dimensions || slotId}`
          )}
        </div>
      )}

      {/* Compliance Micro-Disclosure Label */}
      {showDisclosure && (
        <div className="w-full flex items-center justify-center py-1 select-none pointer-events-none">
          <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400 dark:text-[#64748B] opacity-80">
            Advertisement
          </span>
        </div>
      )}

      {/* Render Fallback Card if unconfigured or failed */}
      {isFallback && hasFallback && (
        <div className="w-full h-full flex items-center justify-center">
          {/* Top Leaderboard Fallback (Sleek low-profile horizontal banner on mobile & desktop) */}
          {slotId === 'slot_top_banner' && (
            <div
              onClick={handleAffiliateClick}
              className="w-full py-2 px-3 sm:py-3 sm:px-4 rounded-xl sm:rounded-2xl glass-card border border-rose-500/20 hover:border-rose-500/50 shadow-md cursor-pointer group transition-all flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 text-left min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0 group-hover:scale-105 transition-transform">
                  <i className="ri-shield-keyhole-line not-italic text-base sm:text-xl"></i>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded">
                      {campaign.badge || 'VERIFIED DEAL'}
                    </span>
                    <span className="text-[10px] sm:text-xs text-slate-400 font-semibold truncate hidden xs:inline">{campaign.network}</span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-100 group-hover:text-rose-400 transition-colors truncate">
                    {campaign.title}
                  </h4>
                </div>
              </div>
              <button className="min-h-[32px] sm:min-h-[38px] px-3 sm:px-5 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black text-[11px] sm:text-xs shadow-md group-hover:scale-105 active:scale-95 transition-all shrink-0 flex items-center justify-center gap-1">
                <span>{campaign.mobileCta || campaign.cta}</span>
                <i className="ri-arrow-right-line text-xs"></i>
              </button>
            </div>
          )}

          {/* Below-Player Fallback */}
          {slotId === 'slot_below_player' && (
            <div
              onClick={handleAffiliateClick}
              className="w-full p-5 sm:p-6 rounded-2xl glass-card border border-rose-500/20 hover:border-rose-500/50 shadow-xl cursor-pointer group transition-all text-center max-w-2xl mx-auto flex flex-col items-center justify-center"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
                <i className="ri-shield-check-fill not-italic"></i> {campaign.badge || 'SPONSORED OFFER'}
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white mb-1.5 group-hover:text-rose-500 transition-colors">
                {campaign.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 max-w-lg mb-4">
                {campaign.description}
              </p>
              <button className="min-h-[42px] px-8 py-2 rounded-full bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-extrabold text-xs shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5">
                <span>{campaign.cta}</span>
                <i className="ri-arrow-right-line text-sm"></i>
              </button>
            </div>
          )}

          {/* Sticky Footer Fallback (Guaranteed safe spacing so close button NEVER collides with CTA) */}
          {slotId === 'slot_sticky_footer' && (
            <div
              onClick={handleAffiliateClick}
              className="w-full h-12 sm:h-14 flex items-center justify-between pl-3 sm:pl-4 pr-11 sm:pr-8 cursor-pointer group bg-slate-900/95 hover:bg-slate-900 text-white transition-colors rounded-2xl sm:rounded-full border border-white/10 shadow-2xl"
            >
              <div className="flex items-center gap-2 text-left min-w-0 pr-2">
                <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/25 text-rose-400 flex items-center justify-center shrink-0">
                  <i className="ri-shield-star-fill not-italic text-sm"></i>
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-wider text-rose-400 block sm:hidden">
                    {campaign.badge || 'SPONSORED'}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white group-hover:text-rose-400 transition-colors truncate block">
                    {campaign.title}
                  </span>
                </div>
              </div>
              <button className="min-h-[30px] sm:min-h-[34px] px-3 sm:px-4 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] sm:text-xs shrink-0 shadow-md transition-all">
                {campaign.mobileCta || campaign.cta}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Keep the injection node mounted so changed settings/device zones can recover after no-fill. */}
      <div
        ref={outerWrapperRef}
        className="adcast-ad-frame relative w-full min-w-0 overflow-hidden flex items-center justify-center"
        style={{
          display: isFallback ? 'none' : undefined,
          minHeight: !isLoaded ? frameHeight : undefined,
        }}
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

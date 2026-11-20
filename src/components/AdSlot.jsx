import React, { useEffect, useRef, useState } from 'react';
import { store, useAdSettings } from '../services/store';
import { hasRenderedAd } from '../services/adRendering';

export default function AdSlot({ slotId, className = '', devBadge = true }) {
  const containerRef = useRef(null);
  const outerWrapperRef = useRef(null);
  const [isFallback, setIsFallback] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const adSettings = useAdSettings();
  const slot = adSettings[slotId];
  const affiliateSettings = adSettings.affiliate_fallbacks || {};
  const isDevMode = store.isDevMode();

  // Pick appropriate campaign based on slot position
  const getCampaign = () => {
    switch (slotId) {
      case 'slot_native_feed':
        return affiliateSettings.dating || affiliateSettings.vpn;
      case 'slot_below_player':
        return affiliateSettings.vpn || affiliateSettings.gaming;
      case 'slot_sticky_footer':
        return affiliateSettings.vpn;
      case 'slot_top_banner':
      default:
        return affiliateSettings.vpn;
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

  // Device-adaptive zone switching:
  // Top banner: mobile 300x250 banner zone 6093362 (<768px), desktop 728x90 zone 6093488 (>=768px)
  // Sticky bottom: mobile zone 6096158 (<768px), desktop zone 6093426 (>=768px)
  const rawCode = slot?.code || '';
  let effectiveCode = rawCode;
  if (slotId === 'slot_top_banner' && rawCode) {
    if (isMobileViewport) {
      effectiveCode = rawCode.includes('6093488') ? rawCode.replace('6093488', '6093362') : (rawCode.includes('6096160') ? rawCode.replace('6096160', '6093362') : rawCode);
    } else {
      effectiveCode = rawCode.includes('6093362') ? rawCode.replace('6093362', '6093488') : (rawCode.includes('6096160') ? rawCode.replace('6096160', '6093488') : rawCode);
    }
  } else if (slotId === 'slot_sticky_footer' && rawCode) {
    if (isMobileViewport) {
      effectiveCode = rawCode.includes('6093426') ? rawCode.replace('6093426', '6096158') : rawCode;
    } else {
      effectiveCode = rawCode.includes('6096158') ? rawCode.replace('6096158', '6093426') : rawCode;
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
      if (!wrapper || !wrapper.clientWidth) return;
      const naturalWidth = Math.max(container.offsetWidth,
        ...[...container.querySelectorAll('iframe, img, video, ins > *')].map(el => el.offsetWidth || 0));
      const scale = Math.min(1, wrapper.clientWidth / (naturalWidth || 1));
      container.style.transform = scale < 1 ? `scale(${scale})` : '';
      wrapper.style.height = `${Math.ceil(container.scrollHeight * scale)}px`;
    };
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fitFrame) : null;
    resizeObserver?.observe(outerWrapperRef.current);
    resizeObserver?.observe(container);
    window.addEventListener('resize', fitFrame);

    // Style only our frame. Never rewrite the provider's tables, links or thumbnails.
    const loadedFrames = new WeakSet();
    let lastDeliveredAt = Date.now();
    const updateDelivery = () => {
      if (!isMounted) return;
      fitFrame();
      const delivered = hasRenderedAd(container, loadedFrames);
      setIsLoaded(delivered);
      if (delivered) {
        lastDeliveredAt = Date.now();
        setIsFallback(false);
      } else if (Date.now() - lastDeliveredAt >= 10000) {
        // Also handle a later provider refresh that leaves the placement empty.
        setIsFallback(true);
      }
    };
    const handleLoad = (event) => {
      if (event.target.tagName === 'IFRAME') loadedFrames.add(event.target);
      updateDelivery();
    };
    container.addEventListener('load', handleLoad, true);
    const observer = new MutationObserver(updateDelivery);
    observer.observe(container, { childList: true, subtree: true });
    const refreshInterval = setInterval(updateDelivery, 1000);
    const noFillTimer = setTimeout(() => {
      if (isMounted && !hasRenderedAd(container, loadedFrames)) setIsFallback(true);
    }, 10000);

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

  const hasFallback = Boolean(affiliateSettings.isEnabled && campaign?.url);

  const showDisclosure = slotId !== 'slot_sticky_footer' && slotId !== 'slot_native_feed';

  return (
    <div
      data-ad-slot={slotId}
      data-ad-state={isFallback ? (hasFallback ? 'fallback' : 'empty') : isLoaded ? 'loaded' : 'loading'}
      className={`relative min-w-0 w-full mx-auto self-start flex flex-col items-center ${isNative ? 'rounded-2xl glass-card p-2 gap-2' : ''} ${className}`}
      style={{ maxWidth: frameWidth, display: isFallback && !hasFallback ? 'none' : undefined }}
    >
      {/* Dev Mode Badge */}
      {isDevMode && devBadge && (
        <div className="absolute top-1 right-1 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-sans font-bold tabular-nums bg-black/85 text-cyan-400 border border-cyan-500/40 shadow-md">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
          {isFallback ? (
            <span className="flex items-center gap-1">
              <i className="ri-flashlight-line text-xs"></i> Affiliate Fallback
            </span>
          ) : (
            `${slot.network || 'Ad Slot'} | ${slot.dimensions || slotId}`
          )}
        </div>
      )}

      {/* Keep the disclosure outside the creative, clear of provider controls. */}
      {isNative && (
        <div className="w-full flex items-center px-1 pointer-events-none">
          <span className="text-[9px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
            Advertisement
          </span>
        </div>
      )}

      {/* Compliance Micro-Disclosure Label */}
      {showDisclosure && (
        <div className="w-full flex items-center justify-center py-1 select-none pointer-events-none">
          <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400 dark:text-[#64748B] opacity-80">
            {isFallback ? 'Sponsored Recommendation' : 'Advertisement'}
          </span>
        </div>
      )}

      {/* Render Fallback Card if unconfigured or failed */}
      {isFallback && hasFallback && (
        <div className="w-full h-full flex items-center justify-center">
          {/* Top Leaderboard Fallback */}
          {slotId === 'slot_top_banner' && (
            <div
              onClick={handleAffiliateClick}
              className="w-full p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-[#0E101B] via-[#161A2B] to-[#0E101B] border border-cyan-500/30 hover:border-cyan-500/70 shadow-xl cursor-pointer group transition-all flex flex-col sm:flex-row items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
                  <i className="ri-shield-keyhole-line not-italic text-xl"></i>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-lg">
                      {campaign.badge || 'VERIFIED DEAL'}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">{campaign.network}</span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                    {campaign.title}
                  </h4>
                </div>
              </div>
              <button className="min-h-[44px] px-5 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs shadow-lg group-hover:scale-105 active:scale-95 transition-all shrink-0 flex items-center gap-1">
                <span>{campaign.cta}</span>
                <i className="ri-arrow-right-line text-sm"></i>
              </button>
            </div>
          )}

          {/* Native In-Feed Fallback (matches VideoCard) */}
          {slotId === 'slot_native_feed' && (
            <div
              onClick={handleAffiliateClick}
              className="group relative flex flex-col w-full rounded-xl overflow-hidden cursor-pointer bg-slate-100 dark:bg-black/20"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-black/80">
                <img
                  src={campaign.image}
                  alt={campaign.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30" />
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wider uppercase bg-rose-600 text-white shadow-md">
                    {campaign.badge || 'SPONSORED'}
                  </span>
                </div>
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-black/85 backdrop-blur-md border border-white/10 text-[10px] font-sans font-bold tabular-nums text-cyan-400">
                  Featured Offer
                </div>
              </div>

              <div className="p-4 flex flex-col justify-between flex-1 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-rose-400 transition-colors min-h-[2.5rem]">
                    {campaign.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                    {campaign.description}
                  </p>
                </div>
                <button className="min-h-[44px] w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white text-xs font-bold shadow-md hover:scale-[1.02] active:scale-95 transition-all">
                  <span>{campaign.cta}</span>
                  <i className="ri-arrow-right-line text-sm"></i>
                </button>
              </div>
            </div>
          )}

          {/* Below-Player Fallback */}
          {slotId === 'slot_below_player' && (
            <div
              onClick={handleAffiliateClick}
              className="w-full p-6 rounded-2xl bg-gradient-to-br from-[#0F111A] via-[#161A2A] to-[#0A0B12] border border-cyan-500/30 hover:border-cyan-500/60 shadow-2xl cursor-pointer group transition-all text-center max-w-2xl mx-auto flex flex-col items-center justify-center"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
                <i className="ri-shield-check-fill not-italic"></i> {campaign.badge || 'SPONSORED OFFER'}
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                {campaign.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-lg mb-4">
                {campaign.description}
              </p>
              <button className="min-h-[44px] px-8 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5">
                <span>{campaign.cta}</span>
                <i className="ri-arrow-right-line text-sm"></i>
              </button>
            </div>
          )}

          {/* Sticky Footer Fallback */}
          {slotId === 'slot_sticky_footer' && (
            <div
              onClick={handleAffiliateClick}
              className="w-full h-full flex items-center justify-between px-4 sm:px-6 cursor-pointer group bg-black/90 hover:bg-black transition-colors"
            >
              <div className="flex items-center gap-2 text-left">
                <i className="ri-shield-star-fill not-italic text-cyan-400 text-base"></i>
                <span className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                  {campaign.title}
                </span>
              </div>
              <button className="min-h-[36px] sm:min-h-[40px] px-4 py-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs shrink-0 shadow-md">
                {campaign.cta}
              </button>
            </div>
          )}
        </div>
      )}
      {/* Keep the injection node mounted so changed settings/device zones can recover after no-fill. */}
      <div
        ref={outerWrapperRef}
        className={`adcast-ad-frame w-full min-w-0 flex justify-center items-start ${isNative ? 'rounded-xl bg-slate-100 dark:bg-black/20' : ''}`}
        style={{
          display: isFallback ? 'none' : undefined,
          minHeight: !isLoaded ? (isNative ? 180 : frameHeight) : undefined,
        }}
      >
        <div
          ref={containerRef}
          className={`adcast-ad-content ${isNative ? 'adcast-ad-native' : 'adcast-ad-banner'}`}
          style={{ width: frameWidth || '100%', flexShrink: 0, transformOrigin: 'top center' }}
        />
      </div>
    </div>
  );
}

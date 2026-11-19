import React, { useEffect, useRef, useState } from 'react';
import { store, useAdSettings } from '../services/store';

export default function AdSlot({ slotId, className = '', devBadge = true }) {
  const containerRef = useRef(null);
  const outerWrapperRef = useRef(null);
  const [scaleRatio, setScaleRatio] = useState(1);
  const [isBlocked, setIsBlocked] = useState(false);
  const adSettings = useAdSettings();
  const slot = adSettings[slotId];
  const affiliateSettings = adSettings.affiliate_fallbacks || {};
  const isDevMode = store.isDevMode();

  // Dynamic scale measurement for fixed-dimension desktop banners (e.g. 728x90) on mobile
  useEffect(() => {
    if (slotId !== 'slot_top_banner') return;

    const handleResize = () => {
      if (outerWrapperRef.current) {
        const available = outerWrapperRef.current.offsetWidth || (typeof window !== 'undefined' ? window.innerWidth - 32 : 728);
        if (available > 0 && available < 728) {
          setScaleRatio(available / 728);
        } else {
          setScaleRatio(1);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [slotId]);

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

  useEffect(() => {
    let isMounted = true;
    let probeTimeout = null;
    let bait = null;

    if (!slot || !slot.isActive) return;

    // 1. Detect unconfigured placeholder codes
    const isPlaceholder =
      !slot.code ||
      slot.code.includes('Replace in Admin Panel') ||
      slot.code.includes('EXOCLICK BELOW-PLAYER BANNER') ||
      slot.code.includes('EXOCLICK TOP LEADERBOARD') ||
      slot.code.includes('EXOCLICK NATIVE RECOMMENDATIONS') ||
      slot.code.includes('EXOCLICK TABUNDER') ||
      slot.code.includes('JUICYADS') ||
      slot.code.includes('TrafficFactory') ||
      slot.code.includes('EXOCLICK STICKY BOTTOM BANNER') ||
      slot.code.includes('Adsterra Popunder Script Placeholder');

    if (isPlaceholder) {
      setIsBlocked(true);
      return;
    }

    // Reset blocked state for valid ad configurations
    setIsBlocked(false);

    // 2. Active Ad-Blocker Probe
    bait = document.createElement('div');
    bait.setAttribute(
      'class',
      'pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text-ads text-ad-links ad-text ad-placement banner-ad'
    );
    bait.setAttribute(
      'style',
      'width: 1px !important; height: 1px !important; position: absolute !important; left: -10000px !important; top: -1000px !important;'
    );
    document.body.appendChild(bait);

    probeTimeout = window.setTimeout(() => {
      if (!isMounted) return;
      if (
        !bait.offsetParent ||
        bait.offsetHeight === 0 ||
        bait.offsetWidth === 0 ||
        window.getComputedStyle(bait).getPropertyValue('display') === 'none' ||
        window.getComputedStyle(bait).getPropertyValue('visibility') === 'hidden'
      ) {
        setIsBlocked(true);
      }
      if (bait.parentNode) {
        bait.parentNode.removeChild(bait);
      }
    }, 150);

    return () => {
      isMounted = false;
      if (probeTimeout) clearTimeout(probeTimeout);
      if (bait && bait.parentNode) {
        bait.parentNode.removeChild(bait);
      }
    };
  }, [slot?.code, slot?.isActive, slotId]);

  // Effect 2: Inject ad tags once container is mounted and slot is not blocked
  useEffect(() => {
    if (!slot || !slot.isActive || isBlocked || !containerRef.current) return;

    const isPlaceholder =
      !slot.code ||
      slot.code.includes('Replace in Admin Panel') ||
      slot.code.includes('EXOCLICK BELOW-PLAYER BANNER') ||
      slot.code.includes('EXOCLICK TOP LEADERBOARD') ||
      slot.code.includes('EXOCLICK NATIVE RECOMMENDATIONS') ||
      slot.code.includes('EXOCLICK TABUNDER') ||
      slot.code.includes('JUICYADS') ||
      slot.code.includes('TrafficFactory') ||
      slot.code.includes('EXOCLICK STICKY BOTTOM BANNER') ||
      slot.code.includes('Adsterra Popunder Script Placeholder');

    if (isPlaceholder) return;

    let isMounted = true;
    const container = containerRef.current;
    container.innerHTML = '';

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = slot.code;

    const scripts = tempDiv.querySelectorAll('script');
    if (scripts.length > 0) {
      const nonScripts = slot.code.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      container.innerHTML = nonScripts;

      scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.textContent = oldScript.textContent;
        newScript.onerror = () => {
          if (isMounted) setIsBlocked(true);
        };
        container.appendChild(newScript);
      });
    } else {
      container.innerHTML = slot.code;
    }

    return () => {
      isMounted = false;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [slot?.code, slot?.isActive, isBlocked, slotId]);

  if (!slot || !slot.isActive) return null;

  const handleAffiliateClick = () => {
    if (campaign?.url) {
      window.open(campaign.url, '_blank', 'noopener,noreferrer,sponsored');
    }
  };

  // Pre-allocated dimension classes to prevent Cumulative Layout Shift (CLS)
  const getSlotContainerClasses = () => {
    switch (slotId) {
      case 'slot_top_banner':
        return 'min-h-[90px] w-full max-w-full sm:max-w-4xl mx-auto flex flex-col items-center justify-center overflow-hidden [&_iframe]:max-w-full [&_ins]:max-w-full';
      case 'slot_below_player':
        return 'min-h-[250px] w-full flex flex-col items-center justify-center';
      case 'slot_native_feed':
        return 'w-full flex flex-col items-center justify-center max-h-[360px] overflow-hidden';
      case 'slot_sticky_footer':
        return 'min-h-[50px] sm:min-h-[60px] w-full flex items-center justify-center';
      default:
        return 'min-h-[90px] w-full flex flex-col items-center justify-center';
    }
  };

  const showDisclosure = slotId !== 'slot_sticky_footer';

  return (
    <div className={`relative overflow-hidden transition-all duration-200 ${getSlotContainerClasses()} ${className}`}>
      {/* Dev Mode Badge */}
      {isDevMode && devBadge && (
        <div className="absolute top-1 right-1 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-sans font-bold tabular-nums bg-black/85 text-cyan-400 border border-cyan-500/40 shadow-md">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
          {isBlocked ? (
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
            {isBlocked ? 'Sponsored Recommendation' : 'Advertisement'}
          </span>
        </div>
      )}

      {/* Render Fallback Card if Ad-Blocked or unconfigured */}
      {isBlocked && affiliateSettings.isEnabled && campaign ? (
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
              className="group relative flex flex-col h-full w-full rounded-2xl glass-card overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl border border-rose-500/30"
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
      ) : (
        /* Regular Ad Injection Container with proportional scale-down for desktop banners on mobile */
        <div
          ref={outerWrapperRef}
          className="w-full flex items-center justify-center overflow-hidden"
          style={slotId === 'slot_top_banner' && scaleRatio < 1 ? { height: `${Math.round(90 * scaleRatio)}px` } : undefined}
        >
          <div
            style={
              slotId === 'slot_top_banner' && scaleRatio < 1
                ? {
                    width: '728px',
                    height: '90px',
                    transform: `scale(${scaleRatio})`,
                    transformOrigin: 'top center',
                    flexShrink: 0
                  }
                : undefined
            }
            className="w-full flex items-center justify-center"
          >
            <div
              ref={containerRef}
              className={`w-full flex items-center justify-center ${
                isDevMode ? 'ring-1 ring-cyan-500/30 ring-dashed rounded-xl p-1' : ''
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
}


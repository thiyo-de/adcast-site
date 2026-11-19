import React, { useEffect } from 'react';
import { useAdBlock } from '../services/adBlockContext';

export default function AdBlockNotice() {
  const { isNoticeOpen, isRechecking, recheck } = useAdBlock();

  // Lock background page scrolling while the lockout wall is active
  useEffect(() => {
    if (!isNoticeOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isNoticeOpen]);

  if (!isNoticeOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adblock-dialog-title"
    >
      <div
        className="relative w-full max-w-lg bg-[#0F111A] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-500 shrink-0 shadow-lg shadow-rose-500/10">
            <i className="ri-shield-cross-fill text-2xl"></i>
          </div>
          <div>
            <h2 id="adblock-dialog-title" className="text-lg sm:text-xl font-black text-white tracking-tight">
              AdBlocker Detected
            </h2>
            <p className="text-xs text-rose-400 font-bold flex items-center gap-1 mt-0.5">
              <i className="ri-lock-line not-italic"></i> Access Restricted — Disable to Continue
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
          Our video streams and high-speed servers are <strong>100% free</strong> and supported entirely by advertisements. To access this catalog and watch videos, you must turn off your ad blocker or protective shield.
        </p>

        {/* Step-by-Step Whitelist Instructions */}
        <div className="mb-5 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-3 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[11px]">
              <i className="ri-shield-star-line"></i>
            </div>
            <div>
              <strong className="text-slate-100 block font-bold">Brave Browser Users:</strong>
              <span className="text-slate-400 leading-relaxed">
                Click the <strong>orange lion icon</strong> in your address bar and toggle <strong>Shields to OFF</strong> for this website. If Brave continues blocking, please switch to <strong>Google Chrome, Edge, Safari, or Firefox</strong>.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-2 border-t border-white/[0.06]">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[11px]">
              <i className="ri-plug-line"></i>
            </div>
            <div>
              <strong className="text-slate-100 block font-bold">uBlock Origin, AdBlock, AdGuard, Opera:</strong>
              <span className="text-slate-400 leading-relaxed">
                Click your ad blocker extension icon in the toolbar and click <strong>Pause on this site</strong> or toggle protection <strong>OFF</strong>.
              </span>
            </div>
          </div>
        </div>

        {/* Primary Action Button (The ONLY way to unlock the site) */}
        <div>
          <button
            type="button"
            onClick={recheck}
            disabled={isRechecking}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 disabled:opacity-50 text-white rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-xl shadow-rose-600/30 transition-all active:scale-[0.98] cursor-pointer"
          >
            <i className={`ri-refresh-line text-base ${isRechecking ? 'animate-spin' : ''}`}></i>
            <span>{isRechecking ? 'Verifying Ad Connection...' : 'I Have Disabled AdBlock — Unlock Site'}</span>
          </button>
          <p className="text-[10px] text-center text-slate-500 font-semibold mt-2.5">
            Site unlocks automatically once ads are allowed to load
          </p>
        </div>
      </div>
    </div>
  );
}

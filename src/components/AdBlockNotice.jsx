import React, { useEffect, useRef } from 'react';
import { useAdBlock } from '../services/adBlockContext';

export default function AdBlockNotice() {
  const { isNoticeOpen, recheck, isRechecking } = useAdBlock();
  const dialogRef = useRef(null);
  const buttonRef = useRef(null);
  const prevActiveElementRef = useRef(null);

  // Manage body scroll, autofocus, keyboard focus-trap, and focus restoration
  useEffect(() => {
    if (!isNoticeOpen) return;

    // Record previous active element to restore focus when dismissed
    prevActiveElementRef.current = document.activeElement;

    // Lock page background scrolling on both html and body to stop mobile scroll chaining completely
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    // Autofocus the primary action button
    const focusTimer = setTimeout(() => {
      buttonRef.current?.focus();
    }, 50);

    // Trap focus inside the modal dialog
    const handleKeyDown = (e) => {
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.touchAction = prevTouchAction;

      // Restore focus to previous element if available
      if (prevActiveElementRef.current && typeof prevActiveElementRef.current.focus === 'function') {
        try {
          prevActiveElementRef.current.focus();
        } catch {}
      }
    };
  }, [isNoticeOpen]);

  if (!isNoticeOpen) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn overflow-y-auto overscroll-contain"
      onTouchMove={(e) => {
        // Prevent backdrop touch drags from reaching the page underneath
        if (e.target === dialogRef.current) {
          e.preventDefault();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="adblock-dialog-title"
      aria-describedby="adblock-dialog-desc"
    >
      <div
        className="relative w-full max-w-lg my-auto max-h-[92dvh] overflow-y-auto bg-[#0F111A] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-white overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-500 shrink-0 shadow-lg shadow-rose-500/10">
            <i className="ri-shield-cross-fill text-2xl"></i>
          </div>
          <div>
            <h2 id="adblock-dialog-title" className="text-lg sm:text-xl font-black text-white tracking-tight">
              Please allow ads on this site
            </h2>
            <p className="text-xs text-rose-400 font-bold flex items-center gap-1 mt-0.5">
              <i className="ri-lock-line not-italic"></i> Ads support free playback
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <p id="adblock-dialog-desc" className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
          Allow ads for this site in your browser or extension, then select Check again to continue here.
        </p>

        {/* Step-by-Step Whitelist Instructions */}
        <div className="mb-5 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-3 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[11px]">
              <i className="ri-shield-star-line"></i>
            </div>
            <div>
              <strong className="text-slate-100 block font-bold">Brave Browser:</strong>
              <span className="text-slate-400 leading-relaxed">
                Open the shield icon in the address bar and allow ads for this site.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-2 border-t border-white/[0.06]">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[11px]">
              <i className="ri-plug-line"></i>
            </div>
            <div>
              <strong className="text-slate-100 block font-bold">AdBlock, uBlock, AdGuard:</strong>
              <span className="text-slate-400 leading-relaxed">
                Click your extension icon and select <strong>Pause on this site</strong> or turn protection <strong>OFF</strong>.
              </span>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div>
          <button
            ref={buttonRef}
            type="button"
            onClick={recheck}
            aria-disabled={isRechecking}
            aria-busy={isRechecking}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-xl shadow-rose-600/30 transition-all active:scale-[0.98] cursor-pointer"
          >
            <i className="ri-refresh-line text-base"></i>
            <span aria-live="polite">{isRechecking ? 'Checking…' : 'Check again'}</span>
          </button>
          <button type="button" onClick={() => window.location.reload()}
            className="mt-2 w-full py-2 text-sm text-slate-300 underline">
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function AgeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const enterBtnRef = useRef(null);
  const exitBtnRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    try {
      const hasCookie = document.cookie.includes('age_verified=true');
      const verifiedTimestamp = localStorage.getItem('adcast_age_verified');

      if (hasCookie && verifiedTimestamp) {
        const elapsed = Date.now() - parseInt(verifiedTimestamp, 10);
        if (elapsed < THIRTY_DAYS_MS) {
          setIsOpen(false);
          return;
        }
      } else if (hasCookie || (verifiedTimestamp && verifiedTimestamp === 'true')) {
        setIsOpen(false);
        return;
      }
      setIsOpen(true);
    } catch (e) {
      setIsOpen(false);
    }
  }, []);

  // Trap focus and lock background scroll while age gate is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = setTimeout(() => {
      enterBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Tab') {
        const focusable = [enterBtnRef.current, exitBtnRef.current].filter(Boolean);
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleEnter = () => {
    try {
      localStorage.setItem('adcast_age_verified', Date.now().toString());
      // Set 30-day HTTP cookie (2,592,000 seconds)
      document.cookie = 'age_verified=true; max-age=2592000; path=/; SameSite=Lax';
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('adcast_age_verified'));
      }
    } catch (e) {}
    setIsOpen(false);
  };

  const handleExit = () => {
    window.location.replace('https://www.google.com');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 dark:bg-[#050608]/95 backdrop-blur-2xl animate-fade-in select-none">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-gate-title"
        aria-describedby="age-gate-desc"
        className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl glass-panel text-center shadow-2xl border border-slate-200/80 dark:border-white/10"
      >
        {/* Warning Icon Badge */}
        <div className="inline-flex items-center justify-center w-14 h-14 mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-500 shadow-inner">
          <i className="ri-error-warning-fill not-italic text-3xl"></i>
        </div>

        <h2 id="age-gate-title" className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
          Age Restricted Content (18+)
        </h2>

        <p id="age-gate-desc" className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
          This platform contains media intended strictly for consenting adults aged <strong className="text-slate-900 dark:text-white font-extrabold">18 years or older</strong>. By entering, you confirm you have reached the age of majority in your jurisdiction.
        </p>

        {/* 48px Full-Width Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            ref={enterBtnRef}
            onClick={handleEnter}
            className="w-full min-h-[48px] h-12 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs tracking-wider uppercase transition-all duration-200 shadow-lg shadow-rose-600/30 active:scale-95 flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-400"
          >
            <i className="ri-checkbox-circle-fill not-italic text-base"></i>
            <span>I Am 18 or Older — Enter</span>
          </button>

          <button
            ref={exitBtnRef}
            onClick={handleExit}
            className="w-full min-h-[44px] h-11 rounded-full glass-button font-semibold text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <i className="ri-external-link-line not-italic text-sm"></i>
            <span>Exit (Leave Site)</span>
          </button>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-white/[0.08] text-[11px] text-slate-400 leading-normal">
          Strictly compliant with international 18+ regulations, DMCA embed standards, and user privacy.
        </div>
      </div>
    </div>
  );
}

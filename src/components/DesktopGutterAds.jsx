import React, { useState } from 'react';
import { useAdSettings } from '../services/store';
import AdSlot from './AdSlot';

export default function DesktopGutterAds({ currentView }) {
  const adSettings = useAdSettings();
  const [leftDismissed, setLeftDismissed] = useState(false);
  const [rightDismissed, setRightDismissed] = useState(false);

  const leftSlot = adSettings['slot_desktop_skyscraper_left'];
  const rightSlot = adSettings['slot_desktop_skyscraper_right'];

  if (['admin', 'dmca', 'privacy', 'terms'].includes(currentView)) {
    return null;
  }

  const showLeft = leftSlot?.isActive && !leftDismissed;
  const showRight = rightSlot?.isActive && !rightDismissed;

  if (!showLeft && !showRight) return null;

  return (
    <>
      {/* Left Skyscraper (160x600) */}
      {showLeft && (
        <aside
          aria-label="Advertisement Sponsor Left"
          className="fixed left-2 2xl:left-4 top-28 z-20 hidden 2xl:flex flex-col items-center w-[160px] select-none"
        >
          <div className="w-full flex items-center justify-between pb-1 px-1 text-[9px] font-bold text-slate-400">
            <span>SPONSOR</span>
            <button
              onClick={() => setLeftDismissed(true)}
              className="hover:text-rose-500 flex items-center gap-0.5 cursor-pointer transition-colors"
              title="Hide this ad"
            >
              <i className="ri-close-line text-xs"></i> Hide
            </button>
          </div>
          <div className="w-[160px] min-h-[600px] rounded-xl overflow-hidden border border-slate-200/60 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-sm shadow-xl flex items-center justify-center">
            <AdSlot slotId="slot_desktop_skyscraper_left" devBadge={false} />
          </div>
        </aside>
      )}

      {/* Right Skyscraper (160x600) */}
      {showRight && (
        <aside
          aria-label="Advertisement Sponsor Right"
          className="fixed right-2 2xl:right-4 top-28 z-20 hidden 2xl:flex flex-col items-center w-[160px] select-none"
        >
          <div className="w-full flex items-center justify-between pb-1 px-1 text-[9px] font-bold text-slate-400">
            <span>SPONSOR</span>
            <button
              onClick={() => setRightDismissed(true)}
              className="hover:text-rose-500 flex items-center gap-0.5 cursor-pointer transition-colors"
              title="Hide this ad"
            >
              <i className="ri-close-line text-xs"></i> Hide
            </button>
          </div>
          <div className="w-[160px] min-h-[600px] rounded-xl overflow-hidden border border-slate-200/60 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-sm shadow-xl flex items-center justify-center">
            <AdSlot slotId="slot_desktop_skyscraper_right" devBadge={false} />
          </div>
        </aside>
      )}
    </>
  );
}

import React, { useState } from 'react';
import AdSlot from './AdSlot';
import { store } from '../services/store';

export default function StickyFooter() {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const adSettings = store.getAdSettings();
  const slot = adSettings['slot_sticky_footer'];

  if (isDismissed || !slot || !slot.isActive) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex flex-col items-center justify-center transition-all duration-300 pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Controls Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between px-4 py-1.5 bg-white/90 dark:bg-obsidian-surface/95 backdrop-blur-xl border-t border-x border-slate-200/80 dark:border-white/10 rounded-t-2xl text-[11px] text-slate-500 dark:text-slate-400 pointer-events-auto shadow-lg">
        <span className="font-semibold text-xs text-cyan-500 dark:text-cyan-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
          Sponsored
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
            title={isMinimized ? 'Expand ad' : 'Minimize ad'}
          >
            <i className={`ri-arrow-${isMinimized ? 'up' : 'down'}-s-line not-italic text-sm`}></i>
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
            title="Close ad"
          >
            <i className="ri-close-line not-italic text-sm"></i>
          </button>
        </div>
      </div>

      {/* Ad Content Container */}
      {!isMinimized && (
        <div className="w-full max-w-4xl bg-white/95 dark:bg-obsidian/95 backdrop-blur-2xl border-x border-b border-slate-200/80 dark:border-white/10 shadow-2xl p-2 flex items-center justify-center min-h-[50px] sm:min-h-[90px] pointer-events-auto">
          <AdSlot slotId="slot_sticky_footer" devBadge={false} />
        </div>
      )}
    </div>
  );
}

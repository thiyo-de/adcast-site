import React, { useState } from 'react';
import AdSlot from './AdSlot';
import { useAdSettings } from '../services/store';

export default function StickyFooter() {
  const [isDismissed, setIsDismissed] = useState(false);
  const adSettings = useAdSettings();
  const slot = adSettings['slot_sticky_footer'];

  if (!slot || !slot.isActive || isDismissed) return null;

  return (
    <aside
      aria-label="Sponsored"
      className="fixed bottom-0 left-0 right-0 z-40 flex flex-col items-center pointer-events-auto"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="relative">
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute -top-5 right-1 px-1.5 py-0.5 rounded-t-md bg-slate-900/90 hover:bg-black text-[10px] font-bold text-slate-300 hover:text-white border-t border-x border-white/20 flex items-center gap-1 shadow cursor-pointer transition-colors"
          title="Dismiss sticky ad"
          aria-label="Dismiss sticky ad"
        >
          <span>Ad</span>
          <i className="ri-close-line not-italic text-xs"></i>
        </button>
        <AdSlot slotId="slot_sticky_footer" devBadge={false} />
      </div>
    </aside>
  );
}

import React from 'react';
import AdSlot from './AdSlot';
import { useAdSettings } from '../services/store';

export default function StickyFooter() {
  const adSettings = useAdSettings();
  const slot = adSettings['slot_sticky_footer'];

  if (!slot || !slot.isActive) return null;

  return (
    <aside
      aria-label="Sponsored"
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-auto"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <AdSlot slotId="slot_sticky_footer" devBadge={false} />
    </aside>
  );
}

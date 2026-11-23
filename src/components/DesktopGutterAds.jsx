import React, { useLayoutEffect, useState } from 'react';
import { useAdSettings } from '../services/store';
import { useWideAdViewport } from '../services/adViewport';
import AdSlot from './AdSlot';

const towerWidth = 160;
const clearance = 16;

export default function DesktopGutterAds({ currentView, contentRef }) {
  const settings = useAdSettings();
  const wide = useWideAdViewport();
  const publicView = currentView === 'home' || currentView === 'watch';
  const [room, setRoom] = useState(null);

  useLayoutEffect(() => {
    const content = contentRef?.current;
    if (!wide || !publicView || !content) {
      setRoom(null);
      return;
    }
    function measure() {
      const bounds = content.getBoundingClientRect();
      const left = bounds.left;
      const right = document.documentElement.clientWidth - bounds.right;
      const fits = Math.min(left, right) >= towerWidth + 2 * clearance;
      setRoom(fits ? { left: (left - towerWidth) / 2, right: (right - towerWidth) / 2 } : null);
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    observer.observe(document.documentElement);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [contentRef, publicView, wide]);

  if (!wide || !publicView || !room) return null;
  return ['left', 'right'].map(side => {
    const slotId = 'slot_desktop_skyscraper_' + side;
    if (!settings[slotId]?.isActive) return null;
    return (
      <aside key={side} aria-label={side + ' sponsor'}
        className="adcast-gutter fixed top-28 z-20 pointer-events-none"
        style={{ [side]: room[side], width: towerWidth }}>
        <AdSlot slotId={slotId} devBadge={false} />
      </aside>
    );
  });
}

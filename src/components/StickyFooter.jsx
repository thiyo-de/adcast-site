import React, { useEffect, useRef } from 'react';
import { useAdSettings, isPlaceholderAdCode } from '../services/store';
import { useAdBlock } from '../services/adBlockContext';
import { useAgeConfirmed } from '../services/ageVerification';
import { mountAdTag } from '../services/adTag';
import { useMobileAdViewport } from '../services/adViewport';

export default function StickyFooter({ currentView, videoId }) {
  const host = useRef(null);
  const mobile = useMobileAdViewport();
  const slot = useAdSettings()[mobile ? 'slot_sticky_footer_mobile' : 'slot_sticky_footer'];
  const { isNoticeOpen } = useAdBlock();
  const ageConfirmed = useAgeConfirmed();
  const enabled = ageConfirmed && !isNoticeOpen && (currentView === 'home' || currentView === 'watch')
    && slot?.isActive && !isPlaceholderAdCode(slot.code);
  useEffect(() => {
    if (enabled && host.current) return mountAdTag(host.current, slot.code);
  }, [enabled, slot?.code, mobile, currentView, videoId]);
  // ExoClick owns the fixed banner, refresh and close control. This host has no overlay of its own.
  return enabled ? <aside id="adcast-sticky-footer" aria-label="Sponsored" ref={host} /> : null;
}

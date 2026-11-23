import React, { createContext, useContext } from 'react';
import { useAdBlock } from './adBlockContext';
import { useAgeConfirmed } from './ageVerification';
import { useMobileAdViewport } from './adViewport';
import { isPlaceholderAdCode, useAdSettings } from './store';

const ClickAd = createContext(null);
export const popunderLinkClass = 'adcast-catalog-pop-link';

export function ClickAdProvider({ currentView, children }) {
  const settings = useAdSettings();
  const mobile = useMobileAdViewport();
  const ageConfirmed = useAgeConfirmed();
  const { isNoticeOpen } = useAdBlock();
  const full = settings[mobile ? 'slot_mobile_interstitial' : 'slot_interstitial'];
  const pop = settings.slot_popunder;
  const hasPop = pop?.isActive && !isPlaceholderAdCode(pop.code);
  const hasFull = full?.isActive && !isPlaceholderAdCode(full.code);
  let format = null;
  if (ageConfirmed && !isNoticeOpen && (currentView === 'home' || currentView === 'watch')) {
    if (hasPop && (currentView === 'home' || !hasFull)) format = 'popunder';
    else if (hasFull) format = 'interstitial';
  }
  return <ClickAd.Provider value={format}>{children}</ClickAd.Provider>;
}

export function useClickAd() {
  return useContext(ClickAd);
}

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { detectAdBlock, AD_BLOCK_STATES } from './adBlockDetection';

const AdBlockContext = createContext({
  detectionState: AD_BLOCK_STATES.CHECKING,
  isNoticeOpen: false,
  isRechecking: false,
  dismissNotice: () => {},
  recheck: () => {}
});

const EXEMPT_VIEWS = ['admin', 'dmca', 'privacy', 'terms'];

export function AdBlockProvider({ children, currentView = 'home' }) {
  const [detectionState, setDetectionState] = useState(AD_BLOCK_STATES.CHECKING);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);
  const recheckCooldownRef = useRef(false);

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isExempt =
    EXEMPT_VIEWS.includes(currentView) ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dmca') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms');

  const runDetection = useCallback(async (isManual = false) => {
    if (isExempt) {
      setDetectionState(AD_BLOCK_STATES.NOT_APPLICABLE);
      setIsNoticeOpen(false);
      return;
    }

    if (isManual) {
      setIsRechecking(true);
    }

    try {
      const state = await detectAdBlock({ timeoutMs: 4000 });
      setDetectionState(state);

      if (state === AD_BLOCK_STATES.SUSPECTED_BLOCKING) {
        setIsNoticeOpen(true);
      } else {
        setIsNoticeOpen(false);
      }
    } catch (e) {
      setDetectionState(AD_BLOCK_STATES.INCONCLUSIVE);
      setIsNoticeOpen(false);
    } finally {
      if (isManual) {
        setIsRechecking(false);
      }
    }
  }, [isExempt]);

  // Initial detection run on mount after 1.5 seconds (allowing initial render and layout to settle)
  useEffect(() => {
    if (isExempt) {
      setDetectionState(AD_BLOCK_STATES.NOT_APPLICABLE);
      setIsNoticeOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      runDetection(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [currentView, isExempt, runDetection]);

  const dismissNotice = useCallback(() => {
    // Non-dismissible wall: no manual dismissal or session bypass
  }, []);

  const recheck = useCallback(() => {
    if (recheckCooldownRef.current || isRechecking) return;
    recheckCooldownRef.current = true;
    setTimeout(() => {
      recheckCooldownRef.current = false;
    }, 4000);

    runDetection(true);
  }, [runDetection, isRechecking]);

  return (
    <AdBlockContext.Provider
      value={{
        detectionState,
        isNoticeOpen,
        isRechecking,
        dismissNotice,
        recheck
      }}
    >
      {children}
    </AdBlockContext.Provider>
  );
}

export function useAdBlock() {
  return useContext(AdBlockContext);
}

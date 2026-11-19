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
  const activeCheckIdRef = useRef(0);

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isExempt =
    EXEMPT_VIEWS.includes(currentView) ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dmca') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms');

  const runDetection = useCallback(async (isManual = false) => {
    const checkId = ++activeCheckIdRef.current;

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
    const isCurrentlyExempt =
      EXEMPT_VIEWS.includes(currentView) ||
      currentPath.startsWith('/admin') ||
      currentPath.startsWith('/dmca') ||
      currentPath.startsWith('/privacy') ||
      currentPath.startsWith('/terms');

    if (isCurrentlyExempt) {
      setDetectionState(AD_BLOCK_STATES.NOT_APPLICABLE);
      setIsNoticeOpen(false);
      return;
    }

    if (isManual) {
      setIsRechecking(true);
    }

    try {
      const state = await detectAdBlock({ timeoutMs: 4000 });

      // If user navigated away or another check superseded this one, discard the result
      if (activeCheckIdRef.current !== checkId) {
        return;
      }

      // Re-verify route status immediately after the promise settles
      const latestPath = typeof window !== 'undefined' ? window.location.pathname : '/';
      const isStillExempt =
        EXEMPT_VIEWS.includes(currentView) ||
        latestPath.startsWith('/admin') ||
        latestPath.startsWith('/dmca') ||
        latestPath.startsWith('/privacy') ||
        latestPath.startsWith('/terms');

      if (isStillExempt) {
        setDetectionState(AD_BLOCK_STATES.NOT_APPLICABLE);
        setIsNoticeOpen(false);
        return;
      }

      setDetectionState(state);

      if (state === AD_BLOCK_STATES.SUSPECTED_BLOCKING) {
        setIsNoticeOpen(true);
      } else {
        setIsNoticeOpen(false);
      }
    } catch (e) {
      if (activeCheckIdRef.current === checkId) {
        setDetectionState(AD_BLOCK_STATES.INCONCLUSIVE);
        setIsNoticeOpen(false);
      }
    } finally {
      if (isManual && activeCheckIdRef.current === checkId) {
        setIsRechecking(false);
      }
    }
  }, [currentView]);

  // Initial detection run on mount after 1.5 seconds (allowing initial render and layout to settle)
  useEffect(() => {
    // Invalidate any check in-flight from a previous view
    activeCheckIdRef.current++;

    if (isExempt) {
      setDetectionState(AD_BLOCK_STATES.NOT_APPLICABLE);
      setIsNoticeOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      runDetection(false);
    }, 1500);

    return () => {
      clearTimeout(timer);
      activeCheckIdRef.current++; // Invalidate pending check on unmount or view change
    };
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

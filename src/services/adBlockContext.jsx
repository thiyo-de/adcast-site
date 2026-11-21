import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { detectAdBlock, AD_BLOCK_STATES } from './adBlockDetection';

const AdBlockContext = createContext({
  detectionState: AD_BLOCK_STATES.CHECKING,
  isNoticeOpen: false,
  isRechecking: false,
  dismissNotice: () => {},
  recheck: () => {},
  verifyBeforePlayback: async () => true
});

const EXEMPT_VIEWS = ['admin', 'dmca', 'privacy', 'terms'];

export function AdBlockProvider({ children, currentView = 'home', videoId = null }) {
  const [detectionState, setDetectionState] = useState(AD_BLOCK_STATES.CHECKING);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);
  const recheckCooldownRef = useRef(false);
  const activeCheckIdRef = useRef(0);
  const lastCheckTimestampRef = useRef(0);
  const isCheckingRef = useRef(false);

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isExempt =
    EXEMPT_VIEWS.includes(currentView) ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dmca') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms');

  const runDetection = useCallback(async (isManual = false) => {
    if (isCheckingRef.current && !isManual) {
      return;
    }

    const checkId = ++activeCheckIdRef.current;
    isCheckingRef.current = true;

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
    const isCurrentlyExempt =
      EXEMPT_VIEWS.includes(currentView) ||
      currentPath.startsWith('/admin') ||
      currentPath.startsWith('/dmca') ||
      currentPath.startsWith('/privacy') ||
      currentPath.startsWith('/terms');

    if (isCurrentlyExempt) {
      isCheckingRef.current = false;
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

      lastCheckTimestampRef.current = Date.now();
      setDetectionState(state);

      if (state === AD_BLOCK_STATES.SUSPECTED_BLOCKING) {
        setIsNoticeOpen(true);
      } else {
        setIsNoticeOpen(false);
      }
      return state;
    } catch (e) {
      if (activeCheckIdRef.current === checkId) {
        setDetectionState(AD_BLOCK_STATES.INCONCLUSIVE);
        setIsNoticeOpen(false);
      }
      return AD_BLOCK_STATES.INCONCLUSIVE;
    } finally {
      isCheckingRef.current = false;
      if (isManual) {
        setIsRechecking(false);
      }
    }
  }, [currentView]);

  // Pre-playback verification hook: if previous check is stale (> 45s), run a quick check
  const verifyBeforePlayback = useCallback(async () => {
    if (isExempt) return true;
    if (detectionState === AD_BLOCK_STATES.SUSPECTED_BLOCKING) {
      setIsNoticeOpen(true);
      return false;
    }

    const ageMs = Date.now() - lastCheckTimestampRef.current;
    if (ageMs < 45000 && lastCheckTimestampRef.current > 0) {
      // Recent fresh check confirmed no blocking
      return true;
    }

    // Previous check is older than 45s: verify ad status before starting media
    const result = await runDetection(false);
    return result !== AD_BLOCK_STATES.SUSPECTED_BLOCKING;
  }, [isExempt, detectionState, runDetection]);

  // Trigger check on view change OR video change
  useEffect(() => {
    activeCheckIdRef.current++;

    if (isExempt) {
      setDetectionState(AD_BLOCK_STATES.NOT_APPLICABLE);
      setIsNoticeOpen(false);
      return;
    }

    // On initial mount or route switch, wait 1.2s for layout/ads to settle
    const timer = setTimeout(() => {
      runDetection(false);
    }, 1200);

    return () => {
      clearTimeout(timer);
      activeCheckIdRef.current++;
    };
  }, [currentView, videoId, isExempt, runDetection]);

  // Tab Return Listener: Recheck when returning to the tab if last check was > 10s ago
  useEffect(() => {
    if (isExempt) return;

    const handleTabReturn = () => {
      if (document.visibilityState === 'visible') {
        const timeSinceLastCheck = Date.now() - lastCheckTimestampRef.current;
        if (timeSinceLastCheck >= 10000 && !isCheckingRef.current) {
          runDetection(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleTabReturn);
    window.addEventListener('focus', handleTabReturn);

    return () => {
      document.removeEventListener('visibilitychange', handleTabReturn);
      window.removeEventListener('focus', handleTabReturn);
    };
  }, [isExempt, runDetection]);

  // Periodic Heartbeat: Recheck every 60 seconds while the tab is active/visible
  useEffect(() => {
    if (isExempt) return;

    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible' && !isCheckingRef.current) {
        runDetection(false);
      }
    }, 60000);

    return () => clearInterval(heartbeat);
  }, [isExempt, runDetection]);

  const dismissNotice = useCallback(() => {}, []);

  const recheck = useCallback(() => {
    if (recheckCooldownRef.current || isRechecking) return;
    recheckCooldownRef.current = true;
    setTimeout(() => {
      recheckCooldownRef.current = false;
    }, 3000);

    runDetection(true);
  }, [runDetection, isRechecking]);

  return (
    <AdBlockContext.Provider
      value={{
        detectionState,
        isNoticeOpen,
        isRechecking,
        dismissNotice,
        recheck,
        verifyBeforePlayback
      }}
    >
      {children}
    </AdBlockContext.Provider>
  );
}

export function useAdBlock() {
  return useContext(AdBlockContext);
}

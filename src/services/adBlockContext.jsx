import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AD_BLOCK_STATES as S, detectAdBlock, exoProbeUrls } from './adBlockDetection';
import { useAgeConfirmed } from './ageVerification';
import { useMobileAdViewport, useWideAdViewport } from './adViewport';
import { useAdSettings } from './store';

const AdBlockContext = createContext({
  detectionState: S.NOT_APPLICABLE, isNoticeOpen: false, isRechecking: false,
  recheck: () => {}, verifyBeforePlayback: async () => true
});

export function AdBlockProvider({ children, currentView = 'home', videoId = null }) {
  const confirmed = useAgeConfirmed();
  const settings = useAdSettings();
  const mobile = useMobileAdViewport();
  const wide = useWideAdViewport();
  const endpoints = confirmed ? exoProbeUrls(settings, currentView, mobile, wide).join(' ') : '';
  const scope = JSON.stringify([currentView, videoId, endpoints]);
  const pending = useRef(null);
  const [last, setLast] = useState(null);
  const [retryScope, setRetryScope] = useState(null);

  const run = useCallback(() => {
    if (!endpoints) return Promise.resolve(S.NOT_APPLICABLE);
    if (pending.current?.scope === scope && !pending.current.controller.signal.aborted) return pending.current.promise;
    pending.current?.controller.abort();
    const controller = new AbortController();
    const job = { controller, scope };
    pending.current = job;
    job.promise = detectAdBlock({ urls: endpoints.split(' '), signal: controller.signal })
      .then(state => {
        if (!controller.signal.aborted) setLast({ scope, state, time: Date.now() });
        return state;
      }).finally(() => {
        if (pending.current === job) {
          pending.current = null;
          setRetryScope(null);
        }
      });
    return job.promise;
  }, [scope, endpoints]);

  useEffect(() => {
    if (!endpoints) return;
    const visibleCheck = () => {
      if (!document.hidden) run();
    };
    const timer = setTimeout(visibleCheck, 250);
    const heartbeat = setInterval(visibleCheck, 60000);
    window.addEventListener('focus', visibleCheck);
    document.addEventListener('visibilitychange', visibleCheck);
    return () => {
      clearTimeout(timer);
      clearInterval(heartbeat);
      window.removeEventListener('focus', visibleCheck);
      document.removeEventListener('visibilitychange', visibleCheck);
      if (pending.current?.scope === scope) pending.current.controller.abort();
    };
  }, [endpoints, run, scope]);

  const state = endpoints ? (last?.scope === scope ? last.state : S.CHECKING) : S.NOT_APPLICABLE;
  const verifyBeforePlayback = async () => {
    if (!endpoints) return true;
    if (pending.current?.scope === scope) return await run() !== S.SUSPECTED_BLOCKING;
    if (state === S.SUSPECTED_BLOCKING) return false;
    const maxCacheAge = currentView === 'watch' ? 10000 : 45000;
    if (state === S.NO_BLOCKING_DETECTED && Date.now() - (last?.time || 0) < maxCacheAge) return true;
    return await run() !== S.SUSPECTED_BLOCKING;
  };
  const recheck = () => {
    if (!endpoints) return;
    setRetryScope(scope);
    return run();
  };

  return <AdBlockContext.Provider value={{
    detectionState: state, isNoticeOpen: state === S.SUSPECTED_BLOCKING,
    isRechecking: retryScope === scope, recheck, verifyBeforePlayback
  }}>{children}</AdBlockContext.Provider>;
}

export function useAdBlock() {
  return useContext(AdBlockContext);
}

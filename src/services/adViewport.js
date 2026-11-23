import { useSyncExternalStore } from 'react';

function viewportHook(query) {
  const subscribe = callback => {
    const media = window.matchMedia(query);
    media.addEventListener('change', callback);
    return () => media.removeEventListener('change', callback);
  };
  return function useViewport() {
    return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
  };
}

export const useWideAdViewport = viewportHook('(min-width: 1536px)');
const useDesktopAdViewport = viewportHook('(min-width: 768px)');
export function useMobileAdViewport() {
  return !useDesktopAdViewport();
}

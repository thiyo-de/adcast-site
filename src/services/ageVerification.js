import { useEffect, useState } from 'react';

const key = 'adcast_age_verified';
const validity = 30 * 24 * 60 * 60 * 1000;
let sessionExpiry = 0;

function readExpiry() {
  let stamp;
  let cookie;
  try { stamp = localStorage.getItem(key); } catch {}
  try { cookie = document.cookie.split(';').some(value => value.trim() === 'age_verified=true'); } catch {}
  if (stamp && stamp !== 'true') {
    const time = Number(stamp);
    const expiry = Number.isFinite(time) && time > 0 && time <= Date.now() ? time + validity : 0;
    return Math.max(expiry, sessionExpiry);
  }
  // The lifetime of a legacy cookie is managed by the browser. Recheck it
  // without issuing a new 30-day confirmation on the visitor's behalf.
  if (cookie) return Date.now() + 60000;
  return sessionExpiry;
}

export function confirmAge() {
  const now = Date.now();
  try {
    localStorage.setItem(key, String(now));
    sessionExpiry = 0;
  } catch {
    sessionExpiry = now + validity;
  }
  try { document.cookie = 'age_verified=true; max-age=2592000; path=/; SameSite=Lax'; } catch {}
  window.dispatchEvent(new Event(key));
}

export function useAgeConfirmed() {
  const [confirmed, setConfirmed] = useState(() => readExpiry() > Date.now());
  useEffect(() => {
    let timer;
    function refresh() {
      clearTimeout(timer);
      const remaining = readExpiry() - Date.now();
      setConfirmed(remaining > 0);
      if (remaining > 0) timer = setTimeout(refresh, Math.min(remaining, 2147483647));
    }
    // Finish dispatching the confirmation click before any page-click ad can arm.
    function afterConfirmation() {
      clearTimeout(timer);
      timer = setTimeout(refresh, 0);
    }
    refresh();
    window.addEventListener(key, afterConfirmation);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(key, afterConfirmation);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return confirmed;
}

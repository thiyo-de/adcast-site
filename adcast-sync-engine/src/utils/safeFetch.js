import dns from 'node:dns/promises';
import axios from 'axios';
import { getStealthHeaders } from './userAgents.js';

const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5 MB maximum payload
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Validates whether an IPv4 address is in a private, loopback, or cloud metadata range.
 */
function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(n => parseInt(n, 10));
  if (parts.length !== 4 || parts.some(isNaN)) return true;

  // 127.0.0.0/8 (Loopback)
  if (parts[0] === 127) return true;
  // 10.0.0.0/8 (Private)
  if (parts[0] === 10) return true;
  // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 169.254.0.0/16 (Link-local / AWS & Cloud Metadata)
  if (parts[0] === 169 && parts[1] === 254) return true;
  // 0.0.0.0/8 (Current network)
  if (parts[0] === 0) return true;
  // 100.64.0.0/10 (Shared address / CGNAT)
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  // 224.0.0.0/4 (Multicast) or 240.0.0.0/4 (Reserved)
  if (parts[0] >= 224) return true;

  return false;
}

/**
 * Validates whether an IPv6 address is in a private or loopback range.
 */
function isPrivateIPv6(ip) {
  const clean = ip.toLowerCase().trim();
  if (clean === '::1' || clean === '::') return true;
  // Unique local addresses (fc00::/7)
  if (clean.startsWith('fc') || clean.startsWith('fd')) return true;
  // Link-local addresses (fe80::/10)
  if (clean.startsWith('fe8') || clean.startsWith('fe9') || clean.startsWith('fea') || clean.startsWith('feb')) return true;
  // IPv4-mapped IPv6
  if (clean.includes(':ffff:')) {
    const v4 = clean.split(':ffff:')[1];
    if (v4 && isPrivateIPv4(v4)) return true;
  }
  return false;
}

/**
 * Validates host destination against SSRF attacks before opening network connections.
 */
export async function assertSafeDestination(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    throw new Error(`Invalid URL provided: ${rawUrl}`);
  }

  // Only permit HTTP and HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Blocked scheme: ${parsed.protocol} is not allowed. Only HTTP and HTTPS are permitted.`);
  }

  const hostname = parsed.hostname;

  // Direct IP checks
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    if (isPrivateIPv4(hostname)) {
      throw new Error(`Blocked destination: ${hostname} is a private or internal IP address (SSRF Protection).`);
    }
    return true;
  }

  // Pre-resolve hostname via DNS
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new Error(`DNS resolution failed for host: ${hostname}`);
    }

    for (const record of addresses) {
      if (record.family === 4 && isPrivateIPv4(record.address)) {
        throw new Error(`Blocked destination: ${hostname} resolved to internal/private IP ${record.address} (SSRF Protection).`);
      }
      if (record.family === 6 && isPrivateIPv6(record.address)) {
        throw new Error(`Blocked destination: ${hostname} resolved to internal/private IPv6 ${record.address} (SSRF Protection).`);
      }
    }
  } catch (dnsErr) {
    if (dnsErr.message.includes('Blocked destination')) throw dnsErr;
    throw new Error(`DNS lookup error for ${hostname}: ${dnsErr.message}`);
  }

  return true;
}

/**
 * Checks response headers and HTML body for Cloudflare Turnstile, CAPTCHA, or challenge signals.
 */
export function detectChallenge(headers = {}, body = '') {
  // 1. Explicit Cloudflare Challenge Header
  if (headers['cf-mitigated'] === 'challenge') {
    return {
      isChallenge: true,
      provider: 'cloudflare_turnstile',
      reason: 'Cloudflare Challenge Header (cf-mitigated: challenge)'
    };
  }

  // 2. Body signature detection
  if (typeof body === 'string' && body.length > 0) {
    const lower = body.slice(0, 8000).toLowerCase();
    if (
      lower.includes('cf-browser-verification') ||
      lower.includes('challenge-platform') ||
      lower.includes('cf-turnstile') ||
      lower.includes('<title>just a moment...</title>') ||
      lower.includes('attention required! | cloudflare')
    ) {
      return {
        isChallenge: true,
        provider: 'cloudflare_challenge',
        reason: 'Cloudflare Challenge HTML Signature'
      };
    }
  }

  return { isChallenge: false };
}

/**
 * SSRF-Safe Fetch Wrapper with Bounded Payload, Timeouts, and Anti-Bot Detection.
 */
export async function safeFetch(targetUrl, options = {}) {
  // 1. SSRF Defense Check
  await assertSafeDestination(targetUrl);

  const timeout = options.timeout || DEFAULT_TIMEOUT_MS;
  const headers = {
    ...getStealthHeaders(targetUrl),
    ...(options.headers || {})
  };

  try {
    const response = await axios({
      url: targetUrl,
      method: options.method || 'GET',
      headers,
      timeout,
      maxContentLength: MAX_PAYLOAD_BYTES,
      maxBodyLength: MAX_PAYLOAD_BYTES,
      maxRedirects: 4,
      validateStatus: () => true, // Manually handle status codes
      beforeRedirect: async (options, { headers }) => {
        if (options.href) {
          await assertSafeDestination(options.href);
        }
      }
    });

    // 2. Cloudflare & Bot Challenge Detection
    const challenge = detectChallenge(response.headers, response.data);
    if (challenge.isChallenge) {
      return {
        ok: false,
        status: response.status,
        isChallenge: true,
        challengeReason: challenge.reason,
        headers: response.headers,
        data: null
      };
    }

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      isChallenge: false,
      headers: response.headers,
      data: response.data
    };
  } catch (err) {
    if (err.message.includes('Blocked destination')) {
      throw err;
    }
    if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
      return { ok: false, status: 408, isTimeout: true, error: 'Connection or read timeout' };
    }
    return { ok: false, status: 0, error: err.message };
  }
}

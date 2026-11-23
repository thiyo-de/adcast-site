// Validate the configured entry tag. Creatives and VAST wrappers subsequently
// supplied by ExoClick may legitimately be hosted on an advertiser's CDN.
export function isExoEntryUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      /(^|\.)(magsrv\.com|pemsrv\.com|exoclick\.com|exdynsrv\.com|exosrv\.com)$/i.test(url.hostname);
  } catch {
    return false;
  }
}

// Install the placeholder before executing the provider's registration scripts.
export function mountAdTag(host, code) {
  const template = document.createElement('template');
  template.innerHTML = code;
  const scripts = Array.from(template.content.querySelectorAll('script'));
  const loaders = scripts.filter(script => script.hasAttribute('src'));
  if (!loaders.length || !loaders.every(script => isExoEntryUrl(script.getAttribute('src')))) {
    host.replaceChildren();
    return () => {};
  }
  for (const script of scripts) script.remove();
  host.replaceChildren(template.content);
  for (const source of scripts) {
    const script = document.createElement('script');
    for (const attr of source.attributes) script.setAttribute(attr.name, attr.value);
    script.textContent = source.textContent;
    host.appendChild(script);
  }
  return () => {
    for (const slot of host.querySelectorAll('ins[data-uid]')) {
      window.AdProvider?.stopZoneAdRefresh?.(slot.dataset.uid);
    }
    host.replaceChildren();
  };
}

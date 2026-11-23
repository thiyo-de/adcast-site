import { useEffect } from 'react';
import { useAdSettings } from '../services/store';
import { popunderLinkClass, useClickAd } from '../services/clickAdContext';

// ExoClick binds document listeners. Keep a single installation for this document.
// Only eligible catalog links carry its trigger class while this format is selected.
let installedCode;
export default function PopunderTrigger() {
  const code = useAdSettings().slot_popunder?.code;
  const format = useClickAd();
  useEffect(() => {
    if (format !== 'popunder' || !code || installedCode === code) return;
    const template = document.createElement('template');
    template.innerHTML = code;
    const loader = template.content.querySelector('script[src]');
    if (!loader) return;
    const url = new URL(loader.src, location.href);
    if (url.protocol !== 'https:' || !['a.pemsrv.com', 'a.magsrv.com'].includes(url.hostname)
        || url.pathname !== '/popunder1000.js') return;

    const oldLoader = document.querySelector('script[data-adcast-popunder]');
    oldLoader?.remove();
    installedCode = code;
    // Apply the zone's generated settings first, then enforce class-only triggers.
    for (const source of template.content.querySelectorAll('script:not([src])')) {
      const config = document.createElement('script');
      config.textContent = source.textContent;
      document.body.appendChild(config).remove();
    }
    window.ad_trigger_method = 2;
    window.ad_trigger_class = popunderLinkClass;
    const script = document.createElement('script');
    for (const attr of loader.attributes) script.setAttribute(attr.name, attr.value);
    script.id = 'popmagicldr';
    script.dataset.adcastPopunder = 'true';
    for (const prefix of ['data-ad_', 'data-exo-','data-msg-']) {
      script.setAttribute(prefix + 'trigger_method', '2');
      script.setAttribute(prefix + 'trigger_class', popunderLinkClass);
    }
    script.onerror = () => {
      if (installedCode === code) installedCode = undefined;
      script.remove();
    };
    document.body.appendChild(script);
  }, [format, code]);
  return null;
}

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';

let browser, server, origin;
before(async () => {
  server = await createServer({ configFile: false, appType: 'spa', logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, open: false } });
  await server.listen();
  origin = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); await server?.close(); });

async function fixture(t, size = {width: 390, height: 844}) {
  const page = await browser.newPage({viewport: size, hasTouch:true});
  t.after(() => page.close());
  // All third-party traffic is intercepted before a page can install a paid tag.
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    if (route.request().url().includes('/popunder1000.js')) {
      return route.fulfill({contentType:'text/javascript', body:
        "window.installs=(window.installs||0)+1; const trigger=document.currentScript.getAttribute('data-msg-trigger_class'); document.addEventListener('click', e=>{if(e.target.closest('.'+trigger)) window.popCount=(window.popCount||0)+1},true)"});
    }
    return route.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:'/* test provider */'});
  });
  await page.goto(origin + '/tests/browser/placements.html');
  await page.waitForFunction(() => typeof window.setup === 'function');
  return page;
}
const setup = (page, kind, confirmed = true) => page.evaluate(([k,c]) => window.setup(k,c), [kind,confirmed]);
const result = (page, state) => page.waitForFunction(s => document.querySelector('#result')?.textContent === s, state);

test('detects script-only ExoClick filtering even when an ordinary fetch succeeds', async t => {
  const page = await fixture(t);
  await page.route('**/ad-provider.js', route => route.request().resourceType() === 'script'
    ? route.abort('blockedbyclient')
    : route.fulfill({contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:'/* provider */'}));
  await setup(page,'detector');
  await result(page,'suspected_blocking');
});

test('provider outage, neutral 404 and timeouts keep the site usable', async t => {
  const page = await fixture(t);
  await page.route('**/ad-provider.js', r => r.abort('failed'));
  await setup(page,'detector');
  await result(page,'inconclusive');
  assert.equal(await page.locator('#adblock-dialog-title').count(), 0);
  await page.route('**/ads/banner-ad.js', r => r.abort('blockedbyclient'));
  await page.route('**/icon.png', r => r.fulfill({status:404,body:''}));
  await page.evaluate(() => window.retry());
  await result(page,'inconclusive');
  await page.unroute('**/icon.png');
  await page.evaluate(() => window.retry());
  await result(page,'suspected_blocking');
  await page.unroute('**/ads/banner-ad.js');
  await page.unroute('**/ad-provider.js');
  await page.route('**/ad-provider.js', () => {});
  await page.evaluate(() => window.retry());
  await result(page,'inconclusive');
});

test('age, shared Play check, in-place retry, focus recheck and legal pages', async t => {
  const page = await fixture(t);
  const requests = [];
  page.on('request', r => { if(r.url().endsWith('/ad-provider.js')) requests.push(r.url()); });
  await page.addStyleTag({content:'.adsbox { display:none !important }',});
  await setup(page, 'detector', false);
  await result(page, 'not_applicable');
  assert.equal(requests.length, 0);
  await page.getByRole('button',{name:/18 or Older/}).click();
  await result(page, 'suspected_blocking');
  const before = requests.length;
  const values = await page.evaluate(() => { window.retry(); return Promise.all([window.verify(), window.verify()]); });
  assert.deepEqual(values,[false,false]);
  assert.equal(requests.length - before, 2);
  await page.evaluate(() => {
    window.preserved = 42;
    document.querySelectorAll('style').forEach(s => { if(s.textContent.includes('.adsbox { display:none')) s.remove(); });
  });
  await page.getByRole('button',{name:'Check again'}).click();
  await result(page,'no_blocking_detected');
  assert.equal(await page.evaluate(() => window.preserved),42);
  await page.addStyleTag({content:'.adsbox { display:none !important }'});
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await result(page,'suspected_blocking');
  await page.evaluate(() => window.show('privacy'));
  await result(page,'not_applicable');
  assert.equal(await page.locator('#adblock-dialog-title').count(),0);
});

test('only catalog links can trigger the popunder and each route owns one click format', async t => {
  const page = await fixture(t);
  await setup(page,'gates');
  await page.waitForFunction(() => window.installs === 1);
  const link = page.getByRole('link',{name:'Sample'});
  await page.locator('#under').click();
  assert.equal(await page.evaluate(() => window.popCount || 0),0);
  await link.dispatchEvent('click');
  assert.equal(await page.evaluate(() => window.popCount),1);
  assert.equal(await page.locator('[data-adcast-interstitial]').count(),0);
  await page.evaluate(() => window.show('watch','new'));
  await page.waitForSelector('[data-adcast-interstitial="6100242"]',{state:'attached'});
  await link.dispatchEvent('click');
  await page.evaluate(() => window.show('terms'));
  await page.waitForSelector('[data-adcast-interstitial]',{state:'detached'});
  await link.dispatchEvent('click');
  assert.equal(await page.evaluate(() => window.popCount),1);
  await page.evaluate(() => window.show());
  await page.waitForSelector('.adcast-catalog-pop-link');
  assert.equal(await page.evaluate(() => window.installs),1);
});

test('device switch, independent zones and sticky dismissal leave the page clickable', async t => {
  const page = await fixture(t);
  await setup(page,'device');
  const sticky = page.locator('#adcast-sticky-footer');
  await sticky.locator('[data-zoneid="6096158"]').waitFor({state:'attached'});
  await page.locator('[data-ad-slot="slot_top_banner_mobile"]').waitFor({state:'attached'});
  await page.evaluate(() => window.toggle('slot_top_banner_mobile',false));
  await page.waitForSelector('[data-ad-slot="slot_top_banner_mobile"]',{state:'detached'});
  for (const width of [390,1024]) {
    await page.setViewportSize({width,height:700});
    await sticky.locator('[data-zoneid="'+(width < 768 ? '6096158':'6093426')+'"]').waitFor({state:'attached'});
    await sticky.evaluate(host => {
      const button=document.createElement('button');
      button.textContent='Close sponsor';
      button.style.cssText='position:fixed;bottom:0;left:0;z-index:9999';
      button.onclick=()=>button.remove();
      host.append(button);
    });
    const close = page.getByRole('button',{name:'Close sponsor'});
    if (width < 768) await close.tap();
    else await close.click();
    await page.locator('#under').click();
  }
  assert.equal(await page.evaluate(()=>window.clicks),2);
  await page.locator('[data-ad-slot="slot_top_banner"]').waitFor({state:'attached'});
});

test('native no-fill leaves no grid hole and portrait and landscape images preserve their ratio', async t => {
  const page=await fixture(t);
  await setup(page,'native');
  const ad=page.locator('[data-ad-slot="slot_native_feed"]');
  await ad.waitFor({state:'attached'});
  const y=id=>page.locator(id).evaluate(el=>el.getBoundingClientRect().y);
  assert.equal(await y('#one'),await y('#two'));
  for (const [width,height] of [[100,150],[160,90]]) {
    await ad.locator('ins').evaluate((ins,[w,h])=>{
      const img=new Image();
      img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'"></svg>');
      ins.replaceChildren(img);
    },[width,height]);
    await ad.getByText('Sponsored',{exact:true}).waitFor();
    await page.waitForFunction(([w,h])=>{
      const img=document.querySelector('[data-ad-slot] img');
      if (!img?.naturalWidth) return false;
      const box=img.getBoundingClientRect();
      return box.height>0 && Math.abs(box.width/box.height-w/h)<0.02;
    },[width,height]);
  }
  await ad.locator('ins').evaluate(el=>el.replaceChildren());
  await ad.getByText('Sponsored',{exact:true}).waitFor({state:'detached'});
  assert.equal(await y('#one'),await y('#two'));
});

test('both side banners require space outside the actual catalog', async t => {
  const page = await fixture(t, { width: 1536, height: 900 });
  await setup(page, 'towers');
  await page.getByText('Catalog').waitFor();
  const towers = page.locator('.adcast-gutter');
  assert.equal(await towers.count(), 0);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await towers.last().waitFor({ state: 'attached' });
  const catalog = await page.locator('main').boundingBox();
  for (const [side, zone] of [['left','6100280'], ['right','6100290']]) {
    const rail = page.getByLabel(side + ' sponsor');
    await rail.locator('ins[data-zoneid="' + zone + '"]').waitFor({ state: 'attached' });
    assert.equal(await rail.getByText('Advertisement', {exact:true}).count(), 0);
    await rail.locator('ins').evaluate(ins => {
      const image = document.createElement('div');
      image.className = 'msg-native-widget-item-image';
      image.style.cssText = 'width:160px;height:600px;background-image:url(/icon.png)';
      ins.before(image);
    });
    await rail.getByText('Advertisement', {exact:true}).waitFor();
    const box = await rail.boundingBox();
    assert.ok(side === 'left' ? box.x + box.width + 16 <= catalog.x : box.x >= catalog.x + catalog.width + 16);
  }
  await page.locator('main').evaluate(el => { el.style.maxWidth = '1800px'; });
  await towers.first().waitFor({ state:'detached' });
  await page.setViewportSize({ width:390, height:844 });
  assert.equal(await towers.count(), 0);
});

test('a delivered cross-origin banner nested in srcdoc opens the top placement', async t => {
  const page = await fixture(t, {width:1920,height:940});
  await page.route('https://creative.example/banner', route => route.fulfill({
    contentType:'text/html', body:'<body style="background:blue">Banner</body>'
  }));
  await setup(page,'device');
  const slot = page.locator('[data-ad-slot="slot_top_banner"]');
  await slot.locator('ins').evaluate(ins => {
    const frame = document.createElement('iframe');
    frame.width = 728;
    frame.height = 90;
    frame.srcdoc = '<body style="margin:0"><iframe width="728" height="90" src="https://creative.example/banner"></iframe>';
    ins.before(frame);
  });
  await slot.getByText('Advertisement', {exact:true}).waitFor();
  assert.ok((await slot.boundingBox()).height >= 90);
  await slot.locator('iframe').first().evaluate(frame => { frame.srcdoc = '<body></body>'; });
  await slot.getByText('Advertisement', {exact:true}).waitFor({state:'detached'});
});

test('native widget fills the thumbnail and the disclosure follows its content', async t => {
  const page = await fixture(t);
  await setup(page,'native');
  const slot = page.locator('[data-ad-slot="slot_native_feed"]');
  await slot.locator('ins').evaluate(ins => {
    ins.insertAdjacentHTML('beforebegin', '<a class="msg-native-widget-item" style="display:block;height:300px"><div class="msg-native-widget-item-image-wrapper" style="position:relative"><div class="msg-native-widget-item-image" style="position:absolute;inset:0;background:url(/icon.png) 100% 0%"></div></div><div class="msg-native-widget-item-content" style="height:90px">Advertiser</div></a>');
  });
  await slot.getByText('Sponsored', {exact:true}).waitFor();
  const media = slot.locator('.msg-native-widget-item-image');
  const box = await media.boundingBox();
  assert.ok(Math.abs(box.width / box.height - 16 / 9) < .02);
  assert.equal(await media.evaluate(el => getComputedStyle(el).backgroundPosition), '50% 50%');
  assert.equal(await media.evaluate(el => getComputedStyle(el).backgroundSize), 'cover');
  assert.ok((await slot.locator('.msg-native-widget-item-content').boundingBox()).height < 40);
});

test('fullscreen closes with the provider control and releases the page on desktop and mobile', async t => {
  const page = await fixture(t);
  await setup(page, 'device');
  await page.evaluate(() => window.show('watch','first'));
  for (const [width, zone] of [[390,'6100242'],[1280,'6093518']]) {
    await page.setViewportSize({width,height:800});
    const host = page.locator('[data-adcast-interstitial="' + zone + '"]');
    await host.waitFor({state:'attached'});
    await page.locator('#under').click();
    await host.evaluate((host, zone) => {
      const overlay = document.createElement('div');
      overlay.id = 'ad_' + zone;
      overlay.className = 'ex-over-top';
      overlay.style.cssText = 'position:fixed;inset:0;background:white;z-index:100';
      const close = document.createElement('button');
      close.className = 'ex-over-btn';
      close.textContent = 'Close advertisement';
      close.onclick = () => { overlay.remove(); };
      overlay.append(close);
      host.querySelector('ins').append(overlay);
      document.body.style.overflow = 'hidden';
    }, zone);
    assert.equal(await page.getByRole('button',{name:'Close advertisement'}).count(),1);
    const close = page.getByRole('button',{name:'Close advertisement'});
    if (width < 768) await close.tap();
    else await close.click();
    await host.waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
    await page.locator('#under').click();
  }
  assert.equal(await page.evaluate(()=>window.clicks),4);
});

test('shared pre-roll follows VAST skip timing and the below-player zone stays centered', async t => {
  const page = await fixture(t);
  for (const [width, offset] of [[390,'25%'],[1280,'00:00:07']]) {
    await page.setViewportSize({width,height:800});
    await page.goto(origin + '/tests/browser/placements.html');
    await page.route('**/vast.php?*', r => r.fulfill({
      contentType:'application/xml',headers:{'Access-Control-Allow-Origin':'*'},
      body:'<VAST><Ad><InLine><Creatives><Creative><Linear skipoffset="'+offset+'"><MediaFiles><MediaFile type="video/mp4">https://example.org/test-ad.mp4</MediaFile></MediaFiles></Linear></Creative></Creatives></InLine></Ad></VAST>'
    }));
    await page.route('**/test-ad.mp4', () => {});
    await setup(page,'player');
    const below = page.locator('[data-ad-slot="slot_below_player"]');
    await below.locator('ins[data-zoneid="6093362"]').waitFor({state:'attached'});
    const box = await below.boundingBox();
    assert.ok(Math.abs(box.x + box.width / 2 - width / 2) < 1);
    await page.getByRole('button',{name:'Play video',exact:true}).click();
    const ad = page.locator('video').first();
    await ad.evaluate(el => {
      Object.defineProperty(el, 'duration', {value:20});
      Object.defineProperty(el, 'currentTime', {value:4, configurable:true});
      el.dispatchEvent(new Event('timeupdate',{bubbles:true}));
    });
    const remaining = width === 390 ? 1 : 3;
    assert.equal(await page.getByRole('button',{name:'Skip ad in '+remaining+' seconds'}).isDisabled(),true);
    await ad.evaluate(el => {
      Object.defineProperty(el,'currentTime',{value:7});
      el.dispatchEvent(new Event('timeupdate',{bubbles:true}));
    });
    await page.getByRole('button',{name:'Skip ad now'}).click();
    await ad.waitFor({state:'detached'});
    await page.unroute('**/vast.php?*');
    await page.unroute('**/test-ad.mp4');
  }
});

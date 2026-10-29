'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const { webContents } = require('electron');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function pageProbe(frameUrl) {
  const hash = async (bytes) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (v) => v.toString(16).padStart(2, '0')).join('');
  const identity = () => ({ ua: navigator.userAgent, platform: navigator.platform, language: navigator.language, cores: navigator.hardwareConcurrency, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  const workerResult = await new Promise((resolve) => {
    const worker = new Worker('/worker.js');
    const timer = setTimeout(() => { worker.terminate(); resolve({ error: 'worker timeout' }); }, 4000);
    worker.onmessage = (event) => { clearTimeout(timer); worker.terminate(); resolve(event.data); };
    worker.onerror = () => { clearTimeout(timer); worker.terminate(); resolve({ error: 'worker error' }); };
  });
  const frameResult = await new Promise((resolve) => {
    const frame = document.createElement('iframe');
    const timer = setTimeout(() => { frame.remove(); resolve({ error: 'frame timeout' }); }, 4000);
    const handler = (event) => {
      if (event.source !== frame.contentWindow || event.data?.type !== 'identity-probe') return;
      clearTimeout(timer); window.removeEventListener('message', handler); frame.remove(); resolve(event.data.identity);
    };
    window.addEventListener('message', handler); frame.src = frameUrl; document.body.appendChild(frame);
  });
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const context = c.getContext('2d'); context.fillStyle = '#777'; context.fillRect(0, 0, c.width, c.height);
  const dataUrl = c.toDataURL();
  const pixels = await hash(context.getImageData(0, 0, c.width, c.height).data);
  const audio = new OfflineAudioContext(1, 4096, 44100);
  const oscillator = audio.createOscillator(); oscillator.type = 'triangle'; oscillator.frequency.value = 1000; oscillator.connect(audio.destination); oscillator.start();
  const rendered = await audio.startRendering();
  const first = new Float32Array(rendered.getChannelData(0));
  const second = new Float32Array(rendered.getChannelData(0));
  const copied = new Float32Array(first.length); rendered.copyFromChannel(copied, 0);
  const audioHash = await hash(first);
  return { early: window.__earlyIdentity, main: identity(), worker: workerResult, frame: frameResult,
    headers: await (await fetch('/echo')).json(),
    canvas: await hash(new TextEncoder().encode(dataUrl)), canvasStable: dataUrl === c.toDataURL(), dataUrl, pixels,
    audio: audioHash, audioStable: audioHash === await hash(second) && audioHash === await hash(copied),
    offsetWinter: new Date('2026-01-15T12:00:00Z').getTimezoneOffset(), explicitUTC: Intl.DateTimeFormat('en-US', { timeZone: 'UTC' }).resolvedOptions().timeZone };
}
const worker = `(async () => {
  const canvas = new OffscreenCanvas(128, 64); const context = canvas.getContext('2d'); context.fillStyle = '#777'; context.fillRect(0, 0, 128, 64);
  const digest = await crypto.subtle.digest('SHA-256', context.getImageData(0, 0, 128, 64).data);
  const pixels = Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join('');
  const png = Array.from(new Uint8Array(await (await canvas.convertToBlob()).arrayBuffer()));
  postMessage({ ua: navigator.userAgent, platform: navigator.platform, language: navigator.language, cores: navigator.hardwareConcurrency, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, pixels, png });
})()`;
const frame = `<script>parent.postMessage({type:'identity-probe',identity:{ua:navigator.userAgent,platform:navigator.platform,language:navigator.language,cores:navigator.hardwareConcurrency,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}}, '*')</script>`;
async function storage(write) {
  if (write) { document.cookie = 'identityMarker=A; path=/'; localStorage.setItem('identityMarker', 'A'); }
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('identity-audit', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('markers');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const idb = await new Promise((resolve, reject) => {
    const tx = db.transaction('markers', write ? 'readwrite' : 'readonly');
    const request = write ? tx.objectStore('markers').put('A', 'identity') : tx.objectStore('markers').get('identity');
    tx.oncomplete = () => resolve(write ? 'A' : request.result || null); tx.onerror = () => reject(tx.error);
  }); db.close();
  const cache = await caches.open('identity-audit');
  if (write) await cache.put('/cache-marker', new Response('A'));
  const cached = await cache.match('/cache-marker');
  return { cookie: document.cookie, local: localStorage.getItem('identityMarker'), idb, cache: cached ? await cached.text() : null };
}
async function run(ui) {
  const trace = (message) => require('node:fs').appendFileSync(require('node:path').join(__dirname, '../../e2e-trace.txt'), `identity: ${message}\n`);
  const checks = []; const tabs = [];
  const add = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  let framePort;
  const handler = (request, response) => {
    if (request.url === '/worker.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(worker); }
    else if (request.url === '/frame') { response.setHeader('Content-Type', 'text/html'); response.end(frame); }
    else if (request.url === '/echo') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(request.headers)); }
    else { response.setHeader('Content-Type', 'text/html'); response.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><body><script>window.__earlyIdentity={ua:navigator.userAgent,platform:navigator.platform};window.__identityReady=(${pageProbe.toString()})('http://127.0.0.1:${framePort}/frame')</script>`); }
  };
  const server = http.createServer(handler); const frameServer = http.createServer(handler);
  await new Promise((resolve) => frameServer.listen(0, '127.0.0.1', resolve)); framePort = frameServer.address().port;
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  async function create() {
    trace('create tab');
    const info = await ui.executeJavaScript(`(async () => { const tab = await createTab({ url: ${JSON.stringify(url)}, deviceId: 'desktop' }); return { id: tab.id, fp: tab.fp, partition: tab.partition }; })()`);
    tabs.push(info.id);
    return resolveTab(info);
  }
  async function resolveTab(info) {
    for (let i = 0; i < 80; i++) {
      const wcId = await ui.executeJavaScript(`(() => { try { return state.tabs.find(t => t.id === ${JSON.stringify(info.id)}).wv.getWebContentsId(); } catch { return null; } })()`);
      const wc = wcId && webContents.fromId(wcId);
      if (wc && wc.getURL() === url && await wc.executeJavaScript('!!window.__identityReady').catch(() => false)) {
        const snapshot = await wc.executeJavaScript(`window.__identityReady.catch(error => { throw new Error('Probe: ' + (error.stack || error.message || JSON.stringify(error))); })`);
        trace('probe complete');
        return { ...info, wc, snapshot };
      }
      await delay(100);
    }
    throw new Error('Identity probe did not load');
  }
  try {
    const a = await create(); trace('storage A'); const aStorage = await a.wc.executeJavaScript(`(${storage.toString()})(true)`);
    const b = await create(); trace('storage B'); const bStorage = await b.wc.executeJavaScript(`(${storage.toString()})(false)`);
    add('identity audit: tab IDs, partitions and noise seeds differ', a.fp.id !== b.fp.id && a.partition !== b.partition && a.fp.canvasSeed !== b.fp.canvasSeed && a.fp.audioSeed !== b.fp.audioSeed);
    add('identity audit: cookies, localStorage, IndexedDB and CacheStorage are isolated', !!aStorage.cookie && !bStorage.cookie && bStorage.local === null && bStorage.idb === null && bStorage.cache === null, bStorage);
    for (const item of [a, b]) {
      const s = item.snapshot;
      const matches = (value) => value.ua === item.fp.ua && value.platform === item.fp.platform && value.language === item.fp.language && value.cores === item.fp.hardwareConcurrency && value.timezone === item.fp.timezone;
      add('identity audit: early page and cross-origin frame match the tab profile', s.early.ua === item.fp.ua && s.early.platform === item.fp.platform && matches(s.main) && matches(s.frame), { main: s.main, frame: s.frame });
      add('identity audit: dedicated worker matches the tab profile', matches(s.worker), { ...s.worker, png: undefined });
      const workerPixels = s.worker.png ? await require('sharp')(Buffer.from(s.worker.png)).ensureAlpha().raw().toBuffer() : null;
      add('identity audit: worker OffscreenCanvas matches page noise and PNG export', s.worker.pixels === s.pixels && workerPixels && crypto.createHash('sha256').update(workerPixels).digest('hex') === s.pixels);
      add('identity audit: network UA, platform hints and language match the page', s.headers['user-agent'] === item.fp.ua && s.headers['sec-ch-ua-platform'] === '"' + item.fp.uaDataPlatform + '"' && s.headers['accept-language'].startsWith(item.fp.language));
      add('identity audit: canvas and audio reads are stable; UTC is respected', s.canvasStable && s.audioStable && s.explicitUTC === 'UTC');
      const png = Buffer.from(s.dataUrl.split(',')[1], 'base64');
      const pixels = await require('sharp')(png).ensureAlpha().raw().toBuffer();
      add('identity audit: canvas PNG and getImageData expose consistent pixels', crypto.createHash('sha256').update(pixels).digest('hex') === s.pixels);
    }
    add('identity audit: rendered canvas and offline audio vary between tabs', a.snapshot.canvas !== b.snapshot.canvas && a.snapshot.audio !== b.snapshot.audio);
    trace('reload A'); a.wc.reload(); await delay(100);
    const reloaded = (await resolveTab(a)).snapshot;
    add('identity audit: reload preserves identity and its storage', reloaded.canvas === a.snapshot.canvas && (await a.wc.executeJavaScript(`(${storage.toString()})(false)`)).local === 'A');
    trace('rotate A'); await ui.executeJavaScript(`(async () => { activate(${JSON.stringify(a.id)}); await rotateTab(${JSON.stringify(a.id)}); })()`);
    const replacement = await ui.executeJavaScript('({ id: activeTab().id, fp: activeTab().fp, partition: activeTab().partition })'); tabs.push(replacement.id);
    const reset = await resolveTab(replacement);
    const resetStorage = await reset.wc.executeJavaScript(`(${storage.toString()})(false)`);
    const old = await ui.executeJavaScript(`window.api.fp.current(${JSON.stringify(a.fp.id)})`);
    add('identity audit: New identity replaces profile and clears old session data', replacement.fp.id !== a.fp.id && replacement.partition !== a.partition && !old.ok && !resetStorage.cookie && resetStorage.local === null && resetStorage.idb === null && resetStorage.cache === null, resetStorage);
  } finally {
    for (const id of tabs) await ui.executeJavaScript(`closeTab(${JSON.stringify(id)}, { silent: true })`).catch(() => {});
    server.closeAllConnections(); frameServer.closeAllConnections();
    await new Promise((resolve) => server.close(resolve)); await new Promise((resolve) => frameServer.close(resolve));
  }
  return checks;
}
module.exports = { run };

'use strict';
/**
 * Automated end-to-end check of the running app (UI + tabs + navigation).
 * Enabled with:  npx electron . --fathi-e2e
 * Writes e2e-report.json and e2e-*.png next to package.json.
 */
const fs = require('node:fs');
const path = require('node:path');
const { webContents } = require('electron');

const OUT_DIR = path.join(__dirname, '..', '..');
const TRACE_FILE = path.join(OUT_DIR, 'e2e-trace.txt');
let lastMark = 'start';

function trace(msg) {
  lastMark = msg;
  global.__e2eTraceLast = msg;
  try { fs.appendFileSync(TRACE_FILE, `${new Date().toISOString()}  ${msg}\n`); } catch {}
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout: ' + label)), ms))
  ]);
}

async function waitFor(fn, timeout = 20000, interval = 250) {
  const started = Date.now();
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch {}
    if (Date.now() - started > timeout) return null;
    await sleep(interval);
  }
}

async function run(win) {
  trace('run start');
  const report = { startedAt: new Date().toISOString(), checks: [], errors: [] };
  const add = (name, pass, detail) => report.checks.push({ name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });

  await waitFor(async () => !win.webContents.isLoading(), 15000);
  await sleep(2500);
  trace('ui loaded');

  const ui = win.webContents;

  /* ---- 1. chrome rendered */
  trace('check 1: chrome');
  const shell = await ui.executeJavaScript(`({
    tabs: document.querySelectorAll('.tab').length,
    webviews: document.querySelectorAll('webview').length,
    hasOmni: !!document.getElementById('omnibox'),
    hasSettings: !!document.getElementById('settings-overlay'),
    title: document.title
  })`);
  add('browser chrome rendered', shell.tabs === 1 && shell.webviews === 1 && shell.hasOmni, JSON.stringify(shell));

  /* ---- 2. new tab page loaded inside the webview */
  const tabsState = () => withTimeout(ui.executeJavaScript(`(() => {
    const list = Array.from(document.querySelectorAll('webview')).map((w) => {
      let url = null, title = null, err = null;
      try { url = w.getURL(); } catch (e) { err = String(e && e.message || e); }
      try { title = w.getTitle(); } catch (e) {}
      return {
        cls: w.className,
        srcAttr: w.getAttribute('src'),
        partitionAttr: w.getAttribute('partition'),
        url, title, err,
        connected: w.isConnected
      };
    });
    const active = document.querySelector('webview.active') || document.querySelector('webview');
    return {
      count: document.querySelectorAll('.tab').length,
      partition: active ? active.getAttribute('partition') : null,
      url: active && active.getURL ? (() => { try { return active.getURL(); } catch (e) { return 'ERR:' + e.message; } })() : null,
      title: active && active.getTitle ? (() => { try { return active.getTitle(); } catch (e) { return null; } })() : null,
      all: list
    };
  })()`), 5000, 'tabs state');
  report.debugFirstTabs = await tabsState().catch((e) => String(e));
  report.debugWebContents = (() => {
    try {
      return webContents.getAllWebContents().map((w) => ({
        id: w.id, type: w.getType(), url: w.getURL(), title: (() => { try { return w.getTitle(); } catch { return null; } })()
      }));
    } catch (e) { return String(e); }
  })();

  const first = await waitFor(async () => {
    const s = await tabsState();
    return s.url && s.url.startsWith('fathi://newtab') ? s : null;
  }, 15000);
  add('new tab page loaded', !!first, first && first.url);
  add('tab session is in-memory', first && first.partition && !String(first.partition).startsWith('persist:'), first && first.partition);

  /* ---- 2b. wallpaper + brand icon render inside the tab */
  let wall = null;
  for (let i = 0; i < 10; i += 1) {
    wall = await withTimeout(ui.executeJavaScript(`(async () => {
      const wv = document.querySelector('webview.active');
      try {
        return await wv.executeJavaScript('(() => { const bg = document.getElementById("bg"); const img = document.querySelector("#brand-mark img"); return { ready: bg.classList.contains("ready"), bg: getComputedStyle(bg).backgroundImage, brand: img ? { w: img.naturalWidth, src: img.getAttribute("src") } : null }; })()');
      } catch (e) { return { err: String(e && e.message || e) }; }
    })()`), 6000, 'wallpaper').catch((e) => ({ err: String(e && e.message || e) }));
    if (wall && wall.ready) break;
    await sleep(700);
  }
  add('new tab wallpaper loaded', !!(wall && /url\(/.test(wall.bg || '')), JSON.stringify(wall));
  add('new tab brand icon loaded', !!(wall && wall.brand && wall.brand.w > 0), JSON.stringify(wall && wall.brand));

  /* ---- 2c. start-page promo banners (GitHub + Telegram) */
  const promos = await ui.executeJavaScript(`(async () => {
    const wv = document.querySelector('webview.active');
    try {
      return await wv.executeJavaScript('(() => Array.from(document.querySelectorAll("#promos .promo")).map((a) => ({ href: a.getAttribute("href"), target: a.getAttribute("target"), title: (a.querySelector(".ptitle") || {}).textContent, sub: (a.querySelector(".psub") || {}).textContent, go: (a.querySelector(".pgo") || {}).textContent })))()');
    } catch (e) { return { err: String(e && e.message || e) }; }
  })()`).catch((e) => ({ err: String(e && e.message || e) }));
  add('start page promos render',
    Array.isArray(promos) && promos.length === 2 &&
      promos[0].href === 'https://github.com/iMumd' && promos[0].target === '_blank' &&
      promos[1].href === 'https://t.me/Mumdthoughts' && promos[1].target === '_blank' &&
      /GitHub/.test(promos[0].sub || '') && /Telegram/.test(promos[1].sub || ''),
    JSON.stringify(promos));

  /* ---- 3. second tab gets a different partition */
  trace('check 3: second tab');
  await ui.executeJavaScript(`document.getElementById('newtab-btn').click()`);
  await sleep(1800);
  const two = await tabsState();
  add('second tab created', two.count === 2, 'tabs=' + two.count);
  add('tabs use separate sessions', two.partition && first && two.partition !== first.partition,
    `${first && first.partition} | ${two.partition}`);

  /* ---- 4. navigation works (through proxy) */
  trace('check 4: navigation');
  await ui.executeJavaScript(`
    (() => {
      const wv = document.querySelector('webview.active');
      wv.loadURL('https://example.com');
    })()
  `);
  const nav = await waitFor(async () => {
    const s = await tabsState();
    return s.url && s.url.includes('example.com') && !s.url.startsWith('fathi://') ? s : null;
  }, 45000);
  add('external navigation works', !!nav, nav && nav.url);
  add('page title updated', !!(nav && nav.title), nav && nav.title);

  /* ---- 5. device mode (iPhone preset), same window, mobile metrics */
  trace('check 5: device tab');
  await ui.executeJavaScript(`void createTab({ deviceId: 'iphone-15-pro' }); true`);
  await sleep(2600);
  trace('check 5: device frame');

  const devFrame = await withTimeout(ui.executeJavaScript(`(() => {
    const wv = document.querySelector('webview.active');
    const v = document.getElementById('view');
    const r = v.getBoundingClientRect();
    const w = wv.getBoundingClientRect();
    return {
      stage: v.classList.contains('stage'),
      cssW: wv.style.width, cssH: wv.style.height,
      styleRight: w.right <= r.right + 1 && w.left >= r.left - 1 && w.top >= r.top - 1 && w.bottom <= r.bottom + 1,
      scale: wv.style.transform,
      url: (() => { try { return wv.getURL(); } catch { return ''; } })()
    };
  })()`), 5000, 'device frame');
  add('device tab uses a frame', devFrame.stage && devFrame.cssW === '393px' && devFrame.cssH === '852px', JSON.stringify(devFrame));

  const devMetrics = await waitFor(async () => {
    const m = await withTimeout(ui.executeJavaScript(`(async () => {
      const wv = document.querySelector('webview.active');
      try {
        return await wv.executeJavaScript('({ iw: innerWidth, ih: innerHeight, sw: screen.width, sh: screen.height, dpr: devicePixelRatio, touch: navigator.maxTouchPoints, ua: navigator.userAgent, platform: navigator.platform, uaData: typeof navigator.userAgentData, chromeObj: typeof window.chrome })');
      } catch (e) { return { err: String(e && e.message || e) }; }
    })()`), 5000, 'device metrics');
    return m && !m.err ? m : null;
  }, 15000);
  const devOK = devMetrics &&
    devMetrics.iw === 393 && devMetrics.sw === 393 &&
    Math.abs(devMetrics.dpr - 3) < 0.01 && devMetrics.touch === 5 &&
    /iPhone/.test(devMetrics.ua) && devMetrics.platform === 'iPhone' &&
    devMetrics.uaData === 'undefined' && devMetrics.chromeObj === 'undefined';
  add('device metrics match the user agent', devOK, JSON.stringify(devMetrics));

  /* ---- 5b. interceptor, pause, inspect and forward a real request */
  trace('check 5b: interceptor on');
  await ui.executeJavaScript(`(async () => { await window.api.intercept.set(true); })()`);
  await ui.executeJavaScript(`(() => {
    const wv = document.querySelector('webview.active');
    wv.loadURL('https://example.com/?fathi-ix=1');
  })()`);
  const pausedRows = await waitFor(
    () => ui.executeJavaScript(`document.querySelectorAll('#ix-list .ix-item').length`),
    20000
  );
  add('interceptor pauses requests', pausedRows > 0, 'rows=' + pausedRows);
  if (pausedRows > 0) {
    await ui.executeJavaScript(`document.getElementById('ix-forward-all').click()`);
    await sleep(800);
  }
  await ui.executeJavaScript(`(async () => { await window.api.intercept.set(false); })()`);
  const ixOff = await ui.executeJavaScript(`(async () => (await window.api.intercept.state()).state.enabled)()`);
  add('interceptor turns off cleanly', ixOff === false, 'enabled=' + ixOff);

  /* ---- 5c. flow recorder, capture, inspect, export and code generation */
  trace('check 5c: flow recorder');
  await sleep(800);
  const netInfo = await ui.executeJavaScript(`(async () => {
    const wv = document.querySelector('webview.active');
    const wcId = wv.getWebContentsId();
    const res = await window.api.net.list({ wcId });
    return { wcId, count: res.ok ? res.records.length : -1 };
  })()`).catch((e) => ({ count: -1, error: String(e) }));
  add('flow captures the request log', netInfo.count > 0, JSON.stringify(netInfo));

  await ui.executeJavaScript(`document.getElementById('chip-flow').click()`);
  await sleep(500);
  const flowRows = await ui.executeJavaScript(`document.querySelectorAll('#net-list .net-row').length`);
  add('flow panel lists requests', flowRows > 0, 'rows=' + flowRows);

  const har = await ui.executeJavaScript(`(async () => {
    const wcId = document.querySelector('webview.active').getWebContentsId();
    const res = await window.api.net.serialize({ format: 'har', wcId });
    return res.ok ? res.text : '';
  })()`).catch(() => '');
  add('HAR export builds a valid archive', har.includes('"log"') && har.includes('"entries"') && har.includes('"creator"'), 'bytes=' + har.length);

  const xmlExport = await ui.executeJavaScript(`(async () => {
    const wcId = document.querySelector('webview.active').getWebContentsId();
    const res = await window.api.net.serialize({ format: 'xml', wcId });
    return res.ok ? res.text : '';
  })()`).catch(() => '');
  add('XML export builds a session document', xmlExport.includes('<fathi-session') && xmlExport.includes('<request '), 'bytes=' + xmlExport.length);

  const code = await ui.executeJavaScript(`(async () => {
    const wcId = document.querySelector('webview.active').getWebContentsId();
    const res = await window.api.net.list({ wcId });
    const rec = (res.records || []).find((r) => /example\\.com/.test(r.url)) || (res.records || [])[0];
    if (!rec) return '';
    const d = await window.api.net.detail({ wcId, id: rec.id });
    if (!d.ok) return '';
    return [codeFor(d.record, 'curl'), codeFor(d.record, 'python'), codeFor(d.record, 'php')].join('\\n---\\n');
  })()`).catch(() => '');
  add('request code generation works', /curl -X/.test(code) && /import requests/.test(code) && /curl_init/.test(code), 'chars=' + code.length);

  await ui.executeJavaScript(`document.querySelector('#net-list .net-row').click()`);
  await sleep(500);
  const inspector = await ui.executeJavaScript(`({
    visible: !document.getElementById('net-detail').classList.contains('hidden'),
    notes: document.querySelectorAll('#net-panel .net-note').length,
    title: (document.querySelector('.net-title') || {}).textContent || ''
  })`).catch(() => ({ visible: false, notes: 0 }));
  add('flow inspector renders analysis', inspector.visible && inspector.notes > 0, JSON.stringify(inspector));
  await ui.executeJavaScript(`document.getElementById('ix-close').click()`);

  /* ---- 6. screenshot of the chrome + the page surface */
  trace('check 6: screenshots');
  try {
    const img = await withTimeout(ui.capturePage(), 12000, 'window capture');
    fs.writeFileSync(path.join(OUT_DIR, 'e2e-window.png'), img.toPNG());
    add('window screenshot captured', true, 'e2e-window.png');
  } catch (e) {
    add('window screenshot captured', false, e.message);
  }

  try {
    const views = webContents.getAllWebContents().filter((w) => w.getType() === 'webview');
    let i = 0;
    let lastErr = '';
    for (const w of views) {
      try {
        const img = await withTimeout(w.capturePage(), 8000, 'webview capture');
        fs.writeFileSync(path.join(OUT_DIR, `e2e-webview-${i++}.png`), img.toPNG());
      } catch (e) { lastErr = String(e && e.message || e); }
    }
    add('page screenshots captured', i > 0, `${i} webview surface(s)${lastErr ? ' · ' + lastErr : ''}`);
  } catch (e) {
    add('page screenshots captured', false, e.message);
  }

  /* ---- 6. fingerprint difference between the two tabs (from the UI state) */
  const fps = await ui.executeJavaScript(`(async () => {
    const out = [];
    for (const t of window.__fathiTabs || []) out.push(t);
    return out;
  })()`).catch(() => null);

  trace('write report');
  report.finishedAt = new Date().toISOString();
  report.passed = report.checks.filter((c) => c.pass).length;
  report.total = report.checks.length;

  fs.writeFileSync(path.join(OUT_DIR, 'e2e-report.json'), JSON.stringify(report, null, 2), 'utf8');

  const lines = ['=== FATHI APP E2E ==='];
  for (const c of report.checks) lines.push(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}  :: ${c.detail}`);
  lines.push(`result: ${report.passed}/${report.total} passed`);
  lines.push(report.passed === report.total ? 'E2E_OK' : 'E2E_FAIL');
  fs.writeFileSync(path.join(OUT_DIR, 'e2e-result.txt'), lines.join('\n') + '\n', 'utf8');

  return report.passed === report.total;
}

module.exports = { run };

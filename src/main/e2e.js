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

  /* ---- 2d. about section shows the developer and links */
  const about = await ui.executeJavaScript(`(async () => {
    openSettings('about');
    await new Promise((r) => setTimeout(r, 250));
    const overlay = document.getElementById('settings-overlay');
    const body = document.getElementById('settings-body');
    const text = body ? body.innerText : '';
    const out = {
      visible: !!overlay && !overlay.classList.contains('hidden'),
      github: !!document.getElementById('about-github'),
      telegram: !!document.getElementById('about-telegram-link'),
      channel: !!document.getElementById('about-channel'),
      email: !!document.getElementById('about-email'),
      hasName: /iMumd/.test(text),
      hasGithub: /github\\.com\\/iMumd/.test(text),
      hasTelegram: /t\\.me\\/aweing/.test(text),
      hasChannel: /t\\.me\\/Mumdthoughts/.test(text)
    };
    closeSettings();
    return out;
  })()`).catch((e) => ({ err: String(e && e.message || e) }));
  add('about section shows the developer links',
    about.visible && about.github && about.telegram && about.channel && about.email &&
      about.hasName && about.hasGithub && about.hasTelegram && about.hasChannel,
    JSON.stringify(about));

  /* ---- 3. second tab gets a different partition */
  const updateUi = await ui.executeJavaScript(`(async () => {
    openSettings('proxy');
    const port = document.getElementById('tor-port');
    const portStyle = getComputedStyle(port);
    const burp = document.getElementById('px-burp').getBoundingClientRect();
    const themedPort = portStyle.backgroundColor !== 'rgb(255, 255, 255)' && portStyle.color !== portStyle.backgroundColor;
    openSettings('shortcuts');
    const input = document.querySelector('.sc-input').getBoundingClientRect();
    openSettings('intercept');
    document.getElementById('mr-add').click();
    const rule = document.querySelector('.mr-rule:last-child');
    rule.querySelector('.mr-match').value = 'hello';
    rule.querySelector('.mr-replace').value = 'updated';
    rule.querySelector('.mr-toggle').click();
    const collapsed = getComputedStyle(rule.querySelector('.mr-row')).display === 'none';
    const test = await window.api.rules.test({ rules: collectRules(), target: 'responseBody', payload: 'hello payload' });
    renderUpdate({ status: 'latest' });
    renderUpdate({ status: 'available', version: '99.0.0', current: '1.0.2', manual: true });
    const alerted = !document.getElementById('update-banner').classList.contains('hidden');
    renderUpdate({ status: 'latest' });
    const hidden = document.getElementById('update-banner').classList.contains('hidden');
    closeSettings();
    const firstNotes = await showReleaseNotesOnce();
    const notesVisible = !!document.getElementById('release-done');
    closeSettings();
    const secondNotes = await showReleaseNotesOnce();
    return { themedPort, burpHeight: burp.height, shortcutHeight: input.height, collapsed, test, alerted, hidden, firstNotes, notesVisible, secondNotes };
  })()`);
  add('SOCKS port follows theme', updateUi.themedPort, JSON.stringify(updateUi));
  add('Burp and shortcut controls have consistent sizes', updateUi.burpHeight >= 38 && updateUi.shortcutHeight === 34, JSON.stringify(updateUi));
  add('rules collapse and preview real payloads', updateUi.collapsed && updateUi.test.ok && updateUi.test.output === 'updated payload', JSON.stringify(updateUi));
  add('new update alerts survive a previous latest result', updateUi.alerted && updateUi.hidden, JSON.stringify(updateUi));
  add('release notes appear once per version', updateUi.firstNotes && updateUi.notesVisible && !updateUi.secondNotes, JSON.stringify(updateUi));
  const researchUi = await ui.executeJavaScript(`(async () => {
    openSettings('research');
    document.getElementById('scope-include').value = 'example.com\\n*.example.com';
    document.getElementById('scope-exclude').value = 'accounts.example.com';
    document.getElementById('scope-intercept').checked = true;
    document.getElementById('scope-save').click();
    await new Promise(r => setTimeout(r, 150));
    const applied = researchWorkspace.scope.onlyIntercept && Research.inScope('https://api.example.com', researchWorkspace.scope) && !Research.inScope('https://accounts.example.com', researchWorkspace.scope);
    const input = document.getElementById('research-input');
    input.value = '<svg onload="window.__researchXss=1">فتحي</svg>';
    input.dispatchEvent(new Event('input'));
    const op = document.getElementById('research-operation'); op.value = 'urlEncode'; op.dispatchEvent(new Event('change'));
    document.getElementById('research-run').click();
    await new Promise(r => setTimeout(r, 150));
    const transformed = document.getElementById('research-output').textContent.includes('%3Csvg') && !window.__researchXss;
    document.getElementById('research-clear').click();
    const cleared = researchWorkspace.input === '' && researchWorkspace.output === '';
    const reset = await window.api.research.setScope({}); researchWorkspace.scope = reset.scope;
    const escaped = document.createElement('div');
    renderSecurityPanel({ url: 'https://example.com', status: 200, mimeType: 'text/html', responseHeaders: { 'set-cookie': '<svg onload=bad>=secret; SameSite=None' } }, escaped);
    const passive = escaped.querySelectorAll('.security-finding').length > 0 && escaped.querySelectorAll('svg').length === 0 && !escaped.textContent.includes('=secret');
    researchWorkspace.baseline = { wcId: -1, method: 'GET', url: 'https://example.com', status: 200, body: 'old', responseHeaders: {} };
    const comparePanel = document.createElement('div'); document.getElementById('settings-body').appendChild(comparePanel);
    renderComparisonPanel({ status: 201, body: 'new', responseHeaders: { Test: '<script>bad</script>' } }, comparePanel);
    const compared = comparePanel.querySelector('.diff-before').textContent === 'old' && comparePanel.querySelector('.diff-after').textContent === 'new' && !comparePanel.querySelector('script');
    clearResearchForTab(-1);
    const purged = researchWorkspace.baseline === null;
    const saved = (await window.api.settings.get()).settings;
    const noPersistence = !('scope' in saved) && !('research' in saved);
    closeSettings();
    return { applied, transformed, cleared, passive, compared, purged, noPersistence };
  })()`);
  add('research scope applies exclusions and remains session-only', researchUi.applied && researchUi.noPersistence, JSON.stringify(researchUi));
  add('offline toolbox transforms text safely and clears sensitive data', researchUi.transformed && researchUi.cleared, JSON.stringify(researchUi));
  add('security notes escape untrusted evidence', researchUi.passive, JSON.stringify(researchUi));
  add('response comparisons render safely and purge the baseline', researchUi.compared && researchUi.purged, JSON.stringify(researchUi));
  trace('check 3: second tab');
  await ui.executeJavaScript(`document.getElementById('newtab-btn').click()`);
  await sleep(1800);
  const two = await tabsState();
  add('second tab created', two.count === 2, 'tabs=' + two.count);
  add('tabs use separate sessions', two.partition && first && two.partition !== first.partition,
    `${first && first.partition} | ${two.partition}`);

  /* ---- 4. navigation works with the active proxy setting */
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
  await sleep(3000);
  trace('check 5: device frame');

  const devFrame = await withTimeout(ui.executeJavaScript(`(() => {
    const wv = document.querySelector('webview.active');
    const v = document.getElementById('view');
    const f = document.getElementById('device-frame');
    const w = wv.getBoundingClientRect();
    const fr = f ? f.getBoundingClientRect() : null;
    return {
      stage: v.classList.contains('stage'),
      deviceClass: wv.classList.contains('device'),
      frameVisible: !!(f && !f.classList.contains('hidden') && fr && fr.width > 0 && fr.height > 0),
      frameRatio: fr && fr.height ? Number((fr.width / fr.height).toFixed(3)) : 0,
      matchesFrame: !!fr && Math.abs(w.width - fr.width) < 2 && Math.abs(w.height - fr.height) < 2 && Math.abs(w.left - fr.left) < 2 && Math.abs(w.top - fr.top) < 2,
      url: (() => { try { return wv.getURL(); } catch { return ''; } })()
    };
  })()`), 5000, 'device frame');
  add('device tab uses a frame',
    devFrame.stage && devFrame.deviceClass && devFrame.frameVisible && devFrame.matchesFrame &&
      Math.abs(devFrame.frameRatio - 393 / 852) < 0.03,
    JSON.stringify(devFrame));

  const devMetrics = await waitFor(async () => {
    const m = await withTimeout(ui.executeJavaScript(`(async () => {
      const wv = document.querySelector('webview.active');
      try {
        return await wv.executeJavaScript('({ iw: innerWidth, ih: innerHeight, sw: screen.width, sh: screen.height, dpr: devicePixelRatio, touch: navigator.maxTouchPoints, ua: navigator.userAgent, platform: navigator.platform, uaData: typeof navigator.userAgentData, chromeObj: typeof window.chrome })');
      } catch (e) { return { err: String(e && e.message || e) }; }
    })()`), 5000, 'device metrics');
    return m && !m.err ? m : null;
  }, 25000);
  const devSnap = await withTimeout(ui.executeJavaScript(`(async () => {
    const wv = document.querySelector('webview.active');
    try { return await wv.executeJavaScript('({ iw: innerWidth, sw: screen.width, dpr: devicePixelRatio, touch: navigator.maxTouchPoints, ua: navigator.userAgent, platform: navigator.platform, uaData: typeof navigator.userAgentData, chromeObj: typeof window.chrome })'); } catch (e) { return { err: String(e && e.message || e) }; }
  })()`), 5000, 'device snapshot').catch((e) => ({ timeout: String(e && e.message || e) }));
  add('device metrics snapshot', !!devSnap && !devSnap.timeout && !devSnap.err, JSON.stringify(devSnap));
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
    const topActions = await ui.executeJavaScript(`(async () => {
      devOpen('intercept'); await ixOpenItem(ix.items[0].id);
      ixRenderHeaderRows(Object.fromEntries(Array.from({ length: 30 }, (_, i) => ['X-Test-' + i, 'test value'])));
      const scroller = document.querySelector('#pane-intercept .ix-body');
      const bar = document.querySelector('.ix-action-bar');
      const aboveEditor = bar.getBoundingClientRect().bottom <= document.getElementById('ix-url').getBoundingClientRect().top;
      scroller.scrollTop = 300;
      await new Promise(r => requestAnimationFrame(r));
      const offset = bar.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      return { aboveEditor, sticky: offset >= -1 && offset <= 14, unique: document.querySelectorAll('#ix-forward').length === 1 && document.querySelectorAll('#ix-forward-all').length === 1 };
    })()`);
    add('interception actions stay above the editor and visible while scrolling', topActions.aboveEditor && topActions.sticky && topActions.unique, JSON.stringify(topActions));
    fs.writeFileSync(path.join(OUT_DIR, 'e2e-intercept-actions.png'), (await ui.capturePage()).toPNG());
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
  const flowFilters = await ui.executeJavaScript(`(() => {
    document.getElementById('net-method').value = 'DELETE'; flowRender();
    const filtered = document.querySelectorAll('#net-list .net-row').length === 0;
    document.getElementById('net-method').value = ''; flowRender();
    return filtered && document.querySelectorAll('#net-list .net-row').length > 0;
  })()`);
  add('Flow method filters narrow captured traffic without clearing it', flowFilters);

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
  await ui.executeJavaScript(`openSettings('about'); true`);
  await sleep(250);
  fs.writeFileSync(path.join(OUT_DIR, 'e2e-about-dark.png'), (await ui.capturePage()).toPNG());
  await ui.executeJavaScript(`(async () => { await setTheme('light'); await setLanguage('ar'); openSettings('about'); })()`);
  await sleep(250);
  fs.writeFileSync(path.join(OUT_DIR, 'e2e-about-light-ar.png'), (await ui.capturePage()).toPNG());
  const aboutLayout = await ui.executeJavaScript(`({ light: document.documentElement.dataset.theme === 'light', rtl: document.documentElement.classList.contains('rtl'), overflow: document.getElementById('settings-body').scrollWidth > document.getElementById('settings-body').clientWidth + 1 })`);
  add('About supports light Arabic layout without horizontal overflow', aboutLayout.light && aboutLayout.rtl && !aboutLayout.overflow, JSON.stringify(aboutLayout));
  await ui.executeJavaScript(`(async () => { await setTheme('dark'); await setLanguage('en'); openSettings('research'); })()`);
  await sleep(250);
  fs.writeFileSync(path.join(OUT_DIR, 'e2e-research.png'), (await ui.capturePage()).toPNG());
  const researchLayout = await ui.executeJavaScript(`(() => {
    const body = document.getElementById('settings-body');
    return body.scrollWidth <= body.clientWidth + 1 && !!document.getElementById('research-run');
  })()`);
  add('research workspace fits the settings panel', researchLayout);
  await ui.executeJavaScript(`closeSettings(); true`);
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

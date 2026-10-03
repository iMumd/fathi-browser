'use strict';
/**
 * Verifies the real <webview> path: partition -> in-memory session -> preload
 * injection -> proxy -> spoofed request headers on the wire.
 *   npx electron tools/selftest-webview.js
 */
const { app, BrowserWindow, ipcMain, session, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

app.setPath('sessionData', path.join(os.tmpdir(), 'fathi-selftest-wv-' + process.pid));

const fpgen = require('../src/main/fingerprint');
const settings = require('../src/main/settings');
const proxyMgr = require('../src/main/proxy');
const { configureSession } = require('../src/main/session');

settings.load();
const fp = fpgen.generate('webview-test-seed');

const LOG = path.join(__dirname, 'selftest-webview.log');
const OUT = path.join(__dirname, '..', 'selftest-webview-result.txt');
fs.writeFileSync(LOG, '');
function log(...a) {
  const line = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
  fs.appendFileSync(LOG, line + '\n');
}

ipcMain.on('fathi:fp:sync', (event, id) => {
  event.returnValue = id === fp.id ? JSON.stringify(fp) : 'null';
});

app.on('window-all-closed', () => {});

// proxy credentials (the real app registers this globally too)
app.on('login', (event, webContents, details, authInfo, callback) => {
  if (!authInfo || !authInfo.isProxy) return;
  const entry = proxyMgr.entryFor(PARTITION) || proxyMgr.pool()[0];
  if (!entry) return;
  event.preventDefault();
  callback(entry.username || '', entry.password || '');
});

const PARTITION = 'fathi-tab-webviewtest0001';
const TARGET = process.env.FATHI_TEST_URL || 'https://httpbin.org/headers';

app.whenReady().then(async () => {
  // Configure the in-memory tab session exactly like the real app does,
  // BEFORE the webview attaches to it.
  const ses = session.fromPartition(PARTITION);
  proxyMgr.assign(PARTITION);
  configureSession(ses, fp, PARTITION, { downloadDir: os.tmpdir(), extensions: false });

  const win = new BrowserWindow({
    show: false,
    width: 1000,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload', 'ui.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true
    }
  });

  win.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    log('will-attach-webview partition=', params.partition);
    delete webPreferences.preloadURL;
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInSubFrames = true;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = false;
    webPreferences.webSecurity = true;
    webPreferences.webviewTag = false;
    webPreferences.preload = path.join(__dirname, '..', 'src', 'preload', 'fp.js');
    webPreferences.additionalArguments = [`--fathi-fp=${fp.id}`, `--fathi-partition=${params.partition}`];
  });

  await win.loadFile(path.join(__dirname, 'wvhost.html'));

  const script = `(async () => {
    const wv = document.createElement('webview');
    wv.setAttribute('partition', ${JSON.stringify(PARTITION)});
    wv.setAttribute('src', ${JSON.stringify(TARGET)});
    document.body.appendChild(wv);

    const ready = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('webview load timeout')), 60000);
      wv.addEventListener('dom-ready', () => { clearTimeout(t); resolve(); });
      wv.addEventListener('did-fail-load', (e) => { clearTimeout(t); reject(new Error('fail: ' + e.errorCode + ' ' + e.errorDescription)); });
    });

    await ready;

    const info = await wv.executeJavaScript(\`(async () => {
      const out = {
        ua: navigator.userAgent,
        platform: navigator.platform,
        langs: navigator.languages,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        wd: navigator.webdriver,
        gl: (() => {
          const c = document.createElement('canvas');
          const g = c.getContext('webgl');
          const d = g && g.getExtension('WEBGL_debug_renderer_info');
          return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : null;
        })(),
        href: location.href,
        text: (document.body ? document.body.innerText : '').slice(0, 400)
      };
      try {
        const r = await fetch('https://httpbin.org/headers', { cache: 'no-store' });
        out.headers = (await r.json()).headers;
      } catch (e) { out.headersError = String(e); }
      return out;
    })()\`);

    return info;
  })()`;

  let result;
  try {
    result = await win.webContents.executeJavaScript(script, true);
  } catch (e) {
    result = { error: String(e && e.message || e) };
  }

  const h = (result && result.headers) || {};
  const checks = [];
  const add = (n, p, d) => checks.push({ n, p: !!p, d: d === undefined ? '' : String(d) });

  add('webview navigated', result && !result.error, result && (result.error || result.href));
  add('JS UA spoofed in webview', result && result.ua === fp.ua, result && result.ua);
  add('JS platform spoofed', result && result.platform === fp.platform, result && result.platform);
  add('JS timezone spoofed', result && result.tz === fp.timezone, result && result.tz);
  add('JS webdriver false', result && result.wd === false, result && result.wd);
  add('JS webgl spoofed', result && result.gl === fp.webgl.renderer, result && result.gl);
  add('header User-Agent spoofed', h['User-Agent'] === fp.ua, h['User-Agent']);
  add('header Accept-Language spoofed', (h['Accept-Language'] || '').includes(fp.language), h['Accept-Language']);
  add('header sec-ch-ua platform', (h['Sec-Ch-Ua-Platform'] || h['sec-ch-ua-platform'] || '').includes(fp.uaDataPlatform),
    h['Sec-Ch-Ua-Platform'] || h['sec-ch-ua-platform']);
  add('header sec-ch-ua brands', /Google Chrome/.test(h['Sec-Ch-Ua'] || h['sec-ch-ua'] || ''),
    h['Sec-Ch-Ua'] || h['sec-ch-ua']);
  add('session is in-memory (no persist)', !PARTITION.startsWith('persist:'), PARTITION);

  const lines = ['=== FATHI WEBVIEW SELF-TEST ==='];
  for (const c of checks) lines.push(`${c.p ? 'PASS' : 'FAIL'}  ${c.n}  :: ${c.d}`);
  lines.push(`result: ${checks.filter((c) => c.p).length}/${checks.length} passed`);
  lines.push(checks.every((c) => c.p) ? 'WEBVIEW_OK' : 'WEBVIEW_FAIL');
  const text = lines.join('\n') + '\n';
  fs.writeFileSync(OUT, text, 'utf8');
  log(text);

  win.destroy();
  setTimeout(() => app.exit(checks.every((c) => c.p) ? 0 : 1), 200);
}).catch((e) => {
  fs.appendFileSync(OUT, 'WEBVIEW_CRASH ' + String(e && e.stack || e) + '\n');
  app.exit(2);
});

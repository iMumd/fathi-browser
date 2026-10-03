'use strict';
/**
 * End-to-end self test of the fingerprint + proxy engines.
 *   npx electron tools/selftest.js
 *
 * Prints a machine-readable line starting with SELFTEST_OK / SELFTEST_FAIL.
 */
const { app, BrowserWindow, ipcMain, net, session } = require('electron');
const path = require('node:path');
const os = require('node:os');

app.setPath('sessionData', path.join(os.tmpdir(), 'fathi-selftest-' + process.pid));

const LOG_FILE = path.join(__dirname, 'selftest.log');
try { require('node:fs').writeFileSync(LOG_FILE, ''); } catch (e) {}
function log(...args) {
  const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  try { require('node:fs').appendFileSync(LOG_FILE, line + '\n'); } catch (e) {}
  try { process.stdout.write(line + '\n'); } catch (e) {}
}
app.on('window-all-closed', () => { /* keep alive until the test finishes */ });
log('boot', process.versions.electron, process.versions.chrome);

const fpgen = require('../src/main/fingerprint');
const proxyMgr = require('../src/main/proxy');

const fps = new Map();
const fpA = fpgen.generate('alpha-seed');
const fpB = fpgen.generate('beta-seed');
fps.set(fpA.id, fpA);
fps.set(fpB.id, fpB);

ipcMain.on('fathi:fp:sync', (event, id) => {
  const fp = fps.get(id);
  event.returnValue = fp ? JSON.stringify(fp) : 'null';
});

const PROBE = `(async () => {
  const out = {};
  const c = document.createElement('canvas');
  c.width = 220; c.height = 60;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f60'; ctx.fillRect(0, 0, 220, 60);
  ctx.font = '16px Arial';
  ctx.fillText('Fathi', 10, 35);
  out.canvas1 = c.toDataURL();
  out.canvas2 = c.toDataURL();

  const gl = document.createElement('canvas').getContext('webgl');
  let dbg = null;
  if (gl) dbg = gl.getExtension('WEBGL_debug_renderer_info');

  out.ua = navigator.userAgent;
  out.platform = navigator.platform;
  out.vendor = navigator.vendor;
  out.language = navigator.language;
  out.languages = navigator.languages;
  out.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  out.offset = new Date().getTimezoneOffset();
  out.cores = navigator.hardwareConcurrency;
  out.mem = navigator.deviceMemory;
  out.webdriver = navigator.webdriver;
  out.plugins = navigator.plugins.length;
  out.screen = [screen.width, screen.height, screen.colorDepth, devicePixelRatio];
  out.glVendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null;
  out.glRenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null;

  if (navigator.userAgentData) {
    out.uaDataPlatform = navigator.userAgentData.platform;
    out.uaDataBrands = navigator.userAgentData.brands;
    try {
      out.high = await navigator.userAgentData.getHighEntropyValues(
        ['architecture', 'bitness', 'platformVersion', 'uaFullVersion']);
    } catch (e) { out.high = null; }
  }
  return out;
})()`;

function makeWindow(fp) {
  return new BrowserWindow({
    show: false,
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload', 'fp.js'),
      contextIsolation: true,
      sandbox: false,
      additionalArguments: [`--fathi-fp=${fp.id}`]
    }
  });
}

async function probe(fp) {
  const win = makeWindow(fp);
  await win.loadFile(path.join(__dirname, 'selftest.html'));
  const res = await win.webContents.executeJavaScript(PROBE, true);
  const headers = await win.webContents.session.webRequest; // placeholder, headers tested at session level
  return { res, win };
}

function hashes(s) {
  return require('node:crypto').createHash('sha1').update(s).digest('hex').slice(0, 16);
}

async function ipThrough(ses, entry) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ error: 'timeout' }), 20000);
    try {
      const req = net.request({ url: 'https://api.ipify.org?format=json', session: ses });
      req.on('login', (_a, cb) => cb(entry ? entry.username : '', entry ? entry.password : ''));
      let body = '';
      req.on('response', (r) => {
        r.on('data', (d) => { body += d.toString(); });
        r.on('end', () => { clearTimeout(timer); try { resolve(JSON.parse(body)); } catch { resolve({ error: body.slice(0, 80) }); } });
      });
      req.on('error', (e) => { clearTimeout(timer); resolve({ error: String(e.message || e) }); });
      req.end();
    } catch (e) {
      clearTimeout(timer);
      resolve({ error: String(e.message || e) });
    }
  });

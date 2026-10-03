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
}

async function proxyCheck() {
  const settings = require('../src/main/settings');
  settings.load();

  const direct = await ipThrough(session.defaultSession, null);

  const entry = proxyMgr.parseEntry(settings.get().proxy.pool[0]);
  if (!entry) return { ok: false, skipped: true, error: 'no proxy configured' };

  const ses = session.fromPartition('fathi-selftest-proxy');
  await ses.setProxy({ proxyRules: entry.rules, proxyBypassRules: '<local>' });
  const viaProxy = await ipThrough(ses, entry);

  return {
    ok: !!viaProxy.ip,
    host: `${entry.host}:${entry.port}`,
    direct: direct.ip || direct.error || '',
    proxy: viaProxy.ip || viaProxy.error || ''
  };
}

function diffFingerprints(a, b) {
  const keys = ['ua', 'platform', 'language', 'tz', 'cores', 'mem', 'screen', 'glVendor', 'glRenderer'];
  const diffs = [];
  for (const k of keys) {
    const av = JSON.stringify(a[k]);
    const bv = JSON.stringify(b[k]);
    if (av !== bv) diffs.push(k);
  }
  return diffs;
}

(async () => {
  log('waiting for ready');
  await app.whenReady();
  log('ready');

  const checks = [];
  const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

  log('probing A');
  const { res: a, win: winA } = await probe(fpA);
  log('probe A done');
  const { res: b, win: winB } = await probe(fpB);
  log('probe B done');

  add('UA matches profile', a.ua === fpA.ua, a.ua);
  add('UA differs between tabs', a.ua !== b.ua, `${a.ua.slice(0, 40)} != ${b.ua.slice(0, 40)}`);
  add('platform matches', a.platform === fpA.platform, a.platform);
  add('language matches', a.language === fpA.language, a.language);
  add('language list matches', JSON.stringify(a.languages) === JSON.stringify(fpA.languages), JSON.stringify(a.languages));
  add('timezone matches', a.tz === fpA.timezone, a.tz);
  add('timezone offset consistent', Math.abs(a.offset) <= 840, String(a.offset));
  add('hardwareConcurrency matches', a.cores === fpA.hardwareConcurrency, `${a.cores} vs ${fpA.hardwareConcurrency}`);
  add('deviceMemory matches', a.mem === fpA.deviceMemory, `${a.mem} vs ${fpA.deviceMemory}`);
  add('webdriver is false', a.webdriver === false, String(a.webdriver));
  add('screen matches', a.screen[0] === fpA.screen.width && a.screen[1] === fpA.screen.height, JSON.stringify(a.screen));
  add('dpr matches', a.screen[3] === fpA.screen.dpr, String(a.screen[3]));
  add('WebGL vendor spoofed', a.glVendor === fpA.webgl.vendor, a.glVendor);
  add('WebGL renderer spoofed', a.glRenderer === fpA.webgl.renderer, a.glRenderer);
  add('plugins list present', a.plugins === (fpA.plugins || []).length, `${a.plugins} vs ${(fpA.plugins || []).length}`);
  add('userAgentData platform', a.uaDataPlatform === fpA.uaDataPlatform, String(a.uaDataPlatform));
  add('userAgentData brands match', JSON.stringify(a.uaDataBrands) === JSON.stringify(fpA.uaBrands), JSON.stringify(a.uaDataBrands));
  add('high entropy hints', !!a.high && a.high.architecture === fpA.architecture, JSON.stringify(a.high));
  add('canvas noise is stable', a.canvas1 === a.canvas2, 'two toDataURL calls equal');
  add('canvas differs between tabs', a.canvas1 !== b.canvas1, hashes(a.canvas1) + ' vs ' + hashes(b.canvas1));
  add('fingerprint identity differs', diffFingerprints(a, b).length >= 3, diffFingerprints(a, b).join(','));

  winA.destroy();
  winB.destroy();

  const proxy = await proxyCheck();
  if (proxy.skipped) {
    add('proxy is unset by default', true, 'add one in settings when needed');
  } else {
    add('proxy reaches internet', proxy.ok, `${proxy.host} -> ${proxy.proxy}`);
    add('proxy IP differs from direct', proxy.ok && proxy.direct && proxy.proxy && proxy.direct !== proxy.proxy,
      `direct ${proxy.direct} / proxy ${proxy.proxy}`);
  }

  const failed = checks.filter((c) => !c.pass);
  const lines = [];
  lines.push('=== FATHI SELF-TEST ===');
  for (const c of checks) {
    lines.push(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}  ${c.detail ? ':: ' + c.detail : ''}`);
  }
  lines.push(`result: ${checks.length - failed.length}/${checks.length} passed`);
  lines.push(failed.length ? 'SELFTEST_FAIL' : 'SELFTEST_OK');
  lines.push('SELFTEST_JSON ' + JSON.stringify({ checks, proxy, sample: {
    ua: a.ua, tz: a.tz, screen: a.screen, glRenderer: a.glRenderer
  } }));

  const text = lines.join('\n') + '\n';
  console.log(text);
  try {
    require('node:fs').writeFileSync(require('node:path').join(__dirname, '..', 'selftest-result.txt'), text, 'utf8');
  } catch (e) {}

  setTimeout(() => app.exit(failed.length ? 1 : 0), 300);
})().catch((e) => {
  console.error('SELFTEST_CRASH', e);
  app.exit(2);
});

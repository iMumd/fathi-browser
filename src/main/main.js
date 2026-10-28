'use strict';
/**
 * Fathi main process.
 *
 * Design rules:
 *  Every tab gets its own IN-MEMORY session (partition without "persist:")
 *  Every tab gets a unique fingerprint (UA + client hints + JS surface)
 *  Nothing about browsing is written to disk. Cache and session data live in a
 *    temporary directory that is removed on exit
 *  The proxy is applied per session and can be changed at runtime
 */
const {
  app, BrowserWindow, ipcMain, session, net, shell, dialog, webContents, Menu, clipboard
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const rewrite = require('./rewrite');

/* ---------------------------------------------------- process hardening */

// WebRTC must never expose a local or non-proxied address.
app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');
app.commandLine.appendSwitch('enable-features', 'WebRtcHideLocalIpsWithMdns');
// Reduce cross-tab renderer sharing / keep surfaces independent.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

/* ------------------------------------------------------------------ paths */

const ROOT = path.join(__dirname, '..', '..');
const PRELOAD_DIR = path.join(ROOT, 'src', 'preload');
const RENDERER_DIR = path.join(ROOT, 'src', 'renderer');
const ASSETS_DIR = path.join(ROOT, 'assets');

/* ------------------------------------------------- ephemeral runtime dirs */

const TMP_SESSION = path.join(os.tmpdir(), `fathi-session-${process.pid}`);
const DOWNLOAD_DIR = path.join(os.tmpdir(), `fathi-downloads-${process.pid}`);
for (const d of [TMP_SESSION, DOWNLOAD_DIR]) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
  fs.mkdirSync(d, { recursive: true });
}
// Chromium's cache / cookies / GPUCache all go here and are wiped on quit.
app.setPath('sessionData', TMP_SESSION);

/* --------------------------------------------------------------- modules */

const settings = require('./settings');
const fpgen = require('./fingerprint');
const proxyMgr = require('./proxy');
const extMgr = require('./extensions');
const devices = require('./devices');
const protocolPages = require('./protocol');
const { configureSession, applyCertTrust } = require('./session');
const intercept = require('./intercept');
const network = require('./network');
const tor = require('./tor');
const updater = require('./updater');

/* ----------------------------------------------------------------- state */

let mainWindow = null;
let lastViewport = { width: 1200, height: 700 };

const fps = new Map();                 // fpId -> fingerprint
const partitions = new Map();          // partition -> { ses, fp }
const partitionFp = new Map();         // partition -> fpId

/* -------------------------------------------------------- protocol setup */

protocolPages.registerPrivileged();

/* -------------------------------------------------------------- sessions */

function ensureSession(partition, fp) {
  if (partitions.has(partition)) {
    const rec = partitions.get(partition);
    rec.fp = fp;
    return rec.ses;
  }

  // No "persist:" prefix => Chromium keeps this session in memory only.
  const ses = session.fromPartition(partition);

  proxyMgr.assign(partition);
  protocolPages.bind(ses);
  configureSession(ses, fp, partition, { downloadDir: DOWNLOAD_DIR });
  partitions.set(partition, { ses, fp });

  return ses;
}

async function destroySession(partition) {
  const rec = partitions.get(partition);
  partitions.delete(partition);
  partitionFp.delete(partition);
  if (!rec) return;
  try { await rec.ses.clearStorageData(); } catch {}
  try { await rec.ses.clearCache(); } catch {}
  try { await rec.ses.clearHostResolverCache(); } catch {}
}

/* ------------------------------------------------------------------ window */

function createWindow() {
  const cfg = settings.get();

  mainWindow = new BrowserWindow({
    width: cfg.window.width,
    height: cfg.window.height,
    minWidth: 940,
    minHeight: 620,
    frame: false,
    show: false,
    backgroundColor: '#14161a',
    title: 'Fathi',
    icon: path.join(ASSETS_DIR, 'icon.png'),
    webPreferences: {
      preload: path.join(PRELOAD_DIR, 'ui.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      spellcheck: false,
      devTools: true
    }
  });

  if (cfg.window.maximized) mainWindow.maximize();

  mainWindow.loadFile(path.join(RENDERER_DIR, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  /* -------- webview hardening + per-tab preload wiring */
  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    const partition = params.partition || '';
    const fpId = partitionFp.get(partition) || '';

    // Never trust a renderer supplied preload / node integration
    delete webPreferences.preloadURL;
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInSubFrames = true;   // spoof iframes too
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = false;
    webPreferences.webSecurity = true;
    webPreferences.allowRunningInsecureContent = false;
    webPreferences.webviewTag = false;
    webPreferences.preload = path.join(PRELOAD_DIR, 'fp.js');
    webPreferences.additionalArguments = [`--fathi-fp=${fpId}`, `--fathi-partition=${partition}`];
    webPreferences.spellcheck = false;
    webPreferences.devTools = true;
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  const pushWinState = () => {
    if (!mainWindow) return;
    mainWindow.webContents.send('fathi:win:state', {
      maximized: mainWindow.isMaximized(),
      fullscreen: mainWindow.isFullScreen()
    });
  };
  mainWindow.on('maximize', pushWinState);
  mainWindow.on('unmaximize', pushWinState);
  mainWindow.on('enter-full-screen', pushWinState);
  mainWindow.on('leave-full-screen', pushWinState);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (mainWindow) mainWindow.webContents.send('fathi:window:open', { url });
    return { action: 'deny' };
  });
}

/* ------------------------------------------------------ webview behaviour */

function recordForWebContents(wc) {
  try {
    for (const [partition, rec] of partitions) {
      if (rec.ses === wc.session) return { partition, fp: rec.fp };
    }
  } catch {}
  return null;
}

/** Device emulation for mobile presets. Uses the native webContents API so we
 *  never need a second debugger client (which froze tabs and fought with
 *  DevTools). The renderer sends its viewport so the emulated screen can be
 *  scaled and centred without a CSS transform on the webview. */
function applyDeviceEmulation(wc, fp, viewport) {
  const dev = fp && fp.device;
  if (!wc || wc.isDestroyed()) return;
  try {
    if (!dev || !dev.mobile) {
      wc.disableDeviceEmulation();
      return;
    }
    const vw = Math.max(120, Number(viewport && viewport.width) || 900);
    const vh = Math.max(160, Number(viewport && viewport.height) || 700);
    const pad = 34;
    const scale = Math.max(0.2, Math.min((vw - pad) / dev.width, (vh - pad) / dev.height, 1));
    wc.enableDeviceEmulation({
      screenPosition: 'mobile',
      screenSize: { width: dev.width, height: dev.height },
      viewPosition: {
        x: Math.max(0, Math.round((vw - dev.width * scale) / 2)),
        y: Math.max(0, Math.round((vh - dev.height * scale) / 2))
      },
      deviceScaleFactor: dev.dpr || 1,
      viewSize: { width: dev.width, height: dev.height },
      scale
    });
    if (fp.ua) wc.setUserAgent(fp.ua, (fp.languages || ['en-US']).join(','));
  } catch (e) {
    // Target already gone or emulation unsupported; the page still renders.
  }
}

app.on('web-contents-created', (_event, wc) => {
  if (wc.getType() !== 'webview') return;

  intercept.attach(wc);
  network.attach(wc);

  const rec = recordForWebContents(wc);
  if (rec && rec.fp && rec.fp.device && rec.fp.device.mobile) {
    const apply = () => applyDeviceEmulation(wc, rec.fp, lastViewport);
    // Enable emulation before the first commit so a page's viewport meta is
    // honoured from the start; enabling it after load keeps the desktop layout
    // width until the page reloads.
    apply();
    wc.once('dom-ready', apply);
    wc.on('did-navigate', apply);
  }

  // target=_blank -> new Fathi tab
  wc.setWindowOpenHandler(({ url, disposition }) => {
    if (mainWindow) {
      mainWindow.webContents.send('fathi:window:open', { url, wcId: wc.id, disposition });
    }
    return { action: 'deny' };
  });

  // Keep everything inside the tab; block unexpected app launches
  wc.on('will-navigate', (event, url) => {
    if (/^(mailto|tel|magnet|steam):/i.test(url)) {
      event.preventDefault();
      shell.openExternal(url).catch(() => {});
    }
  });

  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;
    if (ctrl && input.key.toLowerCase() === 'l') {
      event.preventDefault();
      if (mainWindow) mainWindow.webContents.send('fathi:focus-omnibox');
    }
    if (ctrl && input.key.toLowerCase() === 't') {
      event.preventDefault();
      if (mainWindow) mainWindow.webContents.send('fathi:new-tab');
    }
    if (ctrl && input.key.toLowerCase() === 'w') {
      event.preventDefault();
      if (mainWindow) mainWindow.webContents.send('fathi:close-tab', { wcId: wc.id });
    }
    if (input.key === 'F12' || (ctrl && input.shift && input.key.toLowerCase() === 'i')) {
      event.preventDefault();
      if (wc.isDevToolsOpened()) wc.closeDevTools();
      else wc.openDevTools({ mode: 'detach' });
    }
  });

  // Right-click: inspect element / DevTools / copy-paste, like a real browser.
  wc.on('context-menu', (_event, params) => {
    const items = [];
    if (params.linkURL) {
      items.push({
        label: 'Open link in new tab',
        click: () => { if (mainWindow) mainWindow.webContents.send('fathi:window:open', { url: params.linkURL }); }
      });
      items.push({ label: 'Copy link address', click: () => clipboard.writeText(params.linkURL) });
      items.push({ type: 'separator' });
    }
    if (params.mediaType === 'image' && params.srcURL) {
      items.push({ label: 'Copy image address', click: () => clipboard.writeText(params.srcURL) });
      items.push({ type: 'separator' });
    }
    items.push({ role: 'copy', label: 'Copy', enabled: !!(params.editFlags && params.editFlags.canCopy) });
    items.push({ role: 'paste', label: 'Paste', enabled: !!(params.editFlags && params.editFlags.canPaste) });
    items.push({ type: 'separator' });
    items.push({ label: 'Inspect element', click: () => wc.inspectElement(params.x, params.y) });
    items.push({ label: 'Open DevTools', click: () => wc.openDevTools({ mode: 'detach' }) });
    try { Menu.buildFromTemplate(items).popup({ window: mainWindow }); } catch {}
  });
});

/* ------------------------------------------------------------------- auth */

app.on('login', (event, webContents, details, authInfo, callback) => {
  if (!authInfo || !authInfo.isProxy) return;

  // find the entry assigned to the session that requested auth
  let entry = null;
  try {
    const ses = webContents.session;
    for (const [partition, rec] of partitions) {
      if (rec.ses === ses) { entry = proxyMgr.entryFor(partition); break; }
    }
  } catch {}

  if (!entry) {
    const pool = proxyMgr.pool();
    entry = pool[0] || null;
  }
  if (!entry) return;

  event.preventDefault();
  callback(entry.username || '', entry.password || '');
});

/* --------------------------------------------------------------------- IPC */

function ok(data) { return { ok: true, ...data }; }
function fail(error) { return { ok: false, error: String(error && error.message || error) }; }

/* --- app / window */
ipcMain.handle('fathi:app:info', () => ok({
  name: 'Fathi',
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  platform: process.platform,
  arch: process.arch,
  sessions: partitions.size
}));

ipcMain.handle('fathi:win:minimize', () => { if (mainWindow) mainWindow.minimize(); return ok({}); });
ipcMain.handle('fathi:win:toggle-maximize', () => {
  if (!mainWindow) return ok({});
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  return ok({ maximized: mainWindow.isMaximized() });
});
ipcMain.handle('fathi:win:close', () => { if (mainWindow) mainWindow.close(); return ok({}); });
ipcMain.handle('fathi:win:state', () => ok({
  maximized: mainWindow ? mainWindow.isMaximized() : false,
  fullscreen: mainWindow ? mainWindow.isFullScreen() : false
}));
ipcMain.handle('fathi:open-external', (e, url) => { shell.openExternal(url).catch(() => {}); return ok({}); });

/* --- devices */
ipcMain.handle('fathi:devices:list', () => ok({
  devices: devices.DEVICES,
  groups: devices.GROUPS,
  desktop: devices.DESKTOP
}));

/* --- fingerprints */
ipcMain.handle('fathi:fp:new', () => {
  const fp = fpgen.generate();
  fps.set(fp.id, fp);
  return ok({ fp });
});

ipcMain.on('fathi:fp:sync', (event, fpId) => {
  const fp = fps.get(fpId);
  event.returnValue = fp ? JSON.stringify(fp) : 'null';
});

ipcMain.handle('fathi:fp:current', (event, fpId) => {
  const fp = fps.get(fpId);
  return fp ? ok({ fp }) : fail('no fingerprint');
});

/* --- tabs */
ipcMain.handle('fathi:tab:prepare', async (event, opts = {}) => {
  try {
    let fp = opts.fp && opts.fp.id ? opts.fp : null;
    if (!fp) {
      fp = fpgen.generate({ deviceId: opts.deviceId });
      if (opts.landscape && fp.device && fp.device.mobile) {
        const w = fp.device.width;
        fp.device.width = fp.device.height;
        fp.device.height = w;
        fp.device.orientation = 'landscape';
        fp.screen.width = fp.device.width;
        fp.screen.height = fp.device.height;
        fp.screen.availWidth = fp.device.width;
        fp.screen.availHeight = Math.round(fp.device.height * 0.94);
      }
      fps.set(fp.id, fp);
    } else {
      fps.set(fp.id, fp);
    }

    const partition = `fathi-tab-${fp.id}-${Date.now().toString(36)}`;
    partitionFp.set(partition, fp.id);
    ensureSession(partition, fp);

    return ok({
      fp,
      fpId: fp.id,
      partition,
      proxy: proxyMgr.status(partition)
    });
  } catch (e) {
    return fail(e);
  }
});

ipcMain.handle('fathi:tab:destroy', async (event, { partition } = {}) => {
  if (partition) await destroySession(partition);
  return ok({});
});

ipcMain.handle('fathi:tab:proxy-status', (event, { partition } = {}) => {
  return ok({ proxy: proxyMgr.status(partition) });
});

/* --- proxy */
ipcMain.handle('fathi:proxy:get', () => ok({ config: settings.get().proxy }));

ipcMain.handle('fathi:proxy:set', async (event, patch = {}) => {
  try {
    const cfg = settings.save({ proxy: patch });
    // re-assign and apply to all live tabs
    proxyMgr.assignments.clear();
    for (const [partition, rec] of partitions) {
      proxyMgr.assign(partition);
      await proxyMgr.applyTo(rec.ses, partition);
      applyCertTrust(rec.ses);
    }
    mainWindow && mainWindow.webContents.send('fathi:proxy:changed', cfg.proxy);
    return ok({ config: cfg.proxy, applied: partitions.size });
  } catch (e) { return fail(e); }
});

ipcMain.handle('fathi:proxy:test', async (event, { entry, url } = {}) => {
  try {
    const res = await proxyMgr.test(entry, url);
    return ok({ result: res });
  } catch (e) { return fail(e); }
});

/* --- Tor routing for .onion / .eth / .i2p */
ipcMain.handle('fathi:tor:status', async () => {
  try { return ok({ status: await tor.status() }); }
  catch (e) { return fail(e); }
});

ipcMain.handle('fathi:tor:set', async (event, patch = {}) => {
  try {
    const cfg = settings.save({ tor: patch });
    const applied = [];
    for (const [partition, rec] of partitions) {
      await proxyMgr.applyTo(rec.ses, partition);
      applied.push(partition);
    }
    mainWindow && mainWindow.webContents.send('fathi:tor:changed', cfg.tor);
    return ok({ config: cfg.tor, applied: applied.length, status: await tor.status() });
  } catch (e) { return fail(e); }
});

/* --- application updates */
ipcMain.handle('fathi:update:state', () => ok({ state: updater.getState() }));

ipcMain.handle('fathi:update:check', async () => {
  try { return ok({ state: await updater.check() }); }
  catch (e) { return fail(e); }
});

ipcMain.handle('fathi:update:download', async () => {
  try { return ok(await updater.download()); }
  catch (e) { return fail(e); }
});

ipcMain.handle('fathi:update:install', () => ok({ installed: updater.install() }));

ipcMain.handle('fathi:update:open', async () => {
  try { return ok({ opened: await updater.openRelease() }); }
  catch (e) { return fail(e); }
});

ipcMain.handle('fathi:update:command', () => {
  try { return ok({ copied: updater.copyCommand(), command: updater.UPDATE_COMMAND }); }
  catch (e) { return fail(e); }
});

/* --- interceptor (Burp-style pause/edit) */
ipcMain.handle('fathi:intercept:state', () => ok({ state: intercept.state() }));

ipcMain.handle('fathi:intercept:set', async (event, { enabled: on } = {}) => {
  try { return ok({ state: await intercept.setEnabled(on) }); }
  catch (e) { return fail(e); }
});

ipcMain.handle('fathi:intercept:resolve', async (event, payload = {}) => {
  const res = await intercept.resolve(payload);
  return res.ok ? ok({}) : fail(res.error);
});

ipcMain.handle('fathi:intercept:drain', async () => {
  try { return ok(await intercept.drain()); }
  catch (e) { return fail(e); }
});

ipcMain.handle('fathi:intercept:filter', (event, { filter } = {}) => {
  try { return ok({ state: intercept.setFilter(filter) }); }
  catch (e) { return fail(e); }
});

/* --- repeat: resend an edited request and return its response */
ipcMain.handle('fathi:intercept:repeat', async (event, payload = {}) => {
  try {
    const res = await intercept.sendRequest(payload);
    return res.ok ? ok({ response: res.response }) : fail(res.error);
  } catch (e) { return fail(e); }
});

/* --- device emulation geometry from the renderer */
ipcMain.handle('fathi:device:emulate', (event, { wcId, viewport } = {}) => {
  try {
    if (viewport) lastViewport = {
      width: Number(viewport.width) || lastViewport.width,
      height: Number(viewport.height) || lastViewport.height
    };
    const wc = webContents.fromId(Number(wcId));
    if (!wc || wc.isDestroyed()) return ok({ applied: false });
    const rec = recordForWebContents(wc);
    if (rec && rec.fp) applyDeviceEmulation(wc, rec.fp, lastViewport);
    return ok({ applied: true });
  } catch (e) { return fail(e); }
});

/* --- match and replace rules */
ipcMain.handle('fathi:rules:list', () => ok({ rules: settings.get().matchReplace || [] }));

ipcMain.handle('fathi:rules:save', (event, { rules } = {}) => {
  try {
    const clean = (Array.isArray(rules) ? rules : []).map((r) => ({
      id: String(r && r.id || rewrite.newId()),
      enabled: !(r && r.enabled === false),
      target: rewrite.TARGETS.has(r && r.target) ? r.target : 'responseBody',
      match: String((r && r.match) || ''),
      replace: String((r && r.replace) || ''),
      regex: !!(r && r.regex),
      caseSensitive: !!(r && r.caseSensitive)
    })).filter((r) => r.match);
    const cfg = settings.save({ matchReplace: clean });
    if (mainWindow) mainWindow.webContents.send('fathi:settings:changed', cfg);
    return ok({ rules: cfg.matchReplace });
  } catch (e) { return fail(e); }
});

/* --- window / app actions for the corner menu */
ipcMain.handle('fathi:win:hide', () => {
  try { if (mainWindow) mainWindow.minimize(); } catch {}
  return ok({});
});

ipcMain.handle('fathi:app:quit', () => {
  try { app.quit(); } catch {}
  return ok({});
});

/* --- flow recorder (network log / HAR export) */
ipcMain.handle('fathi:net:list', (event, { wcId, all } = {}) => {
  try {
    return ok({
      records: network.listSummaries(wcId, !!all),
      stats: network.stats(wcId, !!all)
    });
  } catch (e) { return fail(e); }
});

ipcMain.handle('fathi:net:detail', async (event, { wcId, id } = {}) => {
  const record = await network.detail({ wcId, id });
  return record ? ok({ record }) : fail('request not found');
});

ipcMain.handle('fathi:net:export', async (event, opts = {}) => {
  try { return ok(await network.save(opts)); }
  catch (e) { return fail(e); }
});

ipcMain.handle('fathi:net:serialize', (event, { format = 'har', wcId, all } = {}) => {
  try { return ok({ text: network.serialize(format, { wcId, all: !!all }) }); }
  catch (e) { return fail(e); }
});

ipcMain.handle('fathi:net:clear', (event, { wcId, all } = {}) => {
  try { return ok(network.clear({ wcId, all: !!all })); }
  catch (e) { return fail(e); }
});

/* --- settings */
ipcMain.handle('fathi:settings:get', () => ok({
  settings: settings.get(),
  info: {
    version: app.getVersion(),
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
}));

ipcMain.handle('fathi:settings:set', (event, patch = {}) => {
  try {
    const cfg = settings.save(patch);
    mainWindow && mainWindow.webContents.send('fathi:settings:changed', cfg);
    return ok({ settings: cfg });
  } catch (e) { return fail(e); }
});

ipcMain.handle('fathi:settings:reset', () => ok({ settings: settings.reset() }));

/* --- wallpapers */
const LOCAL_WALLPAPER_DIR = path.join(__dirname, '..', '..', 'assets', 'wallpapers');
let wallpaperCache = { at: 0, list: [] };

function localWallpapers() {
  try {
    return fs.readdirSync(LOCAL_WALLPAPER_DIR)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort()
      .map((f) => ({
        url: `fathi://wallpaper/${encodeURIComponent(f)}`,
        thumb: `fathi://wallpaper/${encodeURIComponent(f)}`,
        author: 'Unsplash',
        link: 'https://unsplash.com',
        local: true
      }));
  } catch { return []; }
}

function unsplashSized(raw, width, quality) {
  if (!raw) return '';
  const base = String(raw).split('?')[0];
  return `${base}?auto=format&fit=crop&w=${width}&q=${quality}&fm=jpg`;
}

async function fetchUnsplash() {
  const now = Date.now();
  if (wallpaperCache.list.length && now - wallpaperCache.at < 10 * 60 * 1000) {
    return wallpaperCache.list;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    const res = await net.fetch(
      'https://unsplash.com/napi/topics/wallpapers/photos?per_page=30&page=1',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
          accept: 'application/json'
        },
        signal: ctrl.signal
      }
    );
    clearTimeout(timer);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const arr = await res.json();
    const list = (Array.isArray(arr) ? arr : []).map((p) => ({
      url: unsplashSized((p.urls && (p.urls.raw || p.urls.full || p.urls.regular)) || '', 2560, 85),
      thumb: unsplashSized((p.urls && p.urls.small) || '', 640, 60),
      author: (p.user && p.user.name) || 'Unsplash',
      link: (p.links && p.links.html) || 'https://unsplash.com'
    })).filter((x) => x.url);
    if (list.length) {
      wallpaperCache = { at: now, list };
      return list;
    }
  } catch {}
  return [];
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

ipcMain.handle('fathi:wallpaper:fetch', async () => {
  try {
    const cfg = settings.get().wallpapers;
    if (cfg.source === 'none') return ok({ wallpaper: null });
    if (cfg.source === 'custom' && cfg.custom) {
      return ok({ wallpaper: { url: cfg.custom, author: 'Custom', link: '' } });
    }

    // The bundled set is always used as the guarantee; the live Unsplash
    // stream is only an opt-in bonus so wallpapers never come up blank
    // (proxy/offline/firewall) and never hang the page on a remote image.
    const locals = localWallpapers();
    const localPick = locals.length ? pickRandom(locals) : null;
    let wallpaper = localPick;

    if (cfg.source === 'unsplash' && cfg.online === true && Math.random() < 0.5) {
      const remote = await fetchUnsplash();
      if (remote.length) wallpaper = pickRandom(remote);
    }

    if (!wallpaper) return ok({ wallpaper: null });
    return ok({
      wallpaper: { ...wallpaper, fallback: localPick ? localPick.url : '' },
      count: locals.length
    });
  } catch (e) { return fail(e); }
});

/* --- new tab page bridge */
ipcMain.handle('fathi:newtab:navigate', (event, url) => {
  if (mainWindow) {
    mainWindow.webContents.send('fathi:newtab:navigate', { url, wcId: event.sender.id });
  }
  return ok({});
});

ipcMain.handle('fathi:newtab:new', (event) => {
  if (mainWindow) mainWindow.webContents.send('fathi:newtab:new', { wcId: event.sender.id });
  return ok({});
});

ipcMain.handle('fathi:newtab:rotate', (event) => {
  if (mainWindow) mainWindow.webContents.send('fathi:newtab:rotate', { wcId: event.sender.id });
  return ok({});
});

ipcMain.handle('fathi:newtab:focus', (event) => {
  if (mainWindow) mainWindow.webContents.send('fathi:focus-omnibox');
  return ok({});
});

ipcMain.handle('fathi:newtab:guide', (event) => {
  if (mainWindow) mainWindow.webContents.send('fathi:newtab:guide', { wcId: event.sender.id });
  return ok({});
});

ipcMain.handle('fathi:newtab:shortcuts', (event) => {
  if (mainWindow) mainWindow.webContents.send('fathi:newtab:shortcuts', { wcId: event.sender.id });
  return ok({});
});

ipcMain.handle('fathi:page:status', (event) => {
  let partition = '';
  try {
    for (const [p, rec] of partitions) {
      if (rec.ses === event.sender.session) { partition = p; break; }
    }
  } catch {}
  return ok({
    proxy: proxyMgr.status(partition),
    fpId: partitionFp.get(partition) || '',
    partition
  });
});

/* --- extensions */
ipcMain.handle('fathi:ext:install', async (event, { input } = {}) => {
  try {
    const res = await extMgr.install(input, partitions);
    const list = await extMgr.list(partitions);
    return ok({ ...res, list });
  } catch (e) { return fail(e); }
});

ipcMain.handle('fathi:ext:install-unpacked', async (event) => {
  try {
    const res = await extMgr.installUnpacked(mainWindow, partitions);
    const list = await extMgr.list(partitions);
    return ok({ ...(res || {}), list });
  } catch (e) { return fail(e); }
});

ipcMain.handle('fathi:ext:list', async () => ok({ list: await extMgr.list(partitions) }));

ipcMain.handle('fathi:ext:remove', async (event, { id } = {}) => {
  try {
    await extMgr.remove(id, partitions);
    return ok({ list: await extMgr.list(partitions) });
  } catch (e) { return fail(e); }
});

/* ----------------------------------------------------------------- lifecycle */

app.whenReady().then(async () => {
  settings.load();
  protocolPages.bind(session.defaultSession);

  // default session should not persist anything either
  try {
    session.defaultSession.setPermissionRequestHandler((wc, p, cb) => cb(false));
  } catch {}

  createWindow();
  intercept.init(mainWindow);
  updater.init(mainWindow);
  network.init(mainWindow, {
    meta: (wc) => {
      const rec = recordForWebContents(wc);
      if (!rec) return null;
      return { partition: rec.partition, fpId: rec.fp && rec.fp.id };
    }
  });
  if (process.argv.includes('--fathi-e2e')) {
    setTimeout(async () => {
      // hard watchdog so a stuck step always leaves a readable trace
      setTimeout(() => {
        try {
          fs.writeFileSync(path.join(ROOT, 'e2e-result.txt'),
            'E2E_TIMEOUT at: ' + (global.__e2eTraceLast || 'unknown'), 'utf8');
        } catch {}
        app.exit(3);
      }, 150000);
      try {
        const { run } = require('./e2e');
        const ok = await run(mainWindow);
        app.exit(ok ? 0 : 1);
      } catch (e) {
        try {
          fs.writeFileSync(path.join(ROOT, 'e2e-result.txt'), 'E2E_CRASH ' + String(e && e.stack || e), 'utf8');
        } catch {}
        app.exit(2);
      }
    }, 800);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function cleanup() {
  try { fs.rmSync(TMP_SESSION, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(DOWNLOAD_DIR, { recursive: true, force: true }); } catch {}
}
app.on('will-quit', cleanup);
process.on('exit', cleanup);

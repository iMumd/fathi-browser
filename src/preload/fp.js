'use strict';
/**
 * Fathi page preload.
 *
 * Runs in every tab (and sub-frame). Two jobs:
 *   1. inject the per-tab fingerprint into the page's main world, before any
 *      page script executes;
 *   2. expose a small bridge (fathi:// internal pages only) for the new tab.
 */
const { ipcRenderer, contextBridge, webFrame } = require('electron');

/* ---------------------------------------------------------- fingerprint */

function fathiSpoof(cfg) {
  'use strict';
  const w = window;

  const def = (obj, prop, value) => {
    try {
      Object.defineProperty(obj, prop, { get: () => value, configurable: true, enumerable: true });
    } catch (e) {}
  };
  const defGet = (obj, prop, fn) => {
    try { Object.defineProperty(obj, prop, { get: fn, configurable: true, enumerable: true }); } catch (e) {}
  };

  const nav = w.navigator;
  if (!nav) return;

  /* ---------- navigator identity ---------- */
  def(nav, 'userAgent', cfg.ua);
  def(nav, 'appVersion', cfg.appVersion);
  def(nav, 'appName', cfg.appName || 'Netscape');
  def(nav, 'appCodeName', cfg.appCodeName || 'Mozilla');
  def(nav, 'platform', cfg.platform);
  def(nav, 'vendor', cfg.vendor || 'Google Inc.');
  def(nav, 'vendorSub', cfg.vendorSub || '');
  def(nav, 'productSub', cfg.productSub || '20030107');
  def(nav, 'language', cfg.language);
  def(nav, 'languages', Object.freeze((cfg.languages || [cfg.language]).slice()));
  def(nav, 'hardwareConcurrency', cfg.hardwareConcurrency);
  def(nav, 'deviceMemory', cfg.deviceMemory);
  def(nav, 'maxTouchPoints', cfg.maxTouchPoints || 0);
  def(nav, 'webdriver', false);
  def(nav, 'doNotTrack', null);
  def(nav, 'cookieEnabled', true);
  def(nav, 'onLine', true);
  def(nav, 'pdfViewerEnabled', true);
  if (cfg.oscpu) def(nav, 'oscpu', cfg.oscpu);

  /* ---------- plugins / mimeTypes ---------- */
  try {
    const names = cfg.plugins || ['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer'];
    const plugins = names.map((n) => {
      const p = { name: n, filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 0 };
      p.item = () => null; p.namedItem = () => null;
      return p;
    });
    plugins.item = (i) => plugins[i] || null;
    plugins.namedItem = (n) => plugins.find((p) => p.name === n) || null;
    plugins.refresh = () => {};
    def(nav, 'plugins', plugins);

    const mimes = [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }];
    mimes.item = (i) => mimes[i] || null;
    mimes.namedItem = (t) => mimes.find((m) => m.type === t) || null;
    def(nav, 'mimeTypes', mimes);
  } catch (e) {}

  /* ---------- client hints ---------- */
  try {
    if (cfg.clientHints === false) {
      // Safari (iOS) never exposes User-Agent Client Hints.
      try {
        Object.defineProperty(nav, 'userAgentData', {
          get: () => undefined, configurable: true, enumerable: false
        });
      } catch (e) {}
    } else {
      const brands = cfg.uaBrands || [];
      const fullList = cfg.uaFullVersionList || [];
      const isMobile = !!(cfg.device && cfg.device.mobile);
      const highEntropy = (hints) => {
        const out = {
          architecture: cfg.architecture,
          bitness: cfg.bitness,
          brands,
          fullVersionList: fullList,
          mobile: isMobile,
          model: cfg.model || '',
          platform: cfg.uaDataPlatform,
          platformVersion: cfg.platformVersion,
          uaFullVersion: cfg.uaFullVersion,
          wow64: cfg.wow64
        };
        if (!hints || !hints.length) return out;
        const filtered = {};
        for (const h of hints) if (Object.prototype.hasOwnProperty.call(out, h)) filtered[h] = out[h];
        return filtered;
      };
      const uaData = {
        brands,
        mobile: isMobile,
        platform: cfg.uaDataPlatform,
        getHighEntropyValues: (hints) => Promise.resolve(highEntropy(hints)),
        toJSON: () => ({ brands, mobile: isMobile, platform: cfg.uaDataPlatform })
      };
      def(nav, 'userAgentData', uaData);
    }
  } catch (e) {}

  /* ---------- connection ---------- */
  try {
    const c = cfg.connection || {};
    def(nav, 'connection', {
      effectiveType: c.effectiveType || '4g',
      rtt: c.rtt || 50,
      downlink: c.downlink || 10,
      saveData: false,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {}
    });
  } catch (e) {}

  /* ---------- screen ---------- */
  try {
    const s = cfg.screen || {};
    const scr = w.screen;
    if (scr) {
      const keys = ['width', 'height', 'availWidth', 'availHeight', 'colorDepth', 'pixelDepth'];
      for (const k of keys) if (s[k] != null) def(scr, k, s[k]);
      defGet(scr, 'availLeft', () => 0);
      defGet(scr, 'availTop', () => 0);
    }
    if (s.dpr) def(w, 'devicePixelRatio', s.dpr);
    if (s.width) {
      def(w, 'outerWidth', s.width);
      def(w, 'outerHeight', s.height || 900);
      def(w, 'screenX', 0);
      def(w, 'screenY', 0);
    }
    // NOTE: innerWidth/innerHeight are intentionally left untouched, because the
    // webview is CSS-sized to the device viewport, so the real values already
    // match the spoofed screen. Overriding them here caused self-recursion.
  } catch (e) {}

  /* ---------- timezone ---------- */
  try {
    const tz = cfg.timezone;
    if (tz) {
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      const offsetFor = (date) => {
        const parts = dtf.formatToParts(date);
        const m = {};
        for (const p of parts) m[p.type] = p.value;
        const asUTC = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour % 24, +m.minute, +m.second);
        return Math.round((date.getTime() - asUTC) / 60000);
      };

      const origOffset = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = function () {
        try { return -offsetFor(new Date(this.getTime())); }
        catch (e) { return origOffset.call(this); }
      };

      const OrigDTF = Intl.DateTimeFormat;
      const Wrapped = function (locale, opts) {
        const o = opts ? Object.assign({}, opts) : {};
        if (!o.timeZone) o.timeZone = tz;
        return new OrigDTF(locale || cfg.language, o);
      };
      Wrapped.prototype = OrigDTF.prototype;
      Wrapped.supportedLocalesOf = OrigDTF.supportedLocalesOf.bind(OrigDTF);
      try { Intl.DateTimeFormat = Wrapped; } catch (e) {}

      try {
        const origResolved = OrigDTF.prototype.resolvedOptions;
        OrigDTF.prototype.resolvedOptions = function () {
          const r = origResolved.call(this);
          try { r.timeZone = tz; } catch (e) {}
          return r;
        };
      } catch (e) {}
    }
  } catch (e) {}

  /* ---------- WebGL ---------- */
  if (cfg.webgl) {
    const patchGL = (proto) => {
      if (!proto) return;
      try {
        const orig = proto.getParameter;
        proto.getParameter = function (p) {
          try {
            if (p === 37445 || p === 7936) return cfg.webgl.vendor;
            if (p === 37446 || p === 7937) return cfg.webgl.renderer;
          } catch (e) {}
          return orig.call(this, p);
        };
      } catch (e) {}
      try {
        const origExt = proto.getSupportedExtensions;
        proto.getSupportedExtensions = function () {
          const list = origExt.call(this) || [];
          for (const e of ['WEBGL_debug_renderer_info', 'EXT_texture_filter_anisotropic']) {
            if (list.indexOf(e) === -1) list.push(e);
          }
          return list;
        };
      } catch (e) {}
    };
    patchGL(w.WebGLRenderingContext && w.WebGLRenderingContext.prototype);
    patchGL(w.WebGL2RenderingContext && w.WebGL2RenderingContext.prototype);
  }

  /* ---------- canvas noise (stable per canvas size + seed) ---------- */
  try {
    const Ctx = w.CanvasRenderingContext2D;
    const origGetImageData = Ctx.prototype.getImageData;

    const perturb = (data, seedBase) => {
      let s = seedBase >>> 0;
      const step = 4 * 251;
      for (let i = 0; i < data.length; i += step) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        const delta = (s & 1) ? 1 : -1;
        const v = data[i] + delta;
        data[i] = v < 0 ? 0 : (v > 255 ? 255 : v);
      }
    };

    Ctx.prototype.getImageData = function (x, y, w2, h2) {
      const out = origGetImageData.call(this, x, y, w2, h2);
      try {
        if (w2 > 4 && h2 > 4) {
          perturb(out.data, (cfg.canvasSeed ^ Math.imul(w2, 73856093) ^ Math.imul(h2, 19349663)) >>> 0);
        }
      } catch (e) {}
      return out;
    };

    const noisify = (canvas) => {
      try {
        const c2 = document.createElement('canvas');
        c2.width = canvas.width;
        c2.height = canvas.height;
        const ctx = c2.getContext('2d');
        if (!ctx) return canvas;
        ctx.drawImage(canvas, 0, 0);
        const img = origGetImageData.call(ctx, 0, 0, c2.width, c2.height);
        perturb(img.data, (cfg.canvasSeed ^ Math.imul(c2.width, 83492791)) >>> 0);
        ctx.putImageData(img, 0, 0);
        return c2;
      } catch (e) { return canvas; }
    };

    const origToDataURL = w.HTMLCanvasElement.prototype.toDataURL;
    w.HTMLCanvasElement.prototype.toDataURL = function () {
      try {
        if (this.width > 4 && this.height > 4) {
          return origToDataURL.apply(noisify(this), arguments);
        }
      } catch (e) {}
      return origToDataURL.apply(this, arguments);
    };

    const origToBlob = w.HTMLCanvasElement.prototype.toBlob;
    w.HTMLCanvasElement.prototype.toBlob = function () {
      try {
        if (this.width > 4 && this.height > 4) {
          return origToBlob.apply(noisify(this), arguments);
        }
      } catch (e) {}
      return origToBlob.apply(this, arguments);
    };
  } catch (e) {}

  /* ---------- audio noise ---------- */
  try {
    const A = w.AnalyserNode;
    if (A) {
      const gffd = A.prototype.getFloatFrequencyData;
      A.prototype.getFloatFrequencyData = function (arr) {
        gffd.call(this, arr);
        try {
          let s = cfg.audioSeed >>> 0;
          for (let i = 0; i < arr.length; i += 97) {
            s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
            arr[i] = arr[i] + ((s / 4294967296) - 0.5) * 0.0002;
          }
        } catch (e) {}
      };
      const gbfd = A.prototype.getByteFrequencyData;
      A.prototype.getByteFrequencyData = function (arr) {
        gbfd.call(this, arr);
        try {
          for (let i = 0; i < arr.length; i += 211) {
            if (arr[i] > 0) arr[i] = Math.max(0, Math.min(255, arr[i] + ((i % 3) - 1)));
          }
        } catch (e) {}
      };
    }
  } catch (e) {}

  /* ---------- chrome object ---------- */
  try {
    if (cfg.hasChromeObject === false) {
      try { Object.defineProperty(w, 'chrome', { get: () => undefined, configurable: true }); } catch (e) {
        try { delete w.chrome; } catch (e2) {}
      }
    } else {
      if (!w.chrome) w.chrome = {};
      const ch = w.chrome;
      if (!ch.runtime) ch.runtime = {};
      if (!ch.runtime.id) ch.runtime.id = undefined;
      ch.loadTimes = () => ({
        requestTime: Date.now() / 1000 - 0.05,
        startLoadTime: Date.now() / 1000 - 0.04,
        commitLoadTime: Date.now() / 1000 - 0.02,
        finishDocumentLoadTime: Date.now() / 1000 - 0.01,
        finishLoadTime: Date.now() / 1000,
        firstPaintTime: Date.now() / 1000 - 0.015,
        firstPaintAfterLoadTime: 0,
        navigationType: 'Other',
        wasFetchedViaSpdy: true,
        wasNpnNegotiated: true,
        npnNegotiatedProtocol: 'h2',
        wasAlternateProtocolAvailable: false,
        connectionInfo: 'h2'
      });
      ch.csi = () => ({
        onloadT: Date.now(), startE: Date.now() - 120, pageT: 120,
        tran: 15, navigationStart: Date.now() - 120
      });
      if (!ch.app) ch.app = { isInstalled: false, InstallState: { DISABLED: 'disabled' }, RunningState: { RUNNING: 'running' }, getDetails: () => null, getIsInstalled: () => false };

      /* ---------- chrome.webstore shim (real install via Fathi) ---------- */
      try {
        if (!ch.webstore) {
          ch.webstore = {
            install: function (url, onSuccess, onFailure) {
              try {
                const bridge = w.__fathiBridge;
                const p = bridge && bridge.installExtension
                  ? bridge.installExtension(String(url))
                  : Promise.reject(new Error('unsupported'));
                p.then(() => onSuccess && onSuccess(), (e) => onFailure && onFailure(String(e && e.message || e)));
              } catch (e) { onFailure && onFailure(String(e)); }
            }
          };
        }
      } catch (e) {}
    }
  } catch (e) {}

  /* ---------- touch + mobile media (consistent with the device preset) ---------- */
  try {
    const mobile = !!(cfg.device && cfg.device.mobile);
    if (mobile) {
      def(nav, 'maxTouchPoints', cfg.device.touch || 5);
      try { if (!('ontouchstart' in w)) def(w, 'ontouchstart', null); } catch (e) {}
      try {
        const origMM = w.matchMedia.bind(w);
        w.matchMedia = function (q) {
          const query = String(q || '');
          let res = origMM(query);
          try {
            if (/pointer:\s*coarse/.test(query) || /any-pointer:\s*coarse/.test(query)) {
              return { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } };
            }
            if (/hover:\s*none/.test(query) || /any-hover:\s*none/.test(query)) {
              return { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } };
            }
            if (/pointer:\s*fine/.test(query) || /hover:\s*hover/.test(query)) {
              return { matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } };
            }
          } catch (e) {}
          return res;
        };
      } catch (e) {}
    }

    if (nav.mediaDevices && nav.mediaDevices.enumerateDevices) {
      const fake = mobile
        ? [
            { deviceId: 'default', kind: 'audioinput', label: '' },
            { deviceId: 'default', kind: 'audiooutput', label: '' },
            { deviceId: 'cam0', kind: 'videoinput', label: '' }
          ]
        : [
            { deviceId: 'default', kind: 'audioinput', label: '' },
            { deviceId: 'default', kind: 'audiooutput', label: '' },
            { deviceId: 'cam0', kind: 'videoinput', label: '' }
          ];
      nav.mediaDevices.enumerateDevices = () => Promise.resolve(fake.map((d) => ({ ...d, groupId: 'fathi' })));
      if (!nav.mediaDevices.getDisplayMedia) {
        nav.mediaDevices.getDisplayMedia = () => Promise.reject(new Error('Not allowed'));
      }
    }

    if (w.screen && w.screen.orientation) {
      const portrait = !cfg.device || cfg.device.height >= cfg.device.width;
      def(w.screen.orientation, 'type', portrait ? 'portrait-primary' : 'landscape-primary');
      def(w.screen.orientation, 'angle', 0);
    }
  } catch (e) {}

  /* ---------- storage quota (device-class consistent) ---------- */
  try {
    if (nav.storage && nav.storage.estimate) {
      const mem = cfg.deviceMemory || 8;
      const quota = (mem >= 16 ? 240 : mem >= 8 ? 120 : 60) * 1024 * 1024 * 1024;
      nav.storage.estimate = () => Promise.resolve({
        quota: Math.round(quota * (0.82 + ((cfg.canvasSeed % 100) / 100) * 0.12)),
        usage: 1024 * 1024 * (4 + (cfg.canvasSeed % 90))
      });
    }
  } catch (e) {}

  /* ---------- battery ---------- */
  try {
    if (nav.getBattery) {
      const level = 0.35 + ((cfg.audioSeed % 60) / 100);
      nav.getBattery = () => Promise.resolve({
        charging: level > 0.8,
        chargingTime: level > 0.8 ? 0 : Infinity,
        dischargingTime: level > 0.8 ? Infinity : Math.round(level * 8 * 3600),
        level: Math.min(0.99, level),
        addEventListener() {}, removeEventListener() {}
      });
    }
  } catch (e) {}

  /* ---------- speech synthesis voices ---------- */
  try {
    if (w.speechSynthesis && w.speechSynthesis.getVoices) {
      const lang = (cfg.language || 'en-US').split('-')[0];
      w.speechSynthesis.getVoices = () => ([
        { name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true, default: lang === 'en', voiceURI: 'Microsoft David' },
        { name: 'Microsoft Zira - English (United States)', lang: 'en-US', localService: true, default: false, voiceURI: 'Microsoft Zira' },
        { name: 'Google US English', lang: 'en-US', localService: false, default: false, voiceURI: 'Google US English' }
      ]);
    }
  } catch (e) {}

  /* ---------- WebRTC: never leak a local/public IP outside the proxy ---------- */
  try {
    const PC = w.RTCPeerConnection || w.webkitRTCPeerConnection;
    if (PC) {
      const isPrivate = (s) =>
        /(^|\s)(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|fe80:|::1)/i.test(String(s));
      const cleanSdp = (sdp) => String(sdp || '').split('\r\n')
        .filter((line) => !(/^a=candidate:/.test(line) && isPrivate(line)))
        .join('\r\n');
      const origSLD = PC.prototype.setLocalDescription;
      PC.prototype.setLocalDescription = function (desc) {
        if (desc && typeof desc.sdp === 'string') {
          try { desc = { type: desc.type, sdp: cleanSdp(desc.sdp) }; } catch (e) {}
        }
        return origSLD.call(this, desc);
      };
      const origAdd = PC.prototype.addIceCandidate;
      PC.prototype.addIceCandidate = function (cand) {
        try {
          if (cand && typeof cand.candidate === 'string' && isPrivate(cand.candidate)) return Promise.resolve();
        } catch (e) {}
        return origAdd.call(this, cand);
      };
    }
  } catch (e) {}


  /* ---------- notifications / permissions ---------- */
  try {
    const N = w.Notification;
    if (N) def(N, 'permission', 'default');
    if (nav.permissions && nav.permissions.query) {
      const origQuery = nav.permissions.query.bind(nav.permissions);
      nav.permissions.query = function (desc) {
        try {
          if (desc && (desc.name === 'notifications' || desc.name === 'geolocation' ||
                       desc.name === 'camera' || desc.name === 'microphone')) {
            return Promise.resolve({ state: 'prompt', onchange: null });
          }
        } catch (e) {}
        return origQuery(desc);
      };
    }
  } catch (e) {}
}

/* ----------------------------------------------------------- bootstrap */

const fpArg = process.argv.find((a) => a.startsWith('--fathi-fp='));
const fpId = fpArg ? fpArg.slice('--fathi-fp='.length) : '';

let cfg = null;
try {
  cfg = JSON.parse(ipcRenderer.sendSync('fathi:fp:sync', fpId) || 'null');
} catch (e) { cfg = null; }

const isTopFrame = (() => {
  try { return window.top === window; } catch (e) { return false; }
})();

if (cfg && cfg.enabled !== false) {
  try {
    const src = `(${fathiSpoof.toString()})(${JSON.stringify(cfg)})`;
    webFrame.executeJavaScript(src);
  } catch (e) {
    console.error('[fathi] spoof inject failed', e);
  }
}

/* ------------------------------------------------------- bridge (top frame) */

if (isTopFrame) {
  // Available on every page: lets the chrome.webstore shim reach the main process.
  try {
    contextBridge.exposeInMainWorld('__fathiBridge', {
      installExtension: (url) => ipcRenderer.invoke('fathi:ext:install', { input: url })
    });
  } catch (e) {}

  // Internal pages only.
  if (location.protocol === 'fathi:') {
    try {
      contextBridge.exposeInMainWorld('fathi', {
        fpId,
        fingerprint: () => ipcRenderer.invoke('fathi:fp:current', fpId),
        wallpaper: () => ipcRenderer.invoke('fathi:wallpaper:fetch'),
        navigate: (url) => ipcRenderer.invoke('fathi:newtab:navigate', url),
        newTab: () => ipcRenderer.invoke('fathi:newtab:new'),
        rotate: () => ipcRenderer.invoke('fathi:newtab:rotate'),
        focusOmnibox: () => ipcRenderer.invoke('fathi:newtab:focus'),
        proxyStatus: () => ipcRenderer.invoke('fathi:page:status'),
        settings: () => ipcRenderer.invoke('fathi:settings:get'),
        openExternal: (url) => ipcRenderer.invoke('fathi:open-external', url),
        installExtension: (url) => ipcRenderer.invoke('fathi:ext:install', { input: url })
      });
    } catch (e) {}
  }
}

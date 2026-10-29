'use strict';
/**
 * Fathi page preload.
 *
 * Runs in every tab (and sub-frame). Two jobs:
 *   1. inject the per-tab fingerprint into the page's main world, before any
 *      page script executes;
 *   2. expose a small bridge (fathi:// internal pages only) for the new tab.
 */

/* ---------------------------------------------------------- fingerprint */

function fathiSpoof(cfg) {
  'use strict';
  const w = typeof window === 'object' ? window : globalThis;
  const nav = w.navigator;
  if (!nav) return;

  const def = (obj, prop, value) => {
    if (obj === nav) obj = Object.getPrototypeOf(nav);
    try {
      Object.defineProperty(obj, prop, { get: () => value, configurable: true, enumerable: true });
    } catch (e) {}
  };
  const defGet = (obj, prop, fn) => {
    try { Object.defineProperty(obj, prop, { get: fn, configurable: true, enumerable: true }); } catch (e) {}
  };


  /* ---------- navigator identity ---------- */
  def(nav, 'userAgent', cfg.ua);
  def(nav, 'appVersion', cfg.appVersion);
  def(nav, 'appName', cfg.appName || 'Netscape');
  def(nav, 'appCodeName', cfg.appCodeName || 'Mozilla');
  def(nav, 'platform', cfg.platform);
  def(nav, 'vendor', cfg.vendor ?? 'Google Inc.');
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
  // Preserve native PluginArray and MimeTypeArray behavior rather than exposing
  // recognizable plain-array shims.

  /* ---------- client hints ---------- */
  try {
    if (cfg.clientHints === false) {
      // Safari (iOS) never exposes User-Agent Client Hints.
      try {
        Object.defineProperty(Object.getPrototypeOf(nav), 'userAgentData', {
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
        const filtered = { brands, mobile: isMobile, platform: cfg.uaDataPlatform };
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
  if (typeof window === 'object') try {
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
        try { return offsetFor(new Date(this.getTime())); }
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

      // Do not rewrite explicit UTC or another caller-selected time zone.
    }
  } catch (e) {}

  /* ---------- WebGL ---------- */
  if (cfg.webgl && cfg.spoofWebgl !== false) {
    const patchGL = (proto) => {
      if (!proto) return;
      try {
        const orig = proto.getParameter;
        proto.getParameter = function (p) {
          try {
            if (p === 37445) return cfg.webgl.vendor;
            if (p === 37446) return cfg.webgl.renderer;
          } catch (e) {}
          return orig.call(this, p);
        };
      } catch (e) {}
      try {
        const origExt = proto.getSupportedExtensions;
        proto.getSupportedExtensions = function () {
          const list = origExt.call(this) || [];
          return list;
        };
      } catch (e) {}
    };
    patchGL(w.WebGLRenderingContext && w.WebGLRenderingContext.prototype);
    patchGL(w.WebGL2RenderingContext && w.WebGL2RenderingContext.prototype);
  }

  /* ---------- canvas noise (stable per canvas size + seed) ---------- */
    const perturb = (data, width, startX = 0, startY = 0) => {
      const mix = (n) => {
        let s = n >>> 0;
        s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
        s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
        return (s ^ (s >>> 16)) >>> 0;
      };
      for (let row = 0; row < data.length / 4 / width; row++) {
        const y = startY + row;
        const rowSeed = mix(cfg.canvasSeed ^ Math.imul(y, 19349663));
        const offset = ((rowSeed % 251 - startX) % 251 + 251) % 251;
        for (let x = offset; x < width; x += 251) {
        const i = (row * width + x) * 4;
        if (data[i + 3] === 0) continue;
        const delta = (mix(rowSeed ^ Math.imul(startX + x, 73856093)) & 256) ? 1 : -1;
        const v = data[i] + delta;
        data[i] = v < 0 ? 0 : (v > 255 ? 255 : v);
        }
      }
    };

  if (cfg.spoofCanvas !== false) try {
    const Ctx = w.CanvasRenderingContext2D;
    const origGetImageData = Ctx.prototype.getImageData;

    Ctx.prototype.getImageData = function (x, y, w2, h2) {
      const out = origGetImageData.call(this, x, y, w2, h2);
      try {
        if (w2 > 4 && h2 > 4) {
          perturb(out.data, out.width, Math.trunc(x), Math.trunc(y));
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
        perturb(img.data, c2.width);
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

  if (cfg.spoofCanvas !== false && w.OffscreenCanvasRenderingContext2D && w.OffscreenCanvas) try {
    const proto = w.OffscreenCanvasRenderingContext2D.prototype;
    const get = proto.getImageData;
    proto.getImageData = function (x, y, width, height) {
      const image = get.call(this, x, y, width, height);
      if (image.width > 4 && image.height > 4) perturb(image.data, image.width, Math.trunc(x), Math.trunc(y));
      return image;
    };
    const convert = w.OffscreenCanvas.prototype.convertToBlob;
    w.OffscreenCanvas.prototype.convertToBlob = function (options) {
      if (this.width <= 4 || this.height <= 4) return convert.call(this, options);
      try {
        const copy = new w.OffscreenCanvas(this.width, this.height);
        const context = copy.getContext('2d');
        context.drawImage(this, 0, 0);
        const image = get.call(context, 0, 0, copy.width, copy.height);
        perturb(image.data, image.width); context.putImageData(image, 0, 0);
        return convert.call(copy, options);
      } catch { return convert.call(this, options); }
    };
  } catch {}

  /* ---------- audio noise ---------- */
  if (cfg.spoofAudio !== false) try {
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
            if (arr[i] > 0) arr[i] = Math.max(0, Math.min(255, arr[i] + (((cfg.audioSeed ^ Math.imul(i, 31)) >>> 0) % 3 - 1)));
          }
        } catch (e) {}
      };
    }
  } catch (e) {}

  if (cfg.spoofAudio !== false && w.AudioBuffer) {
    const proto = w.AudioBuffer.prototype;
    const original = proto.getChannelData;
    const copied = proto.copyFromChannel;
    const buffers = new WeakMap();
    const channel = (buffer, index) => {
      const data = original.call(buffer, index);
      let channels = buffers.get(buffer);
      if (!channels) { channels = new Map(); buffers.set(buffer, channels); }
      let last = channels.get(index);
      if (!last) { last = new Map(); channels.set(index, last); }
      for (let i = cfg.audioSeed % 97; i < data.length; i += 101) {
        if (!Number.isFinite(data[i]) || data[i] === 0 || last.get(i) === data[i]) continue;
        const mixed = Math.imul(cfg.audioSeed ^ i ^ index, 2654435761) >>> 0;
        data[i] = Math.fround(data[i] + ((mixed / 4294967296) - 0.5) * 0.0000002);
        last.set(i, data[i]);
      }
      return data;
    };
    proto.getChannelData = function (index) { return channel(this, index); };
    if (copied) proto.copyFromChannel = function (destination, index, start) { channel(this, index); return copied.call(this, destination, index, start); };
  }

  /* ---------- chrome object ---------- */
  if (typeof window === 'object') try {
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
      nav.mediaDevices.enumerateDevices = () => Promise.resolve(fake.map((d) => ({ ...d, groupId: '' })));
      if (!nav.mediaDevices.getDisplayMedia) {
        nav.mediaDevices.getDisplayMedia = () => Promise.reject(new Error('Not allowed'));
      }
    }

    if (w.screen && w.screen.orientation) {
      const portrait = cfg.device?.mobile ? cfg.device.height >= cfg.device.width : cfg.screen.height >= cfg.screen.width;
      def(w.screen.orientation, 'type', portrait ? 'portrait-primary' : 'landscape-primary');
      def(w.screen.orientation, 'angle', portrait ? 0 : 90);
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
      w.speechSynthesis.getVoices = () => [];
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

module.exports = { fathiSpoof };

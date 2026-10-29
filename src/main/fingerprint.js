'use strict';
/**
 * Fingerprint factory.
 *
 * Every tab receives a complete, internally-consistent device identity:
 *   user-agent, client hints, platform, languages, timezone, screen, hardware,
 *   WebGL vendor/renderer, canvas + audio noise seeds, fonts, plugins.
 *
 * Profiles are drawn from realistic pools per OS so that the identity is
 * coherent (a Windows UA gets a Windows GPU string, a Mac UA gets an Apple GPU).
 */

const crypto = require('node:crypto');
const devices = require('./devices');

const REAL_CHROME = (() => {
  const v = String(process.versions.chrome || '140.0.0.0').split('.');
  return parseInt(v[0], 10) || 140;
})();

/* ------------------------------------------------------------------ pools */

const LANG_POOL = [
  { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/New_York' },
  { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/Chicago' },
  { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/Los_Angeles' },
  { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/Denver' },
  { language: 'en-GB', languages: ['en-GB', 'en'], timezone: 'Europe/London' },
  { language: 'en-CA', languages: ['en-CA', 'en', 'fr-CA'], timezone: 'America/Toronto' },
  { language: 'en-AU', languages: ['en-AU', 'en'], timezone: 'Australia/Sydney' },
  { language: 'de-DE', languages: ['de-DE', 'de', 'en'], timezone: 'Europe/Berlin' },
  { language: 'fr-FR', languages: ['fr-FR', 'fr', 'en'], timezone: 'Europe/Paris' },
  { language: 'es-ES', languages: ['es-ES', 'es', 'en'], timezone: 'Europe/Madrid' },
  { language: 'it-IT', languages: ['it-IT', 'it', 'en'], timezone: 'Europe/Rome' },
  { language: 'nl-NL', languages: ['nl-NL', 'nl', 'en'], timezone: 'Europe/Amsterdam' },
  { language: 'pl-PL', languages: ['pl-PL', 'pl', 'en'], timezone: 'Europe/Warsaw' },
  { language: 'pt-BR', languages: ['pt-BR', 'pt', 'en'], timezone: 'America/Sao_Paulo' },
  { language: 'tr-TR', languages: ['tr-TR', 'tr', 'en'], timezone: 'Europe/Istanbul' },
  { language: 'ru-RU', languages: ['ru-RU', 'ru', 'en'], timezone: 'Europe/Moscow' },
  { language: 'ar-SA', languages: ['ar-SA', 'ar', 'en'], timezone: 'Asia/Riyadh' },
  { language: 'ar-AE', languages: ['ar-AE', 'ar', 'en'], timezone: 'Asia/Dubai' },
  { language: 'hi-IN', languages: ['hi-IN', 'hi', 'en'], timezone: 'Asia/Kolkata' },
  { language: 'id-ID', languages: ['id-ID', 'id', 'en'], timezone: 'Asia/Jakarta' },
  { language: 'ja-JP', languages: ['ja-JP', 'ja', 'en'], timezone: 'Asia/Tokyo' },
  { language: 'ko-KR', languages: ['ko-KR', 'ko', 'en'], timezone: 'Asia/Seoul' },
  { language: 'zh-CN', languages: ['zh-CN', 'zh', 'en'], timezone: 'Asia/Shanghai' },
  { language: 'vi-VN', languages: ['vi-VN', 'vi', 'en'], timezone: 'Asia/Ho_Chi_Minh' },
  { language: 'th-TH', languages: ['th-TH', 'th', 'en'], timezone: 'Asia/Bangkok' },
  { language: 'fil-PH', languages: ['fil-PH', 'fil', 'en'], timezone: 'Asia/Manila' },
  { language: 'sv-SE', languages: ['sv-SE', 'sv', 'en'], timezone: 'Europe/Stockholm' },
  { language: 'cs-CZ', languages: ['cs-CZ', 'cs', 'en'], timezone: 'Europe/Prague' }
];

const OS_PROFILES = {
  windows: {
    weight: 58,
    platform: 'Win32',
    uaOs: 'Windows NT 10.0; Win64; x64',
    uaDataPlatform: 'Windows',
    platformVersions: ['10.0.0', '13.0.0', '15.0.0', '19.0.0'],
    architecture: 'x86',
    bitness: '64',
    wow64: false,
    screens: [
      [1920, 1080, 1], [1920, 1080, 1], [2560, 1440, 1], [1366, 768, 1],
      [1536, 864, 1.25], [1600, 900, 1], [3840, 2160, 1.5], [1920, 1200, 1]
    ],
    cores: [4, 8, 8, 12, 16],
    memory: [4, 8, 8, 16, 16, 32],
    gpus: [
      { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { v: 'Google Inc. (Intel)', r: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { v: 'Google Inc. (Intel)', r: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { v: 'Google Inc. (AMD)', r: 'ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { v: 'Google Inc. (AMD)', r: 'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' }
    ]
  },
  mac: {
    weight: 22,
    platform: 'MacIntel',
    uaOs: 'Macintosh; Intel Mac OS X 10_15_7',
    uaDataPlatform: 'macOS',
    platformVersions: ['13.6.0', '14.5.0', '14.6.1', '15.1.0'],
    architecture: 'arm',
    bitness: '64',
    wow64: false,
    screens: [[1440, 900, 2], [1512, 982, 2], [1728, 1117, 2], [1920, 1080, 1]],
    cores: [8, 8, 10, 12],
    memory: [8, 16, 16, 32],
    gpus: [
      { v: 'Google Inc. (Apple)', r: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)' },
      { v: 'Google Inc. (Apple)', r: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)' },
      { v: 'Google Inc. (Apple)', r: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)' },
      { v: 'Google Inc. (Intel)', r: 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 640, OpenGL 4.1)' }
    ]
  },
  linux: {
    weight: 20,
    platform: 'Linux x86_64',
    uaOs: 'X11; Linux x86_64',
    uaDataPlatform: 'Linux',
    platformVersions: ['6.8.0', '5.15.0', '6.5.0'],
    architecture: 'x86',
    bitness: '64',
    wow64: false,
    screens: [[1920, 1080, 1], [2560, 1440, 1], [1366, 768, 1], [1680, 1050, 1]],
    cores: [4, 8, 8, 12, 16],
    memory: [4, 8, 16, 16, 32],
    gpus: [
      { v: 'Google Inc. (Intel)', r: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)' },
      { v: 'Google Inc. (AMD)', r: 'ANGLE (AMD, AMD Radeon RX 580 (POLARIS10, DRM 3.54, 6.5.0-35-generic, LLVM 15.0.7), OpenGL 4.6)' },
      { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Ti/PCIe/SSE2, OpenGL 4.5.0)' }
    ]
  }
};

const FONT_POOL = {
  windows: ['Arial', 'Calibri', 'Cambria', 'Consolas', 'Courier New', 'Georgia', 'Segoe UI',
    'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Microsoft Sans Serif',
    'Palatino Linotype', 'Lucida Console', 'Arial Black', 'Comic Sans MS'],
  mac: ['Arial', 'Helvetica', 'Helvetica Neue', 'Menlo', 'Monaco', 'SF Pro Text',
    'Times New Roman', 'Georgia', 'Verdana', 'Courier New', 'Lucida Grande', 'Geneva',
    'Optima', 'Futura', 'Baskerville'],
  linux: ['Arial', 'DejaVu Sans', 'DejaVu Serif', 'Liberation Sans', 'Liberation Serif',
    'Liberation Mono', 'Ubuntu', 'Noto Sans', 'Cantarell', 'FreeSans', 'Nimbus Sans',
    'Courier New', 'Times New Roman', 'Verdana']
};

const PLUGIN_SETS = [
  ['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer', 'Microsoft Edge PDF Viewer', 'WebKit built-in PDF'],
  ['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer'],
  ['PDF Viewer', 'Chrome PDF Viewer']
];

/* --------------------------------------------------------------- helpers */

function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }

function pickWeighted(rng, keys) {
  const total = keys.reduce((s, k) => s + OS_PROFILES[k].weight, 0);
  let r = rng() * total;
  for (const k of keys) {
    r -= OS_PROFILES[k].weight;
    if (r <= 0) return k;
  }
  return keys[0];
}

function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randHex(bytes) { return crypto.randomBytes(bytes).toString('hex'); }

/* ------------------------------------------------------------- generator */

function generate(opts) {
  const options = typeof opts === 'string' ? { seed: opts } : (opts || {});
  const device = devices.get(options.deviceId);
  const material = options.seed ? crypto.createHash('sha256').update(String(options.seed)).digest() : crypto.randomBytes(32);
  const seed = material.subarray(0, 16).toString('hex');
  const rng = mulberry32(material.readUInt32LE(0));

  const osKey = pickWeighted(rng, Object.keys(OS_PROFILES));
  const os = OS_PROFILES[osKey];
  const lang = pick(rng, LANG_POOL);
  // The JavaScript engine cannot become an older Chrome build by changing UA.
  const ver = REAL_CHROME;
  const fullVer = process.versions.chrome || `${ver}.0.0.0`;

  const ua = `Mozilla/5.0 (${os.uaOs}) AppleWebKit/537.36 (KHTML, like Gecko) ` +
    `Chrome/${ver}.0.0.0 Safari/537.36`;

  const [sw, sh, dprRaw] = pick(rng, os.screens);
  const dpr = typeof dprRaw === 'number' ? dprRaw : 1;

  const gpu = pick(rng, os.gpus);
  const cores = pick(rng, os.cores);
  const memory = Math.min(8, pick(rng, os.memory));
  const plugins = PLUGIN_SETS[0].slice();
  const platformVersion = pick(rng, os.platformVersions);

  const brands = shuffle(rng, [
    { brand: 'Not:A-Brand', version: '99' },
    { brand: 'Google Chrome', version: String(ver) },
    { brand: 'Chromium', version: String(ver) }
  ]);
  const fullVersionList = shuffle(rng, [
    { brand: 'Not:A-Brand', version: '99.0.0.0' },
    { brand: 'Google Chrome', version: fullVer },
    { brand: 'Chromium', version: fullVer }
  ]);

  const fonts = shuffle(rng, FONT_POOL[osKey]).slice(0, 8 + Math.floor(rng() * 7));

  const fp = {
    id: randHex(8),
    seed,
    enabled: true,
    createdAt: Date.now(),

    // navigator
    ua,
    appVersion: ua.replace(/^Mozilla\//, ''),
    appName: 'Netscape',
    appCodeName: 'Mozilla',
    platform: os.platform,
    vendor: 'Google Inc.',
    vendorSub: '',
    productSub: '20030107',
    oscpu: undefined,
    language: lang.language,
    languages: lang.languages.slice(),
    doNotTrack: null,
    hardwareConcurrency: cores,
    deviceMemory: memory,
    maxTouchPoints: 0,
    webdriver: false,

    // client hints
    uaBrands: brands,
    uaFullVersionList: fullVersionList,
    uaFullVersion: fullVer,
    uaMobile: false,
    uaDataPlatform: os.uaDataPlatform,
    platformVersion,
    architecture: osKey === 'mac' && /Intel/.test(gpu.r) ? 'x86' : os.architecture,
    bitness: os.bitness,
    wow64: os.wow64,

    // screen
    screen: {
      width: sw,
      height: sh,
      availWidth: sw,
      availHeight: sh - Math.round(32 + rng() * 24),
      colorDepth: 24,
      pixelDepth: 24,
      dpr
    },

    // graphics / media
    webgl: { vendor: gpu.v, renderer: gpu.r },
    canvasSeed: material.readUInt32LE(16),
    audioSeed: material.readUInt32LE(20),
    fonts,
    plugins,

    // misc
    timezone: new Intl.DateTimeFormat('en-US', { timeZone: lang.timezone }).resolvedOptions().timeZone,
    timezoneOffsetBase: 0,
    colorScheme: rng() > 0.28 ? 'light' : 'dark',
    pdfViewerEnabled: true,
    cookieEnabled: true,
    onLine: true,
    connection: {
      effectiveType: pick(rng, ['4g', '4g', '4g', '3g']),
      rtt: pick(rng, [50, 50, 100, 150]),
      downlink: pick(rng, [10, 10, 8.5, 5.25, 2.3]),
      saveData: false
    },

    osKey,
    chromeMajor: ver,
    device: { id: device.id, name: device.name, mobile: !!device.mobile,
      width: device.width, height: device.height, dpr: device.dpr, touch: device.touch || 0, os: device.os || 'desktop' }
  };

  if (device.mobile) applyMobileProfile(fp, device, rng, ver);

  return fp;
}

/**
 * Rewrites a desktop-shaped profile into a coherent mobile identity:
 * UA, platform, vendor, screen, DPR, touch points, GPU and client hints all
 * describe the same physical device.
 */
function applyMobileProfile(fp, device, rng, chromeMajor) {
  const isIOS = device.os === 'ios';
  const isTablet = /iPad|Tab/.test(device.name) || device.model === 'iPad';

  fp.osKey = isIOS ? 'ios' : 'android';
  fp.device = {
    id: device.id,
    name: device.name,
    os: device.os,
    mobile: true,
    tablet: isTablet,
    width: device.width,
    height: device.height,
    dpr: device.dpr,
    touch: device.touch || 5,
    orientation: device.width > device.height ? 'landscape' : 'portrait'
  };

  // ---- user agent
  fp.ua = isIOS ? device.ua : devices.androidUserAgent(device, chromeMajor);
  fp.appVersion = fp.ua.replace(/^Mozilla\//, '');
  fp.platform = device.platform;
  fp.vendor = device.vendor;
  fp.maxTouchPoints = device.touch || 5;
  fp.uaMobile = true;

  // ---- screen
  const safeTop = Math.round(device.height * (isTablet ? 0.03 : 0.06));
  fp.screen = {
    width: device.width,
    height: device.height,
    availWidth: device.width,
    availHeight: device.height - safeTop,
    colorDepth: 24,
    pixelDepth: 24,
    dpr: device.dpr
  };

  // ---- graphics
  fp.webgl = { ...device.gpu };

  // ---- hardware
  fp.hardwareConcurrency = isIOS ? pick(rng, [6]) : pick(rng, [8, 8, 8]);
  fp.deviceMemory = isIOS ? undefined : pick(rng, [4, 8]);
  fp.pdfViewerEnabled = true;
  fp.cookieEnabled = true;
  fp.connection = {
    effectiveType: pick(rng, ['4g', '4g', '4g', '3g']),
    rtt: pick(rng, [50, 50, 100, 100]),
    downlink: pick(rng, [10, 10, 7.5, 3.4]),
    saveData: false
  };

  // ---- client hints / chrome object
  fp.hasChromeObject = !isIOS;
  fp.clientHints = !isIOS;
  fp.uaDataPlatform = isIOS ? 'iOS' : 'Android';
  fp.platformVersion = isIOS ? device.osVersion : `${device.androidVersion}.0.0`;
  fp.architecture = '';
  fp.bitness = '';
  fp.model = device.model || '';
  fp.uaBrands = isIOS ? [] : fp.uaBrands;
  fp.uaFullVersionList = isIOS ? [] : fp.uaFullVersionList;

  // ---- mobile browsers do not expose these desktop-only bits
  fp.oscpu = undefined;

  return fp;
}

module.exports = { generate, REAL_CHROME, applyMobileProfile };

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

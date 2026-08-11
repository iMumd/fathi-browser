'use strict';
/**
 * Persistent app settings (ONLY configuration, never browsing data).
 * Browsing state lives exclusively in in-memory sessions and dies with the app.
 */
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const DEFAULT_PROXY = process.env.FATHI_PROXY || '';

const DEFAULTS = {
  version: 2,
  language: 'en',              // 'en' | 'ar'
  theme: 'dark',               // 'light' | 'dark'
  searchEngine: 'duckduckgo',
  newTabFocus: 'omnibox',
  defaultDevice: 'desktop',

  fingerprint: {
    enabled: true,
    spoofCanvas: true,
    spoofWebgl: true,
    spoofAudio: true,
    uniquePerTab: true
  },

  proxy: {
    enabled: false,
    pool: DEFAULT_PROXY ? [DEFAULT_PROXY] : [],
    mode: 'single',          // 'single' | 'rotate'
    bypass: '<local>',
    testUrl: 'https://api.ipify.org?format=json',
    dnsOverProxy: true,
    trustBurpCert: false     // accept MITM certs issued by the PortSwigger CA
  },

  intercept: {
    enabled: false,
    filter: ''               // substring of the URL; empty intercepts everything
  },

  wallpapers: {
    source: 'unsplash',      // 'unsplash' (bundled, offline-safe) | 'custom' | 'none'
    custom: '',
    blur: 0,
    dim: 0.32,
    refreshEachTab: true,
    online: false            // also try the live Unsplash feed (best effort)
  },

  extensions: [],

  window: { width: 1440, height: 920, maximized: false }
};

function isObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

function merge(base, extra) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!isObject(extra)) return out;
  for (const k of Object.keys(extra)) {
    if (isObject(base[k]) && isObject(extra[k])) out[k] = merge(base[k], extra[k]);
    else out[k] = extra[k];
  }
  return out;
}

let current = null;
let filePath = null;

function file() {
  if (!filePath) filePath = path.join(app.getPath('userData'), 'fathi-config.json');
  return filePath;
}

function load() {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(file(), 'utf8')) || {};
  } catch {
    raw = {};
  }
  current = merge(DEFAULTS, raw);
  // v1 configs shipped a light theme; v2 is black by default.
  if (!raw.version || raw.version < 2) {
    current.theme = 'dark';
    current.version = 2;
    try { save(current); } catch (e) {}
  }
  return current;
}

function get() { return current || load(); }

function save(patch) {
  current = merge(get(), patch || {});
  try {
    const f = file();
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(current, null, 2), 'utf8');
  } catch (e) {
    console.error('[settings] save failed', e);
  }
  return current;
}

function reset() {
  current = merge(DEFAULTS, {});
  try { fs.rmSync(file(), { force: true }); } catch {}
  return current;
}

module.exports = { DEFAULTS, load, get, save, reset, file };

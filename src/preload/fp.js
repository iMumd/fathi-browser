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

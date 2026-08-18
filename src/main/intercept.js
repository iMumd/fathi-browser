'use strict';
/**
 * Fathi interceptor. Pause web requests and let the UI edit, forward or drop
 * them before they leave the tab.
 *
 * Implemented with the Chrome DevTools Protocol "Fetch" domain on each tab's
 * guest WebContents, so it works together with the Burp proxy (Fathi pauses
 * first, then the request goes on to Burp exactly as edited).
 */
const settings = require('./settings');

let win = null;
let enabled = false;

const guests = new Map();       // wcId -> webContents
const paused = new Map();       // requestId -> record
const wired = new WeakSet();    // debugger objects with listeners
const enabling = new Set();     // wcIds with an enable in flight

function init(mainWindow) {
  win = mainWindow;
  enabled = !!(settings.get().intercept || {}).enabled;
}

function send(channel, payload) {
  try {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  } catch {}
}

function state() {
  return {
    enabled,
    paused: paused.size,
    attached: guests.size,
    filter: (settings.get().intercept || {}).filter || ''
  };

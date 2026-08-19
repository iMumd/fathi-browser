'use strict';
/**
 * Flow recorder. A full in-memory network log for every tab.
 *
 * Uses the DevTools "Network" domain on each tab's guest WebContents. Nothing
 * is written to disk unless the user explicitly exports: HAR, XML, JSON or CSV.
 *
 * The log is intentionally self-contained (request + response headers, request
 * and response bodies when textual, timings, sizes, failures) so it can also
 * drive the request inspector and the code generator in the UI.
 */
const fs = require('node:fs');
const path = require('node:path');
const { dialog } = require('electron');

const MAX_PER_TAB = 1500;
const MAX_TOTAL = 6000;
const MAX_BODY = 256 * 1024;

let win = null;
let metaFor = () => null;
let seq = 0;
let total = 0;

const tabs = new Map();      // wcId -> { wc, reqs, order }
const wired = new WeakSet();
const enabling = new Set();
let flushTimer = null;

/* ------------------------------------------------------------------ setup */

function init(mainWindow, opts = {}) {
  win = mainWindow;
  if (typeof opts.meta === 'function') metaFor = opts.meta;
}

function send(channel, payload) {
  try {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  } catch {}
}

function tabFor(wc) {
  let t = tabs.get(wc.id);
  if (!t) {
    t = { wc, reqs: new Map(), order: [] };
    tabs.set(wc.id, t);
  }
  return t;

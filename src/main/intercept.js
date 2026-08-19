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
}

/* ---------------------------------------------------------------- helpers */

function isWebUrl(url) {
  return !/^(fathi|chrome-extension|devtools|data|blob|about|chrome|javascript):/i.test(String(url || ''));
}

function matchesFilter(url) {
  const filter = String((settings.get().intercept || {}).filter || '').trim().toLowerCase();
  if (!filter) return true;
  const u = String(url || '').toLowerCase();
  return filter.split(/\s+/).some((part) => part && u.includes(part));
}

async function continueRaw(rec) {
  try { await rec.wc.debugger.sendCommand('Fetch.continueRequest', { requestId: rec.id }); } catch {}
}

async function enableOn(wc) {
  if (!wc || wc.isDestroyed() || enabling.has(wc.id)) return;
  enabling.add(wc.id);
  try {
    const dbg = wc.debugger;
    if (!dbg.isAttached()) dbg.attach('1.3');
    await dbg.sendCommand('Fetch.enable', {
      patterns: [{ urlPattern: '*', requestStage: 'Request' }]
    });
  } catch (e) {
    // another debugger (DevTools) may be attached, try again on dom-ready
  } finally {
    enabling.delete(wc.id);
  }
}

async function disableOn(wc) {
  if (!wc || wc.isDestroyed()) return;
  for (const rec of Array.from(paused.values())) {
    if (rec.wcId === wc.id) {
      paused.delete(rec.id);
      await continueRaw(rec);
    }
  }
  try {
    if (wc.debugger.isAttached()) await wc.debugger.sendCommand('Fetch.disable');
  } catch {}
}

/* ---------------------------------------------------------------- wiring */

function attach(wc) {
  if (!wc || guests.has(wc.id)) return;
  guests.set(wc.id, wc);

  const dbg = wc.debugger;
  if (!wired.has(dbg)) {
    wired.add(dbg);
    dbg.on('message', (_e, method, params) => onMessage(wc, method, params));
    dbg.on('detach', () => {
      // DevTools opened/closed; re-enable on the next navigation
      try { send('fathi:intercept:state', state()); } catch {}
    });
  }

  const kick = () => { if (enabled) enableOn(wc).catch(() => {}); };
  kick();
  wc.once('dom-ready', kick);

  wc.once('destroyed', () => {
    guests.delete(wc.id);
    for (const rec of Array.from(paused.values())) {
      if (rec.wcId === wc.id) paused.delete(rec.id);
    }
    send('fathi:intercept:state', state());
  });
}

async function onMessage(wc, method, params) {
  if (method !== 'Fetch.requestPaused') return;
  const { requestId, request, resourceType } = params || {};
  if (!requestId || !request) return;

  const rec = {
    id: requestId,
    wcId: wc.id,
    method: request.method || 'GET',
    url: request.url || '',
    resourceType: resourceType || 'Other',
    headers: request.headers || {},
    postData: request.postData || '',
    at: Date.now()
  };

  if (!enabled || !isWebUrl(rec.url) || !matchesFilter(rec.url)) {
    try { await wc.debugger.sendCommand('Fetch.continueRequest', { requestId }); } catch {}
    return;
  }

  paused.set(requestId, { ...rec, wc });
  send('fathi:intercept:paused', rec);
  send('fathi:intercept:state', state());
}

/* ------------------------------------------------------------- operations */

async function resolve({ id, action = 'continue', url, method, headers, postData } = {}) {
  const rec = paused.get(id);
  if (!rec) return { ok: false, error: 'request is no longer paused' };
  paused.delete(id);

  try {
    if (action === 'drop') {
      await rec.wc.debugger.sendCommand('Fetch.failRequest', { requestId: id, errorReason: 'Aborted' });
    } else {
      const params = { requestId: id };
      if (url && url !== rec.url) params.url = String(url);
      if (method && method !== rec.method) params.method = String(method).toUpperCase();
      if (Array.isArray(headers) && headers.length) params.headers = headers;
      const useMethod = params.method || rec.method;
      if (typeof postData === 'string' && postData !== rec.postData && !/^(GET|HEAD)$/i.test(useMethod)) {
        params.postData = Buffer.from(postData, 'utf8').toString('base64');
      }
      await rec.wc.debugger.sendCommand('Fetch.continueRequest', params);
    }
  } catch (e) {
    send('fathi:intercept:state', state());
    return { ok: false, error: String(e && e.message || e) };
  }

  send('fathi:intercept:resolved', { id });
  send('fathi:intercept:state', state());
  return { ok: true };
}

async function drain() {
  const all = Array.from(paused.values());
  paused.clear();
  for (const rec of all) await continueRaw(rec);
  send('fathi:intercept:state', state());
  return { ok: true, forwarded: all.length };
}

async function setEnabled(on) {
  enabled = !!on;
  settings.save({ intercept: { enabled } });

  for (const wc of guests.values()) {
    if (enabled) await enableOn(wc);
    else await disableOn(wc);
  }

  send('fathi:intercept:state', state());
  if (win && !win.isDestroyed()) win.webContents.send('fathi:settings:changed', settings.get());
  return state();
}

function setFilter(filter) {
  settings.save({ intercept: { filter: String(filter || '') } });
  send('fathi:intercept:state', state());
  return state();
}

module.exports = { init, attach, resolve, drain, setEnabled, setFilter, state };

'use strict';
/**
 * Fathi interceptor. Pause web requests and let the UI edit, forward, drop or
 * repeat them before they leave the tab.
 *
 * Implemented with the Chrome DevTools Protocol "Fetch" domain on each tab's
 * guest WebContents, so it works together with the Burp proxy: Fathi pauses
 * first, then the request goes on to Burp exactly as edited.
 *
 * Rules:
 *  - Nothing may stay paused forever. A stuck pause freezes the whole tab, so
 *    every paused request carries a deadline and is auto-forwarded.
 *  - Response inspection reuses the flow recorder (network.js) instead of a
 *    second debugger client, which would fight with DevTools.
 */
const settings = require('./settings');
const rewrite = require('./rewrite');

const AUTO_FORWARD_MS = 120000;   // paused request lifetime
const MAX_PAUSED = 80;            // hard stop on unbounded pause growth

let win = null;
let enabled = false;

const guests = new Map();       // wcId -> webContents
const paused = new Map();       // requestId -> record
const wired = new WeakSet();    // debugger objects with listeners
const enabling = new Set();     // wcIds with an enable in flight

/* ---------------------------------------------------------------- helpers */

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

function isWebUrl(url) {
  return !/^(fathi|chrome-extension|devtools|data|blob|about|chrome|javascript):/i.test(String(url || ''));
}

function matchesFilter(url) {
  const filter = String((settings.get().intercept || {}).filter || '').trim().toLowerCase();
  if (!filter) return true;
  const u = String(url || '').toLowerCase();
  return filter.split(/\s+/).some((part) => part && u.includes(part));
}

/** Match and Replace on the request headers and body of a paused request. */
function applyRules(rec) {
  const rules = settings.get().matchReplace || [];
  if (!rules.length) return { headers: rec.headers, postData: rec.postData };
  const hdr = rewrite.applyHeaders(rec.headers || {}, rules, 'requestHeader');
  const body = rewrite.applyBody(rec.postData || '', rules, 'requestBody');
  return {
    headers: hdr.headers,
    postData: body.changed ? body.body : rec.postData
  };
}

/* ------------------------------------------------------------ debugger ops */

async function continueRaw(rec) {
  try { await rec.wc.debugger.sendCommand('Fetch.continueRequest', { requestId: rec.id }); } catch {}
}

/* --------------------------------------------------------------- enable */

async function enableOn(wc) {
  if (!wc || wc.isDestroyed() || enabling.has(wc.id)) return;
  enabling.add(wc.id);
  try {
    const dbg = wc.debugger;
    if (!dbg.isAttached()) dbg.attach('1.3');
    const patterns = [{ urlPattern: '*', requestStage: 'Request' }];
    // Response bodies are only worth the round trip while the UI can show them.
    patterns.push({ urlPattern: '*', requestStage: 'Response' });
    await dbg.sendCommand('Fetch.enable', { patterns });
  } catch (e) {
    // Another debugger (DevTools) may be attached; retry on the next load.
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
      // DevTools took the debugger; every pause it owned is gone with it.
      for (const rec of Array.from(paused.values())) {
        if (rec.wcId === wc.id) paused.delete(rec.id);
      }
      send('fathi:intercept:state', state());
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

/* --------------------------------------------------------------- capture */

function emitPaused(rec) {
  paused.set(rec.id, { ...rec, wc: rec.wc });
  send('fathi:intercept:paused', publicRecord(rec));
  send('fathi:intercept:state', state());
}

function publicRecord(rec) {
  return {
    id: rec.id,
    wcId: rec.wcId,
    method: rec.method,
    url: rec.url,
    resourceType: rec.resourceType,
    headers: rec.headers || {},
    postData: rec.postData || '',
    at: rec.at,
    stage: rec.stage || 'request',
    hasResponse: !!rec.hasResponse
  };
}

async function onMessage(wc, method, params) {
  if (method === 'Fetch.requestPaused') return onRequestPaused(wc, params);
  if (method === 'Fetch.responsePaused') return onResponsePaused(wc, params);
}

async function onRequestPaused(wc, params) {
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
    at: Date.now(),
    stage: 'request',
    wc
  };

  if (!enabled || !isWebUrl(rec.url) || !matchesFilter(rec.url)) {
    try { await wc.debugger.sendCommand('Fetch.continueRequest', { requestId }); } catch {}
    return;
  }

  if (paused.size >= MAX_PAUSED) {
    // Refuse to pile up. Reading the list is still possible while paused.
    try { await wc.debugger.sendCommand('Fetch.continueRequest', { requestId }); } catch {}
    return;
  }

  const rewritten = applyRules(rec);
  rec.headers = rewritten.headers;
  rec.postData = rewritten.postData;
  rec.deadline = Date.now() + AUTO_FORWARD_MS;
  emitPaused(rec);
}

async function onResponsePaused(wc, params) {
  const { requestId } = params || {};
  const rec = requestId ? paused.get(requestId) : null;
  // Only keep a response pause alive when the UI is actually inspecting it.
  if (!rec || !rec.watchResponse) {
    try { await wc.debugger.sendCommand('Fetch.continueResponse', { requestId }); } catch {}
    return;
  }
  rec.hasResponse = true;
  rec.responseHeaders = params.responseHeaders || {};
  rec.responseStatusCode = params.responseStatusCode || 0;
  send('fathi:intercept:paused', publicRecord(rec));
}

/* ------------------------------------------------------------- operations */

/**
 * Send one request through a clean tab session and return the response.
 * Used by the Repeat action: same URL, method and headers, body as edited.
 * Runs on a throwaway in-memory session so it inherits proxy and cert trust
 * without touching the tab that originated the request.
 */
async function sendRequest({ url, method = 'GET', headers = {}, postData = '', partition = '' } = {}) {
  if (!url) return { ok: false, error: 'missing url' };
  const { net, session } = require('electron');
  const started = Date.now();

  let ses = null;
  try {
    ses = partition ? session.fromPartition(partition) : session.fromPartition('fathi-repeat-' + Date.now().toString(36));
  } catch {}

  try {
    const res = await new Promise((resolvePromise, rejectPromise) => {
      const req = ses
        ? net.request({ session: ses, method: String(method || 'GET').toUpperCase(), url, redirect: 'follow' })
        : net.request({ method: String(method || 'GET').toUpperCase(), url, redirect: 'follow' });

      for (const [name, value] of Object.entries(headers || {})) {
        try { req.setHeader(String(name), String(value)); } catch {}
      }

      const done = (payload) => resolvePromise(payload);
      req.on('response', (response) => {
        const chunks = [];
        let bytes = 0;
        const mime = String(response.headers['content-type'] || '');
        response.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes <= 512 * 1024) chunks.push(chunk);
        });
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          done({
            status: response.statusCode,
            statusText: response.statusMessage || '',
            headers: response.headers || {},
            mimeType: mime,
            body,
            truncated: bytes > 512 * 1024,
            size: bytes,
            time: Date.now() - started
          });
        });
        response.on('error', (e) => rejectPromise(e));
      });
      req.on('error', (e) => rejectPromise(e));

      if (postData && !/^(GET|HEAD)$/i.test(method)) req.write(String(postData));
      req.end();
    });

    return { ok: true, response: res };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

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
      if (rec.stage === 'response') {
        await rec.wc.debugger.sendCommand('Fetch.continueResponse', { requestId: id });
      } else {
        await rec.wc.debugger.sendCommand('Fetch.continueRequest', params);
      }
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
  for (const rec of all) {
    if (rec.stage === 'response') {
      try { await rec.wc.debugger.sendCommand('Fetch.continueResponse', { requestId: rec.id }); } catch {}
    } else {
      await continueRaw(rec);
    }
  }
  send('fathi:intercept:state', state());
  return { ok: true, forwarded: all.length };
}

/* -------------------------------------------------------------- lifecycle */

/** Auto-forward anything the user left sitting for too long. */
setInterval(() => {
  const now = Date.now();
  for (const rec of Array.from(paused.values())) {
    if (rec.deadline && now > rec.deadline) {
      paused.delete(rec.id);
      if (rec.stage === 'response') {
        try { rec.wc.debugger.sendCommand('Fetch.continueResponse', { requestId: rec.id }); } catch {}
      } else {
        continueRaw(rec);
      }
    }
  }
}, 5000).unref?.();

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

module.exports = { init, attach, resolve, drain, setEnabled, setFilter, state, sendRequest };

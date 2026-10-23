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
}

function isInternal(url) {
  return /^(fathi|devtools):/i.test(String(url || ''));
}

async function enableOn(wc) {
  if (!wc || wc.isDestroyed() || isDevtoolsOpen(wc) || enabling.has(wc.id)) return;
  enabling.add(wc.id);
  try {
    const dbg = wc.debugger;
    if (!dbg.isAttached()) dbg.attach('1.3');
    await dbg.sendCommand('Network.enable', {
      maxTotalBufferSize: 64 * 1024 * 1024,
      maxResourceBufferSize: 8 * 1024 * 1024,
      maxPostDataSize: 128 * 1024
    });
  } catch {
    // DevTools or another target owns the debugger; retry on the next load.
  } finally {
    enabling.delete(wc.id);
  }
}

function isDevtoolsOpen(wc) {
  try { return wc.isDevToolsOpened && wc.isDevToolsOpened(); } catch { return false; }
}

function attach(wc) {
  if (!wc || tabs.has(wc.id)) return;
  tabFor(wc);

  const dbg = wc.debugger;
  if (!wired.has(dbg)) {
    wired.add(dbg);
    dbg.on('message', (_e, method, params) => onMessage(wc, method, params));
    dbg.on('detach', () => {
      try { send('fathi:net:batch', { wcId: wc.id, records: listSummaries(wc.id), stats: stats(wc.id) }); } catch {}
    });
  }

  const kick = () => { enableOn(wc).catch(() => {}); };
  kick();
  wc.once('dom-ready', kick);
  wc.on('did-navigate', kick);
  wc.on('devtools-closed', kick);

  wc.once('destroyed', () => {
    tabs.delete(wc.id);
    scheduleFlush();
  });
}

/* --------------------------------------------------------------- capture */

async function onMessage(wc, method, params) {
  if (method === 'Network.requestWillBeSent') {
    onRequest(wc, params);
    return;
  }
  if (method === 'Network.responseReceived') {
    const t = tabs.get(wc.id);
    const rec = t && t.reqs.get(params.requestId);
    if (!rec) return;
    t.dirty = true;
    const r = params.response || {};
    rec.status = r.status;
    rec.statusText = r.statusText || '';
    rec.mimeType = r.mimeType || '';
    rec.responseHeaders = { ...(r.headers || {}) };
    rec.remoteIPAddress = r.remoteIPAddress || '';
    rec.remotePort = r.remotePort || 0;
    rec.fromCache = !!r.fromDiskCache;
    rec.fromServiceWorker = !!r.fromServiceWorker;
    rec.protocol = r.protocol || '';
    rec.timingRaw = r.timing || null;
    rec.timing = buildTiming(r.timing, rec);
    scheduleFlush();
    return;
  }
  if (method === 'Network.responseReceivedExtraInfo') {
    const t = tabs.get(wc.id);
    const rec = t && t.reqs.get(params.requestId);
    if (rec) {
      t.dirty = true;
      rec.extraResponseHeaders = rec.extraResponseHeaders || {};
      for (const [k, v] of Object.entries(params.headers || {})) {
        if (!(k in rec.extraResponseHeaders)) rec.extraResponseHeaders[k] = v;
      }
      rec.status = params.statusCode || rec.status;
    }
    return;
  }
  if (method === 'Network.loadingFinished') {
    const t = tabs.get(wc.id);
    const rec = t && t.reqs.get(params.requestId);
    if (!rec || rec.done) return;
    rec.done = true;
    t.dirty = true;
    rec.finishedAt = Date.now();
    rec.encodedSize = params.encodedDataLength || rec.encodedSize || 0;
    rec.size = rec.encodedSize || headerSize(rec.responseHeaders) || 0;
    rec.timing = rec.timing || emptyTiming();
    if (rec.monoStart > 0 && params.timestamp > 0) {
      rec.timing.total = Math.max(0, Math.round((params.timestamp - rec.monoStart) * 1000));
    }
    const overhead = ['dns', 'connect', 'ssl', 'send', 'wait', 'blocked']
      .reduce((n, k) => n + (rec.timing[k] > 0 ? rec.timing[k] : 0), 0);
    rec.timing.receive = Math.max(0, Math.round(rec.timing.total - overhead));
    scheduleFlush();
    return;
  }
  if (method === 'Network.loadingFailed') {
    const t = tabs.get(wc.id);
    const rec = t && t.reqs.get(params.requestId);
    if (!rec) return;
    rec.done = true;
    rec.failed = true;
    t.dirty = true;
    rec.errorText = params.errorText || 'failed';
    rec.finishedAt = Date.now();
    rec.timing = rec.timing || emptyTiming();
    rec.timing.total = Math.round((rec.finishedAt - rec.startedAt));
    scheduleFlush();
  }
}

function onRequest(wc, params) {
  const t = tabFor(wc);
  const r = params.request || {};
  if (isInternal(r.url)) return;

  // A new request on an id that already exists is a redirect: close the old one.
  const prev = t.reqs.get(params.requestId);
  if (prev) {
    prev.done = true;
    if (params.redirectResponse) {
      prev.status = params.redirectResponse.status;
      prev.statusText = params.redirectResponse.statusText || '';
      prev.responseHeaders = { ...(params.redirectResponse.headers || {}) };
      prev.mimeType = params.redirectResponse.mimeType || '';
      prev.redirectURL = r.url || '';
      prev.timing = buildTiming(params.redirectResponse.timing, prev);
      prev.size = prev.size || 0;
    }
    t.reqs.delete(params.requestId);
  }

  const meta = safeMeta(wc) || {};
  const rec = {
    id: 'n' + (++seq),
    requestId: params.requestId,
    wcId: wc.id,
    partition: meta.partition || '',
    fpId: meta.fpId || '',
    url: r.url || '',
    method: r.method || 'GET',
    resourceType: params.type || 'Other',
    startedAt: Math.round((params.wallTime || Date.now() / 1000) * 1000),
    monoStart: params.timestamp || 0,
    requestHeaders: { ...(r.headers || {}) },
    postData: r.postData || '',
    hasPostData: !!r.hasPostData,
    initiator: (params.initiator && params.initiator.type) || '',
    status: 0,
    statusText: '',
    mimeType: '',
    responseHeaders: {},
    extraResponseHeaders: null,
    timing: null,
    size: 0,
    encodedSize: 0,
    body: null,
    bodyTruncated: false,
    failed: false,
    errorText: '',
    done: false,
    fromCache: false,
    fromServiceWorker: false,
    remoteIPAddress: '',
    remotePort: 0,
    protocol: '',
    redirectURL: ''
  };

  t.reqs.set(params.requestId, rec);
  t.order.push(rec.id);
  t.dirty = true;

  total += 1;
  trimTab(t);
  trimTotal();
  scheduleFlush();
}

function trimTab(t) {
  while (t.order.length > MAX_PER_TAB) {
    const id = t.order.shift();
    for (const [rid, rec] of t.reqs) {
      if (rec.id === id) { t.reqs.delete(rid); break; }
    }
  }
}

function trimTotal() {
  while (total > MAX_TOTAL) {
    let oldest = null;
    let oldestTab = null;
    for (const t of tabs.values()) {
      if (!t.order.length) continue;
      const id = t.order[0];
      let rec = null;
      for (const r of t.reqs.values()) if (r.id === id) { rec = r; break; }
      if (rec && (!oldest || rec.startedAt < oldest.startedAt)) {
        oldest = rec;
        oldestTab = t;
      }
    }
    if (!oldest) break;
    oldestTab.reqs.delete(oldest.requestId);
    oldestTab.order.shift();
    total -= 1;
  }
}

async function fetchBody() {
  // Superseded by ensureBody(), which runs on demand from detail().
}

/* --------------------------------------------------------------- timings */

function emptyTiming() {
  return { dns: -1, connect: -1, ssl: -1, send: -1, wait: -1, receive: -1, blocked: -1, total: 0 };
}

function diff(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number' || a < 0 || b < 0) return -1;
  return Math.round((b - a) * 100) / 100;
}

function buildTiming(raw, rec) {
  const t = emptyTiming();
  if (!raw) {
    t.total = Math.max(0, Date.now() - (rec.startedAt || Date.now()));
    return t;
  }
  t.dns = diff(raw.dnsStart, raw.dnsEnd);
  t.connect = diff(raw.connectStart, raw.connectEnd);
  t.ssl = diff(raw.sslStart, raw.sslEnd);
  t.send = diff(raw.sendStart, raw.sendEnd);
  t.wait = diff(raw.sendEnd, raw.receiveHeadersEnd);
  t.blocked = 0;
  t.total = typeof raw.receiveHeadersEnd === 'number' && raw.receiveHeadersEnd > 0
    ? Math.round(raw.receiveHeadersEnd * 100) / 100
    : 0;
  return t;
}

/* --------------------------------------------------------------- helpers */

function safeMeta(wc) {
  try { return metaFor(wc) || null; } catch { return null; }
}

function headerSize(headers) {
  try {
    let n = 0;
    for (const [k, v] of Object.entries(headers || {})) n += k.length + String(v).length + 4;
    return n;
  } catch { return 0; }
}

function summary(rec) {
  return {
    id: rec.id,
    wcId: rec.wcId,
    url: rec.url,
    method: rec.method,
    resourceType: rec.resourceType,
    status: rec.status,
    statusText: rec.statusText,
    mimeType: rec.mimeType,
    startedAt: rec.startedAt,
    size: rec.size || rec.encodedSize || 0,
    time: rec.timing ? rec.timing.total : 0,
    failed: rec.failed,
    errorText: rec.errorText,
    fromCache: rec.fromCache,
    initiator: rec.initiator
  };
}

function collect(wcId, all) {
  const out = [];
  if (all) {
    for (const t of tabs.values()) for (const r of t.reqs.values()) out.push(r);
  } else if (wcId != null) {
    const t = tabs.get(wcId);
    if (t) for (const r of t.reqs.values()) out.push(r);
  }
  out.sort((a, b) => a.startedAt - b.startedAt);
  return out;
}

function listSummaries(wcId, all) {
  return collect(wcId, all).map(summary);
}

function stats(wcId, all) {
  const recs = collect(wcId, all);
  let bytes = 0;
  let failed = 0;
  let ms = 0;
  const domains = new Map();
  const slow = [];
  const statuses = { s2: 0, s3: 0, s4: 0, s5: 0 };
  for (const r of recs) {
    bytes += r.size || 0;
    if (r.failed) failed += 1;
    if (r.timing && r.timing.total > 0) ms += r.timing.total;
    if (r.status >= 200 && r.status < 300) statuses.s2 += 1;
    else if (r.status >= 300 && r.status < 400) statuses.s3 += 1;
    else if (r.status >= 400 && r.status < 500) statuses.s4 += 1;
    else if (r.status >= 500) statuses.s5 += 1;
    let host = '';
    try { host = new URL(r.url).hostname; } catch {}
    if (host) {
      const d = domains.get(host) || { host, count: 0, bytes: 0 };
      d.count += 1;
      d.bytes += r.size || 0;
      domains.set(host, d);
    }
    if (r.timing && r.timing.total > 0) slow.push({ url: r.url, ms: Math.round(r.timing.total), status: r.status });
  }
  slow.sort((a, b) => b.ms - a.ms);
  return {
    count: recs.length,
    bytes,
    failed,
    avgMs: recs.length ? Math.round(ms / recs.length) : 0,
    statuses,
    slowest: slow.slice(0, 6),
    domains: Array.from(domains.values()).sort((a, b) => b.bytes - a.bytes).slice(0, 8)
  };
}

/* ----------------------------------------------------------------- export */

/* Only records the renderer has not seen yet are pushed, and the body is no
   longer fetched automatically. Both changes matter: the old flush serialised
   up to 400 summaries per tab every 220 ms during a page load, which was the
   single largest source of UI stalls. Bodies are fetched on demand from
   detail(). */

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    for (const t of tabs.values()) {
      if (!t.dirty) continue;
      t.dirty = false;
      const fresh = [];
      for (const rec of t.reqs.values()) {
        if (rec.sent) continue;
        rec.sent = true;
        fresh.push(summary(rec));
      }
      if (!fresh.length) continue;
      send('fathi:net:batch', {
        wcId: t.wc.id,
        records: fresh,
        total: t.reqs.size
      });
    }
  }, 260);
}

/** Fetch a response body the first time someone actually looks at it. */
async function ensureBody(wcId, rec) {
  if (!rec || rec.done === false) return false;
  if (rec.body != null || rec.bodyFailed) return true;
  const wc = (tabs.get(wcId) || {}).wc;
  if (!wc || wc.isDestroyed() || !wc.debugger.isAttached()) return false;
  const mime = String(rec.mimeType || '').toLowerCase();
  if (/^(image|audio|video|font)\//.test(mime)) { rec.bodyFailed = true; return false; }
  if (/octet-stream|zip|pdf|protobuf/.test(mime)) { rec.bodyFailed = true; return false; }
  const size = rec.size || rec.encodedSize || 0;
  if (size > 2 * 1024 * 1024) { rec.bodyFailed = true; return false; }
  try {
    const res = await wc.debugger.sendCommand('Network.getResponseBody', { requestId: rec.requestId });
    if (!res) { rec.bodyFailed = true; return false; }
    let text = res.base64Encoded
      ? Buffer.from(res.body || '', 'base64').toString('utf8')
      : String(res.body || '');
    if (text.length > MAX_BODY) {
      text = text.slice(0, MAX_BODY);
      rec.bodyTruncated = true;
    }
    rec.body = text;
    if (!rec.size) rec.size = Buffer.byteLength(text);
    return true;
  } catch {
    rec.bodyFailed = true;
    return false;
  }
}

function queryString(url) {
  try {
    const u = new URL(url);
    return Array.from(u.searchParams.entries()).map(([name, value]) => ({ name, value }));
  } catch { return []; }
}

function httpVersion(rec) {
  return rec.protocol ? rec.protocol.replace('http/', 'HTTP/') : 'HTTP/1.1';
}

function toHarRequest(rec) {
  const headers = Object.entries(rec.requestHeaders || {}).map(([name, value]) => ({ name, value: String(value) }));
  const qs = queryString(rec.url);
  const cookies = [];
  if (rec.requestHeaders && rec.requestHeaders.cookie) {
    for (const part of String(rec.requestHeaders.cookie).split(';')) {
      const i = part.indexOf('=');
      if (i > 0) cookies.push({ name: part.slice(0, i).trim(), value: part.slice(i + 1).trim() });
    }
  }
  const req = {
    method: rec.method,
    url: rec.url,
    httpVersion: httpVersion(rec),
    cookies,
    headers,
    queryString: qs,
    headersSize: headerSize(rec.requestHeaders),
    bodySize: rec.postData ? Buffer.byteLength(rec.postData) : 0
  };
  if (rec.postData) {
    req.postData = { mimeType: (rec.requestHeaders && rec.requestHeaders['content-type']) || '', text: rec.postData };
  }
  return req;
}

function toHarResponse(rec) {
  const headers = Object.entries(rec.extraResponseHeaders || rec.responseHeaders || {})
    .map(([name, value]) => ({ name, value: String(value) }));
  const cookies = [];
  const bodySize = rec.body ? Buffer.byteLength(rec.body) : (rec.size || 0);
  return {
    status: rec.status || 0,
    statusText: rec.statusText || '',
    httpVersion: httpVersion(rec),
    cookies,
    headers,
    content: {
      size: bodySize,
      mimeType: rec.mimeType || 'application/octet-stream',
      text: rec.body != null ? rec.body : ''
    },
    redirectURL: rec.redirectURL || '',
    headersSize: headerSize(rec.responseHeaders),
    bodySize
  };
}

function har(opts = {}) {
  const recs = collect(opts.wcId, !!opts.all);
  const entries = recs.map((rec) => {
    const t = rec.timing || emptyTiming();
    return {
      startedDateTime: new Date(rec.startedAt).toISOString(),
      time: Math.max(0, Math.round(t.total || 0)),
      request: toHarRequest(rec),
      response: toHarResponse(rec),
      cache: {},
      timings: {
        blocked: t.blocked,
        dns: t.dns,
        connect: t.connect,
        ssl: t.ssl,
        send: t.send,
        wait: t.wait,
        receive: t.receive
      },
      serverIPAddress: rec.remoteIPAddress || '',
      connection: rec.remotePort ? String(rec.remotePort) : '',
      _resourceType: rec.resourceType,
      _failed: rec.failed || undefined,
      _error: rec.errorText || undefined,
      _tab: rec.fpId || rec.partition || ''
    };
  });
  return {
    log: {
      version: '1.2',
      creator: { name: 'Fathi', version: '1.0', comment: 'Private browser flow export' },
      pages: [],
      entries
    }
  };
}

function xmlEscape(value, attr) {
  let s = String(value == null ? '' : value);
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (attr) s = s.replace(/"/g, '&quot;');
  return s;
}

function cdata(value) {
  return '<![CDATA[' + String(value == null ? '' : value).replace(/]]>/g, ']]]]><![CDATA[>') + ']]>';
}

function xml(opts = {}) {
  const recs = collect(opts.wcId, !!opts.all);
  const out = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(`<fathi-session exportedAt="${new Date().toISOString()}" count="${recs.length}" version="1.0">`);
  for (const rec of recs) {
    const t = rec.timing || emptyTiming();
    out.push(`  <request id="${xmlEscape(rec.id, true)}" method="${xmlEscape(rec.method, true)}" url="${xmlEscape(rec.url, true)}" status="${rec.status || 0}" type="${xmlEscape(rec.resourceType, true)}" mime="${xmlEscape(rec.mimeType, true)}" startedAt="${new Date(rec.startedAt).toISOString()}" timeMs="${Math.max(0, Math.round(t.total || 0))}" size="${rec.size || 0}" ip="${xmlEscape(rec.remoteIPAddress, true)}" failed="${rec.failed ? 'true' : 'false'}">`);
    out.push('    <requestHeaders>');
    for (const [name, value] of Object.entries(rec.requestHeaders || {})) {
      out.push(`      <header name="${xmlEscape(name, true)}">${xmlEscape(value)}</header>`);
    }
    out.push('    </requestHeaders>');
    if (rec.postData) out.push(`    <requestBody encoding="utf-8">${cdata(rec.postData)}</requestBody>`);
    out.push('    <responseHeaders>');
    for (const [name, value] of Object.entries(rec.extraResponseHeaders || rec.responseHeaders || {})) {
      out.push(`      <header name="${xmlEscape(name, true)}">${xmlEscape(value)}</header>`);
    }
    out.push('    </responseHeaders>');
    if (rec.body != null) {
      out.push(`    <responseBody encoding="utf-8" truncated="${rec.bodyTruncated ? 'true' : 'false'}">${cdata(rec.body)}</responseBody>`);
    }
    out.push(`    <timing dns="${t.dns}" connect="${t.connect}" ssl="${t.ssl}" send="${t.send}" wait="${t.wait}" receive="${t.receive}" total="${t.total}" />`);
    if (rec.errorText) out.push(`    <error>${xmlEscape(rec.errorText)}</error>`);
    out.push('  </request>');
  }
  out.push('</fathi-session>');
  return out.join('\n');
}

function csv(opts = {}) {
  const recs = collect(opts.wcId, !!opts.all);
  const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = [['startedAt', 'method', 'url', 'status', 'type', 'mime', 'size', 'timeMs', 'dns', 'connect', 'ssl', 'send', 'wait', 'failed', 'error'].join(',')];
  for (const r of recs) {
    const t = r.timing || emptyTiming();
    rows.push([
      new Date(r.startedAt).toISOString(),
      esc(r.method), esc(r.url), r.status || 0, esc(r.resourceType), esc(r.mimeType),
      r.size || 0, Math.round(t.total || 0), t.dns, t.connect, t.ssl, t.send, t.wait,
      r.failed ? 1 : 0, esc(r.errorText)
    ].join(','));
  }
  return rows.join('\r\n');
}

const FORMATS = {
  har: { ext: 'har', name: 'HTTP Archive', mime: 'application/json' },
  json: { ext: 'json', name: 'JSON', mime: 'application/json' },
  xml: { ext: 'xml', name: 'XML', mime: 'application/xml' },
  csv: { ext: 'csv', name: 'CSV', mime: 'text/csv' }
};

function serialize(format, opts) {
  switch (format) {
    case 'xml': return xml(opts);
    case 'csv': return csv(opts);
    case 'json':
      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        count: collect(opts.wcId, !!opts.all).length,
        requests: collect(opts.wcId, !!opts.all)
      }, null, 2);
    case 'har':
    default:
      return JSON.stringify(har(opts), null, 2);
  }
}

async function save(opts = {}) {
  const format = FORMATS[opts.format] ? opts.format : 'har';
  const info = FORMATS[format];
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const base = opts.all ? 'fathi-flow-all' : 'fathi-flow';
  const defaultPath = path.join(process.env.USERPROFILE || process.env.HOME || '.', `${base}-${stamp}.${info.ext}`);

  const res = await dialog.showSaveDialog(win, {
    title: 'Save flow',
    defaultPath,
    filters: [
      { name: info.name, extensions: [info.ext] },
      { name: 'All files', extensions: ['*'] }
    ]
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };

  const content = serialize(format, opts);
  await fs.promises.writeFile(res.filePath, content, 'utf8');
  return { ok: true, path: res.filePath, bytes: Buffer.byteLength(content), format };
}

async function detail({ wcId, id } = {}) {
  const t = tabs.get(wcId);
  if (!t) return null;
  for (const rec of t.reqs.values()) {
    if (rec.id !== id) continue;
    await ensureBody(wcId, rec);
    return full(rec);
  }
  return null;
}

function full(rec) {
  return {
    ...summary(rec),
    requestHeaders: rec.requestHeaders || {},
    responseHeaders: rec.extraResponseHeaders || rec.responseHeaders || {},
    postData: rec.postData || '',
    body: rec.body,
    bodyTruncated: !!rec.bodyTruncated,
    timing: rec.timing || emptyTiming(),
    remoteIPAddress: rec.remoteIPAddress || '',
    remotePort: rec.remotePort || 0,
    protocol: rec.protocol || '',
    fromCache: !!rec.fromCache,
    fromServiceWorker: !!rec.fromServiceWorker,
    redirectURL: rec.redirectURL || '',
    done: !!rec.done
  };
}

function clear({ wcId, all } = {}) {
  if (all) {
    total -= Array.from(tabs.values()).reduce((n, t) => n + t.reqs.size, 0);
    for (const t of tabs.values()) { t.reqs.clear(); t.order = []; }
  } else if (wcId != null) {
    const t = tabs.get(wcId);
    if (t) { total -= t.reqs.size; t.reqs.clear(); t.order = []; }
  }
  if (total < 0) total = 0;
  for (const t of tabs.values()) t.dirty = true;
  scheduleFlush();
  return { ok: true };
}

function hasRequests(wcId) {
  const t = tabs.get(wcId);
  return !!(t && t.reqs.size);
}

module.exports = {
  init, attach, listSummaries, stats, har, xml, csv, serialize, save,
  detail, clear, hasRequests
};

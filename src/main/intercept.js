'use strict';
/** Shared Fetch client for explicit interception and bounded body rules.
 * Header rules belong to session.webRequest and must not be applied twice. */
const settings = require('./settings');
const scope = require('./research-scope');
const executor = require('./rule-executor');
const MAX_BODY = 65536;
const AUTO_FORWARD_MS = 120000;
const MAX_PAUSED = 80;
let win = null;
let enabled = false;
const guests = new Map();
const paused = new Map();
const configuring = new Map();

function send(channel, payload) {
  if (win && !win.isDestroyed()) { try { win.webContents.send(channel, payload); } catch {} }
}
function state() { return { enabled, paused: paused.size, ids: [...paused.keys()], attached: guests.size, filter: settings.get().intercept?.filter || '' }; }
function init(window) { win = window; enabled = !!settings.get().intercept?.enabled; }
executor.events.on('failure', error);
function rules(target) { return (settings.get().matchReplace || []).filter((rule) => rule.enabled !== false && rule.match && rule.target === target); }
function isWeb(url) { return /^https?:\/\//i.test(String(url)); }
function matches(url) {
  const filter = String(settings.get().intercept?.filter || '').trim().toLowerCase();
  return (!filter || filter.split(/\s+/).some((part) => url.toLowerCase().includes(part))) && scope.allows(url);
}
function error(error) { send('fathi:rules:error', { message: String(error.message || error) }); }
async function rewriteBody(payload, target) {
  const list = rules(target);
  if (!list.length) return { output: payload, changed: false };
  if (Buffer.byteLength(payload) > MAX_BODY) { error(new Error('Body exceeds 64 KiB; rules skipped')); return { output: payload, changed: false }; }
  try { return await executor.apply({ payload, rules: list, target }); }
  catch (reason) { error(reason); return { output: payload, changed: false }; }
}
function publicRecord(rec) {
  return { id: rec.id, wcId: rec.wcId, method: rec.method, url: rec.url, resourceType: rec.resourceType, headers: rec.headers, postData: rec.postData, at: rec.at, stage: 'request', hasResponse: false };
}
function resolved(id) { paused.delete(id); send('fathi:intercept:resolved', { id }); send('fathi:intercept:state', state()); }
function continuation(rec, edits = {}) {
  const params = { requestId: rec.rawId };
  if (edits.url && edits.url !== rec.url) params.url = String(edits.url);
  if (edits.method) params.method = String(edits.method).toUpperCase();
  const method = params.method || rec.method;
  const body = typeof edits.postData === 'string' ? edits.postData : rec.postData;
  const bodyChanged = body !== rec.originalPostData && !/^(GET|HEAD)$/i.test(method);
  if (bodyChanged) params.postData = Buffer.from(body, 'utf8').toString('base64');
  if (Array.isArray(edits.headers)) params.headers = edits.headers;
  else if (bodyChanged) params.headers = Object.entries(rec.headers).map(([name, value]) => ({ name, value: String(value) }));
  if (bodyChanged && params.headers) params.headers = params.headers.filter((header) => !/^(content-length|transfer-encoding)$/i.test(header.name));
  return params;
}
async function resolve({ id, action = 'continue', ...edits } = {}) {
  const rec = paused.get(id);
  if (!rec) return { ok: false, error: 'Request is no longer paused' };
  try {
    if (action === 'drop') await rec.wc.debugger.sendCommand('Fetch.failRequest', { requestId: rec.rawId, errorReason: 'Aborted' });
    else await rec.wc.debugger.sendCommand('Fetch.continueRequest', continuation(rec, edits));
    resolved(id); return { ok: true };
  } catch (reason) { return { ok: false, error: String(reason.message || reason) }; }
}
async function drain() {
  const ids = [...paused.keys()]; let forwarded = 0;
  for (const id of ids) if ((await resolve({ id })).ok) forwarded++;
  return { ok: true, forwarded };
}
async function configure(wc) {
  if (!wc || wc.isDestroyed()) return;
  if (configuring.has(wc.id)) await configuring.get(wc.id).catch(() => {});
  const job = (async () => {
    const patterns = [];
    if (enabled || rules('requestBody').length) patterns.push({ urlPattern: '*', requestStage: 'Request' });
    if (rules('responseBody').length) patterns.push({ urlPattern: '*', requestStage: 'Response' });
    if (!patterns.length) {
      for (const rec of [...paused.values()]) if (rec.wcId === wc.id) await resolve({ id: rec.id });
      if (wc.debugger.isAttached()) await wc.debugger.sendCommand('Fetch.disable');
      return;
    }
    if (!wc.debugger.isAttached()) wc.debugger.attach('1.3');
    await wc.debugger.sendCommand('Fetch.enable', { patterns });
  })();
  configuring.set(wc.id, job);
  try { await job; } finally { if (configuring.get(wc.id) === job) configuring.delete(wc.id); }
}
async function refresh() {
  await Promise.all([...guests.values()].map((wc) => configure(wc)));
}
async function response(wc, params) {
  const requestId = params.requestId;
  const headers = params.responseHeaders || [];
  const type = headers.find((header) => header.name.toLowerCase() === 'content-type')?.value || '';
  const length = Number(headers.find((header) => header.name.toLowerCase() === 'content-length')?.value || 0);
  const status = params.responseStatusCode;
  const text = /^(text\/|application\/(?:json|javascript|xml|x-www-form-urlencoded))|\+(?:json|xml)(?:;|$)/i.test(type);
  try {
    if (rules('responseBody').length && isWeb(params.request?.url) && text && status >= 200 && status < 300 && status !== 204 && status !== 206 && params.request?.method !== 'HEAD' && length <= MAX_BODY) {
      const body = await wc.debugger.sendCommand('Fetch.getResponseBody', { requestId });
      const payload = body.base64Encoded ? new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(body.body, 'base64')) : String(body.body || '');
      const result = await rewriteBody(payload, 'responseBody');
      if (result.changed) {
        const responseHeaders = headers.filter((header) => !/^(content-length|content-encoding|transfer-encoding|etag|content-md5|digest)$/i.test(header.name)).map((header) => header.name.toLowerCase() === 'content-type' ? { ...header, value: header.value.replace(/;\s*charset\s*=\s*["']?[^;"'\s]+["']?/i, '') + '; charset=utf-8' } : header);
        responseHeaders.push({ name: 'Content-Length', value: String(Buffer.byteLength(result.output)) });
        await wc.debugger.sendCommand('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders, body: Buffer.from(result.output).toString('base64') });
        return;
      }
    } else if (rules('responseBody').length && length > MAX_BODY) error(new Error('Response exceeds 64 KiB; body rules skipped'));
  } catch (reason) { error(reason); }
  try { await wc.debugger.sendCommand('Fetch.continueResponse', { requestId }); }
  catch { await wc.debugger.sendCommand('Fetch.continueRequest', { requestId }).catch(() => {}); }
}
async function request(wc, params) {
  if (params.responseStatusCode !== undefined || params.responseErrorReason) return response(wc, params);
  const input = params.request;
  if (!input || !params.requestId) return;
  const rec = { id: `${wc.id}:${params.requestId}`, rawId: params.requestId, wcId: wc.id, wc, url: input.url, method: input.method || 'GET', headers: input.headers || {}, postData: input.postData || '', originalPostData: input.postData || '', resourceType: params.resourceType || 'Other', at: Date.now(), deadline: Date.now() + AUTO_FORWARD_MS };
  if (isWeb(rec.url) && !/^(GET|HEAD)$/i.test(rec.method)) {
    if (input.hasPostData && typeof input.postData !== 'string' && rules('requestBody').length) error(new Error('Request body is not available as text; body rules skipped'));
    else rec.postData = (await rewriteBody(rec.postData, 'requestBody')).output;
  }
  if (!enabled || !isWeb(rec.url) || !matches(rec.url) || paused.size >= MAX_PAUSED) {
    await wc.debugger.sendCommand('Fetch.continueRequest', continuation(rec)); return;
  }
  paused.set(rec.id, rec); send('fathi:intercept:paused', publicRecord(rec)); send('fathi:intercept:state', state());
}
function attach(wc) {
  if (!wc || guests.has(wc.id)) return;
  guests.set(wc.id, wc);
  wc.debugger.on('message', (_event, method, params) => { if (method === 'Fetch.requestPaused') request(wc, params).catch(error); });
  const forget = () => { for (const rec of [...paused.values()]) if (rec.wcId === wc.id) resolved(rec.id); };
  wc.debugger.on('detach', forget);
  wc.once('destroyed', () => { forget(); guests.delete(wc.id); });
  const kick = () => configure(wc).catch(error);
  kick(); wc.once('dom-ready', kick); wc.on('devtools-closed', kick);
}
async function setEnabled(on) {
  enabled = !!on; settings.save({ intercept: { enabled } });
  if (!enabled) await drain();
  await refresh(); send('fathi:intercept:state', state());
  return state();
}
function setFilter(filter) { settings.save({ intercept: { filter: String(filter || '') } }); send('fathi:intercept:state', state()); return state(); }
setInterval(() => { for (const rec of paused.values()) if (Date.now() > rec.deadline) resolve({ id: rec.id }).catch(() => {}); }, 5000).unref?.();

async function sendRequest({ url, method = 'GET', headers = {}, postData = '', partition } = {}) {
  if (!isWeb(url) || !partition) return { ok: false, error: 'Repeat requires a known tab and an HTTP(S) URL' };
  const { net, session } = require('electron');
  const started = Date.now();
  const verb = String(method).toUpperCase();
  // The editor already contains request-body rule output. Repeat sends those
  // explicit edits as-is rather than applying non-idempotent rules twice.
  const payload = /^(GET|HEAD)$/.test(verb) ? '' : String(postData);
  try {
    const result = await new Promise((accept, reject) => {
      const req = net.request({ session: session.fromPartition(partition), useSessionCookies: true, method: verb, url, redirect: 'manual' });
      const timer = setTimeout(() => { req.abort(); reject(new Error('Repeat timed out after 15 seconds')); }, 15000);
      const done = (value) => { clearTimeout(timer); accept(value); };
      for (const [name, value] of Object.entries(headers)) if (!/^(content-length|transfer-encoding)$/i.test(name)) { try { req.setHeader(name, String(value)); } catch {} }
      req.on('redirect', (status, _method, target, responseHeaders) => { done({ status, statusText: 'Redirect not followed', headers: responseHeaders, redirectURL: target, body: '', time: Date.now() - started }); req.abort(); });
      req.on('error', (reason) => { clearTimeout(timer); reject(reason); });
      req.on('login', (auth, callback) => {
        if (!auth.isProxy) { callback(); return; }
        const entry = require('./proxy').entryFor(partition);
        callback(entry?.username || '', entry?.password || '');
      });
      req.on('response', (res) => {
        const chunks = []; let bytes = 0;
        const finish = () => done({ status: res.statusCode, statusText: res.statusMessage, headers: res.headers, mimeType: String(res.headers['content-type'] || ''), body: Buffer.concat(chunks).toString('utf8'), size: bytes, truncated: bytes > 512 * 1024, time: Date.now() - started });
        res.on('data', (chunk) => { bytes += chunk.length; if (bytes <= 512 * 1024) chunks.push(chunk); else { finish(); req.abort(); } });
        res.on('end', finish); res.on('error', (reason) => { clearTimeout(timer); reject(reason); });
      });
      if (payload) req.write(payload); req.end();
    });
    if (rules('responseBody').length && result.body) result.body = (await rewriteBody(result.body, 'responseBody')).output;
    return { ok: true, response: result };
  } catch (reason) { return { ok: false, error: String(reason.message || reason) }; }
}
module.exports = { init, attach, resolve, drain, setEnabled, setFilter, state, sendRequest, refresh, ready: configure };

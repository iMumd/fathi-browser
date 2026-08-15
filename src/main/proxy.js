'use strict';
/**
 * Proxy manager.
 *
 * One global pool (configurable in Settings) with two modes:
 *   single : every tab uses the first pool entry
 *   rotate : tabs are assigned pool entries round-robin
 *
 * Credentials are supplied through the session 'login' path so they are never
 * embedded in the proxy rules string.
 */
const { session, net } = require('electron');
const settings = require('./settings');

const assignments = new Map(); // partition -> entry|null
let rr = 0;

function parseEntry(raw) {
  if (!raw) return null;
  let str = String(raw).trim();
  if (!str) return null;
  if (!/^[a-z0-9+]+:\/\//i.test(str)) str = 'http://' + str;

  let u;
  try { u = new URL(str); } catch { return null; }

  const scheme = (u.protocol || 'http:').replace(':', '').toLowerCase();
  const host = u.hostname;
  const port = u.port || (scheme === 'socks5' || scheme === 'socks4' ? '1080' : '8080');
  if (!host) return null;

  const prefix = scheme === 'socks5' || scheme === 'socks4' ? scheme : 'http';
  return {
    raw: str,
    scheme,
    host,
    port,
    username: u.username ? decodeURIComponent(u.username) : '',
    password: u.password ? decodeURIComponent(u.password) : '',
    rules: `${prefix}://${host}:${port}`
  };
}

function pool() {
  const cfg = settings.get().proxy;
  return (cfg.pool || []).map(parseEntry).filter(Boolean);
}

function assign(partition) {
  const cfg = settings.get().proxy;
  const list = pool();
  if (!cfg.enabled || !list.length) {
    assignments.set(partition, null);
    return null;
  }
  const entry = cfg.mode === 'rotate' ? list[rr++ % list.length] : list[0];
  assignments.set(partition, entry);
  return entry;
}

function entryFor(partition) {
  return assignments.has(partition) ? assignments.get(partition) : assign(partition);
}

async function applyTo(ses, partition, forceEntry) {
  const entry = forceEntry !== undefined ? forceEntry : entryFor(partition);
  const cfg = settings.get().proxy;
  try {
    if (!entry || !cfg.enabled) {
      await ses.setProxy({ mode: 'direct' });
      return null;
    }
    await ses.setProxy({
      proxyRules: entry.rules,
      proxyBypassRules: cfg.bypass || '<local>',
      pacScript: ''
    });
    return entry;
  } catch (e) {
    console.error('[proxy] apply failed', e);
    return null;
  }
}

/** Re-apply the (possibly changed) configuration to every live tab session. */
async function applyAll(sessions) {
  assignments.clear();
  rr = 0;
  const tasks = [];
  for (const [partition, rec] of sessions) {
    tasks.push(applyTo(rec.ses, partition));
  }
  await Promise.allSettled(tasks);
}

function looksLikeJson(body) {
  const t = body.trim();
  return t.startsWith('{') || t.startsWith('[');
}

/**
 * Test a proxy entry by fetching an IP echo endpoint through it.
 * Returns { ok, ip, ms, error }.
 */
async function test(rawEntry, testUrl) {
  const entry = parseEntry(rawEntry);
  if (!entry) return { ok: false, error: 'صيغة البروكسي غير صحيحة' };

  const url = testUrl || settings.get().proxy.testUrl || 'https://api.ipify.org?format=json';
  const part = `fathi-probe-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const ses = session.fromPartition(part);
  const started = Date.now();

  try {
    await ses.setProxy({ proxyRules: entry.rules, proxyBypassRules: settings.get().proxy.bypass || '<local>' });

    const result = await new Promise((resolve, reject) => {
      const req = net.request({ url, session: ses, useSessionCookies: false, redirect: 'follow' });
      const timer = setTimeout(() => { try { req.abort(); } catch {} reject(new Error('انتهت المهلة (15s)')); }, 15000);
      let body = '';

      req.on('login', (_authInfo, callback) => {
        callback(entry.username || '', entry.password || '');
      });
      req.on('response', (res) => {
        res.on('data', (chunk) => { body += chunk.toString(); });
        res.on('end', () => { clearTimeout(timer); resolve({ status: res.statusCode, body }); });
        res.on('error', (e) => { clearTimeout(timer); reject(e); });
      });
      req.on('error', (e) => { clearTimeout(timer); reject(e); });
      req.end();
    });

    const ms = Date.now() - started;
    let ip = '';
    try {
      const j = JSON.parse(result.body);
      ip = j.ip || j.query || j.origin || '';
    } catch {
      ip = looksLikeJson(result.body) ? '' : result.body.trim().slice(0, 80);
    }

    await ses.clearStorageData().catch(() => {});
    return {
      ok: result.status >= 200 && result.status < 400,
      status: result.status,
      ip,
      ms,
      entry,
      error: result.status >= 400 ? `HTTP ${result.status}` : undefined
    };
  } catch (e) {
    try { await ses.clearStorageData(); } catch {}
    return { ok: false, ms: Date.now() - started, error: String(e.message || e) };
  }
}

function status(partition) {
  const cfg = settings.get().proxy;
  const entry = entryFor(partition);
  if (!cfg.enabled) return { enabled: false, mode: cfg.mode, host: null };
  return {
    enabled: !!entry,
    mode: cfg.mode,
    host: entry ? `${entry.host}:${entry.port}` : null,
    scheme: entry ? entry.scheme : null,
    username: entry ? entry.username : null,
    count: pool().length
  };
}

module.exports = { parseEntry, pool, assign, entryFor, applyTo, applyAll, test, status, assignments };

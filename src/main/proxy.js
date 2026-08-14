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


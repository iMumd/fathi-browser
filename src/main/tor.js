'use strict';
/**
 * Tor support for special-use names.
 *
 * Chromium cannot resolve .onion, .eth or .i2p through the public DNS, so those
 * hosts are routed to a local Tor SOCKS5 listener through a PAC script. Every
 * other host keeps using the normal connection (or the configured proxy pool),
 * which means ordinary browsing never depends on Tor being installed.
 *
 * The PAC approach is used instead of a global SOCKS rule because a global rule
 * would send *every* request through Tor.
 */
const net = require('node:net');
const settings = require('./settings');

const TOR_HOST = '127.0.0.1';
const TOR_PORT = 9050;      // tor daemon default
const TOR_BROWSER_PORT = 9150; // Tor Browser default

/** Special-use TLDs that only resolve through an anonymising network. */
const TOR_TLDS = ['.onion', '.eth', '.i2p'];

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

function endsWithAny(host, list) {
  if (!host) return false;
  return list.some((tld) => host === tld.slice(1) || host.endsWith(tld));
}

function isOnion(url) { return endsWithAny(hostOf(url), ['.onion']); }
function isEth(url) { return endsWithAny(hostOf(url), ['.eth']); }
function isI2P(url) { return endsWithAny(hostOf(url), ['.i2p']); }

/** True when the URL must leave through Tor rather than the clearnet. */
function shouldRouteThroughTor(url) {
  return endsWithAny(hostOf(url), TOR_TLDS);
}

function torPort() {
  const cfg = settings.get().tor || {};
  const port = Number(cfg.port);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : TOR_PORT;
}

function buildPac(port) {
  const rules = TOR_TLDS.map((tld) => `shExpMatch(host, "*${tld}")`).join(' || ');
  return [
    'function FindProxyForURL(url, host) {',
    `  if (${rules}) return "SOCKS5 ${TOR_HOST}:${port}; SOCKS ${TOR_HOST}:${port}";`,
    '  return "DIRECT";',
    '}'
  ].join('\n');
}

function pacUrl(port) {
  const script = buildPac(port);
  return `data:application/x-ns-proxy-autoconfig;base64,${Buffer.from(script, 'utf8').toString('base64')}`;
}

/** Apply the PAC script to a session so only special-use names use Tor. */
async function applyTo(ses) {
  const cfg = settings.get().tor || {};
  if (!cfg.enabled) return false;
  try {
    await ses.setProxy({ mode: 'pac_script', pacScript: pacUrl(torPort()) });
    return true;
  } catch (e) {
    console.error('[tor] apply failed', e);
    return false;
  }
}

/** Quick TCP probe: is something listening on the Tor SOCKS port? */
function probe(port = torPort(), timeout = 1200) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch {}
      resolve(ok);
    };
    sock.setTimeout(timeout);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
    sock.connect(port, TOR_HOST);
  });
}

async function status() {
  const cfg = settings.get().tor || {};
  const enabled = !!cfg.enabled;
  const port = torPort();
  const running = enabled ? await probe(port) : false;
  return { enabled, port, running, tlds: TOR_TLDS };
}

module.exports = {
  TOR_HOST,
  TOR_PORT,
  TOR_BROWSER_PORT,
  TOR_TLDS,
  isOnion,
  isEth,
  isI2P,
  shouldRouteThroughTor,
  buildPac,
  pacUrl,
  applyTo,
  probe,
  torPort,
  status
};

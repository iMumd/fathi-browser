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

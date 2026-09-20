
function headerPairs(headers) {
  return Object.entries(headers || {}).filter(([k]) => {
    const n = String(k).toLowerCase();
    if (n.startsWith(':')) return false;
    return !['host', 'content-length', 'connection', 'accept-encoding', 'transfer-encoding',
      'http2-settings', 'upgrade', 'proxy-connection'].includes(n);
  });
}

/* ------------------------------------------------------------ code gen */

function shq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
function dq(s) {
  return '"' + String(s)
    .replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"';
}
function phpq(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
function goq(s) {
  return '`' + String(s).replace(/`/g, '` + "`" + `') + '`';
}

function codeFor(rec, lang) {
  const url = rec.url || '';
  const method = (rec.method || 'GET').toUpperCase();
  const headers = headerPairs(rec.requestHeaders);
  const body = rec.postData || '';
  let u;
  try { u = new URL(url); } catch { u = null; }

function copyText(text) {
  const value = String(text == null ? '' : text);
  const done = () => toast(t('flow.copied'), 'ok');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(value).then(done).catch(() => fallbackCopy(value, done));
    return;
  }
  fallbackCopy(value, done);
}

function fallbackCopy(value, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    done();
  } catch {
    toast('Copy failed', 'err');
  }
}

function prettyUrl(u) {
  try {
    const x = new URL(u);
    return x.host + x.pathname + (x.search || '');
  } catch { return String(u || ''); }
}

function lowerHeaders(headers) {  const out = {};
  for (const [k, v] of Object.entries(headers || {})) out[String(k).toLowerCase()] = v;
  return out;
}

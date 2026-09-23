function flowNotes(r) {
  const notes = [];
  const tm = r.timing || {};
  const headers = lowerHeaders(r.responseHeaders);
  const mime = String(r.mimeType || '');
  const texty = /text|json|xml|javascript|css|html/i.test(mime);

  if (r.failed) notes.push(['err', t('flow.noteFailed').replace('{error}', r.errorText || '')]);
  if (r.status >= 400) notes.push([statusCls(r.status), t('flow.noteStatus').replace('{s}', r.status)]);
  if (/^http:/i.test(r.url)) notes.push(['warn', t('flow.noteHttps')]);
  if (r.fromCache) notes.push(['info', t('flow.noteCache')]);
  if (texty && r.size > 50000 && !headers['content-encoding']) notes.push(['warn', t('flow.noteCompression')]);
  if (r.size > 1048576) notes.push(['warn', t('flow.noteLarge').replace('{size}', fmtBytes(r.size))]);
  if (/^image\//i.test(mime) && r.size > 300000) notes.push(['warn', t('flow.noteImage').replace('{size}', fmtBytes(r.size))]);
  if (tm.wait > 500) notes.push(['warn', t('flow.noteTtfb').replace('{ms}', Math.round(tm.wait))]);
  if (tm.dns > 100) notes.push(['info', t('flow.noteDns').replace('{ms}', Math.round(tm.dns))]);
  if (tm.ssl > 200) notes.push(['info', t('flow.noteTls').replace('{ms}', Math.round(tm.ssl))]);
  if (r.redirectURL) notes.push(['info', t('flow.noteRedirect').replace('{url}', r.redirectURL)]);
  if (!notes.length) notes.push(['ok', t('flow.noteOk')]);
  return notes;
}

function clip(text) {
  const s = String(text == null ? '' : text);
  return s.length > 60000 ? s.slice(0, 60000) + '\n…' : s;
}

async function flowSave() {
  const format = $('#net-format').value;
  const all = $('#net-scope').value === 'all';
  const res = await window.api.net.export({ format, wcId: flowWcId(), all });
  if (res && res.ok) {
    if (res.path) toast(t('flow.saved').replace('{path}', res.path), 'ok');
  } else if (res && res.error) {
    toast(res.error, 'err');
  }

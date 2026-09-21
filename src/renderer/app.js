}

function ixParseHeaders(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const i = line.indexOf(':');
    if (i <= 0) continue;
    out.push({ name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() });
  }
  return out;
}

function ixHeadersObject() {
  const out = {};
  for (const h of ixParseHeaders($('#ix-headers').value)) out[h.name] = h.value;
  return out;
}

function ixCurrentRecord() {
  const rec = ix.items.find((r) => r.id === ix.current);
  if (!rec) return null;
  return {
    url: $('#ix-url').value.trim() || rec.url,
    method: ($('#ix-method').value.trim() || rec.method).toUpperCase(),
    requestHeaders: ixHeadersObject(),
    postData: $('#ix-body-text').value || ''
  };
}

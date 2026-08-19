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

async function fetchBody(wc, rec) {
  if (rec.failed || rec.body != null) return;
  const mime = String(rec.mimeType || '').toLowerCase();
  if (/^(image|audio|video|font)\//.test(mime)) return;
  if (/octet-stream|zip|pdf|protobuf/.test(mime)) return;
  const size = rec.size || rec.encodedSize || 0;
  if (size > 1024 * 1024) return;
  try {
    const res = await wc.debugger.sendCommand('Network.getResponseBody', { requestId: rec.requestId });
    if (!res) return;
    let text = res.base64Encoded
      ? Buffer.from(res.body || '', 'base64').toString('utf8')
      : String(res.body || '');
    if (text.length > MAX_BODY) {
      text = text.slice(0, MAX_BODY);
      rec.bodyTruncated = true;
    }
    rec.body = text;
    rec.size = rec.size || Buffer.byteLength(text);
    const t = tabs.get(wc.id);
    if (t) t.dirty = true;
    scheduleFlush();
  } catch {}

}

/* --------------------------------------------------------------- capture */

async function onMessage(wc, method, params) {
  if (method === 'Network.requestWillBeSent') {
    onRequest(wc, params);
    return;
  }
  if (method === 'Network.responseReceived') {
    const t = tabs.get(wc.id);
    const rec = t && t.reqs.get(params.requestId);
    if (!rec) return;
    t.dirty = true;
    const r = params.response || {};
    rec.status = r.status;
    rec.statusText = r.statusText || '';
    rec.mimeType = r.mimeType || '';
    rec.responseHeaders = { ...(r.headers || {}) };
    rec.remoteIPAddress = r.remoteIPAddress || '';
    rec.remotePort = r.remotePort || 0;
    rec.fromCache = !!r.fromDiskCache;
    rec.fromServiceWorker = !!r.fromServiceWorker;
    rec.protocol = r.protocol || '';
    rec.timingRaw = r.timing || null;
    rec.timing = buildTiming(r.timing, rec);
    scheduleFlush();
    return;
  }
  if (method === 'Network.responseReceivedExtraInfo') {
    const t = tabs.get(wc.id);
    const rec = t && t.reqs.get(params.requestId);
    if (rec) {
      t.dirty = true;
      rec.extraResponseHeaders = rec.extraResponseHeaders || {};
      for (const [k, v] of Object.entries(params.headers || {})) {
        if (!(k in rec.extraResponseHeaders)) rec.extraResponseHeaders[k] = v;
      }
      rec.status = params.statusCode || rec.status;
    }
    return;
  }
  if (method === 'Network.loadingFinished') {
    const t = tabs.get(wc.id);
    const rec = t && t.reqs.get(params.requestId);
    if (!rec || rec.done) return;
    rec.done = true;
    t.dirty = true;
    rec.finishedAt = Date.now();
    rec.encodedSize = params.encodedDataLength || rec.encodedSize || 0;
    rec.size = rec.encodedSize || headerSize(rec.responseHeaders) || 0;
    rec.timing = rec.timing || emptyTiming();
    if (rec.monoStart > 0 && params.timestamp > 0) {
      rec.timing.total = Math.max(0, Math.round((params.timestamp - rec.monoStart) * 1000));
    }
    const overhead = ['dns', 'connect', 'ssl', 'send', 'wait', 'blocked']
      .reduce((n, k) => n + (rec.timing[k] > 0 ? rec.timing[k] : 0), 0);
    rec.timing.receive = Math.max(0, Math.round(rec.timing.total - overhead));
    if (/^(Document|XHR|Fetch|Script|Stylesheet|Other)$/i.test(rec.resourceType)) {
      fetchBody(wc, rec).catch(() => {});
    }
    scheduleFlush();
    return;
  }
  if (method === 'Network.loadingFailed') {
    const t = tabs.get(wc.id);
    const rec = t && t.reqs.get(params.requestId);
    if (!rec) return;
    rec.done = true;
    rec.failed = true;
    t.dirty = true;
    rec.errorText = params.errorText || 'failed';
    rec.finishedAt = Date.now();
    rec.timing = rec.timing || emptyTiming();
    rec.timing.total = Math.round((rec.finishedAt - rec.startedAt));
    scheduleFlush();
  }

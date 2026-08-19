}

function onRequest(wc, params) {
  const t = tabFor(wc);
  const r = params.request || {};
  if (isInternal(r.url)) return;

  // A new request on an id that already exists is a redirect: close the old one.
  const prev = t.reqs.get(params.requestId);
  if (prev) {
    prev.done = true;
    if (params.redirectResponse) {
      prev.status = params.redirectResponse.status;
      prev.statusText = params.redirectResponse.statusText || '';
      prev.responseHeaders = { ...(params.redirectResponse.headers || {}) };
      prev.mimeType = params.redirectResponse.mimeType || '';
      prev.redirectURL = r.url || '';
      prev.timing = buildTiming(params.redirectResponse.timing, prev);
      prev.size = prev.size || 0;
    }
    t.reqs.delete(params.requestId);
  }

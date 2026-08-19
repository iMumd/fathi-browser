
  const meta = safeMeta(wc) || {};
  const rec = {
    id: 'n' + (++seq),
    requestId: params.requestId,
    wcId: wc.id,
    partition: meta.partition || '',
    fpId: meta.fpId || '',
    url: r.url || '',
    method: r.method || 'GET',
    resourceType: params.type || 'Other',
    startedAt: Math.round((params.wallTime || Date.now() / 1000) * 1000),
    monoStart: params.timestamp || 0,
    requestHeaders: { ...(r.headers || {}) },
    postData: r.postData || '',
    hasPostData: !!r.hasPostData,
    initiator: (params.initiator && params.initiator.type) || '',
    status: 0,
    statusText: '',
    mimeType: '',
    responseHeaders: {},
    extraResponseHeaders: null,
    timing: null,
    size: 0,
    encodedSize: 0,
    body: null,
    bodyTruncated: false,
    failed: false,
    errorText: '',
    done: false,
    fromCache: false,
    fromServiceWorker: false,
    remoteIPAddress: '',
    remotePort: 0,
    protocol: '',
    redirectURL: ''
  };

  t.reqs.set(params.requestId, rec);
  t.order.push(rec.id);
  t.dirty = true;

  total += 1;
  trimTab(t);
  trimTotal();
  scheduleFlush();

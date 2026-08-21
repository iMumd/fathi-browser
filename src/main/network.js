}

function har(opts = {}) {
  const recs = collect(opts.wcId, !!opts.all);
  const entries = recs.map((rec) => {
    const t = rec.timing || emptyTiming();
    return {
      startedDateTime: new Date(rec.startedAt).toISOString(),
      time: Math.max(0, Math.round(t.total || 0)),
      request: toHarRequest(rec),
      response: toHarResponse(rec),
      cache: {},
      timings: {
        blocked: t.blocked,
        dns: t.dns,
        connect: t.connect,
        ssl: t.ssl,
        send: t.send,
        wait: t.wait,
        receive: t.receive
      },
      serverIPAddress: rec.remoteIPAddress || '',
      connection: rec.remotePort ? String(rec.remotePort) : '',
      _resourceType: rec.resourceType,
      _failed: rec.failed || undefined,
      _error: rec.errorText || undefined,
      _tab: rec.fpId || rec.partition || ''
    };
  });
  return {
    log: {
      version: '1.2',
      creator: { name: 'Fathi', version: '1.0', comment: 'Private browser flow export' },
      pages: [],
      entries
    }
  };
}

function xmlEscape(value, attr) {
  let s = String(value == null ? '' : value);
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (attr) s = s.replace(/"/g, '&quot;');
  return s;

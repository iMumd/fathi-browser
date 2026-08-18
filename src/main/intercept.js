
  const kick = () => { if (enabled) enableOn(wc).catch(() => {}); };
  kick();
  wc.once('dom-ready', kick);

  wc.once('destroyed', () => {
    guests.delete(wc.id);
    for (const rec of Array.from(paused.values())) {
      if (rec.wcId === wc.id) paused.delete(rec.id);
    }
    send('fathi:intercept:state', state());
  });
}

async function onMessage(wc, method, params) {
  if (method !== 'Fetch.requestPaused') return;
  const { requestId, request, resourceType } = params || {};
  if (!requestId || !request) return;

  const rec = {
    id: requestId,
    wcId: wc.id,
    method: request.method || 'GET',
    url: request.url || '',
    resourceType: resourceType || 'Other',
    headers: request.headers || {},
    postData: request.postData || '',
    at: Date.now()
  };

  if (!enabled || !isWebUrl(rec.url) || !matchesFilter(rec.url)) {
    try { await wc.debugger.sendCommand('Fetch.continueRequest', { requestId }); } catch {}
    return;
  }

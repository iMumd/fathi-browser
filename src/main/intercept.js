
  paused.set(requestId, { ...rec, wc });
  send('fathi:intercept:paused', rec);
  send('fathi:intercept:state', state());
}

/* ------------------------------------------------------------- operations */

async function resolve({ id, action = 'continue', url, method, headers, postData } = {}) {
  const rec = paused.get(id);
  if (!rec) return { ok: false, error: 'request is no longer paused' };
  paused.delete(id);

  try {
    if (action === 'drop') {
      await rec.wc.debugger.sendCommand('Fetch.failRequest', { requestId: id, errorReason: 'Aborted' });
    } else {
      const params = { requestId: id };
      if (url && url !== rec.url) params.url = String(url);
      if (method && method !== rec.method) params.method = String(method).toUpperCase();
      if (Array.isArray(headers) && headers.length) params.headers = headers;
      const useMethod = params.method || rec.method;
      if (typeof postData === 'string' && postData !== rec.postData && !/^(GET|HEAD)$/i.test(useMethod)) {
        params.postData = Buffer.from(postData, 'utf8').toString('base64');
      }
      await rec.wc.debugger.sendCommand('Fetch.continueRequest', params);
    }
  } catch (e) {
    send('fathi:intercept:state', state());
    return { ok: false, error: String(e && e.message || e) };
  }

  send('fathi:intercept:resolved', { id });
  send('fathi:intercept:state', state());
  return { ok: true };

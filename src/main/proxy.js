async function applyAll(sessions) {
  assignments.clear();
  rr = 0;
  const tasks = [];
  for (const [partition, rec] of sessions) {
    tasks.push(applyTo(rec.ses, partition));
  }
  await Promise.allSettled(tasks);
}

function looksLikeJson(body) {
  const t = body.trim();
  return t.startsWith('{') || t.startsWith('[');
}

/**
 * Test a proxy entry by fetching an IP echo endpoint through it.
 * Returns { ok, ip, ms, error }.
 */
async function test(rawEntry, testUrl) {
  const entry = parseEntry(rawEntry);
  if (!entry) return { ok: false, error: 'صيغة البروكسي غير صحيحة' };

  const url = testUrl || settings.get().proxy.testUrl || 'https://api.ipify.org?format=json';
  const part = `fathi-probe-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const ses = session.fromPartition(part);
  const started = Date.now();

  try {
    await ses.setProxy({ proxyRules: entry.rules, proxyBypassRules: settings.get().proxy.bypass || '<local>' });

    const result = await new Promise((resolve, reject) => {
      const req = net.request({ url, session: ses, useSessionCookies: false, redirect: 'follow' });
      const timer = setTimeout(() => { try { req.abort(); } catch {} reject(new Error('انتهت المهلة (15s)')); }, 15000);
      let body = '';

      req.on('login', (_authInfo, callback) => {
        callback(entry.username || '', entry.password || '');
      });
      req.on('response', (res) => {
        res.on('data', (chunk) => { body += chunk.toString(); });
        res.on('end', () => { clearTimeout(timer); resolve({ status: res.statusCode, body }); });
        res.on('error', (e) => { clearTimeout(timer); reject(e); });
      });
      req.on('error', (e) => { clearTimeout(timer); reject(e); });
      req.end();
    });

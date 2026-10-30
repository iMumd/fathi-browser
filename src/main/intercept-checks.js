'use strict';
const http = require('node:http');
const { webContents } = require('electron');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function run(ui) {
  const checks = []; let tab; const received = [];
  const add = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  const server = http.createServer((req, res) => {
    if (req.url === '/redirect') { res.writeHead(302, { Location: '/off-target' }); res.end(); return; }
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<body>Local rule fixture<script>window.__rulesFixture = true</script>'); return; }
    let body = ''; req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      received.push({ url: req.url, body, header: req.headers['x-rule-probe'], cookie: req.headers.cookie || '' });
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('X-Response-Probe', 'response-token');
      res.setHeader('Set-Cookie', ['first=one; Path=/', 'second=two; Path=/']);
      res.end(JSON.stringify({ body, header: req.headers['x-rule-probe'] || '', marker: 'response-body' }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const old = await ui.executeJavaScript('(async () => (await window.api.rules.list()).rules)()');
  let wc;
  try {
    await ui.executeJavaScript('window.api.intercept.set(false)');
    tab = await ui.executeJavaScript(`(async () => { const t = await createTab({ url: ${JSON.stringify(url)} }); return { id: t.id }; })()`);
    for (let i = 0; i < 80; i++) {
      const id = await ui.executeJavaScript(`(() => { try { return state.tabs.find(t => t.id === ${JSON.stringify(tab.id)}).wv.getWebContentsId(); } catch { return null; } })()`);
      wc = id && webContents.fromId(id);
      if (wc && await wc.executeJavaScript('!!window.__rulesFixture').catch(() => false)) break;
      await delay(100);
    }
    const cases = [
      { regex: false, matchRequestBody: 'request-body', matchResponseBody: 'response-body', matchRequestHeader: 'request-token', matchResponseHeader: 'response-token', replacement: (value) => value + '-once', body: 'request-body-once', requestHeader: 'request-token-once', responseHeader: 'response-token-once', responseBody: 'response-body-once' },
      { regex: true, matchRequestBody: '(request)-(body)', matchResponseBody: '(response)-(body)', matchRequestHeader: '(request)-(token)', matchResponseHeader: '(response)-(token)', replacement: () => '$2/$1', body: 'body/request', requestHeader: 'token/request', responseHeader: 'token/response', responseBody: 'body/response' }
    ];
    for (const scenario of cases) {
      const targets = ['requestBody', 'responseBody', 'requestHeader', 'responseHeader'];
      const list = targets.map((target, i) => {
        const match = scenario['match' + target[0].toUpperCase() + target.slice(1)];
        return { id: 'live-' + i, enabled: true, target, match, replace: scenario.replacement(match), regex: scenario.regex };
      });
      const saved = await ui.executeJavaScript(`window.api.rules.save(${JSON.stringify(list)})`);
      if (!saved.ok) throw new Error(saved.error);
      const result = await wc.executeJavaScript(`(async () => { const r = await fetch('/echo', { method: 'POST', headers: { 'X-Rule-Probe': 'request-token', 'Content-Type': 'text/plain' }, body: 'request-body' }); return { status: r.status, header: r.headers.get('x-response-probe'), data: await r.json(), cookies: document.cookie }; })()`);
      add(`live rules: all four ${scenario.regex ? 'regex/capture' : 'plain-text'} targets apply once while Intercept is off`, result.data.body === scenario.body && result.data.header === scenario.requestHeader && result.header === scenario.responseHeader && result.data.marker === scenario.responseBody, result);
      add('live rules: response header rewriting preserves separate Set-Cookie fields', result.cookies.includes('first=one') && result.cookies.includes('second=two'), result.cookies);
    }
    const manualRules = ['requestBody', 'responseBody', 'requestHeader', 'responseHeader'].map((target, i) => {
      const match = cases[0]['match' + target[0].toUpperCase() + target.slice(1)];
      return { id: 'manual-' + i, enabled: true, target, match, replace: match + '-once' };
    });
    await ui.executeJavaScript(`window.api.rules.save(${JSON.stringify(manualRules)})`);
    await ui.executeJavaScript('window.api.intercept.filter("/manual-rule")');
    await ui.executeJavaScript('window.api.intercept.set(true)');
    await wc.executeJavaScript(`window.__manualRule = fetch('/manual-rule', { method: 'POST', headers: { 'X-Rule-Probe': 'request-token' }, body: 'request-body' }).then(async r => ({ header: r.headers.get('x-response-probe'), data: await r.json() })); true`);
    for (let i = 0; i < 80; i++) { if (await ui.executeJavaScript(`ix.items.some(r => r.wcId === ${wc.id})`)) break; await delay(100); }
    const editorRewritten = await ui.executeJavaScript(`(async () => { const row = ix.items.find(r => r.wcId === ${wc.id}); await ixOpenItem(row.id); const rewritten = document.getElementById('ix-body-text').value === 'request-body-once'; await ixResolve('continue'); return rewritten; })()`);
    const manual = await wc.executeJavaScript('window.__manualRule');
    add('live rules: edited interception forwards all four targets exactly once', editorRewritten && manual.data.body === 'request-body-once' && manual.data.header === 'request-token-once' && manual.header === 'response-token-once' && manual.data.marker === 'response-body-once', manual);
    await ui.executeJavaScript('window.api.intercept.set(false)');
    await ui.executeJavaScript('window.api.rules.save([])');
    const replay = await ui.executeJavaScript(`window.api.intercept.repeat({ wcId: ${wc.id}, url: ${JSON.stringify(url + 'echo')}, method: 'POST', postData: 'manual-repeat' })`);
    add('Repeat uses the source tab session and cookies', replay.ok && received.some((record) => record.body === 'manual-repeat' && record.cookie.includes('first=one') && record.cookie.includes('second=two')));
    const redirect = await ui.executeJavaScript(`window.api.intercept.repeat({ wcId: ${wc.id}, url: ${JSON.stringify(url + 'redirect')}, method: 'GET' })`);
    add('Repeat reports redirects without following a new destination', redirect.ok && redirect.response.status === 302 && !received.some((record) => record.url === '/off-target'), redirect);
    await ui.executeJavaScript('window.api.intercept.filter("/queue")');
    await ui.executeJavaScript('window.api.intercept.set(true)');
    await wc.executeJavaScript(`window.__queuedRequests = Promise.all([1,2,3].map(i => fetch('/queue?i=' + i, { method: 'POST', body: 'original-' + i }).then(r => r.json()).catch(() => ({ dropped: true })))); true`);
    let queued;
    for (let i = 0; i < 80; i++) {
      queued = await ui.executeJavaScript(`ix.items.filter(r => r.wcId === ${wc.id}).length`);
      if (queued >= 3) break; await delay(100);
    }
    const queue = await ui.executeJavaScript(`(async () => {
      devOpen('intercept'); const rows = ix.items.filter(r => r.wcId === ${wc.id});
      const automatic = !!ix.current && !document.getElementById('ix-detail').classList.contains('hidden');
      const visible = !document.getElementById('ix-list').classList.contains('hidden') && document.querySelectorAll('#ix-list .ix-item').length >= 3;
      await ixOpenItem(rows[0].id); document.getElementById('ix-body-text').value = 'edited-first';
      await ixOpenItem(rows[2].id); await ixOpenItem(rows[0].id);
      const preserved = document.getElementById('ix-body-text').value === 'edited-first';
      await ixOpenItem(rows[2].id); await ixResolve('drop');
      await ixOpenItem(rows[0].id); await ixResolve('continue');
      const advanced = ix.current === rows[1].id;
      await ixResolve('drop');
      return { automatic, visible, preserved, advanced };
    })()`);
    const results = await wc.executeJavaScript('window.__queuedRequests');
    add('interception queue remains visible and selects the first request automatically', queued >= 3 && queue.automatic && queue.visible, queue);
    add('interception queue preserves drafts while switching and advances after forwarding', queue.preserved && queue.advanced, queue);
    add('Forward sends edited data and Drop never reaches the target', results.filter((r) => r.dropped).length === 2 && received.filter((r) => r.url.startsWith('/queue')).length === 1 && received.some((r) => r.url.startsWith('/queue') && r.body === 'edited-first'), results);
  } finally {
    await ui.executeJavaScript('window.api.intercept.set(false)').catch(() => {});
    await ui.executeJavaScript('window.api.intercept.filter("")').catch(() => {});
    await ui.executeJavaScript(`window.api.rules.save(${JSON.stringify(old || [])})`).catch(() => {});
    if (tab) await ui.executeJavaScript(`closeTab(${JSON.stringify(tab.id)}, { silent: true })`).catch(() => {});
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  }
  return checks;
}
module.exports = { run };


  /* ---- 5c. flow recorder, capture, inspect, export and code generation */
  trace('check 5c: flow recorder');
  await sleep(800);
  const netInfo = await ui.executeJavaScript(`(async () => {
    const wv = document.querySelector('webview.active');
    const wcId = wv.getWebContentsId();
    const res = await window.api.net.list({ wcId });
    return { wcId, count: res.ok ? res.records.length : -1 };
  })()`).catch((e) => ({ count: -1, error: String(e) }));
  add('flow captures the request log', netInfo.count > 0, JSON.stringify(netInfo));

  await ui.executeJavaScript(`document.getElementById('chip-flow').click()`);
  await sleep(500);
  const flowRows = await ui.executeJavaScript(`document.querySelectorAll('#net-list .net-row').length`);
  add('flow panel lists requests', flowRows > 0, 'rows=' + flowRows);

  const har = await ui.executeJavaScript(`(async () => {
    const wcId = document.querySelector('webview.active').getWebContentsId();
    const res = await window.api.net.serialize({ format: 'har', wcId });
    return res.ok ? res.text : '';
  })()`).catch(() => '');
  add('HAR export builds a valid archive', har.includes('"log"') && har.includes('"entries"') && har.includes('"creator"'), 'bytes=' + har.length);

  const xmlExport = await ui.executeJavaScript(`(async () => {
    const wcId = document.querySelector('webview.active').getWebContentsId();
    const res = await window.api.net.serialize({ format: 'xml', wcId });
    return res.ok ? res.text : '';
  })()`).catch(() => '');
  add('XML export builds a session document', xmlExport.includes('<fathi-session') && xmlExport.includes('<request '), 'bytes=' + xmlExport.length);

  const code = await ui.executeJavaScript(`(async () => {
    const wcId = document.querySelector('webview.active').getWebContentsId();
    const res = await window.api.net.list({ wcId });
    const rec = (res.records || []).find((r) => /example\\.com/.test(r.url)) || (res.records || [])[0];
    if (!rec) return '';
    const d = await window.api.net.detail({ wcId, id: rec.id });
    if (!d.ok) return '';
    return [codeFor(d.record, 'curl'), codeFor(d.record, 'python'), codeFor(d.record, 'php')].join('\\n---\\n');
  })()`).catch(() => '');
  add('request code generation works', /curl -X/.test(code) && /import requests/.test(code) && /curl_init/.test(code), 'chars=' + code.length);

  await ui.executeJavaScript(`document.querySelector('#net-list .net-row').click()`);
  await sleep(500);
  const inspector = await ui.executeJavaScript(`({
    visible: !document.getElementById('net-detail').classList.contains('hidden'),
    notes: document.querySelectorAll('#net-panel .net-note').length,
    title: (document.querySelector('.net-title') || {}).textContent || ''
  })`).catch(() => ({ visible: false, notes: 0 }));
  add('flow inspector renders analysis', inspector.visible && inspector.notes > 0, JSON.stringify(inspector));
  await ui.executeJavaScript(`document.getElementById('ix-close').click()`);

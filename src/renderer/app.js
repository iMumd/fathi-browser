
  if (flow.detailTab === 'response') {
    const headers = Object.entries(r.responseHeaders || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
    const body = r.body == null ? '' : String(r.body);
    panel.innerHTML = `
      <h4>${esc(t('flow.responseHeaders'))}</h4>
      <div class="hdr-block">${esc(headers || 'n/a')}</div>
      <h4>${esc(t('flow.responseBody'))}</h4>
      ${body ? `<pre class="body-pre">${esc(clip(body))}</pre>${r.bodyTruncated ? `<div class="net-note info">${esc(t('flow.truncated'))}</div>` : ''}` : `<div class="ix-empty">${esc(t('flow.noBody'))}</div>`}`;
    return;
  }

  if (flow.detailTab === 'timing') {
    const tm = r.timing || {};
    const total = Math.max(1, Number(tm.total) || 1);
    const rows = [
      ['flow.hdrDns', tm.dns],
      ['flow.hdrConnect', tm.connect],
      ['flow.hdrSsl', tm.ssl],
      ['flow.hdrSend', tm.send],
      ['flow.hdrWait', tm.wait],
      ['flow.hdrReceive', tm.receive]
    ];
    panel.innerHTML = `
      <h4>${esc(t('flow.timing'))}</h4>
      ${rows.map(([key, value]) => barRow(t(key), value, total)).join('')}
      ${barRow(t('flow.hdrTotal'), total, total)}
      <h4>${esc(t('flow.analysis'))}</h4>
      <dl class="kv">
        <dt>${esc(t('flow.ip'))}</dt><dd>${esc(r.remoteIPAddress || 'n/a')}${r.remotePort ? ':' + r.remotePort : ''}</dd>
        <dt>Protocol</dt><dd>${esc(r.protocol || 'n/a')}</dd>
        <dt>${esc(t('flow.source'))}</dt><dd>${esc(r.fromCache ? t('flow.cached') : r.fromServiceWorker ? t('flow.serviceWorker') : t('flow.network'))}</dd>
        <dt>${esc(t('flow.time'))}</dt><dd>${fmtMs(tm.total)}</dd>
      </dl>`;
    return;
  }


  const host = (() => { try { return new URL(r.url).host; } catch { return ''; } })();
  const tabs = [
    ['analysis', 'flow.analysis'],
    ['request', 'flow.request'],
    ['response', 'flow.response'],
    ['timing', 'flow.timing'],
    ['code', 'flow.code']
  ];

  d.innerHTML = `
    <div class="net-head">
      <span class="net-status ${statusCls(r.status)}">${r.status || (r.failed ? 'ERR' : 'n/a')}</span>
      <div class="net-title"><b>${esc(r.method)}</b> ${esc(r.url)}</div>
      <button class="btn sm" id="net-back" title="${esc(t('flow.back'))}">${esc(t('flow.back'))}</button>
    </div>
    <div class="net-facts">
      <span>${esc(r.resourceType || 'Other')}</span>
      ${r.mimeType ? `<span>${esc(r.mimeType)}</span>` : ''}
      <span>${fmtBytes(r.size)}</span>
      <span>${fmtMs(r.timing ? r.timing.total : r.time)}</span>
      ${host ? `<span>${esc(host)}</span>` : ''}
      ${r.fromCache ? `<span>${esc(t('flow.cached'))}</span>` : ''}
      ${r.fromServiceWorker ? `<span>${esc(t('flow.serviceWorker'))}</span>` : ''}
    </div>
    <div class="net-actions">
      <button class="btn sm" data-copy="url">${esc(t('flow.copyUrl'))}</button>
      <button class="btn sm" data-copy="curl">${esc(t('flow.copyCurl'))}</button>
      <button class="btn sm" data-copy="raw">${esc(t('flow.copyRaw'))}</button>
      <button class="btn sm" data-copy="python">Python</button>
      <button class="btn sm" data-copy="php">PHP</button>
    </div>
    <div class="net-tabs">
      ${tabs.map(([id, key]) => `<button class="net-tab ${flow.detailTab === id ? 'active' : ''}" data-nt="${id}">${esc(t(key))}</button>`).join('')}
    </div>
    <div class="net-panel" id="net-panel"></div>`;

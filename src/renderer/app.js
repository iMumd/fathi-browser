
  $('#net-back').addEventListener('click', flowBack);
  d.querySelectorAll('.net-tab').forEach((b) => {
    b.addEventListener('click', () => {
      flow.detailTab = b.dataset.nt;
      d.querySelectorAll('.net-tab').forEach((x) => x.classList.toggle('active', x === b));
      flowRenderPanel();
    });
  });
  d.querySelectorAll('[data-copy]').forEach((b) => {
    b.addEventListener('click', () => {
      const kind = b.dataset.copy;
      if (kind === 'url') copyText(r.url);
      else copyText(codeFor(r, kind));
    });
  });
  flowRenderPanel();
}

function flowRenderPanel() {
  const r = flow.detail;
  const panel = $('#net-panel');
  if (!r || !panel) return;

  if (flow.detailTab === 'request') {
    panel.innerHTML = `
      <h4>${esc(t('flow.requestHeaders'))}</h4>
      <div class="hdr-block">${esc(Object.entries(r.requestHeaders || {}).map(([k, v]) => `${k}: ${v}`).join('\n') || 'n/a')}</div>
      <h4>${esc(t('flow.requestBody'))}</h4>
      ${r.postData ? `<pre class="body-pre">${esc(clip(r.postData))}</pre>` : `<div class="ix-empty">${esc(t('flow.noBody'))}</div>`}`;
    return;
  }

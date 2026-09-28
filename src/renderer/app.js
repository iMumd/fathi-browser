function renderFingerprintList() {
  const box = $('#fp-list');
  if (!box) return;
  if (!state.tabs.length) {
    box.innerHTML = `<p class="hint" style="margin:0">n/a</p>`;
    return;
  }
  box.innerHTML = state.tabs.map((tab, i) => {
    const f = tab.fp || {};
    const mobile = !!(f.device && f.device.mobile);
    return `
      <div class="fp-row">
        <div class="fp-ua" title="${esc(f.ua || '')}">${mobile ? esc(f.device.name) + ' · ' : ''}${esc(shortUa(f.ua))}</div>
        <button class="btn sm" data-rotate="${esc(tab.id)}">${esc(t('fp.rotate'))}</button>
        <div class="fp-tags">
          <span class="tag">${esc(t('fp.tagTab', { n: i + 1 }))}</span>
          <span class="tag">${esc(osLabel(f))}</span>
          <span class="tag">${esc(f.timezone || '')}</span>
          <span class="tag">${esc(f.language || '')}</span>
          <span class="tag">${mobile ? `${f.device.width}×${f.device.height}` : (f.screen ? `${f.screen.width}×${f.screen.height}` : '')}</span>
          <span class="tag">${esc(t('fp.tagCores', { n: f.hardwareConcurrency || '?' }))}</span>
          <span class="tag">${esc(String((f.webgl && f.webgl.vendor) || '').replace('Google Inc. ', ''))}</span>
        </div>
      </div>`;
  }).join('');

  box.querySelectorAll('[data-rotate]').forEach((b) => {
    b.addEventListener('click', async () => { await rotateTab(b.dataset.rotate); });
  });
}

function highlightActiveTabInSettings() {
  if (!$('#dev-list')) return;
  const tab = activeTab();
  const activeId = (tab && tab.fp && tab.fp.device && tab.fp.device.id) || 'desktop';
  $$('#dev-list [data-device]').forEach((el) => {
    el.classList.toggle('active', el.dataset.device === activeId);
  });
}


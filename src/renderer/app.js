async function renderExtensionList() {
  const box = $('#ext-list');
  if (!box) return;
  const res = await window.api.ext.list();
  const list = (res && res.list) || [];
  if (!list.length) {
    box.innerHTML = `<p class="hint" style="margin:0">${esc(t('ext.empty'))}</p>`;
    return;
  }
  box.innerHTML = list.map((e) => `
    <div class="ext-item">
      <div class="ext-icon">${esc(String(e.name || '?').slice(0, 1).toUpperCase())}</div>
      <div class="ext-meta">
        <div class="ext-name">${esc(e.name)}</div>
        <div class="ext-sub">v${esc(e.version)} · ${esc(t('ext.sessions', { n: e.runningIn || 0 }))} · ${esc(e.source === 'unpacked' ? t('ext.folder') : t('ext.store'))}</div>
      </div>
      <button class="btn sm danger" data-ext-remove="${esc(e.id)}">${esc(t('ext.remove'))}</button>
    </div>`).join('');

  box.querySelectorAll('[data-ext-remove]').forEach((b) => {
    b.addEventListener('click', async () => {
      const res2 = await window.api.ext.remove(b.dataset.extRemove);
      if (res2 && res2.ok) { toast(t('toast.extRemoved'), 'ok'); renderExtensionList(); }
    });
  });
}

let fpListTimer = null;
function refreshFingerprintList() {
  clearTimeout(fpListTimer);
  fpListTimer = setTimeout(renderFingerprintList, 30);
}


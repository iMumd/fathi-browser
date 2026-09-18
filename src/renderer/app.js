function deviceItemHtml(dev, activeId) {
  const active = dev.id === activeId;
  const meta = dev.mobile
    ? t('devices.size', { w: dev.width, h: dev.height, dpr: dev.dpr })
    : t('settings.nav.general');
  return `<button class="device-item ${active ? 'active' : ''}" data-device="${esc(dev.id)}">
    <span class="di-icon">${iconFor(dev)}</span>
    <span class="di-text">
      <span class="di-name">${esc(dev.mobile ? dev.name : t('devices.desktop'))}</span>
      <span class="di-meta">${esc(meta)}</span>
    </span>
    <span class="di-check"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span>
  </button>`;
}

function renderDevicePopover() {
  const list = $('#device-list');
  if (!list) return;
  const tab = activeTab();
  const activeId = (tab && tab.fp && tab.fp.device && tab.fp.device.id) || 'desktop';
  const groups = state.deviceGroups || {};
  const order = ['desktop', 'apple', 'samsung', 'google', 'other'];
  let html = '';
  for (const key of order) {
    const arr = groups[key];
    if (!arr || !arr.length) continue;
    html += `<div class="device-group-title">${esc(t('devices.group.' + key))}</div>`;
    html += arr.map((d) => deviceItemHtml(d, activeId)).join('');
  }
  list.innerHTML = html;
  list.querySelectorAll('[data-device]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dev = state.devices.find((d) => d.id === btn.dataset.device) || state.desktop;
      changeDevice(dev);
    });
  });

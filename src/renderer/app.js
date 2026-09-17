function updateNavButtons() {
  const tab = activeTab();
  const back = $('#btn-back');
  const fwd = $('#btn-fwd');
  if (!tab) return;
  const canBack = (() => { try { return tab.wv.canGoBack(); } catch { return false; } })();
  const canFwd = (() => { try { return tab.wv.canGoForward(); } catch { return false; } })();
  back.disabled = !canBack;
  fwd.disabled = !canFwd;
  $('#btn-reload').title = tab.loading ? t('nav.stop') : t('nav.reload');
  $('#btn-reload').setAttribute('aria-label', $('#btn-reload').title);
}

function deviceLabel(dev) {
  if (!dev || !dev.mobile) return t('devices.desktop');
  return dev.name;
}

function updateChips() {
  const tab = activeTab();
  const fpChip = $('#chip-fp');
  const pxChip = $('#chip-proxy');
  const devChip = $('#chip-device');

  if (tab && tab.fp) {
    const isMobile = !!(tab.fp.device && tab.fp.device.mobile);
    const tag = isMobile
      ? `${osLabel(tab.fp)} · ${tab.fp.device.width}×${tab.fp.device.height}`
      : `${osLabel(tab.fp)} · ${tab.fp.screen.width}×${tab.fp.screen.height}`;
    $('#chip-fp-text').textContent = tag;
    fpChip.classList.add('on');
    fpChip.title = `${t('chip.fingerprint')} ${tab.fp.id}\n${shortUa(tab.fp.ua)}\n${tab.fp.timezone}`;
    $('#chip-device-text').textContent = deviceLabel(tab.fp.device);
    devChip.classList.toggle('on', isMobile);
    devChip.title = `${t('devices.active')}: ${deviceLabel(tab.fp.device)}`;
  } else {
    $('#chip-fp-text').textContent = t('chip.fingerprint');
    fpChip.classList.remove('on');
    $('#chip-device-text').textContent = t('devices.desktop');
    devChip.classList.remove('on');
  }

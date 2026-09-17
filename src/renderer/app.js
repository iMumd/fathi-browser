}

async function rotateTab(id) {
  const tab = state.tabs.find((x) => x.id === id);
  if (!tab) return;
  const url = tab.url && !tab.url.startsWith('fathi://') ? tab.url : newTabUrl();
  const idx = state.tabs.indexOf(tab);
  const deviceId = (tab.fp && tab.fp.device && tab.fp.device.id) || 'desktop';
  const landscape = !!(tab.fp && tab.fp.device && tab.fp.device.orientation === 'landscape');
  await closeTab(id, { silent: true });
  await createTab({ url, index: Math.min(idx, state.tabs.length), deviceId, landscape });
  toast(t('toast.identity'), 'ok');
}

async function changeDevice(device, rotate) {
  const tab = activeTab();
  if (!tab) return;
  const idx = state.tabs.indexOf(tab);
  const url = tab.url && !tab.url.startsWith('fathi://') ? tab.url : newTabUrl();
  const landscape = rotate === undefined
    ? !!(tab.fp && tab.fp.device && tab.fp.device.orientation === 'landscape' && device.mobile)
    : !!rotate;
  await closeTab(tab.id, { silent: true });
  await createTab({ url, index: Math.min(idx, state.tabs.length), deviceId: device.id, landscape });
  toast(t('toast.deviceChanged'), 'ok');
  closeDevicePopover();
}


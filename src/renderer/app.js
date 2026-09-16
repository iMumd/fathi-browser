async function createTab(opts = {}) {
  const prep = await window.api.tab.prepare({
    ...(opts.fp ? { fp: opts.fp } : {}),
    deviceId: opts.deviceId || (state.settings && state.settings.defaultDevice) || 'desktop',
    landscape: !!opts.landscape
  });
  if (!prep || !prep.ok) {
    toast(t('toast.tabFail'), 'err');
    return null;
  }

  const id = 't' + (++seq) + '-' + prep.fp.id.slice(0, 4);
  const wv = document.createElement('webview');
  wv.setAttribute('partition', prep.partition);
  wv.setAttribute('allowpopups', '');
  wv.className = 'wv';
  view.appendChild(wv);

  const startUrl = opts.url || newTabUrl();

  // The src attribute must be set *after* the element is attached, otherwise
  // Chromium creates the guest but never starts a navigation.
  wv.setAttribute('src', startUrl);
  try { wv.loadURL(startUrl); } catch { /* queued until dom-ready */ }

  const tab = {
    id,
    partition: prep.partition,
    fp: prep.fp,
    fpId: prep.fpId,
    proxy: prep.proxy,
    wv,
    url: opts.url || startUrl,
    title: t('tab.new'),
    favicon: null,
    loading: false,
    el: null
  };

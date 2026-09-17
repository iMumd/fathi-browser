
  wv.addEventListener('did-fail-load', (e) => {
    if (e.errorCode === -3 || !e.isMainFrame) return; // aborted
    tab.loading = false;
    el.classList.remove('loading');
    setTitle(t('tab.loadFailed'));
    if (state.activeId === tab.id) {
      $('#progress').classList.remove('active');
      $('#bar').style.width = '0%';
    }
  });

  wv.addEventListener('render-process-gone', () => {
    setTitle(t('tab.crashed'));
    toast(t('toast.crashed'), 'err');
  });

  wv.addEventListener('dom-ready', () => {
    wv.classList.add('ready');
    try { wv.setZoomFactor(1); } catch {}
    updateNavButtons();
  });

  wv.addEventListener('console-message', () => { /* silence */ });
}

/** Sizes the tab surface: fills the window on desktop, floats as a phone in device mode. */
function applyTabLayout(tab) {
  if (!tab || !tab.wv) return;
  const dev = tab.fp && tab.fp.device && tab.fp.device.mobile ? tab.fp.device : null;
  const wv = tab.wv;

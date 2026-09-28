function reloadNewTabs() {
  for (const tab of state.tabs) {
    if (tab.url && tab.url.startsWith('fathi://')) {
      try {
        const target = newTabUrl();
        tab.url = target;
        tab.wv.loadURL(target);
      } catch {}
    }
  }
}

/* ------------------------------------------------------- language + theme */

function applyTheme() {
  const theme = (state.settings && state.settings.theme) || 'light';
  document.documentElement.dataset.theme = theme;
}

function applyStatic() {
  window.i18n.apply();
  const brand = $('#brand');
  if (brand) brand.title = 'Fathi';
  const winMax = $('#win-max');
  if (winMax) winMax.title = t('win.maximize');
  const winMin = $('#win-min');
  if (winMin) winMin.title = t('win.minimize');
  const winClose = $('#win-close');
  if (winClose) winClose.title = t('win.close');
  ixUpdateChrome();
}


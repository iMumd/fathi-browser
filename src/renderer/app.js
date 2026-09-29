});

window.api.on('fathi:newtab:navigate', ({ url, wcId }) => {
  const tab = tabByWcId(wcId) || activeTab();
  if (!tab) return;
  const target = normalizeInput(url);
  if (!target) return;
  tab.url = target;
  try { tab.wv.loadURL(target); } catch {}
});

window.api.on('fathi:newtab:new', () => { createTab(); });

window.api.on('fathi:newtab:rotate', ({ wcId }) => {
  const tab = tabByWcId(wcId) || activeTab();
  if (tab) rotateTab(tab.id);
});

window.api.on('fathi:focus-omnibox', () => { omnibox.focus(); omnibox.select(); });
window.api.on('fathi:new-tab', () => createTab());
window.api.on('fathi:close-tab', ({ wcId }) => {
  const tab = tabByWcId(wcId);
  if (tab) closeTab(tab.id);
});

window.api.on('fathi:win:state', ({ maximized }) => {
  const btn = $('#win-max');
  btn.title = maximized ? t('win.restore') : t('win.maximize');
  btn.setAttribute('aria-label', btn.title);
});


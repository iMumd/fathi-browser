window.api.on('fathi:proxy:changed', (cfg) => {
  if (state.settings) state.settings.proxy = cfg;
  updateChips();
  renderProxyStatus();
});

window.api.on('fathi:intercept:paused', (rec) => {
  if (!rec || !rec.id) return;
  if (!ix.items.some((r) => r.id === rec.id)) ix.items.push(rec);
  const drawer = $('#ix-drawer');
  const wasHidden = drawer.classList.contains('hidden');
  if (wasHidden) ixOpenDrawer();
  else ixRenderList();
  if (!ix.current) ixOpenItem(rec.id);
  ixUpdateChrome();
  if (wasHidden) toast(t('intercept.paused'), '');
});

window.api.on('fathi:intercept:resolved', ({ id } = {}) => {
  if (id) ixRemove(id);
});

window.api.on('fathi:intercept:state', (st) => {
  if (!st) return;
  ix.enabled = !!st.enabled;
  if (typeof st.filter === 'string') ix.filter = st.filter;
  ixUpdateChrome();
});


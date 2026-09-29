window.api.on('fathi:net:batch', (batch) => {
  if (!batch || !Array.isArray(batch.records)) return;
  const activeWc = flowWcId();
  if (flow.scope === 'all' || batch.wcId === activeWc) {
    flowMerge(batch.records);
    if (dev.open && dev.tab === 'flow' && !flow.selected) flowRender();
  }
  if (batch.wcId === activeWc) {
    const chipCount = $('#chip-flow-count');
    if (chipCount) {
      chipCount.textContent = String(batch.records.length);
      chipCount.classList.toggle('hidden', batch.records.length === 0);
    }
  }
});

window.addEventListener('resize', () => {
  const tab = activeTab();
  if (tab) applyTabLayout(tab);
  closeDevicePopover();
});

/* ------------------------------------------------------------------ boot */

(async function boot() {
  const res = await window.api.settings.get();
  state.settings = res.settings;
  state.info = res.info;

  window.i18n.setLang(state.settings.language || 'en', { silent: true });
  applyTheme();
  applyStatic();

  try {
    const st = await window.api.intercept.state();
    if (st && st.ok) {
      ix.enabled = !!st.state.enabled;
      ix.filter = st.state.filter || '';
      ixUpdateChrome();
    }
  } catch {}

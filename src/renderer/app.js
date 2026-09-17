
  document.title = (tab.title || 'Fathi') + ' · Fathi';
  applyTabLayout(tab);
  updateOmnibox();
  updateSecurityIcon();
  updateNavButtons();
  updateChips();
  refreshFingerprintList();
  devOnTabChange();
  highlightActiveTabInSettings();
}

async function closeTab(id, opts = {}) {
  const idx = state.tabs.findIndex((tab) => tab.id === id);
  if (idx === -1) return;
  const tab = state.tabs[idx];

  try { tab.wv.remove(); } catch {}
  try { tab.el.remove(); } catch {}
  window.api.tab.destroy(tab.partition);

  state.tabs.splice(idx, 1);

  if (!state.tabs.length) {
    if (!opts.silent) await createTab();
    return;
  }
  if (state.activeId === id) {
    const next = state.tabs[Math.min(idx, state.tabs.length - 1)];
    activate(next.id);
  }
  refreshFingerprintList();

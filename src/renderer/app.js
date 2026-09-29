async function setLanguage(lang) {
  await window.api.settings.set({ language: lang });
  state.settings.language = lang;
  window.i18n.setLang(lang, { silent: true });
  applyStatic();
  for (const tab of state.tabs) {
    if (tab.url && tab.url.startsWith('fathi://')) {
      tab.title = t('tab.new');
      const titleEl = tab.el.querySelector('.tab-title');
      if (titleEl) titleEl.textContent = tab.title;
    }
    tab.el.title = t('tab.fp');
    const closeBtn = tab.el.querySelector('.tab-close');
    if (closeBtn) { closeBtn.title = t('tab.close'); closeBtn.setAttribute('aria-label', t('tab.close')); }
  }
  updateChips();
  updateSecurityIcon();
  updateOmnibox();
  updateNavButtons();
  if (!$('#settings-overlay').classList.contains('hidden')) renderSection(state.section);
  reloadNewTabs();
  toast(t('toast.languageChanged'), 'ok');
}

async function setTheme(theme) {
  await window.api.settings.set({ theme });
  state.settings.theme = theme;
  applyTheme();
  reloadNewTabs();
  toast(t('toast.themeChanged'), 'ok');
}

/* ---------------------------------------------------------------- events */

window.api.on('fathi:window:open', ({ url }) => {
  if (url) createTab({ url });

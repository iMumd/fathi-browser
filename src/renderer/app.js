function normalizeInput(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  if (/^fathi:\/\//i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^\w+\.\w/.test(s)) return s;
  if (/^(localhost|\[?[\d.a-f:]+\]?)(:\d+)?(\/.*)?$/i.test(s)) return 'http://' + s;
  if (/^[^\s]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(s)) return 'https://' + s;
  return searchUrl(s);
}

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function newTabUrl() {
  const lang = window.i18n.getLang();
  const theme = (state.settings && state.settings.theme) || 'light';
  return `fathi://newtab?lang=${lang}&theme=${theme}`;
}

/* ------------------------------------------------------------------- tabs */

function activeTab() {
  return state.tabs.find((tab) => tab.id === state.activeId) || null;
}

function tabByWcId(wcId) {
  return state.tabs.find((tab) => {
    try { return tab.wv && tab.wv.getWebContentsId() === wcId; } catch { return false; }
  }) || null;

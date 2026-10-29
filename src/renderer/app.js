'use strict';
/* ============================================================================
 * Fathi browser chrome logic
 * ========================================================================== */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const t = (key, vars) => window.i18n.t(key, vars);

const view = $('#view');
const tabstrip = $('#tabstrip');
const omnibox = $('#omnibox');

const SEARCH_ENGINES = {
  duckduckgo: 'https://duckduckgo.com/?q=',
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  brave: 'https://search.brave.com/search?q=',
  startpage: 'https://www.startpage.com/sp/search?query='
};

const state = {
  tabs: [],
  activeId: null,
  settings: null,
  info: null,
  extensions: [],
  section: 'general',
  devices: [],
  deviceGroups: {},
  desktop: { id: 'desktop', name: 'Desktop', mobile: false }
};

let seq = 0;

/* ------------------------------------------------------------------ utils */

function toast(message, kind = '') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 3000);
  setTimeout(() => el.remove(), 3500);
}

/* --------------------------------------------------------------- updates */

let updateState = null;
let updateDismissed = false;
let updateVersionSeen = null;

function updateStatusText(st) {
  if (!st) return '';
  switch (st.status) {
    case 'checking': return t('update.checking');
    case 'latest': return t('update.latest');
    case 'available': return t('update.available', { v: st.version || '', current: st.current || '' });
    case 'downloading': return t('update.downloading', { n: st.progress || 0 });
    case 'ready': return t('update.ready');
    case 'error': return t('update.error');
    default: return '';
  }
}

function hideUpdateBanner() {
  const banner = $('#update-banner');
  if (banner) banner.classList.add('hidden');
}

function renderUpdate(st) {
  if (!st) return;
  updateState = st;
  if (st.version && st.version !== updateVersionSeen && st.status === 'available') {
    updateVersionSeen = st.version;
    updateDismissed = false;
    toast(t('update.available', { v: st.version, current: st.current || '' }), 'ok');
  }
  const inline = $('#about-update-text');
  if (inline) inline.textContent = updateStatusText(st);

  const banner = $('#update-banner');
  if (!banner) return;
  const status = st.status;
  if (status === 'latest') {
    banner.classList.add('hidden');
    return;
  }
  const visible = !updateDismissed && (status === 'available' || status === 'downloading' || status === 'ready');
  banner.classList.toggle('hidden', !visible);
  if (!visible) return;

  const text = $('#ub-text');
  const primary = $('#ub-primary');
  const secondary = $('#ub-secondary');
  const wrap = $('#ub-progress');
  const bar = $('#ub-bar');
  primary.classList.remove('hidden');
  secondary.classList.remove('hidden');
  wrap.classList.add('hidden');

  if (status === 'available') {
    if (st.manual) {
      text.textContent = t('update.manual', { v: st.version || '' });
      primary.textContent = t('update.open');
      secondary.textContent = t('update.copy');
    } else {
      text.textContent = t('update.available', { v: st.version || '', current: st.current || '' });
      primary.textContent = t('update.download');
      secondary.textContent = t('update.later');
    }
  } else if (status === 'downloading') {
    text.textContent = t('update.downloading', { n: st.progress || 0 });
    primary.classList.add('hidden');
    secondary.classList.add('hidden');
    wrap.classList.remove('hidden');
    bar.style.width = `${Math.max(0, Math.min(100, st.progress || 0))}%`;
  } else if (status === 'ready') {
    text.textContent = t('update.ready');
    primary.textContent = t('update.restart');
    secondary.textContent = t('update.later');
  }
}

async function checkForUpdates(silent = false) {
  updateDismissed = false;
  const res = await window.api.update.check();
  if (!res.ok) {
    if (!silent) toast(res.error, 'err');
    return;
  }
  renderUpdate(res.state);
  if (!silent && res.state && res.state.status === 'latest') toast(t('update.latest'), 'ok');
  if (!silent && res.state && res.state.status === 'error') toast(t('update.error'), 'err');
}

function bindUpdateUi() {
  const primary = $('#ub-primary');
  const secondary = $('#ub-secondary');
  const close = $('#ub-close');
  if (!primary || !secondary || !close) return;

  primary.addEventListener('click', async () => {
    const st = updateState || {};
    if (st.status === 'ready') { window.api.update.install(); return; }
    if (st.status !== 'available') return;
    if (st.manual) { window.api.update.open(); return; }
    const res = await window.api.update.download();
    if (!res.ok) toast(res.error, 'err');
  });

  secondary.addEventListener('click', async () => {
    const st = updateState || {};
    if (st.status === 'available' && st.manual) {
      const res = await window.api.update.command();
      if (res.ok) toast(t('update.copied'), 'ok');
      else toast(res.error, 'err');
      return;
    }
    updateDismissed = true;
    hideUpdateBanner();
  });

  close.addEventListener('click', () => {
    updateDismissed = true;
    hideUpdateBanner();
  });

  window.api.update.state().then((res) => {
    if (res && res.ok) {
      renderUpdate(res.state);
    }
  });

  window.api.on('fathi:update:state', (st) => {
    renderUpdate(st);
  });
}

function shortUa(ua) {
  const m = String(ua || '').match(/\(([^)]+)\)/);
  const c = String(ua || '').match(/Chrome\/(\d+)/);
  return (m ? m[1].split(';').slice(0, 2).join('; ') : '') + (c ? ` · Chrome ${c[1]}` : '');
}

function osLabel(fp) {
  const key = (fp && fp.device && fp.device.mobile) ? fp.device.os : (fp && fp.osKey);
  if (key === 'ios') return 'iOS';
  if (key === 'android') return 'Android';
  if (key === 'mac') return 'macOS';
  if (key === 'linux') return 'Linux';
  return 'Windows';
}

function searchUrl(query) {
  const engine = (state.settings && state.settings.searchEngine) || 'duckduckgo';
  return (SEARCH_ENGINES[engine] || SEARCH_ENGINES.duckduckgo) + encodeURIComponent(query);
}

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
}

function makeTabElement(tab) {
  const el = document.createElement('div');
  el.className = 'tab';
  el.setAttribute('role', 'tab');
  el.dataset.id = tab.id;
  el.innerHTML = `
    <div class="tab-fpdot"></div>
    <div class="tab-favicon">F</div>
    <div class="tab-title">${esc(t('tab.new'))}</div>
    <button class="tab-close" data-i18n-title="tab.close" aria-label="${esc(t('tab.close'))}">
      <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>`;
  el.title = t('tab.fp');

  el.addEventListener('mousedown', (e) => {
    if (e.button === 0) activate(tab.id);
  });
  el.querySelector('.tab-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(tab.id);
  });
  el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    if (window.api) window.api.win.toggleMaximize();
  });
  return el;
}

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

  tab.el = makeTabElement(tab);

  const at = typeof opts.index === 'number' ? opts.index : state.tabs.length;
  state.tabs.splice(at, 0, tab);
  const ref = tabstrip.children[at] || null;
  tabstrip.insertBefore(tab.el, ref);

  wireWebview(tab);
  activate(id);

  // Safety net: if the guest was created but no navigation started (rare
  // first-attach race), kick it once more.
  setTimeout(() => {
    try {
      if (!wv.getURL()) wv.loadURL(startUrl);
    } catch {}
  }, 1200);

  if (opts.activate !== false) {
    setTimeout(() => { try { wv.focus(); } catch {} }, 80);
  }
  refreshFingerprintList();
  return tab;
}

function wireWebview(tab) {
  const wv = tab.wv;
  const el = tab.el;

  const setTitle = (title) => {
    tab.title = title || t('tab.untitled');
    el.querySelector('.tab-title').textContent = tab.title;
    el.title = tab.title + '\n' + (tab.url || '');
    if (state.activeId === tab.id) document.title = tab.title + ' · Fathi';
  };

  const setFavicon = (src) => {
    const box = el.querySelector('.tab-favicon');
    if (!src) {
      box.innerHTML = 'F';
      return;
    }
    tab.favicon = src;
    box.innerHTML = `<img src="${esc(src)}" alt="" onerror="this.remove()" />`;
  };

  wv.addEventListener('did-start-loading', () => {
    tab.loading = true;
    el.classList.add('loading');
    $('#progress').classList.add('active');
    $('#bar').style.width = '18%';
    if (state.activeId === tab.id) updateNavButtons();
  });

  wv.addEventListener('did-stop-loading', () => {
    tab.loading = false;
    el.classList.remove('loading');
    wv.classList.add('ready');
    const bar = $('#bar');
    bar.style.width = '100%';
    setTimeout(() => {
      $('#progress').classList.remove('active');
      bar.style.width = '0%';
    }, 240);
    if (state.activeId === tab.id) {
      updateNavButtons();
      updateOmnibox();
      updateSecurityIcon();
    }
  });

  wv.addEventListener('did-start-navigation', (e) => {
    if (!e.isMainFrame) return;
    tab.url = e.url;
    if (state.activeId === tab.id) {
      updateSecurityIcon();
      if (document.activeElement !== omnibox) updateOmnibox();
    }
  });

  wv.addEventListener('did-navigate', (e) => {
    tab.url = e.url;
    if (state.activeId === tab.id) { updateOmnibox(); updateSecurityIcon(); updateNavButtons(); }
  });

  wv.addEventListener('did-navigate-in-page', (e) => {
    if (!e.isMainFrame) return;
    tab.url = e.url;
    if (state.activeId === tab.id) { updateOmnibox(); updateSecurityIcon(); }
  });

  wv.addEventListener('page-title-updated', (e) => {
    if (tab.url && tab.url.startsWith('fathi://newtab')) return;
    setTitle(e.title);
  });
  wv.addEventListener('page-favicon-updated', (e) => {
    if (e.favicons && e.favicons.length) setFavicon(e.favicons[0]);
  });

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
    try { tab.wcId = wv.getWebContentsId(); } catch {}
    if (state.activeId === tab.id) applyTabLayout(tab);
    updateNavButtons();
  });

  wv.addEventListener('console-message', () => { /* silence */ });
}

/** Sizes the tab surface: fills the window on desktop, floats as a phone in device mode. */
function applyTabLayout(tab) {
  if (!tab || !tab.wv) return;
  const dev = tab.fp && tab.fp.device && tab.fp.device.mobile ? tab.fp.device : null;
  const wv = tab.wv;
  const frame = document.getElementById('device-frame');

  if (!dev) {
    view.classList.remove('stage');
    wv.classList.remove('device');
    wv.style.width = '';
    wv.style.height = '';
    wv.style.left = '';
    wv.style.top = '';
    wv.style.transform = '';
    if (frame) { frame.classList.add('hidden'); frame.style.removeProperty('left'); frame.style.removeProperty('top'); frame.style.removeProperty('width'); frame.style.removeProperty('height'); }
    if (tab.wcId) window.api.device.emulate(tab.wcId, { width: view.clientWidth, height: view.clientHeight });
    return;
  }

  view.classList.add('stage');
  wv.classList.add('device');
  const scale = Math.max(0.05, Math.min((Math.max(120, view.clientWidth) - 36) / dev.width, (Math.max(160, view.clientHeight) - 36) / dev.height, 1));
  const fw = Math.round(dev.width * scale);
  const fh = Math.round(dev.height * scale);
  wv.style.width = fw + 'px';
  wv.style.height = fh + 'px';
  wv.style.left = Math.round((view.clientWidth - fw) / 2) + 'px';
  wv.style.top = Math.round((view.clientHeight - fh) / 2) + 'px';
  wv.style.transform = 'none';

  if (frame) {
    frame.style.left = '50%';
    frame.style.top = '50%';
    frame.style.width = fw + 'px';
    frame.style.height = fh + 'px';
    frame.style.transform = `translate(-50%, -50%)`;
    frame.classList.remove('hidden');
  }

  if (tab.wcId) window.api.device.emulate(tab.wcId, { width: view.clientWidth, height: view.clientHeight });
}

function activate(id) {
  const tab = state.tabs.find((x) => x.id === id);
  if (!tab) return;
  state.activeId = id;

  for (const other of state.tabs) {
    const on = other.id === id;
    other.el.classList.toggle('active', on);
    other.el.setAttribute('aria-selected', on ? 'true' : 'false');
    other.wv.classList.toggle('active', on);
  }

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

function navigate(url) {
  const tab = activeTab();
  if (!tab) return;
  const target = normalizeInput(url);
  if (!target) return;
  tab.url = target;
  try { tab.wv.loadURL(target); } catch { tab.wv.setAttribute('src', target); }
  omnibox.blur();
}

/* -------------------------------------------------------------- toolbar UI */

function updateOmnibox() {
  const tab = activeTab();
  if (!tab) return;
  const internal = tab.url && tab.url.startsWith('fathi://');
  if (document.activeElement !== omnibox) {
    omnibox.value = internal ? '' : (tab.url || '');
  }
  omnibox.placeholder = internal ? t('omni.placeholderInternal') : t('omni.placeholder');
  $('#btn-omni-clear').classList.toggle('hidden', !omnibox.value);
}

function updateSecurityIcon() {
  const tab = activeTab();
  const icon = $('#omni-icon');
  icon.className = '';
  if (!tab || !tab.url || tab.url.startsWith('fathi:')) {
    icon.title = t('omni.internal');
    return;
  }
  if (tab.url.startsWith('https://')) { icon.classList.add('secure'); icon.title = t('omni.secure'); }
  else { icon.classList.add('insecure'); icon.title = t('omni.insecure'); }
}

function updateNavButtons() {
  const tab = activeTab();
  const back = $('#btn-back');
  const fwd = $('#btn-fwd');
  if (!tab) return;
  const canBack = (() => { try { return tab.wv.canGoBack(); } catch { return false; } })();
  const canFwd = (() => { try { return tab.wv.canGoForward(); } catch { return false; } })();
  back.disabled = !canBack;
  fwd.disabled = !canFwd;
  $('#btn-reload').title = tab.loading ? t('nav.stop') : t('nav.reload');
  $('#btn-reload').setAttribute('aria-label', $('#btn-reload').title);
}

function deviceLabel(dev) {
  if (!dev || !dev.mobile) return t('devices.desktop');
  return dev.name;
}

function updateChips() {
  const tab = activeTab();
  const fpChip = $('#chip-fp');
  const pxChip = $('#chip-proxy');
  const devChip = $('#chip-device');

  if (tab && tab.fp) {
    const isMobile = !!(tab.fp.device && tab.fp.device.mobile);
    const tag = isMobile
      ? `${osLabel(tab.fp)} · ${tab.fp.device.width}×${tab.fp.device.height}`
      : `${osLabel(tab.fp)} · ${tab.fp.screen.width}×${tab.fp.screen.height}`;
    $('#chip-fp-text').textContent = tag;
    fpChip.classList.add('on');
    fpChip.title = `${t('chip.fingerprint')} ${tab.fp.id}\n${shortUa(tab.fp.ua)}\n${tab.fp.timezone}`;
    $('#chip-device-text').textContent = deviceLabel(tab.fp.device);
    devChip.classList.toggle('on', isMobile);
    devChip.title = `${t('devices.active')}: ${deviceLabel(tab.fp.device)}`;
  } else {
    $('#chip-fp-text').textContent = t('chip.fingerprint');
    fpChip.classList.remove('on');
    $('#chip-device-text').textContent = t('devices.desktop');
    devChip.classList.remove('on');
  }

  const px = tab && tab.proxy;
  if (px && px.enabled && px.host) {
    $('#chip-proxy-text').textContent = px.host;
    pxChip.classList.add('on');
    pxChip.title = t('chip.proxyTitle', { host: px.host, mode: px.mode });
  } else if (px && px.mode === 'rotate') {
    $('#chip-proxy-text').textContent = t('chip.rotate');
    pxChip.classList.add('on');
  } else {
    $('#chip-proxy-text').textContent = t('chip.direct');
    pxChip.classList.remove('on');
  }
}

/* ---------------------------------------------------------------- omnibox */

omnibox.addEventListener('focus', () => { omnibox.select(); });
omnibox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const v = omnibox.value.trim();
    if (v) navigate(v);
    else omnibox.blur();
  }
  if (e.key === 'Escape') {
    updateOmnibox();
    omnibox.blur();
  }
});
omnibox.addEventListener('input', () => {
  $('#btn-omni-clear').classList.toggle('hidden', !omnibox.value);
});
$('#btn-omni-clear').addEventListener('click', () => {
  omnibox.value = '';
  omnibox.focus();
  $('#btn-omni-clear').classList.add('hidden');
});

/* -------------------------------------------------------------- nav action */

$('#btn-back').addEventListener('click', () => { const x = activeTab(); try { x.wv.goBack(); } catch {} });
$('#btn-fwd').addEventListener('click', () => { const x = activeTab(); try { x.wv.goForward(); } catch {} });
$('#btn-reload').addEventListener('click', () => {
  const x = activeTab();
  if (!x) return;
  try { x.loading ? x.wv.stop() : x.wv.reload(); } catch {}
});
$('#btn-home').addEventListener('click', () => {
  const x = activeTab();
  if (!x) return;
  x.url = newTabUrl();
  try { x.wv.loadURL(x.url); } catch {}
});

$('#newtab-btn').addEventListener('click', () => createTab());
$('#btn-shuffle').addEventListener('click', () => createTab());

$('#win-min').addEventListener('click', () => window.api.win.minimize());
$('#win-max').addEventListener('click', () => window.api.win.toggleMaximize());
$('#win-close').addEventListener('click', () => window.api.win.close());

$('#titlebar-drag')?.addEventListener('dblclick', () => window.api.win.toggleMaximize());
$('#titlebar').addEventListener('dblclick', (e) => {
  if (e.target.closest('.tab') || e.target.closest('button')) return;
  window.api.win.toggleMaximize();
});

/* Global shortcuts are registered further down, from the user's shortcut map. */

/* ------------------------------------------------------------ device menu */

function iconFor(dev) {
  if (!dev.mobile) {
    return `<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20h6M12 16.5V20"/></svg>`;
  }
  if (/iPad|Tab/.test(dev.name)) {
    return `<svg viewBox="0 0 24 24"><rect x="4.5" y="2.5" width="15" height="19" rx="2.4"/><path d="M10.5 19h3"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.6"/><path d="M10.6 5.2h2.8"/></svg>`;
}

function deviceItemHtml(dev, activeId) {
  const active = dev.id === activeId;
  const meta = dev.mobile
    ? t('devices.size', { w: dev.width, h: dev.height, dpr: dev.dpr })
    : t('settings.nav.general');
  return `<button class="device-item ${active ? 'active' : ''}" data-device="${esc(dev.id)}">
    <span class="di-icon">${iconFor(dev)}</span>
    <span class="di-text">
      <span class="di-name">${esc(dev.mobile ? dev.name : t('devices.desktop'))}</span>
      <span class="di-meta">${esc(meta)}</span>
    </span>
    <span class="di-check"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span>
  </button>`;
}

function renderDevicePopover() {
  const list = $('#device-list');
  if (!list) return;
  const tab = activeTab();
  const activeId = (tab && tab.fp && tab.fp.device && tab.fp.device.id) || 'desktop';
  const groups = state.deviceGroups || {};
  const order = ['desktop', 'apple', 'samsung', 'google', 'other'];
  let html = '';
  for (const key of order) {
    const arr = groups[key];
    if (!arr || !arr.length) continue;
    html += `<div class="device-group-title">${esc(t('devices.group.' + key))}</div>`;
    html += arr.map((d) => deviceItemHtml(d, activeId)).join('');
  }
  list.innerHTML = html;
  list.querySelectorAll('[data-device]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dev = state.devices.find((d) => d.id === btn.dataset.device) || state.desktop;
      changeDevice(dev);
    });
  });

  const rotateBtn = $('#device-rotate');
  const isMobile = !!(tab && tab.fp && tab.fp.device && tab.fp.device.mobile);
  rotateBtn.classList.toggle('hidden', !isMobile);
}

function openDevicePopover() {
  const pop = $('#device-popover');
  renderDevicePopover();
  pop.classList.remove('hidden');
  const rect = $('#chip-device').getBoundingClientRect();
  const width = 292;
  let left = rect.right - width;
  if (left < 12) left = 12;
  if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
  let top = rect.bottom + 8;
  const maxH = 430;
  if (top + maxH > window.innerHeight - 12) top = Math.max(12, window.innerHeight - maxH - 12);
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
}

function closeDevicePopover() {
  $('#device-popover').classList.add('hidden');
}

$('#chip-device').addEventListener('click', (e) => {
  e.stopPropagation();
  const pop = $('#device-popover');
  if (pop.classList.contains('hidden')) openDevicePopover();
  else closeDevicePopover();
});

$('#device-rotate').addEventListener('click', (e) => {
  e.stopPropagation();
  const tab = activeTab();
  if (!tab || !tab.fp.device || !tab.fp.device.mobile) return;
  changeDevice(tab.fp.device, tab.fp.device.orientation !== 'landscape');
});

document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('#device-popover') && !e.target.closest('#chip-device')) closeDevicePopover();
});

/* -------------------------------------------------- flow + dev drawer */

const ix = { enabled: false, items: [], current: null, filter: '', view: 'request' };

const flow = {
  wcId: null,
  records: [],
  filter: '',
  selected: null,
  detail: null,
  detailTab: 'analysis',
  scope: 'tab',
  format: 'har',
  codeLang: 'curl'
};

const dev = { open: false, tab: 'flow' };

const CODE_LANGS = [
  ['curl', 'cURL'],
  ['python', 'Python · requests'],
  ['python-http', 'Python · http.client'],
  ['php', 'PHP · cURL'],
  ['node', 'Node.js · fetch'],
  ['powershell', 'PowerShell'],
  ['go', 'Go'],
  ['raw', 'Raw HTTP']
];

/* --------------------------------------------------------------- helpers */

function fmtBytes(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

function fmtMs(n) {
  n = Number(n) || 0;
  if (n <= 0) return 'n/a';
  if (n < 1000) return Math.round(n) + ' ms';
  return (n / 1000).toFixed(2) + ' s';
}

function statusCls(s) {
  s = Number(s) || 0;
  if (!s) return '';
  if (s >= 500) return 'err';
  if (s >= 400) return 'warn';
  if (s >= 300) return 'info';
  if (s >= 200) return 'ok';
  return '';
}

function copyText(text) {
  const value = String(text == null ? '' : text);
  const done = () => toast(t('flow.copied'), 'ok');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(value).then(done).catch(() => fallbackCopy(value, done));
    return;
  }
  fallbackCopy(value, done);
}

function fallbackCopy(value, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    done();
  } catch {
    toast('Copy failed', 'err');
  }
}

function prettyUrl(u) {
  try {
    const x = new URL(u);
    return x.host + x.pathname + (x.search || '');
  } catch { return String(u || ''); }
}

function lowerHeaders(headers) {  const out = {};
  for (const [k, v] of Object.entries(headers || {})) out[String(k).toLowerCase()] = v;
  return out;
}

function headerPairs(headers) {
  return Object.entries(headers || {}).filter(([k]) => {
    const n = String(k).toLowerCase();
    if (n.startsWith(':')) return false;
    return !['host', 'content-length', 'connection', 'accept-encoding', 'transfer-encoding',
      'http2-settings', 'upgrade', 'proxy-connection'].includes(n);
  });
}

/* ------------------------------------------------------------ code gen */

function shq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
function dq(s) {
  return '"' + String(s)
    .replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"';
}
function phpq(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
function goq(s) {
  return '`' + String(s).replace(/`/g, '` + "`" + `') + '`';
}

function codeFor(rec, lang) {
  const url = rec.url || '';
  const method = (rec.method || 'GET').toUpperCase();
  const headers = headerPairs(rec.requestHeaders);
  const body = rec.postData || '';
  let u;
  try { u = new URL(url); } catch { u = null; }

  if (lang === 'raw') {
    const path = u ? u.pathname + (u.search || '') : url;
    const host = u ? u.host : '';
    const lines = [`${method} ${path} HTTP/1.1`];
    if (host) lines.push(`Host: ${host}`);
    for (const [k, v] of headers) lines.push(`${k}: ${v}`);
    return lines.join('\n') + (body ? '\n\n' + body : '');
  }

  if (lang === 'python') {
    const hs = headers.map(([k, v]) => `    ${dq(k)}: ${dq(v)},`).join('\n');
    return [
      'import requests',
      '',
      `url = ${dq(url)}`,
      'headers = {',
      hs,
      '}',
      body ? `payload = ${dq(body)}` : 'payload = None',
      '',
      `resp = requests.request(${dq(method)}, url, headers=headers, data=payload, timeout=30)`,
      'print(resp.status_code)',
      'print(resp.text)'
    ].join('\n');
  }

  if (lang === 'python-http') {
    const secure = u && u.protocol === 'http:' ? 'HTTP' : 'HTTPS';
    const host = u ? u.hostname : '';
    const port = u && u.port ? Number(u.port) : 0;
    const path = u ? u.pathname + (u.search || '') : '/';
    const hs = headers.map(([k, v]) => `    ${dq(k)}: ${dq(v)},`).join('\n');
    return [
      'import http.client',
      '',
      `host = ${dq(host)}`,
      `path = ${dq(path)}`,
      `conn = http.client.${secure}Connection(host${port ? ', ' + port : ''}, timeout=30)`,
      `body = ${body ? dq(body) : 'None'}`,
      'headers = {',
      hs,
      '}',
      '',
      `conn.request(${dq(method)}, path, body=body, headers=headers)`,
      'res = conn.getresponse()',
      'print(res.status, res.reason)',
      'print(res.read().decode("utf-8", "replace"))',
      'conn.close()'
    ].join('\n');
  }

  if (lang === 'php') {
    const hs = headers.map(([k, v]) => `        ${dq(k + ': ' + v)},`).join('\n');
    return [
      '<?php',
      '$ch = curl_init();',
      'curl_setopt_array($ch, [',
      `    CURLOPT_URL => ${dq(url)},`,
      '    CURLOPT_RETURNTRANSFER => true,',
      `    CURLOPT_CUSTOMREQUEST => ${dq(method)},`,
      '    CURLOPT_HTTPHEADER => [',
      hs,
      '    ],',
      body ? `    CURLOPT_POSTFIELDS => ${dq(body)},` : null,
      ']);',
      '$response = curl_exec($ch);',
      '$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);',
      'curl_close($ch);',
      'echo $status . "\\n" . $response;'
    ].filter((x) => x !== null).join('\n');
  }

  if (lang === 'node') {
    const hs = headers.map(([k, v]) => `    ${dq(k)}: ${dq(v)},`).join('\n');
    return [
      'const res = await fetch(' + dq(url) + ', {',
      `  method: ${dq(method)},`,
      '  headers: {',
      hs,
      '  },',
      body ? `  body: ${dq(body)},` : null,
      '});',
      'console.log(res.status);',
      'console.log(await res.text());'
    ].filter((x) => x !== null).join('\n');
  }

  if (lang === 'powershell') {
    const hs = headers.map(([k, v]) => `    ${dq(k)} = ${dq(v)}`).join('\n');
    return [
      '$headers = @{',
      hs,
      '}',
      body ? `$body = @'\n${body}\n'@` : '$body = $null',
      '',
      `$r = Invoke-WebRequest -Uri ${dq(url)} -Method ${method} -Headers $headers -Body $body`,
      '$r.StatusCode',
      '$r.Content'
    ].join('\n');
  }

  if (lang === 'go') {
    const hs = headers.map(([k, v]) => `  req.Header.Set(${dq(k)}, ${dq(v)})`).join('\n');
    return [
      'package main',
      '',
      'import (',
      '  "fmt"',
      '  "io"',
      '  "net/http"',
      '  "strings"',
      '  "time"',
      ')',
      '',
      'func main() {',
      body ? `  body := strings.NewReader(${goq(body)})` : '  var body io.Reader',
      `  req, err := http.NewRequest(${dq(method)}, ${dq(url)}, body)`,
      '  if err != nil { panic(err) }',
      hs,
      '  res, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)',
      '  if err != nil { panic(err) }',
      '  defer res.Body.Close()',
      '  out, _ := io.ReadAll(res.Body)',
      '  fmt.Println(res.Status)',
      '  fmt.Println(string(out))',
      '}'
    ].filter((x) => x !== '' || true).join('\n');
  }

  // cURL is the default
  const parts = [`curl -X ${method} ${shq(url)}`];
  for (const [k, v] of headers) parts.push(`  -H ${shq(k + ': ' + v)}`);
  if (body) parts.push(`  --data-raw ${shq(body)}`);
  parts.push('  --compressed --insecure -sS');
  return parts.join(' \\\n');
}

/* ------------------------------------------------------------- intercept */

function ixUpdateChrome() {  const count = ix.items.length;
  const chip = $('#chip-intercept');
  const badge = $('#chip-intercept-count');
  if (badge) {
    badge.textContent = String(count);
    badge.classList.toggle('hidden', count === 0);
  }
  if (chip) {
    chip.classList.toggle('on', ix.enabled);
    chip.title = `${t('intercept.title')} · ${ix.enabled ? t('intercept.on') : t('intercept.off')}`;
  }
  const toggle = $('#ix-toggle');
  if (toggle) toggle.classList.toggle('on', ix.enabled);
  const pane = $('#pane-intercept');
  if (pane) pane.classList.toggle('on', ix.enabled);
  const stateText = $('#ix-state-text');
  if (stateText) stateText.textContent = ix.enabled ? t('intercept.on') : t('intercept.off');
  const countEl = $('#ix-count');
  if (countEl) countEl.textContent = String(count);
  const hint = $('#ix-hint');
  if (hint) hint.textContent = ix.enabled ? t('intercept.hint') : t('intercept.off');
  const filter = $('#ix-filter');
  if (filter && document.activeElement !== filter) filter.value = ix.filter || '';
}

function ixRenderList() {
  const box = $('#ix-list');
  if (!box) return;
  const needle = String(ix.filter || '').trim().toLowerCase();
  const list = needle
    ? ix.items.filter((r) => {
        const hay = `${r.method} ${r.url} ${r.resourceType} ${r.postData || ''} ${JSON.stringify(r.headers || {})}`.toLowerCase();
        return needle.split(/\s+/).filter(Boolean).every((part) => hay.includes(part));
      })
    : ix.items;
  if (!list.length) {
    box.innerHTML = `<div class="ix-empty">${esc(t('intercept.empty'))}</div>`;
    return;
  }
  box.innerHTML = list.map((r) => `
    <button class="ix-item ${ix.current === r.id ? 'active' : ''}" data-ix="${esc(r.id)}">
      <span class="ix-m">${esc(r.method)}</span>
      <span class="ix-u" title="${esc(r.url)}">${esc(r.url)}</span>
      <span class="ix-t">${esc(r.resourceType || '')}${r.hasResponse ? ' · R' : ''}</span>
    </button>`).join('') || `<div class="ix-empty">${esc(t('intercept.empty'))}</div>`;
  box.querySelectorAll('[data-ix]').forEach((b) => {
    b.addEventListener('click', () => ixOpenItem(b.dataset.ix));
  });
}

/* ---- structured header editors ---- */

function ixHeaderRow(name = '', value = '') {
  const row = document.createElement('div');
  row.className = 'ix-hrow';
  row.innerHTML = `
    <input class="hname" type="text" spellcheck="false" dir="ltr" placeholder="Header" />
    <input class="hval" type="text" spellcheck="false" dir="ltr" placeholder="Value" />
    <button class="hdel" title="${esc(t('mr.remove'))}" aria-label="Remove">
      <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>`;
  row.querySelector('.hname').value = name;
  row.querySelector('.hval').value = value;
  row.querySelector('.hdel').addEventListener('click', () => row.remove());
  return row;
}

function ixRenderHeaderRows(headers) {
  const box = $('#ix-headers-rows');
  if (!box) return;
  box.innerHTML = '';
  const pairs = Object.entries(headers || {});
  if (!pairs.length) box.appendChild(ixHeaderRow());
  for (const [name, value] of pairs) {
    box.appendChild(ixHeaderRow(name, Array.isArray(value) ? value.join(', ') : String(value)));
  }
}

function ixHeaderPairsFromRows() {
  const out = [];
  $$('#ix-headers-rows .ix-hrow').forEach((row) => {
    const name = row.querySelector('.hname').value.trim();
    const value = row.querySelector('.hval').value;
    if (name) out.push({ name, value });
  });
  return out;
}

function prettyJson(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return null;
  }
}

function ixFormatBody() {
  const box = $('#ix-body-text');
  if (!box) return;
  const pretty = prettyJson(box.value);
  if (pretty == null) return toast(t('intercept.pretty'), 'err');
  box.value = pretty;
  box.classList.add('mono-wrap');
}

function ixFormatResponse() {
  const el = $('#ix-resp-body');
  if (!el) return;
  const pretty = prettyJson(el.textContent || '');
  if (pretty == null) return;
  el.textContent = pretty;
}

function ixShowTab(which) {
  const isResponse = which === 'response';
  $('#ix-request-view').classList.toggle('hidden', isResponse);
  $('#ix-response-view').classList.toggle('hidden', !isResponse);
  $$('.ix-name').forEach((b) => b.classList.toggle('active', b.dataset.ixTab === which));
  ix.view = which;
}

async function ixOpenItem(id) {
  const rec = ix.items.find((r) => r.id === id);
  if (!rec) return;
  ix.current = id;
  $('#ix-list').classList.add('hidden');
  $('#ix-detail').classList.remove('hidden');
  $('#ix-repeat-out')?.remove();
  $('#ix-url').value = rec.url;
  $('#ix-method').value = rec.method;
  $('#ix-type').value = rec.resourceType || '';
  ixRenderHeaderRows(rec.headers || {});
  $('#ix-body-text').value = rec.postData || '';
  $('#ix-body-text').classList.toggle('mono-wrap', /\n/.test(rec.postData || ''));
  $('#ix-body-field').classList.toggle('hidden', /^(GET|HEAD)$/i.test(rec.method));
  const hint = $('#ix-body-hint');
  if (hint) hint.textContent = t('intercept.bodyHint');

  const respHeaders = $('#ix-resp-headers');
  if (respHeaders) {
    respHeaders.textContent = rec.responseHeaders
      ? Object.entries(rec.responseHeaders).map(([k, v]) => `${k}: ${v}`).join('\n')
      : t('intercept.repeatEmpty');
  }
  const respBody = $('#ix-resp-body');
  if (respBody) respBody.textContent = rec.hasResponse ? '' : t('intercept.repeatEmpty');

  ixShowTab('request');
  ixRenderList();
}

function ixBack() {
  ix.current = null;
  const detail = $('#ix-detail');
  const list = $('#ix-list');
  if (detail) detail.classList.add('hidden');
  if (list) list.classList.remove('hidden');
  ixRenderList();
}

function ixParseHeaders(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const i = line.indexOf(':');
    if (i <= 0) continue;
    out.push({ name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() });
  }
  return out;
}

function ixCurrentRecord() {
  const rec = ix.items.find((r) => r.id === ix.current);
  if (!rec) return null;
  return {
    url: $('#ix-url').value.trim() || rec.url,
    method: ($('#ix-method').value.trim() || rec.method).toUpperCase(),
    requestHeaders: Object.fromEntries(ixHeaderPairsFromRows().map((h) => [h.name, h.value])),
    postData: $('#ix-body-text').value || ''
  };
}

async function ixResolve(action) {
  const rec = ix.items.find((r) => r.id === ix.current);
  if (!rec) return ixBack();
  const payload = {
    id: rec.id,
    action,
    url: $('#ix-url').value.trim(),
    method: $('#ix-method').value.trim().toUpperCase(),
    headers: ixHeaderPairsFromRows(),
    postData: $('#ix-body-text').value
  };
  const res = await window.api.intercept.resolve(payload);
  if (!res || !res.ok) toast((res && res.error) || t('proxy.error'), 'err');
  ixRemove(rec.id);
}

/* ------------------------------------------------ Repeat (edit and resend) */

async function ixRepeat() {
  const rec = ixCurrentRecord();
  if (!rec) return;
  const btn = $('#ix-repeat');
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = t('intercept.repeating');
  try {
    const res = await window.api.intercept.repeat({
      url: rec.url,
      method: rec.method,
      headers: rec.requestHeaders,
      postData: rec.postData
    });
    if (!res || !res.ok) {
      toast((res && res.error) || t('proxy.error'), 'err');
      return;
    }
    ixRenderRepeat(res.response);
    ixShowTab('response');
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

function ixRenderRepeat(response) {
  const detail = $('#ix-detail');
  if (!detail) return;
  $('#ix-repeat-out')?.remove();
  const r = response || {};
  const headers = Object.entries(r.headers || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
  const pretty = r.body ? prettyJson(r.body) : null;
  const box = document.createElement('div');
  box.id = 'ix-repeat-out';
  box.innerHTML = `
    <div class="net-head">
      <span class="net-status ${statusCls(r.status)}">${r.status || 'ERR'}</span>
      <div class="net-title"><b>${esc(r.statusText || '')}</b> ${r.mimeType ? esc(r.mimeType) : ''}</div>
      <span class="muted small">${fmtMs(r.time)}</span>
    </div>
    <h4>${esc(t('intercept.repeatTitle'))}</h4>
    <div class="hdr-block">${esc(headers || 'n/a')}</div>
    ${r.body ? `<pre class="body-pre">${esc(pretty || r.body)}</pre>` : `<div class="ix-empty">${esc(t('intercept.repeatEmpty'))}</div>`}
    ${r.truncated ? `<div class="net-note info">${esc(t('flow.truncated'))}</div>` : ''}`;
  detail.appendChild(box);
  box.scrollIntoView({ block: 'nearest' });
}

function ixRemove(id) {
  ix.items = ix.items.filter((r) => r.id !== id);
  if (ix.current === id) {
    ix.current = null;
    const detail = $('#ix-detail');
    const list = $('#ix-list');
    if (detail) detail.classList.add('hidden');
    if (list) list.classList.remove('hidden');
  }
  ixRenderList();
  ixUpdateChrome();
}

/* ------------------------------------------------------------------ flow */

function flowWcId() {
  const tab = activeTab();
  if (!tab || !tab.wv) return null;
  try { return tab.wv.getWebContentsId(); } catch { return null; }
}

function flowMerge(list) {
  if (!Array.isArray(list) || !list.length) return;
  const map = new Map(flow.records.map((r) => [r.id, r]));
  for (const r of list) map.set(r.id, r);
  flow.records = Array.from(map.values()).sort((a, b) => a.startedAt - b.startedAt);
  if (flow.records.length > 1500) flow.records = flow.records.slice(-1500);
}

function calcStats(recs) {
  let bytes = 0;
  let failed = 0;
  let ms = 0;
  let timed = 0;
  const statuses = { s2: 0, s3: 0, s4: 0, s5: 0 };
  const domains = new Map();
  const slow = [];
  for (const r of recs) {
    bytes += Number(r.size) || 0;
    if (r.failed) failed += 1;
    if (r.time > 0) { ms += r.time; timed += 1; }
    if (r.status >= 200 && r.status < 300) statuses.s2 += 1;
    else if (r.status >= 300 && r.status < 400) statuses.s3 += 1;
    else if (r.status >= 400 && r.status < 500) statuses.s4 += 1;
    else if (r.status >= 500) statuses.s5 += 1;
    let host = '';
    try { host = new URL(r.url).hostname; } catch {}
    if (host) {
      const d = domains.get(host) || { host, count: 0, bytes: 0 };
      d.count += 1;
      d.bytes += Number(r.size) || 0;
      domains.set(host, d);
    }
    if (r.time > 0) slow.push({ url: r.url, ms: Math.round(r.time), status: r.status });
  }
  slow.sort((a, b) => b.ms - a.ms);
  return {
    count: recs.length,
    bytes,
    failed,
    avgMs: timed ? Math.round(ms / timed) : 0,
    statuses,
    slowest: slow.slice(0, 5),
    domains: Array.from(domains.values()).sort((a, b) => b.bytes - a.bytes).slice(0, 6)
  };
}

function netRow(r) {
  return `
    <button class="net-row" data-net="${esc(r.id)}" data-wc="${esc(r.wcId)}" title="${esc(r.url)}">
      <span class="net-status ${statusCls(r.status)}">${r.status || (r.failed ? 'ERR' : 'n/a')}</span>
      <span class="net-m">${esc(r.method)}</span>
      <span class="net-u">${esc(prettyUrl(r.url))}</span>
      <span class="net-size">${fmtBytes(r.size)}</span>
      <span class="net-ms">${fmtMs(r.time)}</span>
    </button>`;
}

function flowRender() {
  const needle = flow.filter.trim().toLowerCase();
  const list = needle
    ? flow.records.filter((r) => `${r.url} ${r.method} ${r.status} ${r.mimeType}`.toLowerCase().includes(needle))
    : flow.records;
  const st = calcStats(list);

  $('#net-total').textContent = String(st.count);
  $('#net-bytes').textContent = fmtBytes(st.bytes);
  $('#net-avg').textContent = fmtMs(st.avgMs);
  $('#net-fail').textContent = String(st.failed);

  const badge = $('#ix-net-count');
  if (badge) badge.textContent = String(flow.records.length);
  const chipCount = $('#chip-flow-count');
  if (chipCount) {
    chipCount.textContent = String(flow.records.length);
    chipCount.classList.toggle('hidden', flow.records.length === 0);
  }

  const box = $('#net-list');
  if (!box) return;
  if (!list.length) {
    box.innerHTML = `<div class="ix-empty">${esc(t('flow.empty'))}</div>`;
    return;
  }
  box.innerHTML = list.slice(-500).reverse().map(netRow).join('');
  box.querySelectorAll('[data-net]').forEach((b) => {
    b.addEventListener('click', () => flowOpen(b.dataset.net, b.dataset.wc));
  });
}

async function flowLoad() {
  flow.wcId = flowWcId();
  if (flow.wcId == null && flow.scope !== 'all') {
    flow.records = [];
    flowRender();
    return;
  }
  const res = await window.api.net.list({ wcId: flow.wcId, all: flow.scope === 'all' });
  if (!res || !res.ok) return;
  flow.records = res.records || [];
  flowRender();
}

function flowBack() {
  flow.selected = null;
  flow.detail = null;
  const list = $('#net-list');
  const detail = $('#net-detail');
  if (list) list.classList.remove('hidden');
  if (detail) { detail.classList.add('hidden'); detail.innerHTML = ''; }
  flowRender();
}

async function flowOpen(id, wcId) {
  const targetWc = Number(wcId) || flow.wcId;
  const res = await window.api.net.detail({ wcId: targetWc, id });
  if (!res || !res.ok) return toast((res && res.error) || 'Request not found', 'err');
  flow.selected = id;
  flow.detail = res.record;
  flow.detailTab = 'analysis';
  flow.codeLang = 'curl';
  $('#net-list').classList.add('hidden');
  $('#net-detail').classList.remove('hidden');
  flowRenderDetail();
}

function flowRenderDetail() {
  const r = flow.detail;
  const d = $('#net-detail');
  if (!r || !d) return;

  const host = (() => { try { return new URL(r.url).host; } catch { return ''; } })();
  const tabs = [
    ['analysis', 'flow.analysis'],
    ['request', 'flow.request'],
    ['response', 'flow.response'],
    ['timing', 'flow.timing'],
    ['code', 'flow.code']
  ];

  d.innerHTML = `
    <div class="net-head">
      <span class="net-status ${statusCls(r.status)}">${r.status || (r.failed ? 'ERR' : 'n/a')}</span>
      <div class="net-title"><b>${esc(r.method)}</b> ${esc(r.url)}</div>
      <button class="btn sm" id="net-back" title="${esc(t('flow.back'))}">${esc(t('flow.back'))}</button>
    </div>
    <div class="net-facts">
      <span>${esc(r.resourceType || 'Other')}</span>
      ${r.mimeType ? `<span>${esc(r.mimeType)}</span>` : ''}
      <span>${fmtBytes(r.size)}</span>
      <span>${fmtMs(r.timing ? r.timing.total : r.time)}</span>
      ${host ? `<span>${esc(host)}</span>` : ''}
      ${r.fromCache ? `<span>${esc(t('flow.cached'))}</span>` : ''}
      ${r.fromServiceWorker ? `<span>${esc(t('flow.serviceWorker'))}</span>` : ''}
    </div>
    <div class="net-actions">
      <button class="btn sm" data-copy="url">${esc(t('flow.copyUrl'))}</button>
      <button class="btn sm" data-copy="curl">${esc(t('flow.copyCurl'))}</button>
      <button class="btn sm" data-copy="raw">${esc(t('flow.copyRaw'))}</button>
      <button class="btn sm" data-copy="python">Python</button>
      <button class="btn sm" data-copy="php">PHP</button>
    </div>
    <div class="net-tabs">
      ${tabs.map(([id, key]) => `<button class="net-tab ${flow.detailTab === id ? 'active' : ''}" data-nt="${id}">${esc(t(key))}</button>`).join('')}
    </div>
    <div class="net-panel" id="net-panel"></div>`;

  $('#net-back').addEventListener('click', flowBack);
  d.querySelectorAll('.net-tab').forEach((b) => {
    b.addEventListener('click', () => {
      flow.detailTab = b.dataset.nt;
      d.querySelectorAll('.net-tab').forEach((x) => x.classList.toggle('active', x === b));
      flowRenderPanel();
    });
  });
  d.querySelectorAll('[data-copy]').forEach((b) => {
    b.addEventListener('click', () => {
      const kind = b.dataset.copy;
      if (kind === 'url') copyText(r.url);
      else copyText(codeFor(r, kind));
    });
  });
  flowRenderPanel();
}

function flowRenderPanel() {
  const r = flow.detail;
  const panel = $('#net-panel');
  if (!r || !panel) return;

  if (flow.detailTab === 'request') {
    panel.innerHTML = `
      <h4>${esc(t('flow.requestHeaders'))}</h4>
      <div class="hdr-block">${esc(Object.entries(r.requestHeaders || {}).map(([k, v]) => `${k}: ${v}`).join('\n') || 'n/a')}</div>
      <h4>${esc(t('flow.requestBody'))}</h4>
      ${r.postData ? `<pre class="body-pre">${esc(clip(r.postData))}</pre>` : `<div class="ix-empty">${esc(t('flow.noBody'))}</div>`}`;
    return;
  }

  if (flow.detailTab === 'response') {
    const headers = Object.entries(r.responseHeaders || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
    const body = r.body == null ? '' : String(r.body);
    panel.innerHTML = `
      <h4>${esc(t('flow.responseHeaders'))}</h4>
      <div class="hdr-block">${esc(headers || 'n/a')}</div>
      <h4>${esc(t('flow.responseBody'))}</h4>
      ${body ? `<pre class="body-pre">${esc(clip(body))}</pre>${r.bodyTruncated ? `<div class="net-note info">${esc(t('flow.truncated'))}</div>` : ''}` : `<div class="ix-empty">${esc(t('flow.noBody'))}</div>`}`;
    return;
  }

  if (flow.detailTab === 'timing') {
    const tm = r.timing || {};
    const total = Math.max(1, Number(tm.total) || 1);
    const rows = [
      ['flow.hdrDns', tm.dns],
      ['flow.hdrConnect', tm.connect],
      ['flow.hdrSsl', tm.ssl],
      ['flow.hdrSend', tm.send],
      ['flow.hdrWait', tm.wait],
      ['flow.hdrReceive', tm.receive]
    ];
    panel.innerHTML = `
      <h4>${esc(t('flow.timing'))}</h4>
      ${rows.map(([key, value]) => barRow(t(key), value, total)).join('')}
      ${barRow(t('flow.hdrTotal'), total, total)}
      <h4>${esc(t('flow.analysis'))}</h4>
      <dl class="kv">
        <dt>${esc(t('flow.ip'))}</dt><dd>${esc(r.remoteIPAddress || 'n/a')}${r.remotePort ? ':' + r.remotePort : ''}</dd>
        <dt>Protocol</dt><dd>${esc(r.protocol || 'n/a')}</dd>
        <dt>${esc(t('flow.source'))}</dt><dd>${esc(r.fromCache ? t('flow.cached') : r.fromServiceWorker ? t('flow.serviceWorker') : t('flow.network'))}</dd>
        <dt>${esc(t('flow.time'))}</dt><dd>${fmtMs(tm.total)}</dd>
      </dl>`;
    return;
  }

  if (flow.detailTab === 'code') {
    panel.innerHTML = `
      <div class="code-lang-row">
        <select id="net-code-lang" class="mini-select">
          ${CODE_LANGS.map(([id, label]) => `<option value="${id}" ${flow.codeLang === id ? 'selected' : ''}>${esc(label)}</option>`).join('')}
        </select>
        <button class="btn sm primary" id="net-code-copy">${esc(t('flow.copyCode'))}</button>
      </div>
      <pre class="body-pre code-box" id="net-code-pre">${esc(codeFor(r, flow.codeLang))}</pre>`;
    $('#net-code-lang').addEventListener('change', (e) => {
      flow.codeLang = e.target.value;
      $('#net-code-pre').textContent = codeFor(r, flow.codeLang);
    });
    $('#net-code-copy').addEventListener('click', () => copyText(codeFor(r, flow.codeLang)));
    return;
  }

  // analysis
  const stats = calcStats(flow.records);
  const notes = flowNotes(r);
  const total = Math.max(1, Number(r.timing && r.timing.total) || 1);
  const sc = stats.statuses;
  panel.innerHTML = `
    <h4>${esc(t('flow.notes'))}</h4>
    ${notes.map(([kind, text]) => `<div class="net-note ${kind}">${esc(text)}</div>`).join('')}

    <h4>${esc(t('flow.timing'))}</h4>
    ${barRow(t('flow.hdrWait'), r.timing && r.timing.wait, total)}
    ${barRow(t('flow.hdrReceive'), r.timing && r.timing.receive, total)}
    ${barRow(t('flow.hdrDns'), r.timing && r.timing.dns, total)}
    ${barRow(t('flow.hdrSsl'), r.timing && r.timing.ssl, total)}

    <h4>${esc(t('flow.fullFlow'))} · ${esc(t('flow.requests'))}</h4>
    <dl class="kv">
      <dt>${esc(t('flow.requests'))}</dt><dd>${stats.count}</dd>
      <dt>${esc(t('flow.transferred'))}</dt><dd>${fmtBytes(stats.bytes)}</dd>
      <dt>${esc(t('flow.avg'))}</dt><dd>${fmtMs(stats.avgMs)}</dd>
      <dt>${esc(t('flow.failed'))}</dt><dd>${stats.failed}</dd>
      <dt>${esc(t('flow.statuses'))}</dt><dd>2xx ${sc.s2} · 3xx ${sc.s3} · 4xx ${sc.s4} · 5xx ${sc.s5}</dd>
    </dl>

    <h4>${esc(t('flow.slowest'))}</h4>
    ${stats.slowest.length
      ? stats.slowest.map((s) => `<div class="net-slow"><span title="${esc(s.url)}">${esc(prettyUrl(s.url))}</span><span>${fmtMs(s.ms)}</span></div>`).join('')
      : `<div class="ix-empty">${esc(t('flow.empty'))}</div>`}

    <h4>${esc(t('flow.domains'))}</h4>
    <div class="net-domains">
      ${stats.domains.map((d) => `<div class="net-domain"><b>${esc(d.host)}</b><span>${d.count}</span><span>${fmtBytes(d.bytes)}</span></div>`).join('')}
    </div>`;
}

function barRow(label, value, total) {
  const n = Math.max(0, Number(value) || 0);
  const pct = Math.max(0, Math.min(100, (n / Math.max(1, total)) * 100));
  return `<div class="bar-row">
    <span class="lbl">${esc(label)}</span>
    <span class="val">${n > 0 ? Math.round(n) + ' ms' : 'n/a'}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${pct.toFixed(1)}%"></span></span>
  </div>`;
}

function flowNotes(r) {
  const notes = [];
  const tm = r.timing || {};
  const headers = lowerHeaders(r.responseHeaders);
  const mime = String(r.mimeType || '');
  const texty = /text|json|xml|javascript|css|html/i.test(mime);

  if (r.failed) notes.push(['err', t('flow.noteFailed').replace('{error}', r.errorText || '')]);
  if (r.status >= 400) notes.push([statusCls(r.status), t('flow.noteStatus').replace('{s}', r.status)]);
  if (/^http:/i.test(r.url)) notes.push(['warn', t('flow.noteHttps')]);
  if (r.fromCache) notes.push(['info', t('flow.noteCache')]);
  if (texty && r.size > 50000 && !headers['content-encoding']) notes.push(['warn', t('flow.noteCompression')]);
  if (r.size > 1048576) notes.push(['warn', t('flow.noteLarge').replace('{size}', fmtBytes(r.size))]);
  if (/^image\//i.test(mime) && r.size > 300000) notes.push(['warn', t('flow.noteImage').replace('{size}', fmtBytes(r.size))]);
  if (tm.wait > 500) notes.push(['warn', t('flow.noteTtfb').replace('{ms}', Math.round(tm.wait))]);
  if (tm.dns > 100) notes.push(['info', t('flow.noteDns').replace('{ms}', Math.round(tm.dns))]);
  if (tm.ssl > 200) notes.push(['info', t('flow.noteTls').replace('{ms}', Math.round(tm.ssl))]);
  if (r.redirectURL) notes.push(['info', t('flow.noteRedirect').replace('{url}', r.redirectURL)]);
  if (!notes.length) notes.push(['ok', t('flow.noteOk')]);
  return notes;
}

function clip(text) {
  const s = String(text == null ? '' : text);
  return s.length > 60000 ? s.slice(0, 60000) + '\n…' : s;
}

async function flowSave() {
  const format = $('#net-format').value;
  const all = $('#net-scope').value === 'all';
  const res = await window.api.net.export({ format, wcId: flowWcId(), all });
  if (res && res.ok) {
    if (res.path) toast(t('flow.saved').replace('{path}', res.path), 'ok');
  } else if (res && res.error) {
    toast(res.error, 'err');
  }
}

async function flowClear() {
  const all = $('#net-scope').value === 'all';
  await window.api.net.clear({ wcId: flowWcId(), all });
  flow.records = [];
  flow.selected = null;
  flow.detail = null;
  $('#net-detail').classList.add('hidden');
  $('#net-list').classList.remove('hidden');
  flowRender();
  toast(t('flow.cleared'), 'ok');
}

/* ------------------------------------------------------------- dev drawer */

function devOpen(tab) {
  dev.open = true;
  $('#ix-drawer').classList.remove('hidden');
  devSwitch(tab || dev.tab);
  ixUpdateChrome();
  ixRenderList();
  setTimeout(() => {
    const f = dev.tab === 'flow' ? $('#net-filter') : $('#ix-filter');
    if (f) f.focus();
  }, 70);
}

function devClose() {
  dev.open = false;
  $('#ix-drawer').classList.add('hidden');
  if (dev.tab === 'flow') flowBack();
  else ixBack();
}

function devSwitch(tab) {
  dev.tab = tab === 'intercept' ? 'intercept' : 'flow';
  document.querySelectorAll('.ix-tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.devTab === dev.tab);
  });
  $('#pane-flow').classList.toggle('hidden', dev.tab !== 'flow');
  $('#pane-intercept').classList.toggle('hidden', dev.tab !== 'intercept');
  if (dev.tab === 'flow') flowLoad();
  else ixRenderList();
  ixUpdateChrome();
}

function devToggle(tab) {
  if (dev.open && dev.tab === tab) devClose();
  else devOpen(tab);
}

function devOnTabChange() {
  if (dev.open && dev.tab === 'flow') flowLoad();
}

function ixOpenDrawer() { devOpen('intercept'); }
function ixCloseDrawer() { devClose(); }

/* -------------------------------------------------------------- wiring */

$('#chip-flow').addEventListener('click', () => devToggle('flow'));
$('#chip-intercept').addEventListener('click', () => devToggle('intercept'));
$('#ix-close').addEventListener('click', devClose);
document.querySelectorAll('.ix-tab').forEach((b) => {
  b.addEventListener('click', () => devSwitch(b.dataset.devTab));
});

$('#ix-back').addEventListener('click', ixBack);
$('#ix-toggle').addEventListener('click', async () => {
  const res = await window.api.intercept.set(!ix.enabled);
  if (res && res.ok) {
    ix.enabled = !!res.state.enabled;
    ixUpdateChrome();
  } else if (res && res.error) {
    toast(res.error, 'err');
  }
});

$('#ix-forward').addEventListener('click', () => ixResolve('continue'));
$('#ix-drop').addEventListener('click', () => ixResolve('drop'));
$('#ix-repeat').addEventListener('click', ixRepeat);
$('#ix-header-add')?.addEventListener('click', () => {
  $('#ix-headers-rows')?.appendChild(ixHeaderRow());
});
$('#ix-body-format')?.addEventListener('click', ixFormatBody);
$('#ix-resp-format')?.addEventListener('click', ixFormatResponse);
$$('.ix-name').forEach((b) => {
  b.addEventListener('click', () => ixShowTab(b.dataset.ixTab));
});

$('#ix-code-copy').addEventListener('click', () => {
  const rec = ixCurrentRecord();
  if (rec) copyText(codeFor(rec, $('#ix-code-lang').value));
});
$('#ix-copy-curl').addEventListener('click', () => {
  const rec = ixCurrentRecord();
  if (rec) copyText(codeFor(rec, 'curl'));
});

$('#ix-forward-all').addEventListener('click', async () => {
  const res = await window.api.intercept.drain();
  ix.items = [];
  ixBack();
  ixUpdateChrome();
  if (res && res.ok) toast(t('intercept.forwardAll'), 'ok');
});

let ixFilterTimer = null;
$('#ix-filter').addEventListener('input', (e) => {
  const value = e.target.value;
  ix.filter = value;
  ixRenderList();
  clearTimeout(ixFilterTimer);
  ixFilterTimer = setTimeout(() => { window.api.intercept.filter(value); }, 350);
});

let flowFilterTimer = null;
$('#net-filter').addEventListener('input', (e) => {
  flow.filter = e.target.value;
  clearTimeout(flowFilterTimer);
  flowFilterTimer = setTimeout(flowRender, 110);
});

$('#net-scope').addEventListener('change', (e) => {
  flow.scope = e.target.value === 'all' ? 'all' : 'tab';
  flowBack();
  flowLoad();
});

$('#net-save').addEventListener('click', flowSave);
$('#net-clear').addEventListener('click', flowClear);

/* Escape closes the drawer from anywhere. */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#ix-drawer').classList.contains('hidden')) devClose();
});

/* ------------------------------------------------------------- settings UI */

/* ======================================================================
 * Keyboard shortcuts
 * ==================================================================== */

const SHORTCUT_DEFS = [
  ['newTab', 'sc.newTab'],
  ['closeTab', 'sc.closeTab'],
  ['reopenTab', 'sc.reopenTab'],
  ['nextTab', 'sc.nextTab'],
  ['prevTab', 'sc.prevTab'],
  ['focusAddress', 'sc.focusAddress'],
  ['reload', 'sc.reload'],
  ['hardReload', 'sc.hardReload'],
  ['back', 'sc.back'],
  ['forward', 'sc.forward'],
  ['toggleDevice', 'sc.toggleDevice'],
  ['toggleProxy', 'sc.toggleProxy'],
  ['toggleInterceptor', 'sc.toggleInterceptor'],
  ['openGuide', 'sc.openGuide'],
  ['settings', 'sc.settings'],
  ['fingerprint', 'sc.fingerprint'],
  ['zoomIn', 'sc.zoomIn'],
  ['zoomOut', 'sc.zoomOut'],
  ['zoomReset', 'sc.zoomReset'],
  ['quit', 'sc.quit']
];

/** Build the canonical "Ctrl+Shift+K" form from a keyboard event. */
function comboFromEvent(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  let key = e.key;
  if (key === ' ' ) key = 'Space';
  else if (key === '+') key = '=';
  else if (key.length === 1) key = key.toUpperCase();
  else if (key === 'Escape' || key === 'Enter' || key === 'Tab' || key === 'Backspace') key = '';
  else if (/^Arrow/.test(key)) key = key.slice(5);
  else if (/^(Control|Meta|Alt|Shift)$/.test(key)) return '';
  if (!key) return '';
  parts.push(key);
  return parts.join('+');
}

function shortcuts() {
  return (state.settings && state.settings.shortcuts) || {};
}

function matchCombo(e, name) {
  const want = shortcuts()[name];
  if (!want) return false;
  return comboFromEvent(e) === want;
}

function shortcutOwner(combo, except) {
  for (const [name, key] of SHORTCUT_DEFS) {
    if (name === except) continue;
    if (shortcuts()[name] === combo) return key;
  }
  return null;
}

function zoomBy(delta) {
  const tab = activeTab();
  if (!tab) return;
  try {
    const cur = tab.wv.getZoomFactor();
    const next = Math.max(0.25, Math.min(5, Number((cur + delta).toFixed(2))));
    tab.wv.setZoomFactor(next);
    toast(String(Math.round(next * 100)) + '%', '');
  } catch {}
}

function zoomReset() {
  const tab = activeTab();
  if (!tab) return;
  try { tab.wv.setZoomFactor(1); } catch {}
}

function hardReload() {
  const tab = activeTab();
  if (!tab) return;
  try { tab.wv.reloadIgnoringCache(); } catch { try { tab.wv.reload(); } catch {} }
}

function cycleDevice() {
  const list = [state.desktop, ...state.devices];
  const tab = activeTab();
  const curId = (tab && tab.fp && tab.fp.device && tab.fp.device.id) || 'desktop';
  const idx = list.findIndex((d) => d.id === curId);
  const next = list[(idx + 1) % list.length];
  if (next) changeDevice(next);
}

function cycleProxy() {
  const p = (state.settings && state.settings.proxy) || {};
  const enabled = !p.enabled;
  window.api.proxy.set({ enabled }).then((res) => {
    if (res && res.ok) {
      state.settings.proxy = res.config;
      updateChips();
      toast(enabled ? t('proxy.online') : t('proxy.direct'), 'ok');
    }
  });
}

async function runShortcut(name) {
  const tab = activeTab();
  switch (name) {
    case 'newTab': return createTab();
    case 'closeTab': if (tab) closeTab(tab.id); return;
    case 'reopenTab': return createTab();
    case 'nextTab': return cycleTab(1);
    case 'prevTab': return cycleTab(-1);
    case 'focusAddress': omnibox.focus(); omnibox.select(); return;
    case 'reload': if (tab) { try { tab.wv.reload(); } catch {} } return;
    case 'hardReload': return hardReload();
    case 'back': if (tab) { try { tab.wv.goBack(); } catch {} } return;
    case 'forward': if (tab) { try { tab.wv.goForward(); } catch {} } return;
    case 'toggleDevice': return cycleDevice();
    case 'toggleProxy': return cycleProxy();
    case 'toggleInterceptor': return toggleInterceptor();
    case 'openGuide': return openGuide();
    case 'settings': return openSettings();
    case 'fingerprint': return openSettings('fingerprint');
    case 'zoomIn': return zoomBy(0.1);
    case 'zoomOut': return zoomBy(-0.1);
    case 'zoomReset': return zoomReset();
    case 'quit': return window.api.app.quit();
    default: return;
  }
}

function cycleTab(delta) {
  if (state.tabs.length < 2) return;
  const idx = state.tabs.findIndex((x) => x.id === state.activeId);
  const next = (idx + delta + state.tabs.length) % state.tabs.length;
  activate(state.tabs[next].id);
}

async function toggleInterceptor() {
  const res = await window.api.intercept.set(!ix.enabled);
  if (res && res.ok) {
    ix.enabled = !!res.state.enabled;
    ixUpdateChrome();
    if (ix.enabled) devOpen('intercept');
    toast(ix.enabled ? t('intercept.on') : t('intercept.off'), 'ok');
  }
}

/* Global shortcut handling. Page input wins first, so typing a shortcut inside
   a text field never swallows the keystroke. */
function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

document.addEventListener('keydown', (e) => {
  if (isTypingTarget(e.target) && !(e.ctrlKey || e.metaKey)) return;
  for (const [name] of SHORTCUT_DEFS) {
    if (matchCombo(e, name)) {
      e.preventDefault();
      runShortcut(name);
      return;
    }
  }
});

/* ======================================================================
 * Guide
 * ==================================================================== */

function openGuide() {
  const body = $('#guide-body');
  if (body) body.innerHTML = guideHtml();
  $('#guide-overlay').classList.remove('hidden');
}

function closeGuide() {
  $('#guide-overlay').classList.add('hidden');
}

function comboHtml(combo) {
  return String(combo || '').split('+').filter(Boolean)
    .map((k) => `<i>${esc(k)}</i>`).join('');
}

function guideHtml() {
  const sc = shortcuts();
  const shortcutRows = SHORTCUT_DEFS.slice(0, 12).map(([name, key]) => `
    <div class="kbd-row"><span>${esc(t(key))}</span><span class="kbd-combo">${comboHtml(sc[name])}</span></div>`).join('');
  const steps = [
    ['guide.step1Title', 'guide.step1'],
    ['guide.step2Title', 'guide.step2'],
    ['guide.step3Title', 'guide.step3']
  ].map(([title, text], i) => `
    <div class="guide-step">
      <span class="g-num">${i + 1}</span>
      <div><b>${esc(t(title))}</b><span>${esc(t(text))}</span></div>
    </div>`).join('');

  return `
    <div class="guide-grid">
      <div class="card">
        <h3>${esc(t('guide.shortcutsTitle'))}</h3>
        <p class="hint">${esc(t('guide.shortcutsHint'))}</p>
        <div class="kbd-table">${shortcutRows}</div>
      </div>
      <div class="card">
        <h3>${esc(t('guide.flowTitle'))}</h3>
        <p class="hint">${esc(t('guide.flowHint'))}</p>
        <h3>${esc(t('guide.interceptTitle'))}</h3>
        <p class="hint">${esc(t('guide.interceptHint'))}</p>
      </div>
      <div class="card">
        <h3>${esc(t('guide.proxyTitle'))}</h3>
        <p class="hint">${esc(t('guide.proxyHint'))}</p>
      </div>
      <div class="card">
        <h3>${esc(t('guide.rulesTitle'))}</h3>
        <p class="hint">${esc(t('guide.rulesHint'))}</p>
      </div>
      <div class="card guide-wide">
        <h3>${esc(t('guide.title'))}</h3>
        ${steps}
      </div>
    </div>`;
}

/* ======================================================================
 * App menu (corner Fathi icon)
 * ==================================================================== */

function openAppMenu() {
  const menu = $('#app-menu');
  const btn = $('#app-menu-btn');
  if (!menu || !btn) return;
  const r = btn.getBoundingClientRect();
  menu.classList.remove('hidden');
  const width = menu.offsetWidth || 220;
  const height = menu.offsetHeight || 300;
  const left = Math.min(Math.max(8, r.left - width + r.width), window.innerWidth - width - 8);
  const top = Math.min(r.bottom + 6, window.innerHeight - height - 8);
  menu.style.left = left + 'px';
  menu.style.top = Math.max(8, top) + 'px';
  const version = $('#am-version');
  if (version && state.info) version.textContent = 'v' + state.info.version;
}

function closeAppMenu() {
  $('#app-menu')?.classList.add('hidden');
}

/* ======================================================================
 * Match and Replace
 * ==================================================================== */

function mrRules() {
  return (state.settings && state.settings.matchReplace) || [];
}

function mrRuleHtml(rule, index) {
  const targets = [
    'requestHeader', 'requestBody', 'responseHeader', 'responseBody'
  ].map((id) => `<option value="${id}" ${rule.target === id ? 'selected' : ''}>${esc(t('mr.target.' + id))}</option>`).join('');
  return `
    <div class="mr-rule" data-mr="${esc(rule.id)}">
      <div class="mr-head">
        <b>${esc(t('mr.ruleN', { n: index + 1 }))}</b>
        <button class="mr-toggle btn sm" type="button" aria-expanded="true">${esc(t('mr.collapse'))}</button>
        <button class="mr-del" data-mr-del="${esc(rule.id)}">${esc(t('mr.remove'))}</button>
      </div>
      <div class="mr-row">
        <label>${esc(t('mr.target'))}</label>
        <select class="mr-target">${targets}</select>
      </div>
      <div class="mr-row">
        <label>${esc(t('mr.match'))}</label>
        <input type="text" class="mr-match" value="${esc(rule.match || '')}" dir="ltr" />
      </div>
      <div class="mr-row">
        <label>${esc(t('mr.replace'))}</label>
        <input type="text" class="mr-replace" value="${esc(rule.replace || '')}" dir="ltr" />
      </div>
      <div class="mr-row">
        <label>${esc(t('mr.enabled'))}</label>
        <div class="mr-check">
          <label><input type="checkbox" class="mr-regex" ${rule.regex ? 'checked' : ''} /> ${esc(t('mr.regex'))}</label>
          <label><input type="checkbox" class="mr-case" ${rule.caseSensitive ? 'checked' : ''} /> ${esc(t('mr.caseSensitive'))}</label>
          <label><input type="checkbox" class="mr-on" ${rule.enabled !== false ? 'checked' : ''} /> ${esc(t('mr.enabled'))}</label>
        </div>
      </div>
    </div>`;
}

function collectRules() {
  const out = [];
  $$('#mr-list .mr-rule').forEach((el, i) => {
    out.push({
      id: el.dataset.mr || ('r' + i),
      enabled: el.querySelector('.mr-on').checked,
      target: el.querySelector('.mr-target').value,
      match: el.querySelector('.mr-match').value,
      replace: el.querySelector('.mr-replace').value,
      regex: el.querySelector('.mr-regex').checked,
      caseSensitive: el.querySelector('.mr-case').checked
    });
  });
  return out.filter((r) => r.match);
}

async function saveRules() {
  const res = await window.api.rules.save(collectRules());
  if (res && res.ok) {
    state.settings.matchReplace = res.rules;
    toast(t('mr.saved'), 'ok');
    renderSection('intercept');
  } else if (res && res.error) {
    toast(res.error, 'err');
  }
}

function newRuleId() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function renderMatchReplaceCard() {
  const rules = mrRules();
  const list = rules.length
    ? rules.map((r, i) => mrRuleHtml(r, i)).join('')
    : `<div class="mr-empty">${esc(t('mr.empty'))}</div>`;
  return `
    <div class="card">
      <h3>${esc(t('mr.title'))}</h3>
      <p class="hint">${esc(t('mr.hint'))}</p>
      <div id="mr-list">${list}</div>
      <div class="btn-row">
        <button class="btn sm" id="mr-add">${esc(t('mr.add'))}</button>
        <button class="btn sm primary" id="mr-save">${esc(t('toast.saved'))}</button>
      </div>
      <details class="mr-tester">
        <summary>${esc(t('mr.testTitle'))}</summary>
        <p class="hint">${esc(t('mr.testHint'))}</p>
        <label for="mr-test-target">${esc(t('mr.target'))}</label>
        <select id="mr-test-target">${['requestHeader', 'requestBody', 'responseHeader', 'responseBody'].map((id) => `<option value="${id}">${esc(t('mr.target.' + id))}</option>`).join('')}</select>
        <label for="mr-payload">${esc(t('mr.payload'))}</label>
        <textarea id="mr-payload" dir="ltr" rows="5" spellcheck="false"></textarea>
        <button class="btn primary" id="mr-test">${esc(t('mr.test'))}</button>
        <p id="mr-test-status" role="status"></p>
        <pre id="mr-test-result" dir="ltr"></pre>
      </details>
    </div>`;
}

function wireMatchReplaceCard() {
  $('#mr-test')?.addEventListener('click', async () => {
    const res = await window.api.rules.test({ rules: collectRules(), target: $('#mr-test-target').value, payload: $('#mr-payload').value });
    $('#mr-test-status').textContent = res.ok ? t(res.changed ? 'mr.changed' : 'mr.unchanged') : res.error;
    $('#mr-test-result').textContent = res.ok ? res.output : '';
  });
  const add = $('#mr-add');
  if (add) {
    add.addEventListener('click', () => {
      const list = $('#mr-list');
      if (!list) return;
      const empty = list.querySelector('.mr-empty');
      if (empty) empty.remove();
      const tmp = document.createElement('div');
      tmp.innerHTML = mrRuleHtml({
        id: newRuleId(), enabled: true, target: 'responseBody', match: '', replace: '', regex: false
      }, list.querySelectorAll('.mr-rule').length);
      list.appendChild(tmp.firstElementChild);
      wireRuleDelete();
    });
  }
  const save = $('#mr-save');
  if (save) save.addEventListener('click', saveRules);
  wireRuleDelete();
}

function wireRuleDelete() {
  $$('#mr-list .mr-toggle').forEach((b) => {
    if (b.dataset.wired) return;
    b.dataset.wired = '1';
    b.addEventListener('click', () => {
      const collapsed = b.closest('.mr-rule').classList.toggle('collapsed');
      b.setAttribute('aria-expanded', String(!collapsed));
      b.textContent = t(collapsed ? 'mr.expand' : 'mr.collapse');
    });
  });
  $$('#mr-list [data-mr-del]').forEach((b) => {
    if (b.dataset.wired) return;
    b.dataset.wired = '1';
    b.addEventListener('click', () => {
      const el = b.closest('.mr-rule');
      if (el) el.remove();
    });
  });
}

/* ------------------------------------------------------------- settings UI */

function openSettings(section) {
  if (section) state.section = section;
  $('#settings-overlay').classList.remove('hidden');
  $$('.snav').forEach((b) => b.classList.toggle('active', b.dataset.section === state.section));
  renderSection(state.section);
}

function closeSettings() {
  $('#settings-overlay').classList.add('hidden');
}

async function showReleaseNotesOnce() {
  if (state.settings.lastSeenRelease === state.info.version) return false;
  openSettings('whatsnew');
  const saved = await window.api.settings.set({ lastSeenRelease: state.info.version });
  if (saved.ok) state.settings.lastSeenRelease = state.info.version;
  return true;
}

$('#btn-menu').addEventListener('click', () => openSettings());
$('#settings-close').addEventListener('click', closeSettings);
$('#settings-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'settings-overlay') closeSettings();
});
$$('.snav').forEach((b) => {
  b.addEventListener('click', () => {
    state.section = b.dataset.section;
    $$('.snav').forEach((x) => x.classList.toggle('active', x === b));
    renderSection(state.section);
  });
});

$('#chip-fp').addEventListener('click', () => openSettings('fingerprint'));
$('#chip-proxy').addEventListener('click', () => openSettings('proxy'));

const CHECK_LINKS = [
  { id: 'fp-check-1', url: 'https://browserleaks.com/javascript' },
  { id: 'fp-check-2', url: 'https://abrahamjuliot.github.io/creepjs/' },
  { id: 'fp-check-3', url: 'https://iphey.com/' }
];

function renderSection(section) {
  const body = $('#settings-body');
  const S = state.settings || {};

  if (section === 'whatsnew') {
    body.innerHTML = `<div class="card release-notes"><span class="badge accent">Fathi ${esc(state.info.version)}</span>
      <h2>${esc(t('release.title'))}</h2><p class="hint">${esc(t('release.intro'))}</p>
      <ul>${['burp', 'rules', 'devices', 'shortcuts', 'updates'].map((key) => `<li>${esc(t('release.' + key))}</li>`).join('')}</ul>
      <button class="btn primary" id="release-done">${esc(t('release.continue'))}</button></div>`;
    $('#release-done').addEventListener('click', closeSettings);
    return;
  }

  if (section === 'general') {
    body.innerHTML = `
      <div class="card">
        <h3>${esc(t('general.searchTitle'))}</h3>
        <p class="hint">${esc(t('general.searchHint'))}</p>
        <div class="field">
          <select id="set-search">
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="brave">Brave Search</option>
            <option value="google">Google</option>
            <option value="bing">Bing</option>
            <option value="startpage">Startpage</option>
          </select>
        </div>
      </div>

      <div class="card">
        <h3>${esc(t('general.languageTitle'))}</h3>
        <p class="hint">${esc(t('general.languageHint'))}</p>
        <div class="field">
          <select id="set-language">
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </div>
      </div>

      <div class="card">
        <h3>${esc(t('general.themeTitle'))}</h3>
        <p class="hint">${esc(t('general.themeHint'))}</p>
        <div class="btn-row">
          <button class="btn ${S.theme !== 'dark' ? 'primary' : ''}" data-theme-set="light">${esc(t('theme.light'))}</button>
          <button class="btn ${S.theme === 'dark' ? 'primary' : ''}" data-theme-set="dark">${esc(t('theme.dark'))}</button>
        </div>
      </div>

      <div class="card">
        <h3>${esc(t('general.privacyTitle'))}</h3>
        <p class="hint">${esc(t('general.privacyHint'))}</p>
        <div class="row">
          <div><label>${esc(t('general.p1'))}</label><div class="sub">${esc(t('general.p1sub'))}</div></div>
          <span class="badge">${esc(t('general.on'))}</span>
        </div>
        <div class="row">
          <div><label>${esc(t('general.p2'))}</label><div class="sub">${esc(t('general.p2sub'))}</div></div>
          <span class="badge">${esc(t('general.on'))}</span>
        </div>
        <div class="row">
          <div><label>${esc(t('general.p3'))}</label><div class="sub">${esc(t('general.p3sub'))}</div></div>
          <span class="badge">${esc(t('general.on'))}</span>
        </div>
      </div>

      <div class="card">
        <h3>${esc(t('general.shortcuts'))}</h3>
        <div class="kv"><span class="k">${esc(t('sc.newTab'))}</span><span class="v">Ctrl + T</span></div>
        <div class="kv"><span class="k">${esc(t('sc.closeTab'))}</span><span class="v">Ctrl + W</span></div>
        <div class="kv"><span class="k">${esc(t('sc.address'))}</span><span class="v">Ctrl + L</span></div>
        <div class="kv"><span class="k">${esc(t('sc.reload'))}</span><span class="v">Ctrl + R</span></div>
        <div class="kv"><span class="k">${esc(t('sc.settings'))}</span><span class="v">Ctrl + D</span></div>
      </div>`;

    const search = $('#set-search');
    search.value = S.searchEngine || 'duckduckgo';
    search.addEventListener('change', async () => {
      await window.api.settings.set({ searchEngine: search.value });
      state.settings.searchEngine = search.value;
      toast(t('toast.saved'), 'ok');
    });

    const lang = $('#set-language');
    lang.value = S.language || 'en';
    lang.addEventListener('change', async () => {
      await setLanguage(lang.value);
    });

    $$('[data-theme-set]').forEach((b) => b.addEventListener('click', async () => {
      await setTheme(b.dataset.themeSet);
      renderSection('general');
    }));
    return;
  }

  if (section === 'devices') {
    const current = activeTab();
    const curDev = (current && current.fp && current.fp.device) || state.desktop;
    const groups = state.deviceGroups || {};
    const order = ['desktop', 'apple', 'samsung', 'google', 'other'];
    let listHtml = '';
    for (const key of order) {
      const arr = groups[key];
      if (!arr || !arr.length) continue;
      listHtml += `<div class="device-group-title">${esc(t('devices.group.' + key))}</div>`;
      listHtml += arr.map((d) => deviceItemHtml(d, curDev.id)).join('');
    }

    body.innerHTML = `
      <div class="card">
        <h3>${esc(t('devices.title'))}</h3>
        <p class="hint">${esc(t('devices.hint'))}</p>
        <div class="field">
          <label>${esc(t('devices.default'))}</label>
          <select id="set-default-device">
            ${[state.desktop, ...state.devices].map((d) => `
              <option value="${esc(d.id)}">${esc(d.mobile ? d.name : t('devices.desktop'))}</option>`).join('')}
          </select>
        </div>
        <div class="btn-row">
          <button class="btn ${curDev.mobile ? '' : 'hidden'}" id="dev-rotate">
            <svg viewBox="0 0 24 24"><rect x="4" y="7" width="12" height="10" rx="2"/><path d="M19 10v4"/></svg>
            ${esc(t('devices.rotate'))}
          </button>
        </div>
      </div>

      <div class="card">
        <h3>${esc(t('devices.active'))} <span class="muted small">· ${esc(curDev.mobile ? curDev.name : t('devices.desktop'))}</span></h3>
        <p class="hint">${esc(t('devices.reload'))}</p>
        <div id="dev-list">${listHtml}</div>
      </div>`;

    const sel = $('#set-default-device');
    sel.value = S.defaultDevice || 'desktop';
    sel.addEventListener('change', async () => {
      await window.api.settings.set({ defaultDevice: sel.value });
      state.settings.defaultDevice = sel.value;
      toast(t('toast.saved'), 'ok');
    });

    const rotate = $('#dev-rotate');
    if (rotate) rotate.addEventListener('click', () => {
      if (!curDev.mobile) return;
      changeDevice(curDev, curDev.orientation !== 'landscape');
    });

    $$('#dev-list [data-device]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dev = state.devices.find((d) => d.id === btn.dataset.device) || state.desktop;
        changeDevice(dev);
      });
    });
    return;
  }

  if (section === 'fingerprint') {
    const f = S.fingerprint || {};
    body.innerHTML = `
      <div class="card">
        <h3>${esc(t('fp.title'))}</h3>
        <p class="hint">${esc(t('fp.hint'))}</p>
        <div class="row">
          <div><label>${esc(t('fp.enabled'))}</label><div class="sub">${esc(t('fp.enabledSub'))}</div></div>
          <div class="switch ${f.enabled !== false ? 'on' : ''}" data-toggle="fingerprint.enabled"></div>
        </div>
        <div class="row">
          <div><label>${esc(t('fp.canvas'))}</label><div class="sub">${esc(t('fp.canvasSub'))}</div></div>
          <div class="switch ${f.spoofCanvas !== false ? 'on' : ''}" data-toggle="fingerprint.spoofCanvas"></div>
        </div>
        <div class="row">
          <div><label>${esc(t('fp.webgl'))}</label><div class="sub">${esc(t('fp.webglSub'))}</div></div>
          <div class="switch ${f.spoofWebgl !== false ? 'on' : ''}" data-toggle="fingerprint.spoofWebgl"></div>
        </div>
        <div class="row">
          <div><label>${esc(t('fp.audio'))}</label><div class="sub">${esc(t('fp.audioSub'))}</div></div>
          <div class="switch ${f.spoofAudio !== false ? 'on' : ''}" data-toggle="fingerprint.spoofAudio"></div>
        </div>
      </div>

      <div class="card">
        <h3>${esc(t('fp.tabsTitle', { n: state.tabs.length }))}</h3>
        <p class="hint">${esc(t('fp.tabsHint'))}</p>
        <div id="fp-list"></div>
      </div>

      <div class="card">
        <h3>${esc(t('fp.checkTitle'))}</h3>
        <p class="hint">${esc(t('fp.checkHint'))}</p>
        <div class="btn-row">
          <button class="btn sm" id="fp-check-1">browserleaks.com</button>
          <button class="btn sm" id="fp-check-2">abrahamjuliot.github.io/creepjs</button>
          <button class="btn sm" id="fp-check-3">iphey.com</button>
        </div>
      </div>`;

    body.querySelectorAll('.switch[data-toggle]').forEach((sw) => {
      sw.addEventListener('click', async () => {
        sw.classList.toggle('on');
        const path = sw.dataset.toggle.split('.');
        const patch = { [path[0]]: { [path[1]]: sw.classList.contains('on') } };
        await window.api.settings.set(patch);
        state.settings = (await window.api.settings.get()).settings;
        toast(t('toast.saved'), 'ok');
      });
    });

    for (const link of CHECK_LINKS) {
      const btn = $('#' + link.id);
      if (btn) btn.addEventListener('click', () => { navigate(link.url); closeSettings(); });
    }

    refreshFingerprintList();
    return;
  }

  if (section === 'proxy') {
    const p = S.proxy || {};
    const torCfg = S.tor || {};
    body.innerHTML = `
      <div class="card">
        <h3>${esc(t('proxy.title'))}</h3>
        <p class="hint">${esc(t('proxy.hint'))}</p>

        <div class="row">
          <div><label>${esc(t('proxy.enable'))}</label><div class="sub">${esc(t('proxy.enableSub'))}</div></div>
          <div class="switch ${p.enabled ? 'on' : ''}" id="px-enabled"></div>
        </div>

        <div class="field" style="margin-top:12px">
          <label>${esc(t('proxy.mode'))}</label>
          <select id="px-mode">
            <option value="single">${esc(t('proxy.modeSingle'))}</option>
            <option value="rotate">${esc(t('proxy.modeRotate'))}</option>
          </select>
        </div>

        <div class="field">
          <label>${esc(t('proxy.pool'))}</label>
          <textarea id="px-pool" spellcheck="false" placeholder="http://user:pass@host:port">${esc((p.pool || []).join('\n'))}</textarea>
        </div>

        <div class="field">
          <label>${esc(t('proxy.bypass'))}</label>
          <input type="text" id="px-bypass" dir="ltr" value="${esc(p.bypass || '<local>')}" />
        </div>

        <div class="row">
          <div><label>${esc(t('proxy.burp'))}</label><div class="sub">${esc(t('proxy.burpHint'))}</div></div>
          <button class="btn burp-action" id="px-burp">${esc(t('proxy.burpApply'))}</button>
        </div>

        <div class="row">
          <div><label>${esc(t('proxy.trust'))}</label><div class="sub">${esc(t('proxy.trustHint'))}</div></div>
          <div class="switch ${p.trustBurpCert ? 'on' : ''}" id="px-trust"></div>
        </div>

        <div class="row">
          <div><label>${esc(t('proxy.intercept'))}</label><div class="sub">${esc(t('proxy.interceptHint'))}</div></div>
          <button class="btn sm" id="px-intercept">${esc(t('proxy.openIntercept'))}</button>
        </div>

        <div class="btn-row">
          <button class="btn primary" id="px-apply">${esc(t('proxy.apply'))}</button>
          <button class="btn" id="px-test">${esc(t('proxy.test'))}</button>
        </div>

        <div id="px-result" style="margin-top:12px"></div>
      </div>

      <div class="card">
        <h3>${esc(t('proxy.tor'))}</h3>
        <p class="hint">${esc(t('proxy.torHint'))}</p>

        <div class="row">
          <div><label>${esc(t('proxy.torEnable'))}</label></div>
          <div class="switch ${torCfg.enabled ? 'on' : ''}" id="tor-enabled"></div>
        </div>

        <div class="field" style="margin-top:12px">
          <label>${esc(t('proxy.torPort'))}</label>
          <input type="number" id="tor-port" min="1" max="65535" dir="ltr" value="${esc(torCfg.port || 9050)}" />
        </div>

        <div class="btn-row">
          <button class="btn primary" id="tor-save">${esc(t('proxy.apply'))}</button>
          <button class="btn" id="tor-check">${esc(t('proxy.torCheck'))}</button>
        </div>

        <div id="tor-result" style="margin-top:12px"></div>
      </div>

      <div class="card">
        <h3>${esc(t('proxy.statusTitle'))}</h3>
        <div id="px-status"></div>
      </div>`;

    $('#px-mode').value = p.mode || 'single';
    $('#px-enabled').classList.toggle('on', !!p.enabled);
    $('#px-enabled').addEventListener('click', (e) => e.currentTarget.classList.toggle('on'));

    $('#px-apply').addEventListener('click', async () => {
      const patch = {
        enabled: $('#px-enabled').classList.contains('on'),
        mode: $('#px-mode').value,
        pool: $('#px-pool').value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
        bypass: $('#px-bypass').value.trim() || '<local>'
      };
      const res = await window.api.proxy.set(patch);
      if (!res.ok) return toast(res.error, 'err');
      state.settings.proxy = res.config;
      updateChips();
      renderProxyStatus();
      toast(t('toast.applied', { n: res.applied }), 'ok');
    });

    $('#px-test').addEventListener('click', async () => {
      const out = $('#px-result');
      const lines = $('#px-pool').value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const entry = lines[0];
      if (!entry) return toast(t('toast.needProxy'), 'err');
      out.innerHTML = `<span class="badge warn">${esc(t('proxy.testing'))}</span>`;
      const res = await window.api.proxy.test(entry);
      if (!res.ok) { out.innerHTML = `<span class="badge err">${esc(t('proxy.error'))}</span> ${esc(res.error)}`; return; }
      const r = res.result;
      out.innerHTML = r.ok
        ? `<span class="badge">${esc(t('proxy.connected'))}</span> <span class="mono">IP: ${esc(r.ip || 'n/a')}</span> · ${r.ms} ms`
        : `<span class="badge err">${esc(t('proxy.failed'))}</span> ${esc(r.error || '')} · ${r.ms} ms`;
    });

    $('#px-trust').addEventListener('click', async (e) => {
      const on = e.currentTarget.classList.toggle('on');
      const res = await window.api.proxy.set({ trustBurpCert: on });
      if (res.ok) { state.settings.proxy = res.config; toast(t('toast.saved'), 'ok'); }
      else toast(res.error, 'err');
    });

    $('#px-burp').addEventListener('click', async () => {
      const res = await window.api.proxy.set({
        enabled: true,
        mode: 'single',
        pool: ['http://127.0.0.1:8080'],
        bypass: '<local>',
        trustBurpCert: true
      });
      if (!res.ok) return toast(res.error, 'err');
      state.settings.proxy = res.config;
      updateChips();
      renderSection('proxy');
      toast(t('toast.applied', { n: res.applied }), 'ok');
    });

    $('#px-intercept').addEventListener('click', () => {
      closeSettings();
      ixOpenDrawer();
    });

    const showTorStatus = (st) => {
      const out = $('#tor-result');
      if (!out) return;
      if (!st) { out.innerHTML = ''; return; }
      const badge = st.running ? 'badge' : 'badge warn';
      const label = st.running ? t('proxy.torRunning') : t('proxy.torStopped');
      out.innerHTML = `<span class="${badge}">${esc(label)}</span> <span class="mono">127.0.0.1:${esc(st.port)}</span>`;
    };

    window.api.tor.status().then((res) => {
      if (res && res.ok) showTorStatus(res.status);
    });

    $('#tor-enabled').addEventListener('click', (e) => e.currentTarget.classList.toggle('on'));

    $('#tor-check').addEventListener('click', async () => {
      const res = await window.api.tor.status();
      if (!res.ok) return toast(res.error, 'err');
      showTorStatus(res.status);
    });

    $('#tor-save').addEventListener('click', async () => {
      const port = Number($('#tor-port').value);
      const res = await window.api.tor.set({
        enabled: $('#tor-enabled').classList.contains('on'),
        port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 9050
      });
      if (!res.ok) return toast(res.error, 'err');
      state.settings.tor = res.config;
      showTorStatus(res.status);
      toast(t('toast.saved'), 'ok');
    });

    renderProxyStatus();
    return;
  }

  if (section === 'wallpapers') {
    const w = S.wallpapers || {};
    body.innerHTML = `
      <div class="card">
        <h3>${esc(t('wp.title'))}</h3>
        <p class="hint">${esc(t('wp.hint'))}</p>

        <div class="field">
          <label>${esc(t('wp.source'))}</label>
          <select id="wp-source">
            <option value="unsplash">${esc(t('wp.unsplash'))}</option>
            <option value="custom">${esc(t('wp.custom'))}</option>
            <option value="none">${esc(t('wp.none'))}</option>
          </select>
        </div>

        <div class="field">
          <label>${esc(t('wp.customUrl'))}</label>
          <input type="text" id="wp-custom" dir="ltr" value="${esc(w.custom || '')}" placeholder="https://…" />
        </div>

        <div class="field">
          <label>${esc(t('wp.blur'))}: <span id="wp-blur-val">${w.blur || 0}</span>px</label>
          <input type="range" id="wp-blur" min="0" max="24" value="${w.blur || 0}" />
        </div>

        <div class="field">
          <label>${esc(t('wp.dim'))}: <span id="wp-dim-val">${Math.round((w.dim || 0) * 100)}</span>%</label>
          <input type="range" id="wp-dim" min="0" max="85" value="${Math.round((w.dim || 0) * 100)}" />
        </div>

        <div class="btn-row">
          <button class="btn primary" id="wp-save">${esc(t('wp.save'))}</button>
          <button class="btn" id="wp-refresh">${esc(t('wp.refresh'))}</button>
        </div>
      </div>`;

    $('#wp-source').value = w.source || 'unsplash';
    $('#wp-blur').addEventListener('input', (e) => { $('#wp-blur-val').textContent = e.target.value; });
    $('#wp-dim').addEventListener('input', (e) => { $('#wp-dim-val').textContent = e.target.value; });

    $('#wp-save').addEventListener('click', async () => {
      const patch = {
        wallpapers: {
          source: $('#wp-source').value,
          custom: $('#wp-custom').value.trim(),
          blur: Number($('#wp-blur').value) || 0,
          dim: (Number($('#wp-dim').value) || 0) / 100
        }
      };
      await window.api.settings.set(patch);
      state.settings = (await window.api.settings.get()).settings;
      reloadNewTabs();
      toast(t('toast.wpSaved'), 'ok');
    });

    $('#wp-refresh').addEventListener('click', () => {
      reloadNewTabs();
      toast(t('toast.wpRefreshed'), 'ok');
    });
    return;
  }

  if (section === 'extensions') {
    body.innerHTML = `
      <div class="card">
        <h3>${esc(t('ext.title'))}</h3>
        <p class="hint">${esc(t('ext.hint'))}</p>
        <div class="field">
          <label>${esc(t('ext.input'))}</label>
          <input type="text" id="ext-input" dir="ltr" placeholder="https://chromewebstore.google.com/detail/…" />
        </div>
        <div class="btn-row">
          <button class="btn primary" id="ext-install">${esc(t('ext.install'))}</button>
          <button class="btn" id="ext-unpacked">${esc(t('ext.unpacked'))}</button>
        </div>
      </div>

      <div class="card">
        <h3>${esc(t('ext.listTitle'))}</h3>
        <div id="ext-list"></div>
      </div>`;

    $('#ext-install').addEventListener('click', async () => {
      const input = $('#ext-input').value.trim();
      if (!input) return toast(t('toast.needExt'), 'err');
      const btn = $('#ext-install');
      btn.disabled = true; btn.textContent = t('ext.installing');
      const res = await window.api.ext.install(input);
      btn.disabled = false; btn.textContent = t('ext.install');
      if (!res.ok) return toast(res.error, 'err');
      toast(t('toast.extInstalled', { name: res.record.name }), 'ok');
      renderExtensionList();
    });

    $('#ext-unpacked').addEventListener('click', async () => {
      const res = await window.api.ext.installUnpacked();
      if (!res || !res.ok || !res.record) return;
      toast(t('toast.extInstalled', { name: res.record.name }), 'ok');
      renderExtensionList();
    });

    renderExtensionList();
    return;
  }

  if (section === 'intercept') {
    const ixCfg = S.intercept || {};
    body.innerHTML = `
      <div class="card">
        <h3>${esc(t('intercept.title'))}</h3>
        <p class="hint">${esc(t('intercept.hint'))}</p>
        <div class="row">
          <div><label>${esc(t('intercept.enable'))}</label><div class="sub">${esc(t('intercept.enableSub'))}</div></div>
          <div class="switch ${ixCfg.enabled ? 'on' : ''}" id="set-ix-toggle"></div>
        </div>
        <div class="field">
          <label>${esc(t('intercept.filter'))}</label>
          <input type="text" id="set-ix-filter" dir="ltr" spellcheck="false"
                 placeholder="/api login" value="${esc(ixCfg.filter || '')}" />
          <div class="sub">${esc(t('intercept.filterSub'))}</div>
        </div>
      </div>
      ${renderMatchReplaceCard()}`;

    $('#set-ix-toggle').addEventListener('click', async () => {
      const res = await window.api.intercept.set(!ix.enabled);
      if (!res || !res.ok) return;
      ix.enabled = !!res.state.enabled;
      ixUpdateChrome();
      $('#set-ix-toggle').classList.toggle('on', ix.enabled);
      toast(ix.enabled ? t('intercept.on') : t('intercept.off'), 'ok');
    });

    let setFilterTimer = null;
    $('#set-ix-filter').addEventListener('input', (e) => {
      const value = e.target.value;
      clearTimeout(setFilterTimer);
      setFilterTimer = setTimeout(async () => {
        await window.api.intercept.filter(value);
        ix.filter = value;
        ixRenderList();
      }, 350);
    });

    wireMatchReplaceCard();
    return;
  }

  if (section === 'shortcuts') {
    const sc = { ...(S.shortcuts || {}) };
    body.innerHTML = `
      <div class="card">
        <h3>${esc(t('settings.shortcutsTitle'))}</h3>
        <p class="hint">${esc(t('settings.shortcutsHint'))}</p>
        <div class="sc-list">
          ${SHORTCUT_DEFS.map(([name, key]) => `
            <div class="sc-row">
              <span class="sc-name">${esc(t(key))}</span>
              <input class="sc-input" type="text" readonly dir="ltr"
                     data-sc="${esc(name)}" value="${esc(sc[name] || '')}"
                     placeholder="${esc(t('sc.recording'))}" />
            </div>`).join('')}
        </div>
        <div class="btn-row">
          <button class="btn" id="sc-reset">${esc(t('settings.shortcutsReset'))}</button>
          <button class="btn primary" id="sc-save">${esc(t('toast.saved'))}</button>
        </div>
      </div>`;

    let recording = null;
    $$('.sc-input').forEach((input) => {
      input.addEventListener('focus', () => { input.value = ''; });
      input.addEventListener('blur', () => {
        if (!input.value) input.value = sc[input.dataset.sc] || '';
      });
      input.addEventListener('keydown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Backspace') {
          input.value = '';
          sc[input.dataset.sc] = '';
          return;
        }
        const combo = comboFromEvent(e);
        if (!combo) return;
        const owner = shortcutOwner(combo, input.dataset.sc);
        if (owner) {
          toast(t('sc.conflict', { name: t(owner) }), 'err');
          return;
        }
        input.value = combo;
        sc[input.dataset.sc] = combo;
      });
    });

    $('#sc-reset').addEventListener('click', async () => {
      const res = await window.api.settings.set({ shortcuts: {} });
      if (res && res.ok) {
        state.settings.shortcuts = (res.settings && res.settings.shortcuts) || {};
        toast(t('toast.saved'), 'ok');
        renderSection('shortcuts');
      }
    });

    $('#sc-save').addEventListener('click', async () => {
      const res = await window.api.settings.set({ shortcuts: sc });
      if (res && res.ok) {
        state.settings.shortcuts = (res.settings && res.settings.shortcuts) || sc;
        toast(t('toast.saved'), 'ok');
      }
    });
    return;
  }

  /* ------------------------------- about ------------------------------- */
  const info = state.info || {};
  body.innerHTML = `
    <div class="card about-hero">
      <img src="../../assets/icon-128.png" alt="" />
      <h2>Fathi</h2>
      <p>${esc(t('about.tagline'))}</p>
      <div style="margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="badge accent">${esc(t('about.version', { v: info.version || '1.0.0' }))}</span>
        <button class="btn sm" id="about-update" type="button">${esc(t('update.check'))}</button>
        <span id="about-update-text" class="muted">${esc(updateStatusText(updateState))}</span>
      </div>
    </div>

    <div class="card credit-card">
      <div class="credit-avatar">iM</div>
      <div class="credit-text">
        <b>${esc(t('about.credit'))}</b>
        <span>${esc(t('about.creditSub'))}</span>
      </div>
      <button class="btn primary" id="about-telegram" type="button">
        <svg viewBox="0 0 24 24"><path d="M21 4L3 11l5 2 2 6 3-4 5 3z"/></svg>
        ${esc(t('about.message'))}
      </button>
    </div>

    <div class="card">
      <h3>${esc(t('about.links'))}</h3>
      <div class="about-links">
        <button class="about-link" id="about-github" type="button">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.73.5.99 5.24.99 11.5c0 4.86 3.15 8.98 7.52 10.44.55.1.75-.24.75-.53v-1.86c-3.06.67-3.71-1.47-3.71-1.47-.5-1.27-1.22-1.61-1.22-1.61-1-.68.08-.67.08-.67 1.1.08 1.68 1.13 1.68 1.13.98 1.68 2.57 1.2 3.2.92.1-.71.38-1.2.7-1.47-2.44-.28-5.01-1.22-5.01-5.43 0-1.2.43-2.18 1.13-2.95-.11-.28-.49-1.4.11-2.92 0 0 .92-.3 3.02 1.13a10.5 10.5 0 0 1 5.5 0c2.1-1.43 3.02-1.13 3.02-1.13.6 1.52.22 2.64.11 2.92.7.77 1.13 1.75 1.13 2.95 0 4.22-2.58 5.15-5.03 5.42.4.34.75 1.01.75 2.04v3.02c0 .3.2.64.76.53a10.52 10.52 0 0 0 7.5-10.43C23.01 5.24 18.27.5 12 .5z"/></svg>
          <span class="about-link-text"><b>${esc(t('about.github'))}</b><span>${esc(t('about.githubSub'))}</span></span>
          <span class="about-link-go">github.com/iMumd</span>
        </button>
        <button class="about-link" id="about-telegram-link" type="button">
          <svg viewBox="0 0 24 24"><path d="M21 4L3 11l5 2 2 6 3-4 5 3z"/></svg>
          <span class="about-link-text"><b>${esc(t('about.telegram'))}</b><span>${esc(t('about.telegramSub'))}</span></span>
          <span class="about-link-go">t.me/aweing</span>
        </button>
        <button class="about-link" id="about-channel" type="button">
          <svg viewBox="0 0 24 24"><path d="M21 4L3 11l5 2 2 6 3-4 5 3z"/></svg>
          <span class="about-link-text"><b>${esc(t('about.channel'))}</b><span>${esc(t('about.channelSub'))}</span></span>
          <span class="about-link-go">t.me/Mumdthoughts</span>
        </button>
        <button class="about-link" id="about-email" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 6l9 6 9-6"/></svg>
          <span class="about-link-text"><b>${esc(t('about.email'))}</b><span>${esc(t('about.emailSub'))}</span></span>
          <span class="about-link-go">hi@mumd.dev</span>
        </button>
      </div>
    </div>

    <div class="card">
      <h3>${esc(t('about.engine'))}</h3>
      <div class="kv"><span class="k">${esc(t('about.chromium'))}</span><span class="v">${esc(info.chrome || '')}</span></div>
      <div class="kv"><span class="k">${esc(t('about.electron'))}</span><span class="v">${esc(info.electron || '')}</span></div>
      <div class="kv"><span class="k">${esc(t('about.system'))}</span><span class="v">${esc((info.platform || '') + ' ' + (info.arch || ''))}</span></div>
    </div>

    <div class="card">
      <h3>${esc(t('about.privacyTitle'))}</h3>
      <p class="hint" style="margin:0">${esc(t('about.privacy'))}</p>
    </div>

    <div class="card">
      <h3>${esc(t('about.creditsTitle'))}</h3>
      <p class="hint" style="margin:0 0 8px">${esc(t('about.credits'))}</p>
      <p class="hint" style="margin:0">${esc(t('about.license'))}</p>
    </div>

    <div class="card">
      <h3>${esc(t('about.openSource'))}</h3>
      <p class="hint" style="margin:0">${esc(t('about.openSourceText'))}</p>
    </div>`;

  const openLink = (id, url) => {
    const el = $('#' + id);
    if (el) el.addEventListener('click', () => window.api.openExternal(url));
  };
  openLink('about-telegram', 'https://t.me/aweing');
  openLink('about-telegram-link', 'https://t.me/aweing');
  openLink('about-github', 'https://github.com/iMumd');
  openLink('about-channel', 'https://t.me/Mumdthoughts');
  openLink('about-email', 'mailto:hi@mumd.dev');

  const checkBtn = $('#about-update');
  if (checkBtn) {
    checkBtn.addEventListener('click', () => {
      checkBtn.disabled = true;
      checkForUpdates(false).finally(() => { checkBtn.disabled = false; });
    });
  }
}

async function renderProxyStatus() {
  const box = $('#px-status');
  if (!box) return;
  const tab = activeTab();
  if (!tab) { box.innerHTML = `<span class="muted">${esc(t('proxy.noTab'))}</span>`; return; }
  const res = await window.api.tab.proxyStatus(tab.partition);
  const p = (res && res.proxy) || {};
  box.innerHTML = `
    <div class="kv"><span class="k">${esc(t('proxy.state'))}</span><span class="v">${p.enabled ? esc(t('proxy.online')) : esc(t('proxy.direct'))}</span></div>
    <div class="kv"><span class="k">${esc(t('proxy.host'))}</span><span class="v mono">${esc(p.host || 'n/a')}</span></div>
    <div class="kv"><span class="k">${esc(t('proxy.modeLabel'))}</span><span class="v">${p.mode === 'rotate' ? esc(t('proxy.rotateMode')) : esc(t('proxy.single'))}</span></div>
    <div class="kv"><span class="k">${esc(t('proxy.count'))}</span><span class="v">${p.count || 0}</span></div>
    <div class="kv"><span class="k">${esc(t('proxy.partition'))}</span><span class="v mono">${esc(tab.partition)}</span></div>${p.tor ? `
    <div class="kv"><span class="k">${esc(t('proxy.tor'))}</span><span class="v mono">127.0.0.1:${esc(p.tor.port)}</span></div>` : ''}`;
}

async function renderExtensionList() {
  const box = $('#ext-list');
  if (!box) return;
  const res = await window.api.ext.list();
  const list = (res && res.list) || [];
  if (!list.length) {
    box.innerHTML = `<p class="hint" style="margin:0">${esc(t('ext.empty'))}</p>`;
    return;
  }
  box.innerHTML = list.map((e) => `
    <div class="ext-item">
      <div class="ext-icon">${esc(String(e.name || '?').slice(0, 1).toUpperCase())}</div>
      <div class="ext-meta">
        <div class="ext-name">${esc(e.name)}</div>
        <div class="ext-sub">v${esc(e.version)} · ${esc(t('ext.sessions', { n: e.runningIn || 0 }))} · ${esc(e.source === 'unpacked' ? t('ext.folder') : t('ext.store'))}</div>
      </div>
      <button class="btn sm danger" data-ext-remove="${esc(e.id)}">${esc(t('ext.remove'))}</button>
    </div>`).join('');

  box.querySelectorAll('[data-ext-remove]').forEach((b) => {
    b.addEventListener('click', async () => {
      const res2 = await window.api.ext.remove(b.dataset.extRemove);
      if (res2 && res2.ok) { toast(t('toast.extRemoved'), 'ok'); renderExtensionList(); }
    });
  });
}

let fpListTimer = null;
function refreshFingerprintList() {
  clearTimeout(fpListTimer);
  fpListTimer = setTimeout(renderFingerprintList, 30);
}

function renderFingerprintList() {
  const box = $('#fp-list');
  if (!box) return;
  if (!state.tabs.length) {
    box.innerHTML = `<p class="hint" style="margin:0">n/a</p>`;
    return;
  }
  box.innerHTML = state.tabs.map((tab, i) => {
    const f = tab.fp || {};
    const mobile = !!(f.device && f.device.mobile);
    return `
      <div class="fp-row">
        <div class="fp-ua" title="${esc(f.ua || '')}">${mobile ? esc(f.device.name) + ' · ' : ''}${esc(shortUa(f.ua))}</div>
        <button class="btn sm" data-rotate="${esc(tab.id)}">${esc(t('fp.rotate'))}</button>
        <div class="fp-tags">
          <span class="tag">${esc(t('fp.tagTab', { n: i + 1 }))}</span>
          <span class="tag">${esc(osLabel(f))}</span>
          <span class="tag">${esc(f.timezone || '')}</span>
          <span class="tag">${esc(f.language || '')}</span>
          <span class="tag">${mobile ? `${f.device.width}×${f.device.height}` : (f.screen ? `${f.screen.width}×${f.screen.height}` : '')}</span>
          <span class="tag">${esc(t('fp.tagCores', { n: f.hardwareConcurrency || '?' }))}</span>
          <span class="tag">${esc(String((f.webgl && f.webgl.vendor) || '').replace('Google Inc. ', ''))}</span>
        </div>
      </div>`;
  }).join('');

  box.querySelectorAll('[data-rotate]').forEach((b) => {
    b.addEventListener('click', async () => { await rotateTab(b.dataset.rotate); });
  });
}

function highlightActiveTabInSettings() {
  if (!$('#dev-list')) return;
  const tab = activeTab();
  const activeId = (tab && tab.fp && tab.fp.device && tab.fp.device.id) || 'desktop';
  $$('#dev-list [data-device]').forEach((el) => {
    el.classList.toggle('active', el.dataset.device === activeId);
  });
}

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

window.api.on('fathi:newtab:guide', () => openGuide());
window.api.on('fathi:newtab:shortcuts', () => openSettings('shortcuts'));

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

window.api.on('fathi:proxy:changed', (cfg) => {
  if (state.settings) state.settings.proxy = cfg;
  updateChips();
  renderProxyStatus();
});

window.api.on('fathi:tor:changed', (cfg) => {
  if (state.settings) state.settings.tor = cfg;
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

let layoutTimer;
window.addEventListener('resize', () => {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(() => {
  const tab = activeTab();
  if (tab) applyTabLayout(tab);
  }, 80);
  closeDevicePopover();
});

/* --------------------------------------------------- app menu and guide */

$('#app-menu-btn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const menu = $('#app-menu');
  if (menu && menu.classList.contains('hidden')) openAppMenu();
  else closeAppMenu();
});

document.addEventListener('click', (e) => {
  const menu = $('#app-menu');
  if (menu && !menu.classList.contains('hidden') && !e.target.closest('#app-menu')) closeAppMenu();
});
window.addEventListener('blur', closeAppMenu);

$('#am-guide')?.addEventListener('click', () => { closeAppMenu(); openGuide(); });
$('#am-hotkeys')?.addEventListener('click', () => { closeAppMenu(); openSettings('shortcuts'); });
$('#am-settings')?.addEventListener('click', () => { closeAppMenu(); openSettings(); });
$('#am-about')?.addEventListener('click', () => { closeAppMenu(); openSettings('about'); });
$('#am-github')?.addEventListener('click', () => { closeAppMenu(); window.api.openExternal('https://github.com/iMumd'); });
$('#am-telegram')?.addEventListener('click', () => { closeAppMenu(); window.api.openExternal('https://t.me/aweing'); });
$('#am-hide')?.addEventListener('click', () => { closeAppMenu(); window.api.win.hide(); });
$('#am-quit')?.addEventListener('click', () => { closeAppMenu(); window.api.app.quit(); });

$('#guide-close')?.addEventListener('click', closeGuide);
$('#guide-overlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'guide-overlay') closeGuide();
});
$('#guide-settings')?.addEventListener('click', () => { closeGuide(); openSettings('shortcuts'); });

window.api.on('fathi:menu:open', () => openAppMenu());

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const guide = $('#guide-overlay');
  if (guide && !guide.classList.contains('hidden')) closeGuide();
  closeAppMenu();
});

/* ------------------------------------------------------------------ boot */

(async function boot() {
  const res = await window.api.settings.get();
  state.settings = res.settings;
  state.info = res.info;

  window.i18n.setLang(state.settings.language || 'en', { silent: true });
  applyTheme();
  applyStatic();
  bindUpdateUi();

  try {
    const st = await window.api.intercept.state();
    if (st && st.ok) {
      ix.enabled = !!st.state.enabled;
      ix.filter = st.state.filter || '';
      ixUpdateChrome();
    }
  } catch {}

  try {
    const dev = await window.api.devices.list();
    if (dev && dev.ok) {
      state.devices = dev.devices || [];
      state.deviceGroups = dev.groups ? groupDevices(state.devices, dev.desktop) : {};
      state.desktop = dev.desktop || state.desktop;
    }
  } catch {}

  window.api.win.state().then((s) => {
    if (s && s.maximized) {
      const btn = $('#win-max');
      btn.title = t('win.restore');
      btn.setAttribute('aria-label', btn.title);
    }
  });

  await createTab({ deviceId: state.settings.defaultDevice || 'desktop' });
  if (state.info.packaged && state.settings.lastSeenRelease !== state.info.version) {
    await showReleaseNotesOnce();
  }

  window.addEventListener('focus', () => { updateNavButtons(); updateChips(); });
})();

function groupDevices(list, desktop) {
  const out = { desktop: [desktop] };
  for (const d of list) {
    if (!out[d.group]) out[d.group] = [];
    out[d.group].push(d);
  }
  return out;
}

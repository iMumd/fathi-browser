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


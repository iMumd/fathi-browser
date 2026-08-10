
  intercept: {
    enabled: false,
    filter: ''               // substring of the URL; empty intercepts everything
  },

  wallpapers: {
    source: 'unsplash',      // 'unsplash' (bundled, offline-safe) | 'custom' | 'none'
    custom: '',
    blur: 0,
    dim: 0.32,
    refreshEachTab: true,
    online: false            // also try the live Unsplash feed (best effort)
  },

  extensions: [],

  window: { width: 1440, height: 920, maximized: false }
};

function isObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

function merge(base, extra) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!isObject(extra)) return out;
  for (const k of Object.keys(extra)) {
    if (isObject(base[k]) && isObject(extra[k])) out[k] = merge(base[k], extra[k]);
    else out[k] = extra[k];
  }
  return out;
}

let current = null;
let filePath = null;

function file() {
  if (!filePath) filePath = path.join(app.getPath('userData'), 'fathi-config.json');
  return filePath;
}


}

function unsplashSized(raw, width, quality) {
  if (!raw) return '';
  const base = String(raw).split('?')[0];
  return `${base}?auto=format&fit=crop&w=${width}&q=${quality}&fm=jpg`;
}

async function fetchUnsplash() {
  const now = Date.now();
  if (wallpaperCache.list.length && now - wallpaperCache.at < 10 * 60 * 1000) {
    return wallpaperCache.list;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    const res = await net.fetch(
      'https://unsplash.com/napi/topics/wallpapers/photos?per_page=30&page=1',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
          accept: 'application/json'
        },
        signal: ctrl.signal
      }
    );
    clearTimeout(timer);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const arr = await res.json();
    const list = (Array.isArray(arr) ? arr : []).map((p) => ({
      url: unsplashSized((p.urls && (p.urls.raw || p.urls.full || p.urls.regular)) || '', 2560, 85),
      thumb: unsplashSized((p.urls && p.urls.small) || '', 640, 60),
      author: (p.user && p.user.name) || 'Unsplash',
      link: (p.links && p.links.html) || 'https://unsplash.com'
    })).filter((x) => x.url);
    if (list.length) {
      wallpaperCache = { at: now, list };
      return list;
    }
  } catch {}
  return [];

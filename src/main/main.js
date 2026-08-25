}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

ipcMain.handle('fathi:wallpaper:fetch', async () => {
  try {
    const cfg = settings.get().wallpapers;
    if (cfg.source === 'none') return ok({ wallpaper: null });
    if (cfg.source === 'custom' && cfg.custom) {
      return ok({ wallpaper: { url: cfg.custom, author: 'Custom', link: '' } });
    }

    // The bundled set is always used as the guarantee; the live Unsplash
    // stream is only an opt-in bonus so wallpapers never come up blank
    // (proxy/offline/firewall) and never hang the page on a remote image.
    const locals = localWallpapers();
    const localPick = locals.length ? pickRandom(locals) : null;
    let wallpaper = localPick;

    if (cfg.source === 'unsplash' && cfg.online === true && Math.random() < 0.5) {
      const remote = await fetchUnsplash();
      if (remote.length) wallpaper = pickRandom(remote);
    }

    if (!wallpaper) return ok({ wallpaper: null });
    return ok({
      wallpaper: { ...wallpaper, fallback: localPick ? localPick.url : '' },
      count: locals.length
    });
  } catch (e) { return fail(e); }
});

/* --- new tab page bridge */

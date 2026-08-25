
ipcMain.handle('fathi:net:clear', (event, { wcId, all } = {}) => {
  try { return ok(network.clear({ wcId, all: !!all })); }
  catch (e) { return fail(e); }
});

/* --- settings */
ipcMain.handle('fathi:settings:get', () => ok({
  settings: settings.get(),
  info: {
    version: app.getVersion(),
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
}));

ipcMain.handle('fathi:settings:set', (event, patch = {}) => {
  try {
    const cfg = settings.save(patch);
    mainWindow && mainWindow.webContents.send('fathi:settings:changed', cfg);
    return ok({ settings: cfg });
  } catch (e) { return fail(e); }
});

ipcMain.handle('fathi:settings:reset', () => ok({ settings: settings.reset() }));

/* --- wallpapers */
const LOCAL_WALLPAPER_DIR = path.join(__dirname, '..', '..', 'assets', 'wallpapers');
let wallpaperCache = { at: 0, list: [] };

function localWallpapers() {
  try {
    return fs.readdirSync(LOCAL_WALLPAPER_DIR)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort()
      .map((f) => ({
        url: `fathi://wallpaper/${encodeURIComponent(f)}`,
        thumb: `fathi://wallpaper/${encodeURIComponent(f)}`,
        author: 'Unsplash',
        link: 'https://unsplash.com',
        local: true
      }));
  } catch { return []; }

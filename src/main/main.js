});

ipcMain.handle('fathi:ext:install-unpacked', async (event) => {
  try {
    const res = await extMgr.installUnpacked(mainWindow, partitions);
    const list = await extMgr.list(partitions);
    return ok({ ...(res || {}), list });
  } catch (e) { return fail(e); }
});

ipcMain.handle('fathi:ext:list', async () => ok({ list: await extMgr.list(partitions) }));

ipcMain.handle('fathi:ext:remove', async (event, { id } = {}) => {
  try {
    await extMgr.remove(id, partitions);
    return ok({ list: await extMgr.list(partitions) });
  } catch (e) { return fail(e); }
});

/* ----------------------------------------------------------------- lifecycle */

app.whenReady().then(async () => {
  settings.load();
  protocolPages.bind(session.defaultSession);

  // default session should not persist anything either
  try {
    session.defaultSession.setPermissionRequestHandler((wc, p, cb) => cb(false));
  } catch {}

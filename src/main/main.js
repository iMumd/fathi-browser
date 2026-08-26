ipcMain.handle('fathi:newtab:navigate', (event, url) => {
  if (mainWindow) {
    mainWindow.webContents.send('fathi:newtab:navigate', { url, wcId: event.sender.id });
  }
  return ok({});
});

ipcMain.handle('fathi:newtab:new', (event) => {
  if (mainWindow) mainWindow.webContents.send('fathi:newtab:new', { wcId: event.sender.id });
  return ok({});
});

ipcMain.handle('fathi:newtab:rotate', (event) => {
  if (mainWindow) mainWindow.webContents.send('fathi:newtab:rotate', { wcId: event.sender.id });
  return ok({});
});

ipcMain.handle('fathi:newtab:focus', (event) => {
  if (mainWindow) mainWindow.webContents.send('fathi:focus-omnibox');
  return ok({});
});

ipcMain.handle('fathi:page:status', (event) => {
  let partition = '';
  try {
    for (const [p, rec] of partitions) {
      if (rec.ses === event.sender.session) { partition = p; break; }
    }
  } catch {}
  return ok({
    proxy: proxyMgr.status(partition),
    fpId: partitionFp.get(partition) || '',
    partition
  });
});

/* --- extensions */
ipcMain.handle('fathi:ext:install', async (event, { input } = {}) => {
  try {
    const res = await extMgr.install(input, partitions);
    const list = await extMgr.list(partitions);
    return ok({ ...res, list });
  } catch (e) { return fail(e); }

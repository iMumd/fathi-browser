});

ipcMain.handle('fathi:tab:proxy-status', (event, { partition } = {}) => {
  return ok({ proxy: proxyMgr.status(partition) });
});

/* --- proxy */
ipcMain.handle('fathi:proxy:get', () => ok({ config: settings.get().proxy }));

ipcMain.handle('fathi:proxy:set', async (event, patch = {}) => {
  try {
    const cfg = settings.save({ proxy: patch });
    // re-assign and apply to all live tabs
    proxyMgr.assignments.clear();
    for (const [partition, rec] of partitions) {
      proxyMgr.assign(partition);
      await proxyMgr.applyTo(rec.ses, partition);
      applyCertTrust(rec.ses);
    }
    mainWindow && mainWindow.webContents.send('fathi:proxy:changed', cfg.proxy);
    return ok({ config: cfg.proxy, applied: partitions.size });
  } catch (e) { return fail(e); }
});

ipcMain.handle('fathi:proxy:test', async (event, { entry, url } = {}) => {
  try {
    const res = await proxyMgr.test(entry, url);
    return ok({ result: res });
  } catch (e) { return fail(e); }
});

/* --- interceptor (Burp-style pause/edit) */
ipcMain.handle('fathi:intercept:state', () => ok({ state: intercept.state() }));

ipcMain.handle('fathi:intercept:set', async (event, { enabled: on } = {}) => {
  try { return ok({ state: await intercept.setEnabled(on) }); }
  catch (e) { return fail(e); }
});


}));

ipcMain.handle('fathi:win:minimize', () => { if (mainWindow) mainWindow.minimize(); return ok({}); });
ipcMain.handle('fathi:win:toggle-maximize', () => {
  if (!mainWindow) return ok({});
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  return ok({ maximized: mainWindow.isMaximized() });
});
ipcMain.handle('fathi:win:close', () => { if (mainWindow) mainWindow.close(); return ok({}); });
ipcMain.handle('fathi:win:state', () => ok({
  maximized: mainWindow ? mainWindow.isMaximized() : false,
  fullscreen: mainWindow ? mainWindow.isFullScreen() : false
}));
ipcMain.handle('fathi:open-external', (e, url) => { shell.openExternal(url).catch(() => {}); return ok({}); });

/* --- devices */
ipcMain.handle('fathi:devices:list', () => ok({
  devices: devices.DEVICES,
  groups: devices.GROUPS,
  desktop: devices.DESKTOP
}));

/* --- fingerprints */
ipcMain.handle('fathi:fp:new', () => {
  const fp = fpgen.generate();
  fps.set(fp.id, fp);
  return ok({ fp });
});

ipcMain.on('fathi:fp:sync', (event, fpId) => {
  const fp = fps.get(fpId);
  event.returnValue = fp ? JSON.stringify(fp) : 'null';
});

ipcMain.handle('fathi:fp:current', (event, fpId) => {
  const fp = fps.get(fpId);
  return fp ? ok({ fp }) : fail('no fingerprint');
});

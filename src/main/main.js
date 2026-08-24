
/* --- tabs */
ipcMain.handle('fathi:tab:prepare', async (event, opts = {}) => {
  try {
    let fp = opts.fp && opts.fp.id ? opts.fp : null;
    if (!fp) {
      fp = fpgen.generate({ deviceId: opts.deviceId });
      if (opts.landscape && fp.device && fp.device.mobile) {
        const w = fp.device.width;
        fp.device.width = fp.device.height;
        fp.device.height = w;
        fp.device.orientation = 'landscape';
        fp.screen.width = fp.device.width;
        fp.screen.height = fp.device.height;
        fp.screen.availWidth = fp.device.width;
        fp.screen.availHeight = Math.round(fp.device.height * 0.94);
      }
      fps.set(fp.id, fp);
    } else {
      fps.set(fp.id, fp);
    }

    const partition = `fathi-tab-${fp.id}-${Date.now().toString(36)}`;
    partitionFp.set(partition, fp.id);
    ensureSession(partition, fp);

    return ok({
      fp,
      fpId: fp.id,
      partition,
      proxy: proxyMgr.status(partition)
    });
  } catch (e) {
    return fail(e);
  }
});

ipcMain.handle('fathi:tab:destroy', async (event, { partition } = {}) => {
  if (partition) await destroySession(partition);
  return ok({});

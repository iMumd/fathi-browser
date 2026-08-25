ipcMain.handle('fathi:intercept:resolve', async (event, payload = {}) => {
  const res = await intercept.resolve(payload);
  return res.ok ? ok({}) : fail(res.error);
});

ipcMain.handle('fathi:intercept:drain', async () => {
  try { return ok(await intercept.drain()); }
  catch (e) { return fail(e); }
});

ipcMain.handle('fathi:intercept:filter', (event, { filter } = {}) => {
  try { return ok({ state: intercept.setFilter(filter) }); }
  catch (e) { return fail(e); }
});

/* --- flow recorder (network log / HAR export) */
ipcMain.handle('fathi:net:list', (event, { wcId, all } = {}) => {
  try {
    return ok({
      records: network.listSummaries(wcId, !!all),
      stats: network.stats(wcId, !!all)
    });
  } catch (e) { return fail(e); }
});

ipcMain.handle('fathi:net:detail', (event, { wcId, id } = {}) => {
  const record = network.detail({ wcId, id });
  return record ? ok({ record }) : fail('request not found');
});

ipcMain.handle('fathi:net:export', async (event, opts = {}) => {
  try { return ok(await network.save(opts)); }
  catch (e) { return fail(e); }
});

ipcMain.handle('fathi:net:serialize', (event, { format = 'har', wcId, all } = {}) => {
  try { return ok({ text: network.serialize(format, { wcId, all: !!all }) }); }
  catch (e) { return fail(e); }
});

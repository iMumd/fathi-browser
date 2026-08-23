});

/* ------------------------------------------------------------------- auth */

app.on('login', (event, webContents, details, authInfo, callback) => {
  if (!authInfo || !authInfo.isProxy) return;

  // find the entry assigned to the session that requested auth
  let entry = null;
  try {
    const ses = webContents.session;
    for (const [partition, rec] of partitions) {
      if (rec.ses === ses) { entry = proxyMgr.entryFor(partition); break; }
    }
  } catch {}

  if (!entry) {
    const pool = proxyMgr.pool();
    entry = pool[0] || null;
  }
  if (!entry) return;

  event.preventDefault();
  callback(entry.username || '', entry.password || '');
});

/* --------------------------------------------------------------------- IPC */

function ok(data) { return { ok: true, ...data }; }
function fail(error) { return { ok: false, error: String(error && error.message || error) }; }

/* --- app / window */
ipcMain.handle('fathi:app:info', () => ok({
  name: 'Fathi',
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  platform: process.platform,
  arch: process.arch,
  sessions: partitions.size

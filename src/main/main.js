
  proxyMgr.assign(partition);
  protocolPages.bind(ses);
  configureSession(ses, fp, partition, { downloadDir: DOWNLOAD_DIR });
  partitions.set(partition, { ses, fp });

  return ses;
}

async function destroySession(partition) {
  const rec = partitions.get(partition);
  partitions.delete(partition);
  partitionFp.delete(partition);
  if (!rec) return;
  try { await rec.ses.clearStorageData(); } catch {}
  try { await rec.ses.clearCache(); } catch {}
  try { await rec.ses.clearHostResolverCache(); } catch {}
}

/* ------------------------------------------------------------------ window */

function createWindow() {
  const cfg = settings.get();

  mainWindow = new BrowserWindow({
    width: cfg.window.width,
    height: cfg.window.height,
    minWidth: 940,
    minHeight: 620,
    frame: false,
    show: false,
    backgroundColor: '#14161a',
    title: 'Fathi',
    icon: path.join(ASSETS_DIR, 'icon.png'),
    webPreferences: {
      preload: path.join(PRELOAD_DIR, 'ui.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      spellcheck: false,
      devTools: true
    }
  });

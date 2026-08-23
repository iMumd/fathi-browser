}

app.on('web-contents-created', (_event, wc) => {
  if (wc.getType() !== 'webview') return;

  intercept.attach(wc);
  network.attach(wc);

  const rec = recordForWebContents(wc);
  if (rec && rec.fp && rec.fp.device && rec.fp.device.mobile) {
    const apply = () => applyDeviceEmulation(wc, rec.fp);
    wc.once('dom-ready', apply);
    wc.on('did-navigate', apply);
  }

  // target=_blank -> new Fathi tab
  wc.setWindowOpenHandler(({ url, disposition }) => {
    if (mainWindow) {
      mainWindow.webContents.send('fathi:window:open', { url, wcId: wc.id, disposition });
    }
    return { action: 'deny' };
  });

  // Keep everything inside the tab; block unexpected app launches
  wc.on('will-navigate', (event, url) => {
    if (/^(mailto|tel|magnet|steam):/i.test(url)) {
      event.preventDefault();
      shell.openExternal(url).catch(() => {});
    }
  });

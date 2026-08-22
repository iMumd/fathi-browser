
  if (cfg.window.maximized) mainWindow.maximize();

  mainWindow.loadFile(path.join(RENDERER_DIR, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  /* -------- webview hardening + per-tab preload wiring */
  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    const partition = params.partition || '';
    const fpId = partitionFp.get(partition) || '';

    // Never trust a renderer supplied preload / node integration
    delete webPreferences.preloadURL;
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInSubFrames = true;   // spoof iframes too
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = false;
    webPreferences.webSecurity = true;
    webPreferences.allowRunningInsecureContent = false;
    webPreferences.webviewTag = false;
    webPreferences.preload = path.join(PRELOAD_DIR, 'fp.js');
    webPreferences.additionalArguments = [`--fathi-fp=${fpId}`, `--fathi-partition=${partition}`];
    webPreferences.spellcheck = false;
    webPreferences.devTools = true;
  });

  mainWindow.on('closed', () => { mainWindow = null; });

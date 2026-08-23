
  const pushWinState = () => {
    if (!mainWindow) return;
    mainWindow.webContents.send('fathi:win:state', {
      maximized: mainWindow.isMaximized(),
      fullscreen: mainWindow.isFullScreen()
    });
  };
  mainWindow.on('maximize', pushWinState);
  mainWindow.on('unmaximize', pushWinState);
  mainWindow.on('enter-full-screen', pushWinState);
  mainWindow.on('leave-full-screen', pushWinState);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (mainWindow) mainWindow.webContents.send('fathi:window:open', { url });
    return { action: 'deny' };
  });
}

/* ------------------------------------------------------ webview behaviour */

function recordForWebContents(wc) {
  try {
    for (const [partition, rec] of partitions) {
      if (rec.ses === wc.session) return { partition, fp: rec.fp };
    }
  } catch {}
  return null;
}

/** Touch emulation + UA override for mobile presets (layout is CSS-driven). */
async function applyDeviceEmulation(wc, fp) {
  const dev = fp && fp.device;
  if (!dev || !dev.mobile) return;
  try {
    const dbg = wc.debugger;
    if (!dbg.isAttached()) dbg.attach('1.3');
    await dbg.sendCommand('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: dev.touch || 5
    });
    await dbg.sendCommand('Emulation.setUserAgentOverride', {
      userAgent: fp.ua,
      acceptLanguage: (fp.languages || ['en-US']).join(','),
      platform: fp.platform
    });
  } catch (e) {
    // devtools already attached or target gone, non fatal
  }

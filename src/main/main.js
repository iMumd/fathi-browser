
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;
    if (ctrl && input.key.toLowerCase() === 'l') {
      event.preventDefault();
      if (mainWindow) mainWindow.webContents.send('fathi:focus-omnibox');
    }
    if (ctrl && input.key.toLowerCase() === 't') {
      event.preventDefault();
      if (mainWindow) mainWindow.webContents.send('fathi:new-tab');
    }
    if (ctrl && input.key.toLowerCase() === 'w') {
      event.preventDefault();
      if (mainWindow) mainWindow.webContents.send('fathi:close-tab', { wcId: wc.id });
    }
    if (input.key === 'F12' || (ctrl && input.shift && input.key.toLowerCase() === 'i')) {
      event.preventDefault();
      if (wc.isDevToolsOpened()) wc.closeDevTools();
      else wc.openDevTools({ mode: 'detach' });
    }
  });

  // Right-click: inspect element / DevTools / copy-paste, like a real browser.
  wc.on('context-menu', (_event, params) => {
    const items = [];
    if (params.linkURL) {
      items.push({
        label: 'Open link in new tab',
        click: () => { if (mainWindow) mainWindow.webContents.send('fathi:window:open', { url: params.linkURL }); }
      });
      items.push({ label: 'Copy link address', click: () => clipboard.writeText(params.linkURL) });
      items.push({ type: 'separator' });
    }
    if (params.mediaType === 'image' && params.srcURL) {
      items.push({ label: 'Copy image address', click: () => clipboard.writeText(params.srcURL) });
      items.push({ type: 'separator' });
    }
    items.push({ role: 'copy', label: 'Copy', enabled: !!(params.editFlags && params.editFlags.canCopy) });
    items.push({ role: 'paste', label: 'Paste', enabled: !!(params.editFlags && params.editFlags.canPaste) });
    items.push({ type: 'separator' });
    items.push({ label: 'Inspect element', click: () => wc.inspectElement(params.x, params.y) });
    items.push({ label: 'Open DevTools', click: () => wc.openDevTools({ mode: 'detach' }) });
    try { Menu.buildFromTemplate(items).popup({ window: mainWindow }); } catch {}
  });

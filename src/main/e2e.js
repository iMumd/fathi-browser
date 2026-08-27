
  /* ---- 1. chrome rendered */
  trace('check 1: chrome');
  const shell = await ui.executeJavaScript(`({
    tabs: document.querySelectorAll('.tab').length,
    webviews: document.querySelectorAll('webview').length,
    hasOmni: !!document.getElementById('omnibox'),
    hasSettings: !!document.getElementById('settings-overlay'),
    title: document.title
  })`);
  add('browser chrome rendered', shell.tabs === 1 && shell.webviews === 1 && shell.hasOmni, JSON.stringify(shell));

  /* ---- 2. new tab page loaded inside the webview */
  const tabsState = () => withTimeout(ui.executeJavaScript(`(() => {
    const list = Array.from(document.querySelectorAll('webview')).map((w) => {
      let url = null, title = null, err = null;
      try { url = w.getURL(); } catch (e) { err = String(e && e.message || e); }
      try { title = w.getTitle(); } catch (e) {}
      return {
        cls: w.className,
        srcAttr: w.getAttribute('src'),
        partitionAttr: w.getAttribute('partition'),
        url, title, err,
        connected: w.isConnected
      };
    });
    const active = document.querySelector('webview.active') || document.querySelector('webview');
    return {
      count: document.querySelectorAll('.tab').length,
      partition: active ? active.getAttribute('partition') : null,
      url: active && active.getURL ? (() => { try { return active.getURL(); } catch (e) { return 'ERR:' + e.message; } })() : null,
      title: active && active.getTitle ? (() => { try { return active.getTitle(); } catch (e) { return null; } })() : null,
      all: list
    };
  })()`), 5000, 'tabs state');
  report.debugFirstTabs = await tabsState().catch((e) => String(e));
  report.debugWebContents = (() => {
    try {
      return webContents.getAllWebContents().map((w) => ({
        id: w.id, type: w.getType(), url: w.getURL(), title: (() => { try { return w.getTitle(); } catch { return null; } })()
      }));
    } catch (e) { return String(e); }
  })();

  const first = await waitFor(async () => {
    const s = await tabsState();
    return s.url && s.url.startsWith('fathi://newtab') ? s : null;
  }, 15000);
  add('new tab page loaded', !!first, first && first.url);
  add('tab session is in-memory', first && first.partition && !String(first.partition).startsWith('persist:'), first && first.partition);

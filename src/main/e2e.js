
  const devFrame = await withTimeout(ui.executeJavaScript(`(() => {
    const wv = document.querySelector('webview.active');
    const v = document.getElementById('view');
    const r = v.getBoundingClientRect();
    const w = wv.getBoundingClientRect();
    return {
      stage: v.classList.contains('stage'),
      cssW: wv.style.width, cssH: wv.style.height,
      styleRight: w.right <= r.right + 1 && w.left >= r.left - 1 && w.top >= r.top - 1 && w.bottom <= r.bottom + 1,
      scale: wv.style.transform,
      url: (() => { try { return wv.getURL(); } catch { return ''; } })()
    };
  })()`), 5000, 'device frame');
  add('device tab uses a frame', devFrame.stage && devFrame.cssW === '393px' && devFrame.cssH === '852px', JSON.stringify(devFrame));

  const devMetrics = await waitFor(async () => {
    const m = await withTimeout(ui.executeJavaScript(`(async () => {
      const wv = document.querySelector('webview.active');
      try {
        return await wv.executeJavaScript('({ iw: innerWidth, ih: innerHeight, sw: screen.width, sh: screen.height, dpr: devicePixelRatio, touch: navigator.maxTouchPoints, ua: navigator.userAgent, platform: navigator.platform, uaData: typeof navigator.userAgentData, chromeObj: typeof window.chrome })');
      } catch (e) { return { err: String(e && e.message || e) }; }
    })()`), 5000, 'device metrics');
    return m && !m.err ? m : null;
  }, 15000);
  const devOK = devMetrics &&
    devMetrics.iw === 393 && devMetrics.sw === 393 &&
    Math.abs(devMetrics.dpr - 3) < 0.01 && devMetrics.touch === 5 &&
    /iPhone/.test(devMetrics.ua) && devMetrics.platform === 'iPhone' &&
    devMetrics.uaData === 'undefined' && devMetrics.chromeObj === 'undefined';
  add('device metrics match the user agent', devOK, JSON.stringify(devMetrics));

  /* ---- 5b. interceptor, pause, inspect and forward a real request */
  trace('check 5b: interceptor on');
  await ui.executeJavaScript(`(async () => { await window.api.intercept.set(true); })()`);
  await ui.executeJavaScript(`(() => {
    const wv = document.querySelector('webview.active');
    wv.loadURL('https://example.com/?fathi-ix=1');
  })()`);
  const pausedRows = await waitFor(
    () => ui.executeJavaScript(`document.querySelectorAll('#ix-list .ix-item').length`),
    20000
  );
  add('interceptor pauses requests', pausedRows > 0, 'rows=' + pausedRows);
  if (pausedRows > 0) {
    await ui.executeJavaScript(`document.getElementById('ix-forward-all').click()`);
    await sleep(800);
  }
  await ui.executeJavaScript(`(async () => { await window.api.intercept.set(false); })()`);
  const ixOff = await ui.executeJavaScript(`(async () => (await window.api.intercept.state()).state.enabled)()`);
  add('interceptor turns off cleanly', ixOff === false, 'enabled=' + ixOff);

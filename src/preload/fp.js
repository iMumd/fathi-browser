
  /* ---------- connection ---------- */
  try {
    const c = cfg.connection || {};
    def(nav, 'connection', {
      effectiveType: c.effectiveType || '4g',
      rtt: c.rtt || 50,
      downlink: c.downlink || 10,
      saveData: false,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {}
    });
  } catch (e) {}

  /* ---------- screen ---------- */
  try {
    const s = cfg.screen || {};
    const scr = w.screen;
    if (scr) {
      const keys = ['width', 'height', 'availWidth', 'availHeight', 'colorDepth', 'pixelDepth'];
      for (const k of keys) if (s[k] != null) def(scr, k, s[k]);
      defGet(scr, 'availLeft', () => 0);
      defGet(scr, 'availTop', () => 0);
    }
    if (s.dpr) def(w, 'devicePixelRatio', s.dpr);
    if (s.width) {
      def(w, 'outerWidth', s.width);
      def(w, 'outerHeight', s.height || 900);
      def(w, 'screenX', 0);
      def(w, 'screenY', 0);
    }
    // NOTE: innerWidth/innerHeight are intentionally left untouched, because the
    // webview is CSS-sized to the device viewport, so the real values already
    // match the spoofed screen. Overriding them here caused self-recursion.
  } catch (e) {}


  /* ---------- chrome object ---------- */
  try {
    if (cfg.hasChromeObject === false) {
      try { Object.defineProperty(w, 'chrome', { get: () => undefined, configurable: true }); } catch (e) {
        try { delete w.chrome; } catch (e2) {}
      }
    } else {
      if (!w.chrome) w.chrome = {};
      const ch = w.chrome;
      if (!ch.runtime) ch.runtime = {};
      if (!ch.runtime.id) ch.runtime.id = undefined;
      ch.loadTimes = () => ({
        requestTime: Date.now() / 1000 - 0.05,
        startLoadTime: Date.now() / 1000 - 0.04,
        commitLoadTime: Date.now() / 1000 - 0.02,
        finishDocumentLoadTime: Date.now() / 1000 - 0.01,
        finishLoadTime: Date.now() / 1000,
        firstPaintTime: Date.now() / 1000 - 0.015,
        firstPaintAfterLoadTime: 0,
        navigationType: 'Other',
        wasFetchedViaSpdy: true,
        wasNpnNegotiated: true,
        npnNegotiatedProtocol: 'h2',
        wasAlternateProtocolAvailable: false,
        connectionInfo: 'h2'
      });
      ch.csi = () => ({
        onloadT: Date.now(), startE: Date.now() - 120, pageT: 120,
        tran: 15, navigationStart: Date.now() - 120
      });
      if (!ch.app) ch.app = { isInstalled: false, InstallState: { DISABLED: 'disabled' }, RunningState: { RUNNING: 'running' }, getDetails: () => null, getIsInstalled: () => false };

      /* ---------- chrome.webstore shim (real install via Fathi) ---------- */
      try {
        if (!ch.webstore) {
          ch.webstore = {
            install: function (url, onSuccess, onFailure) {
              try {
                const bridge = w.__fathiBridge;
                const p = bridge && bridge.installExtension
                  ? bridge.installExtension(String(url))
                  : Promise.reject(new Error('unsupported'));
                p.then(() => onSuccess && onSuccess(), (e) => onFailure && onFailure(String(e && e.message || e)));
              } catch (e) { onFailure && onFailure(String(e)); }
            }
          };
        }
      } catch (e) {}
    }
  } catch (e) {}

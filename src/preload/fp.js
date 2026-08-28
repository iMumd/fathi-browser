
  /* ---------- plugins / mimeTypes ---------- */
  try {
    const names = cfg.plugins || ['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer'];
    const plugins = names.map((n) => {
      const p = { name: n, filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 0 };
      p.item = () => null; p.namedItem = () => null;
      return p;
    });
    plugins.item = (i) => plugins[i] || null;
    plugins.namedItem = (n) => plugins.find((p) => p.name === n) || null;
    plugins.refresh = () => {};
    def(nav, 'plugins', plugins);

    const mimes = [{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }];
    mimes.item = (i) => mimes[i] || null;
    mimes.namedItem = (t) => mimes.find((m) => m.type === t) || null;
    def(nav, 'mimeTypes', mimes);
  } catch (e) {}

  /* ---------- client hints ---------- */
  try {
    if (cfg.clientHints === false) {
      // Safari (iOS) never exposes User-Agent Client Hints.
      try {
        Object.defineProperty(nav, 'userAgentData', {
          get: () => undefined, configurable: true, enumerable: false
        });
      } catch (e) {}
    } else {
      const brands = cfg.uaBrands || [];
      const fullList = cfg.uaFullVersionList || [];
      const isMobile = !!(cfg.device && cfg.device.mobile);
      const highEntropy = (hints) => {
        const out = {
          architecture: cfg.architecture,
          bitness: cfg.bitness,
          brands,
          fullVersionList: fullList,
          mobile: isMobile,
          model: cfg.model || '',
          platform: cfg.uaDataPlatform,
          platformVersion: cfg.platformVersion,
          uaFullVersion: cfg.uaFullVersion,
          wow64: cfg.wow64
        };
        if (!hints || !hints.length) return out;
        const filtered = {};
        for (const h of hints) if (Object.prototype.hasOwnProperty.call(out, h)) filtered[h] = out[h];
        return filtered;
      };
      const uaData = {
        brands,
        mobile: isMobile,
        platform: cfg.uaDataPlatform,
        getHighEntropyValues: (hints) => Promise.resolve(highEntropy(hints)),
        toJSON: () => ({ brands, mobile: isMobile, platform: cfg.uaDataPlatform })
      };
      def(nav, 'userAgentData', uaData);
    }
  } catch (e) {}

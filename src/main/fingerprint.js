
    // screen
    screen: {
      width: sw,
      height: sh,
      availWidth: sw,
      availHeight: sh - Math.round(32 + rng() * 24),
      colorDepth: 24,
      pixelDepth: 24,
      dpr
    },

    // graphics / media
    webgl: { vendor: gpu.v, renderer: gpu.r },
    canvasSeed: Math.floor(rng() * 0xFFFFFFFF),
    audioSeed: Math.floor(rng() * 0xFFFFFFFF),
    fonts,
    plugins,

    // misc
    timezone: lang.timezone,
    timezoneOffsetBase: 0,
    colorScheme: rng() > 0.28 ? 'light' : 'dark',
    pdfViewerEnabled: true,
    cookieEnabled: true,
    onLine: true,
    connection: {
      effectiveType: pick(rng, ['4g', '4g', '4g', '3g']),
      rtt: pick(rng, [50, 50, 100, 150]),
      downlink: pick(rng, [10, 10, 8.5, 5.25, 2.3]),
      saveData: false
    },

    osKey,
    chromeMajor: ver,
    device: { id: device.id, name: device.name, mobile: !!device.mobile,
      width: device.width, height: device.height, dpr: device.dpr, touch: device.touch || 0, os: device.os || 'desktop' }
  };


  const brands = shuffle(rng, [
    { brand: 'Not:A-Brand', version: '99' },
    { brand: 'Google Chrome', version: String(ver) },
    { brand: 'Chromium', version: String(ver) }
  ]);
  const fullVersionList = shuffle(rng, [
    { brand: 'Not:A-Brand', version: '99.0.0.0' },
    { brand: 'Google Chrome', version: fullVer },
    { brand: 'Chromium', version: fullVer }
  ]);

  const fonts = shuffle(rng, FONT_POOL[osKey]).slice(0, 8 + Math.floor(rng() * 7));

  const fp = {
    id: randHex(8),
    seed,
    enabled: true,
    createdAt: Date.now(),

    // navigator
    ua,
    appVersion: ua.replace(/^Mozilla\//, ''),
    appName: 'Netscape',
    appCodeName: 'Mozilla',
    platform: os.platform,
    vendor: 'Google Inc.',
    vendorSub: '',
    productSub: '20030107',
    oscpu: undefined,
    language: lang.language,
    languages: lang.languages,
    doNotTrack: null,
    hardwareConcurrency: cores,
    deviceMemory: memory,
    maxTouchPoints: 0,
    webdriver: false,

    // client hints
    uaBrands: brands,
    uaFullVersionList: fullVersionList,
    uaFullVersion: fullVer,
    uaMobile: false,
    uaDataPlatform: os.uaDataPlatform,
    platformVersion,
    architecture: os.architecture,
    bitness: os.bitness,
    wow64: os.wow64,

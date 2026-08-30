
  /* ---------- storage quota (device-class consistent) ---------- */
  try {
    if (nav.storage && nav.storage.estimate) {
      const mem = cfg.deviceMemory || 8;
      const quota = (mem >= 16 ? 240 : mem >= 8 ? 120 : 60) * 1024 * 1024 * 1024;
      nav.storage.estimate = () => Promise.resolve({
        quota: Math.round(quota * (0.82 + ((cfg.canvasSeed % 100) / 100) * 0.12)),
        usage: 1024 * 1024 * (4 + (cfg.canvasSeed % 90))
      });
    }
  } catch (e) {}

  /* ---------- battery ---------- */
  try {
    if (nav.getBattery) {
      const level = 0.35 + ((cfg.audioSeed % 60) / 100);
      nav.getBattery = () => Promise.resolve({
        charging: level > 0.8,
        chargingTime: level > 0.8 ? 0 : Infinity,
        dischargingTime: level > 0.8 ? Infinity : Math.round(level * 8 * 3600),
        level: Math.min(0.99, level),
        addEventListener() {}, removeEventListener() {}
      });
    }
  } catch (e) {}

  /* ---------- speech synthesis voices ---------- */
  try {
    if (w.speechSynthesis && w.speechSynthesis.getVoices) {
      const lang = (cfg.language || 'en-US').split('-')[0];
      w.speechSynthesis.getVoices = () => ([
        { name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true, default: lang === 'en', voiceURI: 'Microsoft David' },
        { name: 'Microsoft Zira - English (United States)', lang: 'en-US', localService: true, default: false, voiceURI: 'Microsoft Zira' },
        { name: 'Google US English', lang: 'en-US', localService: false, default: false, voiceURI: 'Google US English' }
      ]);
    }
  } catch (e) {}

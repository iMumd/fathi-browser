
  /* ---------- touch + mobile media (consistent with the device preset) ---------- */
  try {
    const mobile = !!(cfg.device && cfg.device.mobile);
    if (mobile) {
      def(nav, 'maxTouchPoints', cfg.device.touch || 5);
      try { if (!('ontouchstart' in w)) def(w, 'ontouchstart', null); } catch (e) {}
      try {
        const origMM = w.matchMedia.bind(w);
        w.matchMedia = function (q) {
          const query = String(q || '');
          let res = origMM(query);
          try {
            if (/pointer:\s*coarse/.test(query) || /any-pointer:\s*coarse/.test(query)) {
              return { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } };
            }
            if (/hover:\s*none/.test(query) || /any-hover:\s*none/.test(query)) {
              return { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } };
            }
            if (/pointer:\s*fine/.test(query) || /hover:\s*hover/.test(query)) {
              return { matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } };
            }
          } catch (e) {}
          return res;
        };
      } catch (e) {}
    }

    if (nav.mediaDevices && nav.mediaDevices.enumerateDevices) {
      const fake = mobile
        ? [
            { deviceId: 'default', kind: 'audioinput', label: '' },
            { deviceId: 'default', kind: 'audiooutput', label: '' },
            { deviceId: 'cam0', kind: 'videoinput', label: '' }
          ]
        : [
            { deviceId: 'default', kind: 'audioinput', label: '' },
            { deviceId: 'default', kind: 'audiooutput', label: '' },
            { deviceId: 'cam0', kind: 'videoinput', label: '' }
          ];
      nav.mediaDevices.enumerateDevices = () => Promise.resolve(fake.map((d) => ({ ...d, groupId: 'fathi' })));
      if (!nav.mediaDevices.getDisplayMedia) {
        nav.mediaDevices.getDisplayMedia = () => Promise.reject(new Error('Not allowed'));
      }
    }

    if (w.screen && w.screen.orientation) {
      const portrait = !cfg.device || cfg.device.height >= cfg.device.width;
      def(w.screen.orientation, 'type', portrait ? 'portrait-primary' : 'landscape-primary');
      def(w.screen.orientation, 'angle', 0);
    }
  } catch (e) {}

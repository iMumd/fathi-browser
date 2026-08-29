
    const origToBlob = w.HTMLCanvasElement.prototype.toBlob;
    w.HTMLCanvasElement.prototype.toBlob = function () {
      try {
        if (this.width > 4 && this.height > 4) {
          return origToBlob.apply(noisify(this), arguments);
        }
      } catch (e) {}
      return origToBlob.apply(this, arguments);
    };
  } catch (e) {}

  /* ---------- audio noise ---------- */
  try {
    const A = w.AnalyserNode;
    if (A) {
      const gffd = A.prototype.getFloatFrequencyData;
      A.prototype.getFloatFrequencyData = function (arr) {
        gffd.call(this, arr);
        try {
          let s = cfg.audioSeed >>> 0;
          for (let i = 0; i < arr.length; i += 97) {
            s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
            arr[i] = arr[i] + ((s / 4294967296) - 0.5) * 0.0002;
          }
        } catch (e) {}
      };
      const gbfd = A.prototype.getByteFrequencyData;
      A.prototype.getByteFrequencyData = function (arr) {
        gbfd.call(this, arr);
        try {
          for (let i = 0; i < arr.length; i += 211) {
            if (arr[i] > 0) arr[i] = Math.max(0, Math.min(255, arr[i] + ((i % 3) - 1)));
          }
        } catch (e) {}
      };
    }
  } catch (e) {}

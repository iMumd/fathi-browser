
    const perturb = (data, seedBase) => {
      let s = seedBase >>> 0;
      const step = 4 * 251;
      for (let i = 0; i < data.length; i += step) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        const delta = (s & 1) ? 1 : -1;
        const v = data[i] + delta;
        data[i] = v < 0 ? 0 : (v > 255 ? 255 : v);
      }
    };

    Ctx.prototype.getImageData = function (x, y, w2, h2) {
      const out = origGetImageData.call(this, x, y, w2, h2);
      try {
        if (w2 > 4 && h2 > 4) {
          perturb(out.data, (cfg.canvasSeed ^ Math.imul(w2, 73856093) ^ Math.imul(h2, 19349663)) >>> 0);
        }
      } catch (e) {}
      return out;
    };

    const noisify = (canvas) => {
      try {
        const c2 = document.createElement('canvas');
        c2.width = canvas.width;
        c2.height = canvas.height;
        const ctx = c2.getContext('2d');
        if (!ctx) return canvas;
        ctx.drawImage(canvas, 0, 0);
        const img = origGetImageData.call(ctx, 0, 0, c2.width, c2.height);
        perturb(img.data, (cfg.canvasSeed ^ Math.imul(c2.width, 83492791)) >>> 0);
        ctx.putImageData(img, 0, 0);
        return c2;
      } catch (e) { return canvas; }
    };

    const origToDataURL = w.HTMLCanvasElement.prototype.toDataURL;
    w.HTMLCanvasElement.prototype.toDataURL = function () {
      try {
        if (this.width > 4 && this.height > 4) {
          return origToDataURL.apply(noisify(this), arguments);
        }
      } catch (e) {}
      return origToDataURL.apply(this, arguments);
    };

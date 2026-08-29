
      try {
        const origResolved = OrigDTF.prototype.resolvedOptions;
        OrigDTF.prototype.resolvedOptions = function () {
          const r = origResolved.call(this);
          try { r.timeZone = tz; } catch (e) {}
          return r;
        };
      } catch (e) {}
    }
  } catch (e) {}

  /* ---------- WebGL ---------- */
  if (cfg.webgl) {
    const patchGL = (proto) => {
      if (!proto) return;
      try {
        const orig = proto.getParameter;
        proto.getParameter = function (p) {
          try {
            if (p === 37445 || p === 7936) return cfg.webgl.vendor;
            if (p === 37446 || p === 7937) return cfg.webgl.renderer;
          } catch (e) {}
          return orig.call(this, p);
        };
      } catch (e) {}
      try {
        const origExt = proto.getSupportedExtensions;
        proto.getSupportedExtensions = function () {
          const list = origExt.call(this) || [];
          for (const e of ['WEBGL_debug_renderer_info', 'EXT_texture_filter_anisotropic']) {
            if (list.indexOf(e) === -1) list.push(e);
          }
          return list;
        };
      } catch (e) {}
    };
    patchGL(w.WebGLRenderingContext && w.WebGLRenderingContext.prototype);
    patchGL(w.WebGL2RenderingContext && w.WebGL2RenderingContext.prototype);
  }

  /* ---------- canvas noise (stable per canvas size + seed) ---------- */
  try {
    const Ctx = w.CanvasRenderingContext2D;
    const origGetImageData = Ctx.prototype.getImageData;

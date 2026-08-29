
  /* ---------- timezone ---------- */
  try {
    const tz = cfg.timezone;
    if (tz) {
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      const offsetFor = (date) => {
        const parts = dtf.formatToParts(date);
        const m = {};
        for (const p of parts) m[p.type] = p.value;
        const asUTC = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour % 24, +m.minute, +m.second);
        return Math.round((date.getTime() - asUTC) / 60000);
      };

      const origOffset = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = function () {
        try { return -offsetFor(new Date(this.getTime())); }
        catch (e) { return origOffset.call(this); }
      };

      const OrigDTF = Intl.DateTimeFormat;
      const Wrapped = function (locale, opts) {
        const o = opts ? Object.assign({}, opts) : {};
        if (!o.timeZone) o.timeZone = tz;
        return new OrigDTF(locale || cfg.language, o);
      };
      Wrapped.prototype = OrigDTF.prototype;
      Wrapped.supportedLocalesOf = OrigDTF.supportedLocalesOf.bind(OrigDTF);
      try { Intl.DateTimeFormat = Wrapped; } catch (e) {}

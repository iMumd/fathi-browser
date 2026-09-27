
    $('#px-apply').addEventListener('click', async () => {
      const patch = {
        enabled: $('#px-enabled').classList.contains('on'),
        mode: $('#px-mode').value,
        pool: $('#px-pool').value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
        bypass: $('#px-bypass').value.trim() || '<local>'
      };
      const res = await window.api.proxy.set(patch);
      if (!res.ok) return toast(res.error, 'err');
      state.settings.proxy = res.config;
      updateChips();
      renderProxyStatus();
      toast(t('toast.applied', { n: res.applied }), 'ok');
    });

    $('#px-test').addEventListener('click', async () => {
      const out = $('#px-result');
      const lines = $('#px-pool').value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const entry = lines[0];
      if (!entry) return toast(t('toast.needProxy'), 'err');
      out.innerHTML = `<span class="badge warn">${esc(t('proxy.testing'))}</span>`;
      const res = await window.api.proxy.test(entry);
      if (!res.ok) { out.innerHTML = `<span class="badge err">${esc(t('proxy.error'))}</span> ${esc(res.error)}`; return; }
      const r = res.result;
      out.innerHTML = r.ok
        ? `<span class="badge">${esc(t('proxy.connected'))}</span> <span class="mono">IP: ${esc(r.ip || 'n/a')}</span> · ${r.ms} ms`
        : `<span class="badge err">${esc(t('proxy.failed'))}</span> ${esc(r.error || '')} · ${r.ms} ms`;
    });

    $('#px-trust').addEventListener('click', async (e) => {
      const on = e.currentTarget.classList.toggle('on');
      const res = await window.api.proxy.set({ trustBurpCert: on });
      if (res.ok) { state.settings.proxy = res.config; toast(t('toast.saved'), 'ok'); }
      else toast(res.error, 'err');
    });

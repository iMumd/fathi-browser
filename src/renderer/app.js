
    $('#px-burp').addEventListener('click', async () => {
      const res = await window.api.proxy.set({
        enabled: true,
        mode: 'single',
        pool: ['http://127.0.0.1:8080'],
        bypass: '<local>',
        trustBurpCert: true
      });
      if (!res.ok) return toast(res.error, 'err');
      state.settings.proxy = res.config;
      updateChips();
      renderSection('proxy');
      toast(t('toast.applied', { n: res.applied }), 'ok');
    });

    $('#px-intercept').addEventListener('click', () => {
      closeSettings();
      ixOpenDrawer();
    });

    renderProxyStatus();
    return;
  }

  if (section === 'wallpapers') {
    const w = S.wallpapers || {};
    body.innerHTML = `
      <div class="card">
        <h3>${esc(t('wp.title'))}</h3>
        <p class="hint">${esc(t('wp.hint'))}</p>

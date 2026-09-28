
    $('#wp-save').addEventListener('click', async () => {
      const patch = {
        wallpapers: {
          source: $('#wp-source').value,
          custom: $('#wp-custom').value.trim(),
          blur: Number($('#wp-blur').value) || 0,
          dim: (Number($('#wp-dim').value) || 0) / 100
        }
      };
      await window.api.settings.set(patch);
      state.settings = (await window.api.settings.get()).settings;
      reloadNewTabs();
      toast(t('toast.wpSaved'), 'ok');
    });

    $('#wp-refresh').addEventListener('click', () => {
      reloadNewTabs();
      toast(t('toast.wpRefreshed'), 'ok');
    });
    return;
  }

  if (section === 'extensions') {
    body.innerHTML = `
      <div class="card">
        <h3>${esc(t('ext.title'))}</h3>
        <p class="hint">${esc(t('ext.hint'))}</p>
        <div class="field">
          <label>${esc(t('ext.input'))}</label>
          <input type="text" id="ext-input" dir="ltr" placeholder="https://chromewebstore.google.com/detail/…" />
        </div>
        <div class="btn-row">
          <button class="btn primary" id="ext-install">${esc(t('ext.install'))}</button>
          <button class="btn" id="ext-unpacked">${esc(t('ext.unpacked'))}</button>
        </div>
      </div>

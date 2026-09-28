
      <div class="card">
        <h3>${esc(t('ext.listTitle'))}</h3>
        <div id="ext-list"></div>
      </div>`;

    $('#ext-install').addEventListener('click', async () => {
      const input = $('#ext-input').value.trim();
      if (!input) return toast(t('toast.needExt'), 'err');
      const btn = $('#ext-install');
      btn.disabled = true; btn.textContent = t('ext.installing');
      const res = await window.api.ext.install(input);
      btn.disabled = false; btn.textContent = t('ext.install');
      if (!res.ok) return toast(res.error, 'err');
      toast(t('toast.extInstalled', { name: res.record.name }), 'ok');
      renderExtensionList();
    });

    $('#ext-unpacked').addEventListener('click', async () => {
      const res = await window.api.ext.installUnpacked();
      if (!res || !res.ok || !res.record) return;
      toast(t('toast.extInstalled', { name: res.record.name }), 'ok');
      renderExtensionList();
    });

    renderExtensionList();
    return;
  }


    const search = $('#set-search');
    search.value = S.searchEngine || 'duckduckgo';
    search.addEventListener('change', async () => {
      await window.api.settings.set({ searchEngine: search.value });
      state.settings.searchEngine = search.value;
      toast(t('toast.saved'), 'ok');
    });

    const lang = $('#set-language');
    lang.value = S.language || 'en';
    lang.addEventListener('change', async () => {
      await setLanguage(lang.value);
    });

    $$('[data-theme-set]').forEach((b) => b.addEventListener('click', async () => {
      await setTheme(b.dataset.themeSet);
      renderSection('general');
    }));
    return;
  }

  if (section === 'devices') {
    const current = activeTab();
    const curDev = (current && current.fp && current.fp.device) || state.desktop;
    const groups = state.deviceGroups || {};
    const order = ['desktop', 'apple', 'samsung', 'google', 'other'];
    let listHtml = '';
    for (const key of order) {
      const arr = groups[key];
      if (!arr || !arr.length) continue;
      listHtml += `<div class="device-group-title">${esc(t('devices.group.' + key))}</div>`;
      listHtml += arr.map((d) => deviceItemHtml(d, curDev.id)).join('');
    }

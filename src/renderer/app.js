
      <div class="card">
        <h3>${esc(t('fp.tabsTitle', { n: state.tabs.length }))}</h3>
        <p class="hint">${esc(t('fp.tabsHint'))}</p>
        <div id="fp-list"></div>
      </div>

      <div class="card">
        <h3>${esc(t('fp.checkTitle'))}</h3>
        <p class="hint">${esc(t('fp.checkHint'))}</p>
        <div class="btn-row">
          <button class="btn sm" id="fp-check-1">browserleaks.com</button>
          <button class="btn sm" id="fp-check-2">abrahamjuliot.github.io/creepjs</button>
          <button class="btn sm" id="fp-check-3">iphey.com</button>
        </div>
      </div>`;

    body.querySelectorAll('.switch[data-toggle]').forEach((sw) => {
      sw.addEventListener('click', async () => {
        sw.classList.toggle('on');
        const path = sw.dataset.toggle.split('.');
        const patch = { [path[0]]: { [path[1]]: sw.classList.contains('on') } };
        await window.api.settings.set(patch);
        state.settings = (await window.api.settings.get()).settings;
        toast(t('toast.saved'), 'ok');
      });
    });

    for (const link of CHECK_LINKS) {
      const btn = $('#' + link.id);
      if (btn) btn.addEventListener('click', () => { navigate(link.url); closeSettings(); });
    }

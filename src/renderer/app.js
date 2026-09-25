
    body.innerHTML = `
      <div class="card">
        <h3>${esc(t('devices.title'))}</h3>
        <p class="hint">${esc(t('devices.hint'))}</p>
        <div class="field">
          <label>${esc(t('devices.default'))}</label>
          <select id="set-default-device">
            ${[state.desktop, ...state.devices].map((d) => `
              <option value="${esc(d.id)}">${esc(d.mobile ? d.name : t('devices.desktop'))}</option>`).join('')}
          </select>
        </div>
        <div class="btn-row">
          <button class="btn ${curDev.mobile ? '' : 'hidden'}" id="dev-rotate">
            <svg viewBox="0 0 24 24"><rect x="4" y="7" width="12" height="10" rx="2"/><path d="M19 10v4"/></svg>
            ${esc(t('devices.rotate'))}
          </button>
        </div>
      </div>

      <div class="card">
        <h3>${esc(t('devices.active'))} <span class="muted small">· ${esc(curDev.mobile ? curDev.name : t('devices.desktop'))}</span></h3>
        <p class="hint">${esc(t('devices.reload'))}</p>
        <div id="dev-list">${listHtml}</div>
      </div>`;

    const sel = $('#set-default-device');
    sel.value = S.defaultDevice || 'desktop';
    sel.addEventListener('change', async () => {
      await window.api.settings.set({ defaultDevice: sel.value });
      state.settings.defaultDevice = sel.value;
      toast(t('toast.saved'), 'ok');
    });

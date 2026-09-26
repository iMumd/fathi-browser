
    refreshFingerprintList();
    return;
  }

  if (section === 'proxy') {
    const p = S.proxy || {};
    body.innerHTML = `
      <div class="card">
        <h3>${esc(t('proxy.title'))}</h3>
        <p class="hint">${esc(t('proxy.hint'))}</p>

        <div class="row">
          <div><label>${esc(t('proxy.enable'))}</label><div class="sub">${esc(t('proxy.enableSub'))}</div></div>
          <div class="switch ${p.enabled ? 'on' : ''}" id="px-enabled"></div>
        </div>

        <div class="field" style="margin-top:12px">
          <label>${esc(t('proxy.mode'))}</label>
          <select id="px-mode">
            <option value="single">${esc(t('proxy.modeSingle'))}</option>
            <option value="rotate">${esc(t('proxy.modeRotate'))}</option>
          </select>
        </div>

        <div class="field">
          <label>${esc(t('proxy.pool'))}</label>
          <textarea id="px-pool" spellcheck="false" placeholder="http://user:pass@host:port">${esc((p.pool || []).join('\n'))}</textarea>
        </div>

        <div class="field">
          <label>${esc(t('proxy.bypass'))}</label>
          <input type="text" id="px-bypass" dir="ltr" value="${esc(p.bypass || '<local>')}" />
        </div>

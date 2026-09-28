
  /* ------------------------------- about ------------------------------- */
  const info = state.info || {};
  body.innerHTML = `
    <div class="card about-hero">
      <img src="../../assets/icon-128.png" alt="" />
      <h2>Fathi</h2>
      <p>${esc(t('about.tagline'))}</p>
      <div style="margin-top:12px"><span class="badge accent">${esc(t('about.version', { v: info.version || '1.0.0' }))}</span></div>
    </div>

    <div class="card credit-card">
      <div class="credit-avatar">M</div>
      <div class="credit-text">
        <b>${esc(t('about.credit'))}</b>
        <span>${esc(t('about.creditSub'))}</span>
      </div>
      <button class="btn primary" id="about-telegram">
        <svg viewBox="0 0 24 24"><path d="M21 4L3 11l5 2 2 6 3-4 5 3z"/></svg>
        ${esc(t('about.message'))}
      </button>
    </div>

    <div class="card">
      <h3>${esc(t('about.engine'))}</h3>
      <div class="kv"><span class="k">${esc(t('about.chromium'))}</span><span class="v">${esc(info.chrome || '')}</span></div>
      <div class="kv"><span class="k">${esc(t('about.electron'))}</span><span class="v">${esc(info.electron || '')}</span></div>
      <div class="kv"><span class="k">${esc(t('about.system'))}</span><span class="v">${esc((info.platform || '') + ' ' + (info.arch || ''))}</span></div>
    </div>

    <div class="card">
      <h3>${esc(t('about.privacyTitle'))}</h3>
      <p class="hint" style="margin:0">${esc(t('about.privacy'))}</p>
    </div>

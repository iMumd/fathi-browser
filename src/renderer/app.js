
    const rotate = $('#dev-rotate');
    if (rotate) rotate.addEventListener('click', () => {
      if (!curDev.mobile) return;
      changeDevice(curDev, curDev.orientation !== 'landscape');
    });

    $$('#dev-list [data-device]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dev = state.devices.find((d) => d.id === btn.dataset.device) || state.desktop;
        changeDevice(dev);
      });
    });
    return;
  }

  if (section === 'fingerprint') {
    const f = S.fingerprint || {};
    body.innerHTML = `
      <div class="card">
        <h3>${esc(t('fp.title'))}</h3>
        <p class="hint">${esc(t('fp.hint'))}</p>
        <div class="row">
          <div><label>${esc(t('fp.enabled'))}</label><div class="sub">${esc(t('fp.enabledSub'))}</div></div>
          <div class="switch ${f.enabled !== false ? 'on' : ''}" data-toggle="fingerprint.enabled"></div>
        </div>
        <div class="row">
          <div><label>${esc(t('fp.canvas'))}</label><div class="sub">${esc(t('fp.canvasSub'))}</div></div>
          <div class="switch ${f.spoofCanvas !== false ? 'on' : ''}" data-toggle="fingerprint.spoofCanvas"></div>
        </div>
        <div class="row">
          <div><label>${esc(t('fp.webgl'))}</label><div class="sub">${esc(t('fp.webglSub'))}</div></div>
          <div class="switch ${f.spoofWebgl !== false ? 'on' : ''}" data-toggle="fingerprint.spoofWebgl"></div>
        </div>
        <div class="row">
          <div><label>${esc(t('fp.audio'))}</label><div class="sub">${esc(t('fp.audioSub'))}</div></div>
          <div class="switch ${f.spoofAudio !== false ? 'on' : ''}" data-toggle="fingerprint.spoofAudio"></div>
        </div>
      </div>

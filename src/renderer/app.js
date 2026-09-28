
    <div class="card">
      <h3>${esc(t('about.openSource'))}</h3>
      <p class="hint" style="margin:0">${esc(t('about.openSourceText'))}</p>
    </div>`;

  $('#about-telegram').addEventListener('click', () => {
    window.api.openExternal('https://t.me/aweing');
  });
}

async function renderProxyStatus() {
  const box = $('#px-status');
  if (!box) return;
  const tab = activeTab();
  if (!tab) { box.innerHTML = `<span class="muted">${esc(t('proxy.noTab'))}</span>`; return; }
  const res = await window.api.tab.proxyStatus(tab.partition);
  const p = (res && res.proxy) || {};
  box.innerHTML = `
    <div class="kv"><span class="k">${esc(t('proxy.state'))}</span><span class="v">${p.enabled ? esc(t('proxy.online')) : esc(t('proxy.direct'))}</span></div>
    <div class="kv"><span class="k">${esc(t('proxy.host'))}</span><span class="v mono">${esc(p.host || 'n/a')}</span></div>
    <div class="kv"><span class="k">${esc(t('proxy.modeLabel'))}</span><span class="v">${p.mode === 'rotate' ? esc(t('proxy.rotateMode')) : esc(t('proxy.single'))}</span></div>
    <div class="kv"><span class="k">${esc(t('proxy.count'))}</span><span class="v">${p.count || 0}</span></div>
    <div class="kv"><span class="k">${esc(t('proxy.partition'))}</span><span class="v mono">${esc(tab.partition)}</span></div>`;
}


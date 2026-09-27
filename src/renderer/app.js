
        <div class="row">
          <div><label>${esc(t('proxy.burp'))}</label><div class="sub">${esc(t('proxy.burpHint'))}</div></div>
          <button class="btn sm" id="px-burp">${esc(t('proxy.burpApply'))}</button>
        </div>

        <div class="row">
          <div><label>${esc(t('proxy.trust'))}</label><div class="sub">${esc(t('proxy.trustHint'))}</div></div>
          <div class="switch ${p.trustBurpCert ? 'on' : ''}" id="px-trust"></div>
        </div>

        <div class="row">
          <div><label>${esc(t('proxy.intercept'))}</label><div class="sub">${esc(t('proxy.interceptHint'))}</div></div>
          <button class="btn sm" id="px-intercept">${esc(t('proxy.openIntercept'))}</button>
        </div>

        <div class="btn-row">
          <button class="btn primary" id="px-apply">${esc(t('proxy.apply'))}</button>
          <button class="btn" id="px-test">${esc(t('proxy.test'))}</button>
        </div>

        <div id="px-result" style="margin-top:12px"></div>
      </div>

      <div class="card">
        <h3>${esc(t('proxy.statusTitle'))}</h3>
        <div id="px-status"></div>
      </div>`;

    $('#px-mode').value = p.mode || 'single';
    $('#px-enabled').classList.toggle('on', !!p.enabled);
    $('#px-enabled').addEventListener('click', (e) => e.currentTarget.classList.toggle('on'));

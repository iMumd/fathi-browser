
  if (section === 'general') {
    body.innerHTML = `
      <div class="card">
        <h3>${esc(t('general.searchTitle'))}</h3>
        <p class="hint">${esc(t('general.searchHint'))}</p>
        <div class="field">
          <select id="set-search">
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="brave">Brave Search</option>
            <option value="google">Google</option>
            <option value="bing">Bing</option>
            <option value="startpage">Startpage</option>
          </select>
        </div>
      </div>

      <div class="card">
        <h3>${esc(t('general.languageTitle'))}</h3>
        <p class="hint">${esc(t('general.languageHint'))}</p>
        <div class="field">
          <select id="set-language">
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </div>
      </div>

      <div class="card">
        <h3>${esc(t('general.themeTitle'))}</h3>
        <p class="hint">${esc(t('general.themeHint'))}</p>
        <div class="btn-row">
          <button class="btn ${S.theme !== 'dark' ? 'primary' : ''}" data-theme-set="light">${esc(t('theme.light'))}</button>
          <button class="btn ${S.theme === 'dark' ? 'primary' : ''}" data-theme-set="dark">${esc(t('theme.dark'))}</button>
        </div>
      </div>

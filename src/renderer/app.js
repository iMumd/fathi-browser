
        <div class="field">
          <label>${esc(t('wp.source'))}</label>
          <select id="wp-source">
            <option value="unsplash">${esc(t('wp.unsplash'))}</option>
            <option value="custom">${esc(t('wp.custom'))}</option>
            <option value="none">${esc(t('wp.none'))}</option>
          </select>
        </div>

        <div class="field">
          <label>${esc(t('wp.customUrl'))}</label>
          <input type="text" id="wp-custom" dir="ltr" value="${esc(w.custom || '')}" placeholder="https://…" />
        </div>

        <div class="field">
          <label>${esc(t('wp.blur'))}: <span id="wp-blur-val">${w.blur || 0}</span>px</label>
          <input type="range" id="wp-blur" min="0" max="24" value="${w.blur || 0}" />
        </div>

        <div class="field">
          <label>${esc(t('wp.dim'))}: <span id="wp-dim-val">${Math.round((w.dim || 0) * 100)}</span>%</label>
          <input type="range" id="wp-dim" min="0" max="85" value="${Math.round((w.dim || 0) * 100)}" />
        </div>

        <div class="btn-row">
          <button class="btn primary" id="wp-save">${esc(t('wp.save'))}</button>
          <button class="btn" id="wp-refresh">${esc(t('wp.refresh'))}</button>
        </div>
      </div>`;

    $('#wp-source').value = w.source || 'unsplash';
    $('#wp-blur').addEventListener('input', (e) => { $('#wp-blur-val').textContent = e.target.value; });
    $('#wp-dim').addEventListener('input', (e) => { $('#wp-dim-val').textContent = e.target.value; });

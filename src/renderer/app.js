}

/* ------------------------------------------------------------- intercept */

function ixUpdateChrome() {
  const count = ix.items.length;
  const chip = $('#chip-intercept');
  const badge = $('#chip-intercept-count');
  if (badge) {
    badge.textContent = String(count);
    badge.classList.toggle('hidden', count === 0);
  }
  if (chip) {
    chip.classList.toggle('on', ix.enabled);
    chip.title = `${t('intercept.title')} · ${ix.enabled ? t('intercept.on') : t('intercept.off')}`;
  }
  const toggle = $('#ix-toggle');
  if (toggle) toggle.classList.toggle('on', ix.enabled);
  const pane = $('#pane-intercept');
  if (pane) pane.classList.toggle('on', ix.enabled);
  const stateText = $('#ix-state-text');
  if (stateText) stateText.textContent = ix.enabled ? t('intercept.on') : t('intercept.off');
  const countEl = $('#ix-count');
  if (countEl) countEl.textContent = String(count);
  const hint = $('#ix-hint');
  if (hint) hint.textContent = ix.enabled ? t('intercept.hint') : t('intercept.off');
  const filter = $('#ix-filter');
  if (filter && document.activeElement !== filter) filter.value = ix.filter || '';
}


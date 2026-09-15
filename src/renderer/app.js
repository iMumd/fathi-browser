}

function makeTabElement(tab) {
  const el = document.createElement('div');
  el.className = 'tab';
  el.setAttribute('role', 'tab');
  el.dataset.id = tab.id;
  el.innerHTML = `
    <div class="tab-fpdot"></div>
    <div class="tab-favicon">F</div>
    <div class="tab-title">${esc(t('tab.new'))}</div>
    <button class="tab-close" data-i18n-title="tab.close" aria-label="${esc(t('tab.close'))}">
      <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>`;
  el.title = t('tab.fp');

  el.addEventListener('mousedown', (e) => {
    if (e.button === 0) activate(tab.id);
  });
  el.querySelector('.tab-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(tab.id);
  });
  el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    if (window.api) window.api.win.toggleMaximize();
  });
  return el;
}


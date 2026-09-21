function ixRenderList() {
  const box = $('#ix-list');
  if (!box) return;
  if (!ix.items.length) {
    box.innerHTML = `<div class="ix-empty">${esc(t('intercept.empty'))}</div>`;
    return;
  }
  box.innerHTML = ix.items.map((r) => `
    <button class="ix-item ${ix.current === r.id ? 'active' : ''}" data-ix="${esc(r.id)}">
      <span class="ix-m">${esc(r.method)}</span>
      <span class="ix-u" title="${esc(r.url)}">${esc(prettyUrl(r.url))}</span>
      <span class="ix-t">${esc(r.resourceType || '')}</span>
    </button>`).join('');
  box.querySelectorAll('[data-ix]').forEach((b) => {
    b.addEventListener('click', () => ixOpenItem(b.dataset.ix));
  });
}

function ixOpenItem(id) {
  const rec = ix.items.find((r) => r.id === id);
  if (!rec) return;
  ix.current = id;
  $('#ix-list').classList.add('hidden');
  $('#ix-detail').classList.remove('hidden');
  $('#ix-url').value = rec.url;
  $('#ix-method').value = rec.method;
  $('#ix-type').value = rec.resourceType || '';
  $('#ix-headers').value = Object.entries(rec.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
  $('#ix-body-text').value = rec.postData || '';
  $('#ix-body-field').classList.toggle('hidden', /^(GET|HEAD)$/i.test(rec.method));
  ixRenderList();
}

function ixBack() {
  ix.current = null;
  const detail = $('#ix-detail');
  const list = $('#ix-list');
  if (detail) detail.classList.add('hidden');
  if (list) list.classList.remove('hidden');
  ixRenderList();

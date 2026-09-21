
async function ixResolve(action) {
  const rec = ix.items.find((r) => r.id === ix.current);
  if (!rec) return ixBack();
  const payload = {
    id: rec.id,
    action,
    url: $('#ix-url').value.trim(),
    method: $('#ix-method').value.trim().toUpperCase(),
    headers: ixParseHeaders($('#ix-headers').value),
    postData: $('#ix-body-text').value
  };
  const res = await window.api.intercept.resolve(payload);
  if (!res || !res.ok) toast((res && res.error) || t('proxy.error'), 'err');
  ixRemove(rec.id);
}

function ixRemove(id) {
  ix.items = ix.items.filter((r) => r.id !== id);
  if (ix.current === id) {
    ix.current = null;
    const detail = $('#ix-detail');
    const list = $('#ix-list');
    if (detail) detail.classList.add('hidden');
    if (list) list.classList.remove('hidden');
  }
  ixRenderList();
  ixUpdateChrome();
}

/* ------------------------------------------------------------------ flow */


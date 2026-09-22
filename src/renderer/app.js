}

function flowBack() {
  flow.selected = null;
  flow.detail = null;
  const list = $('#net-list');
  const detail = $('#net-detail');
  if (list) list.classList.remove('hidden');
  if (detail) { detail.classList.add('hidden'); detail.innerHTML = ''; }
  flowRender();
}

async function flowOpen(id, wcId) {
  const targetWc = Number(wcId) || flow.wcId;
  const res = await window.api.net.detail({ wcId: targetWc, id });
  if (!res || !res.ok) return toast((res && res.error) || 'Request not found', 'err');
  flow.selected = id;
  flow.detail = res.record;
  flow.detailTab = 'analysis';
  flow.codeLang = 'curl';
  $('#net-list').classList.add('hidden');
  $('#net-detail').classList.remove('hidden');
  flowRenderDetail();
}

function flowRenderDetail() {
  const r = flow.detail;
  const d = $('#net-detail');
  if (!r || !d) return;

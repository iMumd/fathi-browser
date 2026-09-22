
  $('#net-total').textContent = String(st.count);
  $('#net-bytes').textContent = fmtBytes(st.bytes);
  $('#net-avg').textContent = fmtMs(st.avgMs);
  $('#net-fail').textContent = String(st.failed);

  const badge = $('#ix-net-count');
  if (badge) badge.textContent = String(flow.records.length);
  const chipCount = $('#chip-flow-count');
  if (chipCount) {
    chipCount.textContent = String(flow.records.length);
    chipCount.classList.toggle('hidden', flow.records.length === 0);
  }

  const box = $('#net-list');
  if (!box) return;
  if (!list.length) {
    box.innerHTML = `<div class="ix-empty">${esc(t('flow.empty'))}</div>`;
    return;
  }
  box.innerHTML = list.slice(-500).reverse().map(netRow).join('');
  box.querySelectorAll('[data-net]').forEach((b) => {
    b.addEventListener('click', () => flowOpen(b.dataset.net, b.dataset.wc));
  });
}

async function flowLoad() {
  flow.wcId = flowWcId();
  if (flow.wcId == null && flow.scope !== 'all') {
    flow.records = [];
    flowRender();
    return;
  }
  const res = await window.api.net.list({ wcId: flow.wcId, all: flow.scope === 'all' });
  if (!res || !res.ok) return;
  flow.records = res.records || [];
  flowRender();

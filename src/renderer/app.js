}

async function flowClear() {
  const all = $('#net-scope').value === 'all';
  await window.api.net.clear({ wcId: flowWcId(), all });
  flow.records = [];
  flow.selected = null;
  flow.detail = null;
  $('#net-detail').classList.add('hidden');
  $('#net-list').classList.remove('hidden');
  flowRender();
  toast(t('flow.cleared'), 'ok');
}

/* ------------------------------------------------------------- dev drawer */

function devOpen(tab) {
  dev.open = true;
  $('#ix-drawer').classList.remove('hidden');
  devSwitch(tab || dev.tab);
  ixUpdateChrome();
  ixRenderList();
  setTimeout(() => {
    const f = dev.tab === 'flow' ? $('#net-filter') : $('#ix-filter');
    if (f) f.focus();
  }, 70);
}

function devClose() {
  dev.open = false;
  $('#ix-drawer').classList.add('hidden');
  if (dev.tab === 'flow') flowBack();
  else ixBack();

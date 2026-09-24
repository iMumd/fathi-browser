});

let ixFilterTimer = null;
$('#ix-filter').addEventListener('input', (e) => {
  const value = e.target.value;
  ix.filter = value;
  clearTimeout(ixFilterTimer);
  ixFilterTimer = setTimeout(() => { window.api.intercept.filter(value); }, 350);
});

let flowFilterTimer = null;
$('#net-filter').addEventListener('input', (e) => {
  flow.filter = e.target.value;
  clearTimeout(flowFilterTimer);
  flowFilterTimer = setTimeout(flowRender, 110);
});

$('#net-scope').addEventListener('change', (e) => {
  flow.scope = e.target.value === 'all' ? 'all' : 'tab';
  flowBack();
  flowLoad();
});

$('#net-save').addEventListener('click', flowSave);
$('#net-clear').addEventListener('click', flowClear);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#ix-drawer').classList.contains('hidden')) devClose();
});

/* ------------------------------------------------------------- settings UI */


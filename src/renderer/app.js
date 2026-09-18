});
omnibox.addEventListener('input', () => {
  $('#btn-omni-clear').classList.toggle('hidden', !omnibox.value);
});
$('#btn-omni-clear').addEventListener('click', () => {
  omnibox.value = '';
  omnibox.focus();
  $('#btn-omni-clear').classList.add('hidden');
});

/* -------------------------------------------------------------- nav action */

$('#btn-back').addEventListener('click', () => { const x = activeTab(); try { x.wv.goBack(); } catch {} });
$('#btn-fwd').addEventListener('click', () => { const x = activeTab(); try { x.wv.goForward(); } catch {} });
$('#btn-reload').addEventListener('click', () => {
  const x = activeTab();
  if (!x) return;
  try { x.loading ? x.wv.stop() : x.wv.reload(); } catch {}
});
$('#btn-home').addEventListener('click', () => {
  const x = activeTab();
  if (!x) return;
  x.url = newTabUrl();
  try { x.wv.loadURL(x.url); } catch {}
});

$('#newtab-btn').addEventListener('click', () => createTab());
$('#btn-shuffle').addEventListener('click', () => createTab());

$('#win-min').addEventListener('click', () => window.api.win.minimize());
$('#win-max').addEventListener('click', () => window.api.win.toggleMaximize());
$('#win-close').addEventListener('click', () => window.api.win.close());

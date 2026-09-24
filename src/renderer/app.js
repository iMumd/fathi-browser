});

$('#ix-back').addEventListener('click', ixBack);
$('#ix-toggle').addEventListener('click', async () => {
  const res = await window.api.intercept.set(!ix.enabled);
  if (res && res.ok) {
    ix.enabled = !!res.state.enabled;
    ixUpdateChrome();
  } else if (res && res.error) {
    toast(res.error, 'err');
  }
});

$('#ix-forward').addEventListener('click', () => ixResolve('continue'));
$('#ix-drop').addEventListener('click', () => ixResolve('drop'));

$('#ix-code-copy').addEventListener('click', () => {
  const rec = ixCurrentRecord();
  if (rec) copyText(codeFor(rec, $('#ix-code-lang').value));
});
$('#ix-copy-curl').addEventListener('click', () => {
  const rec = ixCurrentRecord();
  if (rec) copyText(codeFor(rec, 'curl'));
});

$('#ix-forward-all').addEventListener('click', async () => {
  const res = await window.api.intercept.drain();
  ix.items = [];
  ixBack();
  ixUpdateChrome();
  if (res && res.ok) toast(t('intercept.forwardAll'), 'ok');

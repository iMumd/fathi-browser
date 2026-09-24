}

function devSwitch(tab) {
  dev.tab = tab === 'intercept' ? 'intercept' : 'flow';
  document.querySelectorAll('.ix-tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.devTab === dev.tab);
  });
  $('#pane-flow').classList.toggle('hidden', dev.tab !== 'flow');
  $('#pane-intercept').classList.toggle('hidden', dev.tab !== 'intercept');
  if (dev.tab === 'flow') flowLoad();
  else ixRenderList();
  ixUpdateChrome();
}

function devToggle(tab) {
  if (dev.open && dev.tab === tab) devClose();
  else devOpen(tab);
}

function devOnTabChange() {
  if (dev.open && dev.tab === 'flow') flowLoad();
}

function ixOpenDrawer() { devOpen('intercept'); }
function ixCloseDrawer() { devClose(); }

/* -------------------------------------------------------------- wiring */

$('#chip-flow').addEventListener('click', () => devToggle('flow'));
$('#chip-intercept').addEventListener('click', () => devToggle('intercept'));
$('#ix-close').addEventListener('click', devClose);
document.querySelectorAll('.ix-tab').forEach((b) => {
  b.addEventListener('click', () => devSwitch(b.dataset.devTab));

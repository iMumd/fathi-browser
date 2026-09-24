function openSettings(section) {
  if (section) state.section = section;
  $('#settings-overlay').classList.remove('hidden');
  $$('.snav').forEach((b) => b.classList.toggle('active', b.dataset.section === state.section));
  renderSection(state.section);
}

function closeSettings() {
  $('#settings-overlay').classList.add('hidden');
}

$('#btn-menu').addEventListener('click', () => openSettings());
$('#settings-close').addEventListener('click', closeSettings);
$('#settings-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'settings-overlay') closeSettings();
});
$$('.snav').forEach((b) => {
  b.addEventListener('click', () => {
    state.section = b.dataset.section;
    $$('.snav').forEach((x) => x.classList.toggle('active', x === b));
    renderSection(state.section);
  });
});

$('#chip-fp').addEventListener('click', () => openSettings('fingerprint'));
$('#chip-proxy').addEventListener('click', () => openSettings('proxy'));

const CHECK_LINKS = [
  { id: 'fp-check-1', url: 'https://browserleaks.com/javascript' },
  { id: 'fp-check-2', url: 'https://abrahamjuliot.github.io/creepjs/' },
  { id: 'fp-check-3', url: 'https://iphey.com/' }
];

function renderSection(section) {
  const body = $('#settings-body');
  const S = state.settings || {};

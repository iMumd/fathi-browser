});

document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('#device-popover') && !e.target.closest('#chip-device')) closeDevicePopover();
});

/* -------------------------------------------------- flow + dev drawer */

const ix = { enabled: false, items: [], current: null, filter: '' };

const flow = {
  wcId: null,
  records: [],
  filter: '',
  selected: null,
  detail: null,
  detailTab: 'analysis',
  scope: 'tab',
  format: 'har',
  codeLang: 'curl'
};

const dev = { open: false, tab: 'flow' };

const CODE_LANGS = [
  ['curl', 'cURL'],
  ['python', 'Python · requests'],
  ['python-http', 'Python · http.client'],
  ['php', 'PHP · cURL'],
  ['node', 'Node.js · fetch'],
  ['powershell', 'PowerShell'],
  ['go', 'Go'],
  ['raw', 'Raw HTTP']
];

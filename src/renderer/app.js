
$('#titlebar-drag')?.addEventListener('dblclick', () => window.api.win.toggleMaximize());
$('#titlebar').addEventListener('dblclick', (e) => {
  if (e.target.closest('.tab') || e.target.closest('button')) return;
  window.api.win.toggleMaximize();
});

/* global shortcuts (when UI has focus) */
document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 't') { e.preventDefault(); createTab(); }
  else if (ctrl && e.key.toLowerCase() === 'w') { e.preventDefault(); if (activeTab()) closeTab(state.activeId); }
  else if (ctrl && e.key.toLowerCase() === 'l') { e.preventDefault(); omnibox.focus(); }
  else if (ctrl && e.key.toLowerCase() === 'r') { e.preventDefault(); const x = activeTab(); if (x) x.wv.reload(); }
  else if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); openSettings('fingerprint'); }
  else if (e.key === 'Escape') { closeDevicePopover(); if (!$('#settings-overlay').classList.contains('hidden')) closeSettings(); }
});

/* ------------------------------------------------------------ device menu */

function iconFor(dev) {
  if (!dev.mobile) {
    return `<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20h6M12 16.5V20"/></svg>`;
  }
  if (/iPad|Tab/.test(dev.name)) {
    return `<svg viewBox="0 0 24 24"><rect x="4.5" y="2.5" width="15" height="19" rx="2.4"/><path d="M10.5 19h3"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.6"/><path d="M10.6 5.2h2.8"/></svg>`;
}


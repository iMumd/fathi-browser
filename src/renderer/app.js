
  if (!dev) {
    view.classList.remove('stage');
    wv.classList.remove('device');
    wv.style.width = '';
    wv.style.height = '';
    wv.style.left = '';
    wv.style.top = '';
    wv.style.transform = '';
    return;
  }

  view.classList.add('stage');
  wv.classList.add('device');

  const pad = 34;
  const availW = Math.max(120, view.clientWidth - pad);
  const availH = Math.max(160, view.clientHeight - pad);
  const scale = Math.max(0.2, Math.min(availW / dev.width, availH / dev.height, 1));

  wv.style.width = dev.width + 'px';
  wv.style.height = dev.height + 'px';
  wv.style.left = '50%';
  wv.style.top = '50%';
  wv.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

function activate(id) {
  const tab = state.tabs.find((x) => x.id === id);
  if (!tab) return;
  state.activeId = id;

  for (const other of state.tabs) {
    const on = other.id === id;
    other.el.classList.toggle('active', on);
    other.el.setAttribute('aria-selected', on ? 'true' : 'false');
    other.wv.classList.toggle('active', on);
  }

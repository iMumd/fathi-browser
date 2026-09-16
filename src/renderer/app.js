
  tab.el = makeTabElement(tab);

  const at = typeof opts.index === 'number' ? opts.index : state.tabs.length;
  state.tabs.splice(at, 0, tab);
  const ref = tabstrip.children[at] || null;
  tabstrip.insertBefore(tab.el, ref);

  wireWebview(tab);
  activate(id);

  // Safety net: if the guest was created but no navigation started (rare
  // first-attach race), kick it once more.
  setTimeout(() => {
    try {
      if (!wv.getURL()) wv.loadURL(startUrl);
    } catch {}
  }, 1200);

  if (opts.activate !== false) {
    setTimeout(() => { try { wv.focus(); } catch {} }, 80);
  }
  refreshFingerprintList();
  return tab;
}

function wireWebview(tab) {
  const wv = tab.wv;
  const el = tab.el;

}

function isInternal(url) {
  return /^(fathi|devtools):/i.test(String(url || ''));
}

async function enableOn(wc) {
  if (!wc || wc.isDestroyed() || isDevtoolsOpen(wc) || enabling.has(wc.id)) return;
  enabling.add(wc.id);
  try {
    const dbg = wc.debugger;
    if (!dbg.isAttached()) dbg.attach('1.3');
    await dbg.sendCommand('Network.enable', {
      maxTotalBufferSize: 64 * 1024 * 1024,
      maxResourceBufferSize: 8 * 1024 * 1024,
      maxPostDataSize: 128 * 1024
    });
  } catch {
    // DevTools or another target owns the debugger; retry on the next load.
  } finally {
    enabling.delete(wc.id);
  }
}

function isDevtoolsOpen(wc) {
  try { return wc.isDevToolsOpened && wc.isDevToolsOpened(); } catch { return false; }
}

function attach(wc) {
  if (!wc || tabs.has(wc.id)) return;
  tabFor(wc);

  const dbg = wc.debugger;
  if (!wired.has(dbg)) {
    wired.add(dbg);
    dbg.on('message', (_e, method, params) => onMessage(wc, method, params));
    dbg.on('detach', () => {
      try { send('fathi:net:batch', { wcId: wc.id, records: listSummaries(wc.id), stats: stats(wc.id) }); } catch {}
    });
  }

  const kick = () => { enableOn(wc).catch(() => {}); };
  kick();
  wc.once('dom-ready', kick);
  wc.on('did-navigate', kick);
  wc.on('devtools-closed', kick);

  wc.once('destroyed', () => {
    tabs.delete(wc.id);
    scheduleFlush();
  });

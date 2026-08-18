}

async function disableOn(wc) {
  if (!wc || wc.isDestroyed()) return;
  for (const rec of Array.from(paused.values())) {
    if (rec.wcId === wc.id) {
      paused.delete(rec.id);
      await continueRaw(rec);
    }
  }
  try {
    if (wc.debugger.isAttached()) await wc.debugger.sendCommand('Fetch.disable');
  } catch {}
}

/* ---------------------------------------------------------------- wiring */

function attach(wc) {
  if (!wc || guests.has(wc.id)) return;
  guests.set(wc.id, wc);

  const dbg = wc.debugger;
  if (!wired.has(dbg)) {
    wired.add(dbg);
    dbg.on('message', (_e, method, params) => onMessage(wc, method, params));
    dbg.on('detach', () => {
      // DevTools opened/closed; re-enable on the next navigation
      try { send('fathi:intercept:state', state()); } catch {}
    });
  }

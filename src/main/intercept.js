}

/* ---------------------------------------------------------------- helpers */

function isWebUrl(url) {
  return !/^(fathi|chrome-extension|devtools|data|blob|about|chrome|javascript):/i.test(String(url || ''));
}

function matchesFilter(url) {
  const filter = String((settings.get().intercept || {}).filter || '').trim().toLowerCase();
  if (!filter) return true;
  const u = String(url || '').toLowerCase();
  return filter.split(/\s+/).some((part) => part && u.includes(part));
}

async function continueRaw(rec) {
  try { await rec.wc.debugger.sendCommand('Fetch.continueRequest', { requestId: rec.id }); } catch {}
}

async function enableOn(wc) {
  if (!wc || wc.isDestroyed() || enabling.has(wc.id)) return;
  enabling.add(wc.id);
  try {
    const dbg = wc.debugger;
    if (!dbg.isAttached()) dbg.attach('1.3');
    await dbg.sendCommand('Fetch.enable', {
      patterns: [{ urlPattern: '*', requestStage: 'Request' }]
    });
  } catch (e) {
    // another debugger (DevTools) may be attached, try again on dom-ready
  } finally {
    enabling.delete(wc.id);
  }

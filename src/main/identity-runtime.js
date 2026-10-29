'use strict';
const { fathiSpoof } = require('../shared/spoof');
const { acceptLanguage } = require('./session');
const installed = new WeakSet();
const configuring = new WeakMap();
const configurators = new WeakMap();
function attach(wc, fp) {
  if (!fp || fp.enabled === false) return;
  const dbg = wc.debugger;
  const apply = () => {
    if (installed.has(wc)) return Promise.resolve();
    if (configuring.has(wc)) return configuring.get(wc);
    if (wc.isDestroyed() || !dbg.isAttached()) return Promise.reject(new Error('Identity debugger is not ready'));
    const job = (async () => {
      await dbg.sendCommand('Target.setAutoAttach', {
        autoAttach: true, waitForDebuggerOnStart: true, flatten: true,
        filter: [{ type: 'worker', exclude: false }, { type: 'shared_worker', exclude: false }, { exclude: true }]
      });
      await dbg.sendCommand('Emulation.setTimezoneOverride', { timezoneId: fp.timezone });
      const identity = { userAgent: fp.ua, acceptLanguage: acceptLanguage(fp), platform: fp.platform };
      if (fp.clientHints !== false) identity.userAgentMetadata = {
        brands: fp.uaBrands, fullVersionList: fp.uaFullVersionList,
        fullVersion: fp.uaFullVersion, platform: fp.uaDataPlatform,
        platformVersion: fp.platformVersion, architecture: fp.architecture,
        model: fp.model || '', mobile: !!fp.uaMobile, bitness: fp.bitness, wow64: !!fp.wow64
      };
      await dbg.sendCommand('Emulation.setUserAgentOverride', identity);
      installed.add(wc);
    })();
    configuring.set(wc, job);
    job.finally(() => configuring.delete(wc)).catch(() => {});
    return job;
  };
  configurators.set(wc, apply);
  dbg.on('message', async (_event, method, params) => {
    if (method !== 'Target.attachedToTarget' || !['worker', 'shared_worker'].includes(params.targetInfo?.type)) return;
    const id = params.sessionId;
    // Always release the worker, including on unsupported protocol commands.
    const rescue = setTimeout(() => { dbg.sendCommand('Runtime.runIfWaitingForDebugger', {}, id).catch(() => {}); }, 2000);
    try {
      await dbg.sendCommand('Runtime.enable', {}, id);
      await dbg.sendCommand('Runtime.evaluate', { expression: `(${fathiSpoof.toString()})(${JSON.stringify(fp)})` }, id);
    } catch {} finally {
      clearTimeout(rescue);
      await dbg.sendCommand('Runtime.runIfWaitingForDebugger', {}, id).catch(() => {});
    }
  });
  dbg.on('detach', () => installed.delete(wc));
  const kick = () => apply().catch(() => {});
  wc.once('dom-ready', kick);
  wc.on('devtools-closed', kick);
  kick();
}
async function ready(wc, fp) {
  if (fp.enabled === false) return;
  const apply = configurators.get(wc);
  if (!apply) throw new Error('Identity runtime is not attached');
  await apply();
}
module.exports = { attach, ready };

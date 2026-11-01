'use strict';

// Each browser window has its own main process, session maps and temporary
// directories. Do not reuse the single-window controller's global tab state.
function launch(app, { spawn = require('node:child_process').spawn, env = process.env, auditPath } = {}) {
  const environment = { ...env };
  delete environment.ELECTRON_RUN_AS_NODE;
  delete environment.FATHI_WINDOW_AUDIT_PATH;
  const args = app.isPackaged ? [] : [app.getAppPath()];
  if (auditPath) { args.push('--fathi-window-audit'); environment.FATHI_WINDOW_AUDIT_PATH = auditPath; }
  const child = spawn(process.execPath, args, { detached: !auditPath, stdio: 'ignore', env: environment });
  if (!auditPath) child.unref();
  return child;
}
module.exports = { launch, auditWindows: new Map() };

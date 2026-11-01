'use strict';

// Actual application/runtime diagnostics, never the active tab's spoofed identity.
// Deliberately exclude usernames, hostname, filesystem paths and browsing data.
function collect({ app, runtime = process, os = require('node:os') }) {
  const names = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
  return {
    name: 'Fathi', version: app.getVersion(), packaged: !!app.isPackaged,
    electron: runtime.versions.electron || '', chrome: runtime.versions.chrome || '',
    node: runtime.versions.node || '', platform: runtime.platform, arch: runtime.arch,
    system: {
      name: names[runtime.platform] || os.type(),
      version: os.version(), release: os.release(),
      machine: typeof os.machine === 'function' ? os.machine() : os.arch()
    }
  };
}
module.exports = { collect };

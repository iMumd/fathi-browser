'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path');
function load(raw) {
  let saved;
  const context = { module: { exports: {} }, process: { env: {} }, console,
    require: (name) => {
      if (name === 'electron') return { app: { getPath: () => '/fixture' } };
      if (name === 'node:fs') return { readFileSync: () => JSON.stringify(raw), mkdirSync() {}, writeFileSync: (_file, text) => { saved = JSON.parse(text); } };
      if (name === 'node:path') return path;
      if (name === '../shared/shortcuts') return require('../src/shared/shortcuts');
      throw new Error(name);
    } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main/settings.js'), 'utf8'), context);
  return { settings: JSON.parse(JSON.stringify(context.module.exports.load())), saved };
}
test('legacy shipped bindings migrate to the Chrome profile without persisting browsing state', () => {
  const result = load({ version: 2, shortcuts: { fingerprint: 'Ctrl+D', toggleProxy: 'Ctrl+Shift+P', toggleDevice: 'Ctrl+Shift+M', toggleInterceptor: 'Ctrl+Shift+I' } });
  assert.equal(result.settings.shortcuts.bookmark, 'Ctrl+D');
  assert.equal(result.settings.shortcuts.fingerprint, 'Ctrl+Alt+D');
  assert.equal(result.settings.shortcuts.toggleProxy, 'Ctrl+Alt+P');
  assert.equal(result.settings.shortcuts.toggleDevice, 'Ctrl+Alt+M');
  assert.equal(result.settings.shortcuts.toggleInterceptor, 'Ctrl+Alt+I');
  assert.equal(result.saved.shortcutProfileVersion, 2);
  for (const key of ['bookmarks', 'history', 'downloads']) assert.equal(key in result.saved, false);
});
test('migration preserves genuine custom bindings and already-versioned configurations', () => {
  assert.equal(load({ version: 2, shortcuts: { fingerprint: 'Ctrl+Alt+Q' } }).settings.shortcuts.fingerprint, 'Ctrl+Alt+Q');
  const claimed = load({ version: 2, shortcuts: { fingerprint: 'Ctrl+D', closeTab: 'Ctrl+Alt+D' } });
  assert.equal(claimed.settings.shortcuts.closeTab, 'Ctrl+Alt+D'); assert.equal(claimed.settings.shortcuts.fingerprint, 'Ctrl+D');
  const current = load({ version: 2, shortcutProfileVersion: 2, shortcuts: { fingerprint: 'Ctrl+D' } });
  assert.equal(current.settings.shortcuts.fingerprint, 'Ctrl+D'); assert.equal(current.saved, undefined);
});

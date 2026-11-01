'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { launch } = require('../src/main/window-launcher');
test('development windows launch the actual app, not a blank Electron process or test runner', () => {
  let invocation; let unref = false;
  launch({ isPackaged: false, getAppPath: () => '/browser' }, {
    env: { ELECTRON_RUN_AS_NODE: '1', FATHI_WINDOW_AUDIT_PATH: 'old', SAFE: 'yes' },
    spawn: (...args) => { invocation = args; return { unref: () => { unref = true; } }; }
  });
  assert.equal(invocation[0], process.execPath); assert.deepEqual(invocation[1], ['/browser']);
  assert.equal(invocation[2].env.ELECTRON_RUN_AS_NODE, undefined); assert.equal(invocation[2].env.FATHI_WINDOW_AUDIT_PATH, undefined);
  assert.equal(invocation[2].env.SAFE, 'yes'); assert.equal(invocation[2].stdio, 'ignore'); assert.equal(unref, true);
});
test('packaged windows start their installed executable; audit windows are explicitly isolated', () => {
  let invocation;
  launch({ isPackaged: true }, { env: {}, auditPath: '/temporary/audit.json', spawn: (...args) => { invocation = args; return {}; } });
  assert.deepEqual(invocation[1], ['--fathi-window-audit']); assert.equal(invocation[2].detached, false);
  assert.equal(invocation[2].env.FATHI_WINDOW_AUDIT_PATH, '/temporary/audit.json');
});

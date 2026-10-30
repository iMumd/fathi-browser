'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const vm = require('node:vm'); const fs = require('node:fs'); const path = require('node:path');
const { EventEmitter } = require('node:events');
const rewrite = require('../src/main/rewrite');
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
function fixture(matchReplace = []) {
  const config = { intercept: { enabled: false, filter: '' }, matchReplace };
  const messages = [];
  const filename = path.resolve(__dirname, '../src/main/intercept.js');
  const executor = { events: new EventEmitter(), apply: async (input) => rewrite.test(input) };
  const context = { module: { exports: {} }, Buffer, TextDecoder, console, Date, setTimeout, clearTimeout,
    setInterval: () => ({ unref() {} }), require: (name) => {
      if (name === './settings') return { get: () => config, save: (patch) => { if (patch.intercept) Object.assign(config.intercept, patch.intercept); } };
      if (name === './research-scope') return { allows: () => true };
      if (name === './rule-executor') return executor;
      throw new Error('Unexpected import ' + name);
    } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  const api = context.module.exports;
  api.init({ isDestroyed: () => false, webContents: { send: (channel, payload) => messages.push({ channel, payload }) } });
  function guest(id) {
    const wc = new EventEmitter(); const commands = [];
    wc.id = id; wc.isDestroyed = () => false; wc.debugger = new EventEmitter(); wc.debugger.isAttached = () => true;
    wc.debugger.sendCommand = async (method, params) => { commands.push({ method, params }); return method === 'Fetch.getResponseBody' ? { body: 'response-body', base64Encoded: false } : {}; };
    api.attach(wc);
    return { wc, commands, pause: (params) => wc.debugger.emit('message', {}, 'Fetch.requestPaused', params) };
  }
  return { api, guest, config, messages };
}
test('body rules remain active with Intercept off and forward the rewritten payload once', async () => {
  const f = fixture([{ target: 'requestBody', match: 'old', replace: 'old-new' }]); const g = f.guest(1);
  g.pause({ requestId: 'raw', request: { url: 'https://example.test', method: 'POST', headers: {}, postData: 'old' } }); await tick();
  const command = g.commands.find((c) => c.method === 'Fetch.continueRequest');
  assert.equal(Buffer.from(command.params.postData, 'base64').toString(), 'old-new');
  assert.equal(f.api.state().paused, 0);
});
test('queue keys isolate equal Fetch IDs from different tabs and failures do not discard pauses', async () => {
  const f = fixture(); const a = f.guest(1); const b = f.guest(2); await f.api.setEnabled(true);
  const input = { requestId: 'same-id', request: { url: 'https://example.test', method: 'GET', headers: {} } };
  a.pause(input); b.pause(input); await tick();
  assert.equal(f.api.state().paused, 2);
  assert.notEqual(f.api.state().ids[0], f.api.state().ids[1]);
  const original = a.wc.debugger.sendCommand;
  a.wc.debugger.sendCommand = async () => { throw new Error('send failed'); };
  assert.equal((await f.api.resolve({ id: '1:same-id' })).ok, false);
  assert.equal(f.api.state().paused, 2);
  a.wc.debugger.sendCommand = original;
  assert.equal((await f.api.resolve({ id: '1:same-id', action: 'drop' })).ok, true);
  assert.equal(f.api.state().paused, 1);
  b.wc.emit('destroyed'); assert.equal(f.api.state().paused, 0);
});
test('response pauses use the real Fetch event and rewrite text with fresh length metadata', async () => {
  const f = fixture([{ target: 'responseBody', match: 'response-body', replace: 'نتيجة' }]); const g = f.guest(1);
  g.pause({ requestId: 'response', request: { url: 'https://example.test', method: 'GET' }, responseStatusCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Content-Length', value: '13' }, { name: 'ETag', value: 'old-tag' }] });
  await tick(); const command = g.commands.find((c) => c.method === 'Fetch.fulfillRequest');
  assert(command); assert.equal(Buffer.from(command.params.body, 'base64').toString(), 'نتيجة');
  assert(!command.params.responseHeaders.some((h) => h.name.toLowerCase() === 'etag'));
  assert.equal(command.params.responseHeaders.find((h) => h.name === 'Content-Length').value, String(Buffer.byteLength('نتيجة')));
});
test('header rules preserve repeated values and plain replacement dollars are literal', () => {
  const result = rewrite.applyHeaders({ 'Set-Cookie': ['a=old; Path=/', 'b=old; Path=/'] }, [{ target: 'responseHeader', match: 'old', replace: '$1' }], 'responseHeader');
  assert.deepEqual(result.headers['Set-Cookie'], ['a=$1; Path=/', 'b=$1; Path=/']);
});
test('live rule workers bound expensive regex execution without blocking the process', async () => {
  const executor = require('../src/main/rule-executor'); const start = Date.now();
  await executor.apply({ rules: [{ target: 'requestBody', match: '(a+)+$', replace: 'x', regex: true }], target: 'requestBody', payload: 'a'.repeat(80) + '!' }).then(
    (result) => assert.equal(result.changed, false), (error) => assert.match(error.message, /timed out/)
  );
  assert(Date.now() - start < 5000);
});

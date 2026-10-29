'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');
function fixture() {
  const filename = path.resolve(__dirname, '../src/main/network.js');
  const localRequire = createRequire(filename);
  const batches = []; const timers = [];
  const context = { module: { exports: {} }, require: (name) => name === 'electron' ? { dialog: {} } : localRequire(name), Buffer, URL, process, console,
    setTimeout: (fn) => { timers.push(fn); return timers.length; } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  const net = context.module.exports;
  const wc = new EventEmitter(); wc.id = 1; wc.isDestroyed = () => false; wc.isDevToolsOpened = () => false;
  wc.debugger = new EventEmitter(); wc.debugger.isAttached = () => true; wc.debugger.sendCommand = async () => ({ body: 'response-secret' });
  net.init({ isDestroyed: () => false, webContents: { send: (channel, payload) => batches.push({ channel, payload }) } });
  net.attach(wc);
  const event = (method, data) => wc.debugger.emit('message', {}, 'Network.' + method, data);
  const request = (id, url = 'https://example.com') => event('requestWillBeSent', { requestId: id, request: { method: 'GET', url, headers: { Authorization: 'request-secret' } }, timestamp: 1, wallTime: 1 });
  return { net, wc, event, request, batches, flush: () => { while (timers.length) timers.shift()(); } };
}
test('Flow receives status and timing updates after the initial request batch', () => {
  const f = fixture(); f.request('1'); f.flush();
  assert.equal(f.batches.at(-1).payload.records[0].status, 0);
  f.event('responseReceived', { requestId: '1', response: { status: 201, headers: {}, mimeType: 'text/plain' } }); f.flush();
  assert.equal(f.batches.at(-1).payload.records[0].status, 201);
  f.event('loadingFinished', { requestId: '1', timestamp: 1.25, encodedDataLength: 100 }); f.flush();
  assert.equal(f.batches.at(-1).payload.records[0].time, 250);
  assert.equal(f.batches.at(-1).payload.records[0].size, 100);
});
test('redirect history retains each hop and exports respect selected record IDs', () => {
  const f = fixture(); f.request('1');
  f.event('requestWillBeSent', { requestId: '1', request: { method: 'GET', url: 'https://example.com/final', headers: {} }, redirectResponse: { status: 302, headers: { location: '/final' } } });
  const records = f.net.listSummaries(1);
  assert.equal(records.length, 2);
  assert.equal(records[0].status, 302);
  const json = JSON.parse(f.net.serialize('json', { wcId: 1, ids: [records[1].id] }));
  assert.equal(json.count, 1); assert.equal(json.requests[0].url, 'https://example.com/final');
  assert.equal(JSON.parse(f.net.serialize('har', { wcId: 1, ids: [] })).log.entries.length, 0);
});
test('redacted exports omit sensitive content while raw exports remain explicit', () => {
  const f = fixture(); f.request('1', 'https://example.com/secret?token=secret');
  const redacted = f.net.serialize('safejson', { wcId: 1 });
  assert(!redacted.includes('request-secret')); assert(!redacted.includes('/secret')); assert(!redacted.includes('token='));
  assert(f.net.serialize('json', { wcId: 1 }).includes('request-secret'));
});
test('CSV guards spreadsheet formula injection and per-tab history stays bounded', () => {
  const f = fixture();
  f.event('requestWillBeSent', { requestId: 'formula', request: { method: '=HYPERLINK("bad")', url: 'https://example.com' } });
  assert(f.net.serialize('csv', { wcId: 1 }).includes("'="));
  for (let i = 0; i < 1600; i++) f.request('r' + i);
  assert.equal(f.net.listSummaries(1).length, 1500);
  f.wc.emit('destroyed');
  assert.equal(f.net.listSummaries(undefined, true).length, 0);
});

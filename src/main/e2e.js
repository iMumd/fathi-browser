'use strict';
/**
 * Automated end-to-end check of the running app (UI + tabs + navigation).
 * Enabled with:  npx electron . --fathi-e2e
 * Writes e2e-report.json and e2e-*.png next to package.json.
 */
const fs = require('node:fs');
const path = require('node:path');
const { webContents } = require('electron');

const OUT_DIR = path.join(__dirname, '..', '..');
const TRACE_FILE = path.join(OUT_DIR, 'e2e-trace.txt');
let lastMark = 'start';

function trace(msg) {
  lastMark = msg;
  global.__e2eTraceLast = msg;
  try { fs.appendFileSync(TRACE_FILE, `${new Date().toISOString()}  ${msg}\n`); } catch {}
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout: ' + label)), ms))
  ]);
}

async function waitFor(fn, timeout = 20000, interval = 250) {
  const started = Date.now();
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch {}
    if (Date.now() - started > timeout) return null;
    await sleep(interval);
  }
}

async function run(win) {
  trace('run start');
  const report = { startedAt: new Date().toISOString(), checks: [], errors: [] };
  const add = (name, pass, detail) => report.checks.push({ name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });

  await waitFor(async () => !win.webContents.isLoading(), 15000);
  await sleep(2500);
  trace('ui loaded');

  const ui = win.webContents;

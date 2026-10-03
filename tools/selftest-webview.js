'use strict';
/**
 * Verifies the real <webview> path: partition -> in-memory session -> preload
 * injection -> proxy -> spoofed request headers on the wire.
 *   npx electron tools/selftest-webview.js
 */
const { app, BrowserWindow, ipcMain, session, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

app.setPath('sessionData', path.join(os.tmpdir(), 'fathi-selftest-wv-' + process.pid));

const fpgen = require('../src/main/fingerprint');
const settings = require('../src/main/settings');
const proxyMgr = require('../src/main/proxy');
const { configureSession } = require('../src/main/session');

settings.load();
const fp = fpgen.generate('webview-test-seed');

const LOG = path.join(__dirname, 'selftest-webview.log');
const OUT = path.join(__dirname, '..', 'selftest-webview-result.txt');
fs.writeFileSync(LOG, '');
function log(...a) {
  const line = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
  fs.appendFileSync(LOG, line + '\n');
}

ipcMain.on('fathi:fp:sync', (event, id) => {
  event.returnValue = id === fp.id ? JSON.stringify(fp) : 'null';
});

app.on('window-all-closed', () => {});

// proxy credentials (the real app registers this globally too)
app.on('login', (event, webContents, details, authInfo, callback) => {
  if (!authInfo || !authInfo.isProxy) return;
  const entry = proxyMgr.entryFor(PARTITION) || proxyMgr.pool()[0];
  if (!entry) return;
  event.preventDefault();
  callback(entry.username || '', entry.password || '');
});

const PARTITION = 'fathi-tab-webviewtest0001';
const TARGET = process.env.FATHI_TEST_URL || 'https://httpbin.org/headers';

app.whenReady().then(async () => {
  // Configure the in-memory tab session exactly like the real app does,
  // BEFORE the webview attaches to it.
  const ses = session.fromPartition(PARTITION);
  proxyMgr.assign(PARTITION);
  configureSession(ses, fp, PARTITION, { downloadDir: os.tmpdir(), extensions: false });

  const win = new BrowserWindow({
    show: false,
    width: 1000,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload', 'ui.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true
    }
  });

  win.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    log('will-attach-webview partition=', params.partition);
    delete webPreferences.preloadURL;
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInSubFrames = true;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = false;
    webPreferences.webSecurity = true;
    webPreferences.webviewTag = false;
    webPreferences.preload = path.join(__dirname, '..', 'src', 'preload', 'fp.js');
    webPreferences.additionalArguments = [`--fathi-fp=${fp.id}`, `--fathi-partition=${params.partition}`];
  });

  await win.loadFile(path.join(__dirname, 'wvhost.html'));

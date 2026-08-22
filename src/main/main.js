'use strict';
/**
 * Fathi main process.
 *
 * Design rules:
 *  Every tab gets its own IN-MEMORY session (partition without "persist:")
 *  Every tab gets a unique fingerprint (UA + client hints + JS surface)
 *  Nothing about browsing is written to disk. Cache and session data live in a
 *    temporary directory that is removed on exit
 *  The proxy is applied per session and can be changed at runtime
 */
const {
  app, BrowserWindow, ipcMain, session, net, shell, dialog, webContents, Menu, clipboard
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

/* ---------------------------------------------------- process hardening */

// WebRTC must never expose a local or non-proxied address.
app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');
app.commandLine.appendSwitch('enable-features', 'WebRtcHideLocalIpsWithMdns');
// Reduce cross-tab renderer sharing / keep surfaces independent.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

/* ------------------------------------------------------------------ paths */

const ROOT = path.join(__dirname, '..', '..');
const PRELOAD_DIR = path.join(ROOT, 'src', 'preload');
const RENDERER_DIR = path.join(ROOT, 'src', 'renderer');
const ASSETS_DIR = path.join(ROOT, 'assets');

/* ------------------------------------------------- ephemeral runtime dirs */

const TMP_SESSION = path.join(os.tmpdir(), `fathi-session-${process.pid}`);
const DOWNLOAD_DIR = path.join(os.tmpdir(), `fathi-downloads-${process.pid}`);
for (const d of [TMP_SESSION, DOWNLOAD_DIR]) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
  fs.mkdirSync(d, { recursive: true });

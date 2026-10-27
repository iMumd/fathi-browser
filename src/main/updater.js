'use strict';
/**
 * Update checks and installation.
 *
 * Windows installers are updated in place through electron-updater: the app
 * checks the published release, downloads on request, then restarts. Portable
 * builds, Linux archives and unsigned macOS builds cannot install silently, so
 * they fall back to a GitHub API check and point the user at the release page
 * or the one command updater.
 */
const { app, net, shell, clipboard } = require('electron');

const REPO = 'iMumd/fathi-browser';
const RELEASE_PAGE = `https://github.com/${REPO}/releases/latest`;
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const UPDATE_COMMAND = process.platform === 'win32'
  ? `irm https://raw.githubusercontent.com/${REPO}/main/tools/update-fathi.ps1 | iex`
  : `curl -fsSL https://raw.githubusercontent.com/${REPO}/main/tools/update-fathi.sh | bash`;

/** Portable Windows builds report their own executable through this variable. */
const SELF_UPDATE = process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_FILE;

let winRef = null;
let started = false;
let fallbackTried = false;

let state = {
  status: 'idle',        // idle | checking | latest | available | downloading | ready | error
  current: app.getVersion(),
  version: null,
  progress: 0,
  manual: !SELF_UPDATE,
  supported: SELF_UPDATE,
  url: RELEASE_PAGE,
  notes: '',
  error: null
};

function send() {
  try {
    if (winRef && !winRef.isDestroyed()) {
      winRef.webContents.send('fathi:update:state', state);
    }
  } catch {}
}

function set(patch) {
  state = { ...state, ...patch };
  send();
  return state;
}

function parts(v) {
  return String(v || '0').replace(/^v/i, '').split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
}

/** True when a is a newer version than b. */
function isNewer(a, b) {
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

async function latestRelease() {
  const res = await net.fetch(API_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'fathi-updater'
    }
  });
  if (!res.ok) throw new Error(`GitHub responded with ${res.status}`);
  return res.json();
}

/** Check through the GitHub API. Used by manual builds and as a fallback. */
async function checkManual() {
  set({ status: 'checking', error: null, progress: 0 });
  try {
    const rel = await latestRelease();
    const tag = rel.tag_name || rel.name || '';
    const version = String(tag).replace(/^v/i, '');
    if (version && isNewer(version, app.getVersion())) {
      return set({
        status: 'available',
        version,
        manual: true,
        url: rel.html_url || RELEASE_PAGE,
        notes: typeof rel.body === 'string' ? rel.body : ''
      });
    }
    return set({ status: 'latest', version: null, manual: !SELF_UPDATE });
  } catch (e) {
    return set({ status: 'error', error: String(e && e.message || e) });
  }
}

function configureAutoUpdater() {
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (e) {
    return false;
  }
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => set({ status: 'checking', error: null }));
  autoUpdater.on('update-available', (info) => set({
    status: 'available',
    version: info && info.version ? info.version : null,
    manual: false,
    url: RELEASE_PAGE,
    notes: info && typeof info.releaseNotes === 'string' ? info.releaseNotes : ''
  }));
  autoUpdater.on('update-not-available', () => set({ status: 'latest', version: null, manual: false }));
  autoUpdater.on('download-progress', (p) => set({
    status: 'downloading',
    progress: p && Number.isFinite(p.percent) ? Math.round(p.percent) : 0
  }));
  autoUpdater.on('update-downloaded', (info) => set({
    status: 'ready',
    version: info && info.version ? info.version : state.version,
    progress: 100,
    manual: false
  }));
  autoUpdater.on('error', () => {
    // A missing channel file or an unsigned build should still tell the user a
    // release exists, so fall back to the public release metadata once.
    if (fallbackTried) return set({ status: 'error', error: 'Update check failed' });
    fallbackTried = true;
    checkManual();
  });
  return true;
}

async function check() {
  if (!app.isPackaged || !SELF_UPDATE) return checkManual();
  try {
    await require('electron-updater').autoUpdater.checkForUpdates();
    return state;
  } catch {
    return checkManual();
  }
}

async function download() {
  if (!SELF_UPDATE || state.manual || !app.isPackaged) {
    shell.openExternal(state.url || RELEASE_PAGE);
    return { opened: true };
  }
  try {
    set({ status: 'downloading', progress: 0 });
    await require('electron-updater').autoUpdater.downloadUpdate();
    return { started: true };
  } catch (e) {
    set({ status: 'error', error: String(e && e.message || e) });
    return { started: false, error: String(e && e.message || e) };
  }
}

function install() {
  if (!SELF_UPDATE || state.status !== 'ready') return false;
  try {
    require('electron-updater').autoUpdater.quitAndInstall(false, true);
    return true;
  } catch {
    return false;
  }
}

function init(win) {
  winRef = win;
  if (started) return state;
  started = true;
  if (SELF_UPDATE && app.isPackaged) configureAutoUpdater();
  // Automated tests should not touch the network.
  if (app.isPackaged && !process.argv.includes('--fathi-e2e')) {
    setTimeout(() => { check(); }, 5000);
  }
  return state;
}

function getState() { return { ...state, command: UPDATE_COMMAND }; }

async function openRelease() {
  const url = state.url || RELEASE_PAGE;
  await shell.openExternal(url);
  return true;
}

function copyCommand() {
  clipboard.writeText(UPDATE_COMMAND);
  return true;
}

module.exports = { init, check, download, install, getState, openRelease, copyCommand, isNewer, UPDATE_COMMAND };

'use strict';
const { ipcRenderer, contextBridge, webFrame } = require('electron');
const { fathiSpoof } = require('../shared/spoof');
const fpArg = process.argv.find((arg) => arg.startsWith('--fathi-fp='));
const fpId = fpArg ? fpArg.slice('--fathi-fp='.length) : '';
let cfg = null;
try { cfg = JSON.parse(ipcRenderer.sendSync('fathi:fp:sync', fpId) || 'null'); } catch {}
if (cfg && cfg.enabled !== false) {
  try {
    if (contextBridge.executeInMainWorld) contextBridge.executeInMainWorld({ func: fathiSpoof, args: [cfg] });
    else webFrame.executeJavaScript(`(${fathiSpoof.toString()})(${JSON.stringify(cfg)})`).catch(() => {});
  } catch (error) { console.error('[fathi] identity injection failed', error); }
}
const storePage = location.protocol === 'https:' && (location.hostname === 'chromewebstore.google.com' || (location.hostname === 'chrome.google.com' && location.pathname.startsWith('/webstore')));
if (process.isMainFrame && storePage) {
  contextBridge.exposeInMainWorld('__fathiBridge', { installExtension: (url) => ipcRenderer.invoke('fathi:ext:install', { input: url }) });
}
if (process.isMainFrame && location.protocol === 'fathi:') {
  contextBridge.exposeInMainWorld('fathi', {
    fpId,
    fingerprint: () => ipcRenderer.invoke('fathi:fp:current', fpId),
    wallpaper: () => ipcRenderer.invoke('fathi:wallpaper:fetch'),
    navigate: (url) => ipcRenderer.invoke('fathi:newtab:navigate', url),
    newTab: () => ipcRenderer.invoke('fathi:newtab:new'),
    rotate: () => ipcRenderer.invoke('fathi:newtab:rotate'),
    focusOmnibox: () => ipcRenderer.invoke('fathi:newtab:focus'),
    proxyStatus: () => ipcRenderer.invoke('fathi:page:status'),
    settings: () => ipcRenderer.invoke('fathi:settings:get'),
    openExternal: (url) => ipcRenderer.invoke('fathi:open-external', url),
    installExtension: (url) => ipcRenderer.invoke('fathi:ext:install', { input: url }),
    openGuide: () => ipcRenderer.invoke('fathi:newtab:guide'),
    openShortcuts: () => ipcRenderer.invoke('fathi:newtab:shortcuts')
  });
}

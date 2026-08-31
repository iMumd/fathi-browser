'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const EVENTS = new Set([
  'fathi:window:open',
  'fathi:newtab:navigate',
  'fathi:newtab:new',
  'fathi:newtab:rotate',
  'fathi:focus-omnibox',
  'fathi:new-tab',
  'fathi:close-tab',
  'fathi:win:state',
  'fathi:proxy:changed',
  'fathi:settings:changed',
  'fathi:intercept:paused',
  'fathi:intercept:resolved',
  'fathi:intercept:state',
  'fathi:net:batch'
]);

contextBridge.exposeInMainWorld('api', {
  appInfo: () => ipcRenderer.invoke('fathi:app:info'),

  win: {
    minimize: () => ipcRenderer.invoke('fathi:win:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('fathi:win:toggle-maximize'),
    close: () => ipcRenderer.invoke('fathi:win:close'),
    state: () => ipcRenderer.invoke('fathi:win:state')
  },

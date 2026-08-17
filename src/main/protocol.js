'use strict';
/**
 * Internal fathi:// protocol.
 *
 * IMPORTANT: protocol handlers are registered per-session in Electron. Since
 * every tab owns its own in-memory session, the handler must be bound to each
 * new session (not just the default one).
 */
const fs = require('node:fs');
const path = require('node:path');
const { protocol } = require('electron');

const RENDERER_DIR = path.join(__dirname, '..', 'renderer');
const ASSET_DIR = path.join(__dirname, '..', '..', 'assets');
const WALLPAPER_DIR = path.join(ASSET_DIR, 'wallpapers');

const PAGES = {
  newtab: 'newtab.html',
  blank: 'blank.html',
  error: 'error.html'
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

function serve(request) {
  let url;
  try { url = new URL(request.url); } catch { return new Response('bad url', { status: 400 }); }

  const host = url.hostname;

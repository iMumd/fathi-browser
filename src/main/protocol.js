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

  // fathi://newtab , fathi://blank , fathi://error
  if (PAGES[host]) {
    const file = path.join(RENDERER_DIR, PAGES[host]);
    try {
      const buf = fs.readFileSync(file);
      return new Response(buf, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store'
        }
      });
    } catch {
      return new Response('not found', { status: 404 });
    }
  }

  // fathi://wallpaper/<name> -> bundled Unsplash wallpapers
  if (host === 'wallpaper') {
    const name = path.basename(decodeURIComponent(url.pathname).replace(/^\/+/, ''));
    if (!/\.(jpe?g|png|webp)$/i.test(name)) return new Response('not found', { status: 404 });
    const file = path.join(WALLPAPER_DIR, name);
    try {
      const buf = fs.readFileSync(file);
      return new Response(buf, {
        status: 200,
        headers: {
          'content-type': MIME[path.extname(name).toLowerCase()] || 'image/jpeg',
          'cache-control': 'public, max-age=31536000, immutable'
        }
      });
    } catch {
      return new Response('not found', { status: 404 });
    }
  }

  // fathi://asset/<name> -> assets/<name> (bundled icons)
  if (host === 'asset') {
    const name = path.basename(decodeURIComponent(url.pathname).replace(/^\/+/, ''));
    const file = path.join(ASSET_DIR, name);
    try {
      const buf = fs.readFileSync(file);
      return new Response(buf, {
        status: 200,
        headers: { 'content-type': MIME[path.extname(name).toLowerCase()] || 'application/octet-stream' }
      });
    } catch {
      return new Response('not found', { status: 404 });
    }
  }

  return new Response('not found', { status: 404 });
}

function registerPrivileged() {
  protocol.registerSchemesAsPrivileged([{
    scheme: 'fathi',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: false
    }
  }]);
}

function bind(ses) {
  try {
    ses.protocol.handle('fathi', serve);
  } catch (e) {
    // already bound
  }
}

module.exports = { registerPrivileged, bind, serve };

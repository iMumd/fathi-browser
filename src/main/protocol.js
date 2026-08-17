
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

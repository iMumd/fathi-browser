
  /* ---- 2b. wallpaper + brand icon render inside the tab */
  let wall = null;
  for (let i = 0; i < 10; i += 1) {
    wall = await withTimeout(ui.executeJavaScript(`(async () => {
      const wv = document.querySelector('webview.active');
      try {
        return await wv.executeJavaScript('(() => { const bg = document.getElementById("bg"); const img = document.querySelector("#brand-mark img"); return { ready: bg.classList.contains("ready"), bg: getComputedStyle(bg).backgroundImage, brand: img ? { w: img.naturalWidth, src: img.getAttribute("src") } : null }; })()');
      } catch (e) { return { err: String(e && e.message || e) }; }
    })()`), 6000, 'wallpaper').catch((e) => ({ err: String(e && e.message || e) }));
    if (wall && wall.ready) break;
    await sleep(700);
  }
  add('new tab wallpaper loaded', !!(wall && /url\(/.test(wall.bg || '')), JSON.stringify(wall));
  add('new tab brand icon loaded', !!(wall && wall.brand && wall.brand.w > 0), JSON.stringify(wall && wall.brand));

  /* ---- 2c. start-page promo banners (GitHub + Telegram) */
  const promos = await ui.executeJavaScript(`(async () => {
    const wv = document.querySelector('webview.active');
    try {
      return await wv.executeJavaScript('(() => Array.from(document.querySelectorAll("#promos .promo")).map((a) => ({ href: a.getAttribute("href"), target: a.getAttribute("target"), title: (a.querySelector(".ptitle") || {}).textContent, sub: (a.querySelector(".psub") || {}).textContent, go: (a.querySelector(".pgo") || {}).textContent })))()');
    } catch (e) { return { err: String(e && e.message || e) }; }
  })()`).catch((e) => ({ err: String(e && e.message || e) }));
  add('start page promos render',
    Array.isArray(promos) && promos.length === 2 &&
      promos[0].href === 'https://github.com/iMumd' && promos[0].target === '_blank' &&
      promos[1].href === 'https://t.me/Mumdthoughts' && promos[1].target === '_blank' &&
      /GitHub/.test(promos[0].sub || '') && /Telegram/.test(promos[1].sub || ''),
    JSON.stringify(promos));

  /* ---- 3. second tab gets a different partition */
  trace('check 3: second tab');
  await ui.executeJavaScript(`document.getElementById('newtab-btn').click()`);
  await sleep(1800);
  const two = await tabsState();
  add('second tab created', two.count === 2, 'tabs=' + two.count);
  add('tabs use separate sessions', two.partition && first && two.partition !== first.partition,
    `${first && first.partition} | ${two.partition}`);

  /* ---- 4. navigation works (through proxy) */
  trace('check 4: navigation');
  await ui.executeJavaScript(`
    (() => {
      const wv = document.querySelector('webview.active');
      wv.loadURL('https://example.com');
    })()
  `);
  const nav = await waitFor(async () => {
    const s = await tabsState();
    return s.url && s.url.includes('example.com') && !s.url.startsWith('fathi://') ? s : null;
  }, 45000);
  add('external navigation works', !!nav, nav && nav.url);
  add('page title updated', !!(nav && nav.title), nav && nav.title);

  /* ---- 5. device mode (iPhone preset), same window, mobile metrics */
  trace('check 5: device tab');
  await ui.executeJavaScript(`void createTab({ deviceId: 'iphone-15-pro' }); true`);
  await sleep(2600);
  trace('check 5: device frame');

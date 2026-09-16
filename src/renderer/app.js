
  wv.addEventListener('did-start-navigation', (e) => {
    if (!e.isMainFrame) return;
    tab.url = e.url;
    if (state.activeId === tab.id) {
      updateSecurityIcon();
      if (document.activeElement !== omnibox) updateOmnibox();
    }
  });

  wv.addEventListener('did-navigate', (e) => {
    tab.url = e.url;
    if (state.activeId === tab.id) { updateOmnibox(); updateSecurityIcon(); updateNavButtons(); }
  });

  wv.addEventListener('did-navigate-in-page', (e) => {
    if (!e.isMainFrame) return;
    tab.url = e.url;
    if (state.activeId === tab.id) { updateOmnibox(); updateSecurityIcon(); }
  });

  wv.addEventListener('page-title-updated', (e) => {
    if (tab.url && tab.url.startsWith('fathi://newtab')) return;
    setTitle(e.title);
  });
  wv.addEventListener('page-favicon-updated', (e) => {
    if (e.favicons && e.favicons.length) setFavicon(e.favicons[0]);
  });

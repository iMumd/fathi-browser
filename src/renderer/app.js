
  const setTitle = (title) => {
    tab.title = title || t('tab.untitled');
    el.querySelector('.tab-title').textContent = tab.title;
    el.title = tab.title + '\n' + (tab.url || '');
    if (state.activeId === tab.id) document.title = tab.title + ' · Fathi';
  };

  const setFavicon = (src) => {
    const box = el.querySelector('.tab-favicon');
    if (!src) {
      box.innerHTML = 'F';
      return;
    }
    tab.favicon = src;
    box.innerHTML = `<img src="${esc(src)}" alt="" onerror="this.remove()" />`;
  };

  wv.addEventListener('did-start-loading', () => {
    tab.loading = true;
    el.classList.add('loading');
    $('#progress').classList.add('active');
    $('#bar').style.width = '18%';
    if (state.activeId === tab.id) updateNavButtons();
  });

  wv.addEventListener('did-stop-loading', () => {
    tab.loading = false;
    el.classList.remove('loading');
    wv.classList.add('ready');
    const bar = $('#bar');
    bar.style.width = '100%';
    setTimeout(() => {
      $('#progress').classList.remove('active');
      bar.style.width = '0%';
    }, 240);
    if (state.activeId === tab.id) {
      updateNavButtons();
      updateOmnibox();
      updateSecurityIcon();
    }
  });

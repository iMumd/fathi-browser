
  const px = tab && tab.proxy;
  if (px && px.enabled && px.host) {
    $('#chip-proxy-text').textContent = px.host;
    pxChip.classList.add('on');
    pxChip.title = t('chip.proxyTitle', { host: px.host, mode: px.mode });
  } else if (px && px.mode === 'rotate') {
    $('#chip-proxy-text').textContent = t('chip.rotate');
    pxChip.classList.add('on');
  } else {
    $('#chip-proxy-text').textContent = t('chip.direct');
    pxChip.classList.remove('on');
  }
}

/* ---------------------------------------------------------------- omnibox */

omnibox.addEventListener('focus', () => { omnibox.select(); });
omnibox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const v = omnibox.value.trim();
    if (v) navigate(v);
    else omnibox.blur();
  }
  if (e.key === 'Escape') {
    updateOmnibox();
    omnibox.blur();
  }

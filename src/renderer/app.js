function navigate(url) {
  const tab = activeTab();
  if (!tab) return;
  const target = normalizeInput(url);
  if (!target) return;
  tab.url = target;
  try { tab.wv.loadURL(target); } catch { tab.wv.setAttribute('src', target); }
  omnibox.blur();
}

/* -------------------------------------------------------------- toolbar UI */

function updateOmnibox() {
  const tab = activeTab();
  if (!tab) return;
  const internal = tab.url && tab.url.startsWith('fathi://');
  if (document.activeElement !== omnibox) {
    omnibox.value = internal ? '' : (tab.url || '');
  }
  omnibox.placeholder = internal ? t('omni.placeholderInternal') : t('omni.placeholder');
  $('#btn-omni-clear').classList.toggle('hidden', !omnibox.value);
}

function updateSecurityIcon() {
  const tab = activeTab();
  const icon = $('#omni-icon');
  icon.className = '';
  if (!tab || !tab.url || tab.url.startsWith('fathi:')) {
    icon.title = t('omni.internal');
    return;
  }
  if (tab.url.startsWith('https://')) { icon.classList.add('secure'); icon.title = t('omni.secure'); }
  else { icon.classList.add('insecure'); icon.title = t('omni.insecure'); }
}


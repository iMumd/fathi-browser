'use strict';
const http = require('node:http');
const fs = require('node:fs');
const { webContents } = require('electron');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(ui) {
  const checks = []; const add = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: JSON.stringify(detail) });
  const evaluate = (source) => ui.executeJavaScript(source);
  const saved = await evaluate(`({ ids: state.tabs.map(t => t.id), active: state.activeId, shortcuts: state.settings.shortcuts, closed: closedTabs.slice(), history: sessionLibrary.history.slice(), bookmarks: sessionLibrary.bookmarks.slice() })`);
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture-download.txt') {
      res.setHeader('Content-Disposition', 'attachment; filename="keyboard-fixture.txt"');
      res.end('Synthetic download fixture'); return;
    }
    res.setHeader('Content-Type', 'text/html'); res.setHeader('Cache-Control', 'no-store');
    res.end('<title>Keyboard fixture</title><textarea id="editor"></textarea><p>needle needle</p><a id="background" href="/background">Background link</a><script>window.__keyboardReady = true</script>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function until(source) {
    for (let i = 0; i < 100; i++) { const result = await evaluate(source); if (result) return result; await sleep(50); }
    throw new Error('Keyboard audit timed out: ' + source);
  }
  async function press(wc, keyCode, modifiers = []) {
    wc.focus();
    wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
    if (!wc.isDestroyed()) wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
    await sleep(120);
  }
  async function make(suffix, background = false) {
    const id = await evaluate(`(async () => (await createTab({ url: ${JSON.stringify(origin + suffix)}, activate: ${!background} })).id)()`);
    const wcId = await until(`(() => { const t = state.tabs.find(t => t.id === ${JSON.stringify(id)}); return t?.identityReady && t.url === ${JSON.stringify(origin + suffix)} && t.wcId; })()`);
    const wc = webContents.fromId(wcId);
    for (let i = 0; i < 100 && !await wc.executeJavaScript('!!window.__keyboardReady').catch(() => false); i++) await sleep(50);
    return { id, wc };
  }
  try {
    await evaluate(`closeSettings(); closeGuide(); (async () => { const s = await window.api.settings.set({ shortcuts: BrowserShortcuts.defaults }); state.settings = s.settings; })()`);
    const a = await make('/a'); const b = await make('/b'); const c = await make('/c', true);
    add('background tabs do not steal selection', await evaluate(`state.activeId === ${JSON.stringify(b.id)}`));
    await b.wc.executeJavaScript('document.getElementById("editor").focus()');
    await press(b.wc, 'Tab', ['control']);
    add('Ctrl+Tab switches tabs even from a page textarea', await evaluate(`state.activeId === ${JSON.stringify(c.id)}`));
    await press(c.wc, 'Tab', ['control', 'shift']);
    add('Ctrl+Shift+Tab selects the previous tab', await evaluate(`state.activeId === ${JSON.stringify(b.id)}`));
    await press(b.wc, '9', ['control']);
    add('Ctrl+9 selects the last tab', await evaluate(`state.activeId === ${JSON.stringify(c.id)}`));
    await press(c.wc, '1', ['control']);
    add('Ctrl+1 selects the first tab', await evaluate(`state.activeId === ${JSON.stringify(saved.ids[0])}`));

    await evaluate(`activate(${JSON.stringify(c.id)})`);
    const beforeNew = await evaluate('state.tabs.length');
    await press(c.wc, 'T', ['control']);
    await until(`state.tabs.length === ${beforeNew + 1} && activeTab().url.startsWith('fathi://newtab') && !activeTab().loading`);
    const newFocus = await evaluate(`({ url: activeTab().url, focus: document.activeElement.id })`);
    add('Ctrl+T creates a blank tab and focuses the address bar', newFocus.url.startsWith('fathi://newtab') && newFocus.focus === 'omnibox', newFocus);
    await press(ui, 'W', ['control']);
    await until(`state.tabs.length === ${beforeNew}`);
    const typed = await evaluate(`(async () => { openSettings('general'); const pending = createTab({ url: newTabUrl() }); omnibox.value = 'typed during setup'; await pending; return { value: omnibox.value, focus: document.activeElement.id, id: activeTab().id, uncovered: $('#settings-overlay').classList.contains('hidden') }; })()`);
    add('explicit new-tab URLs uncover the address bar and preserve immediate typing during setup', typed.value === 'typed during setup' && typed.focus === 'omnibox' && typed.uncovered, typed);
    await evaluate(`closeTab(${JSON.stringify(typed.id)}, { silent: true })`);
    for (const selector of ['#newtab-btn', '#btn-shuffle']) {
      const count = await evaluate('state.tabs.length');
      const point = await evaluate(`(() => { const r = $(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
      ui.focus();
      ui.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point });
      ui.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point });
      await until(`state.tabs.length === ${count + 1} && activeTab().url.startsWith('fathi://newtab') && !activeTab().loading`);
      add(`${selector} native click gives the address bar initial focus`, await evaluate('document.activeElement === omnibox'));
      await evaluate('closeTab(state.activeId, { silent: true })');
    }

    await evaluate(`activate(${JSON.stringify(a.id)});`);
    await press(a.wc, 'F', ['control']);
    add('Ctrl+F opens a focused find bar from inside a page', await evaluate(`!$('#page-find').classList.contains('hidden') && document.activeElement === $('#page-find-input')`));
    await evaluate(`$('#page-find-input').value = 'needle'; $('#page-find-input').dispatchEvent(new Event('input'));`);
    await until(`$('#page-find-count').textContent.includes('/ 2')`);
    const firstMatch = await evaluate(`$('#page-find-count').textContent`);
    await press(ui, 'Enter');
    add('Find Enter advances real Chromium matches', await evaluate(`$('#page-find-count').textContent !== ${JSON.stringify(firstMatch)} && $('#page-find-count').textContent.includes('/ 2')`));
    await press(ui, 'Escape');
    add('Escape closes find without closing the tab', await evaluate(`$('#page-find').classList.contains('hidden') && state.activeId === ${JSON.stringify(a.id)}`));
    await press(a.wc, '+', ['control', 'shift']);
    add('Ctrl+Plus zooms the page', await evaluate(`activeTab().wv.getZoomFactor() > 1`));
    await press(a.wc, '0', ['control']);
    add('Ctrl+0 resets page zoom', await evaluate(`activeTab().wv.getZoomFactor() === 1`));
    await press(a.wc, 'F11');
    await until('(async () => (await window.api.win.state()).fullscreen)()');
    await press(ui, 'F11');
    await until('(async () => !(await window.api.win.state()).fullscreen)()');
    add('F11 enters and leaves real window fullscreen', true);

    await evaluate(`(async () => { const s = await window.api.settings.set({ shortcuts: { nextTab: 'Ctrl+Y' } }); state.settings = s.settings; })()`);
    await press(a.wc, 'Tab', ['control']);
    add('rebinding next-tab disables the old guest shortcut', await evaluate(`state.activeId === ${JSON.stringify(a.id)}`));
    await press(a.wc, 'Y', ['control']);
    add('custom shortcuts apply inside webviews', await evaluate(`state.activeId === ${JSON.stringify(b.id)}`));
    await evaluate(`(async () => { const s = await window.api.settings.set({ shortcuts: BrowserShortcuts.defaults }); state.settings = s.settings; openSettings('shortcuts'); document.querySelector('[data-sc="nextTab"]').focus(); })()`);
    await press(ui, 'Tab', ['control']);
    add('shortcut recording captures Ctrl+Tab without switching tabs', await evaluate(`document.querySelector('[data-sc="nextTab"]').value === 'Ctrl+Tab' && state.activeId === ${JSON.stringify(b.id)}`));
    await evaluate('closeSettings()');

    const before = await evaluate(`({ partition: activeTab().partition, fp: activeTab().fp.id, count: state.tabs.length })`);
    await press(b.wc, 'W', ['control']);
    await until(`!state.tabs.some(t => t.id === ${JSON.stringify(b.id)})`);
    add('Ctrl+W really closes the focused guest tab', await evaluate(`state.tabs.length === ${before.count - 1}`));
    await press(c.wc, 'T', ['control', 'shift']);
    const restored = await until(`(() => { const t = activeTab(); return t?.url === ${JSON.stringify(origin + '/b')} && t.identityReady && { partition: t.partition, fp: t.fp.id }; })()`);
    add('Ctrl+Shift+T restores the URL with a fresh session and identity', restored.partition !== before.partition && restored.fp !== before.fp, restored);
    await until(`activeTab()?.wv.classList.contains('ready') && !activeTab().loading`);

    const uiCloseCount = await evaluate(`state.tabs.length`);
    await evaluate('omnibox.focus()');
    await press(ui, 'W', ['control']);
    await until(`state.tabs.length === ${uiCloseCount - 1}`);
    add('Ctrl+W works from the address bar without closing the window', !ui.isDestroyed());
    await evaluate(`activate(${JSON.stringify(a.id)}); openSettings('about')`);
    const about = await evaluate(`(async () => { const current = await window.api.appInfo(); return { name: $('#about-system').textContent, version: $('#about-os-version').textContent, matches: current.system.name === state.info.system.name && current.node === state.info.node, node: state.info.node, arch: state.info.arch }; })()`);
    const expected = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[process.platform];
    add('About shows actual readable OS/build and consistent runtime versions', about.name === expected && about.version.length > 3 && about.matches && about.node === process.versions.node && about.arch === process.arch, about);
    add('closed-tab URL history is bounded and absent from saved settings', await evaluate(`(async () => closedTabs.length <= 10 && !('closedTabs' in (await window.api.settings.get()).settings))()`));
    await evaluate('closeSettings()');
    const beforeLink = await evaluate('state.tabs.length');
    const point = await a.wc.executeJavaScript(`(() => { const r = document.getElementById('background').getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
    a.wc.focus();
    a.wc.sendInputEvent({ type: 'mouseDown', button: 'middle', clickCount: 1, ...point });
    a.wc.sendInputEvent({ type: 'mouseUp', button: 'middle', clickCount: 1, ...point });
    await until(`state.tabs.length === ${beforeLink + 1}`);
    await until(`state.tabs.some(t => t.url === ${JSON.stringify(origin + '/background')} && t.identityReady && !t.loading)`);
    add('middle-click links open adjacent background tabs without stealing focus', await evaluate(`state.activeId === ${JSON.stringify(a.id)} && state.tabs[state.tabs.findIndex(t => t.id === ${JSON.stringify(a.id)}) + 1].url === ${JSON.stringify(origin + '/background')}`));
    await press(a.wc, 'PageDown', ['control']);
    add('Ctrl+PageDown cycles to the adjacent tab', await evaluate(`activeTab().url === ${JSON.stringify(origin + '/background')}`));

    await evaluate(`activate(${JSON.stringify(a.id)})`);
    await press(a.wc, 'D', ['control']);
    add('Ctrl+D creates a real session bookmark and opens its manager', await evaluate(`state.section === 'bookmarks' && sessionLibrary.bookmarks.some(item => item.url === ${JSON.stringify(origin + '/a')}) && $('#library-results').textContent.includes('Keyboard fixture')`));
    const escaped = await evaluate(`(() => { sessionLibrary.bookmarks[0].title = '<img src=x onerror=bad>'; renderLibrary('bookmarks'); return !$('#settings-body img'); })()`);
    add('bookmark titles render as text, not executable markup', escaped);
    await evaluate('closeSettings()');
    await press(a.wc, 'B', ['control', 'shift']);
    add('Ctrl+Shift+B displays an actual session bookmarks bar', await evaluate(`!$('#bookmarks-bar').classList.contains('hidden') && $('#bookmarks-bar [data-bookmark]') !== null`));
    await press(a.wc, 'H', ['control']);
    add('Ctrl+H displays real in-memory navigation history', await evaluate(`state.section === 'history' && sessionLibrary.history.some(item => item.url === ${JSON.stringify(origin + '/a')}) && $('#library-results .library-row') !== null`));
    await evaluate('closeSettings()');
    await press(a.wc, 'A', ['control', 'shift']);
    add('Ctrl+Shift+A opens a focused filter for current tabs', await evaluate(`state.section === 'tabs' && document.activeElement === $('#library-filter')`));
    await evaluate('closeSettings()');
    await press(a.wc, 'Escape', ['shift']);
    await until(`state.section === 'tasks' && $('#settings-body tbody tr')`);
    add('Shift+Escape shows actual process CPU and memory metrics', await evaluate(`$('#settings-body tbody').textContent.length > 5`));
    await evaluate('closeSettings()');
    a.wc.downloadURL(origin + '/fixture-download.txt');
    await until(`(async () => (await window.api.library.downloads()).items.some(item => item.name === 'keyboard-fixture.txt' && item.state === 'completed'))()`);
    await press(a.wc, 'J', ['control']);
    await until(`state.section === 'downloads' && $('#settings-body').textContent.includes('keyboard-fixture.txt')`);
    add('Ctrl+J displays a real completed temporary download', true);
    await evaluate('closeSettings()');
    const preSource = await evaluate('state.tabs.length');
    await press(a.wc, 'U', ['control']);
    await until(`state.tabs.length === ${preSource + 1} && activeTab().identityReady && !activeTab().loading`);
    const sourceWcId = await evaluate('activeTab().wcId');
    const sourceText = await webContents.fromId(sourceWcId).executeJavaScript('document.body.innerText');
    add('Ctrl+U opens Chromium view-source, not a DOM snapshot', sourceText.includes('<title>Keyboard fixture</title>'), { nativeUrl: webContents.fromId(sourceWcId).getURL(), sourceVisible: sourceText.includes('<title>Keyboard fixture</title>') });
    await evaluate('closeTab(state.activeId, { silent: true })');
    await evaluate(`activate(${JSON.stringify(a.id)})`);
    await press(a.wc, 'T', ['alt', 'shift']);
    add('Alt+Shift+T focuses the first enabled toolbar control', await evaluate(`document.activeElement.matches('#toolbar button:not(:disabled)')`));
    await press(ui, 'F10');
    add('F10 focuses the rightmost toolbar control', await evaluate(`document.activeElement === $('#btn-menu')`));
    await evaluate(`activate(${JSON.stringify(a.id)})`);
    for (const modifiers of [['control'], ['control', 'shift']]) {
      const windows = require('./window-launcher').auditWindows;
      const beforePids = new Set(windows.keys());
      await press(a.wc, 'N', modifiers);
      let record;
      for (let i = 0; i < 200; i++) {
        record = [...windows].find(([pid]) => !beforePids.has(pid));
        if (record && fs.existsSync(record[1].auditPath)) break;
        await sleep(50);
      }
      if (!record || !fs.existsSync(record[1].auditPath)) throw new Error('New-window readiness acknowledgement missing');
      const snapshot = JSON.parse(fs.readFileSync(record[1].auditPath, 'utf8'));
      add(`${modifiers.length === 1 ? 'Ctrl+N' : 'Ctrl+Shift+N'} opens a real isolated window with address focus`, snapshot.focus === 'omnibox' && snapshot.partition.startsWith('fathi-tab-'));
      await evaluate(`window.api.library.closeAuditWindow(${record[0]})`);
      ui.getOwnerBrowserWindow().focus();
    }
    await a.wc.executeJavaScript(`document.cookie = 'clear_fixture=1'; localStorage.setItem('clear_fixture', '1')`);
    await press(a.wc, 'Delete', ['control', 'shift']);
    add('Ctrl+Shift+Delete opens explicit confirmation without clearing automatically', await evaluate(`state.section === 'privacy' && $('#clear-session-data') !== null`) && await a.wc.executeJavaScript(`localStorage.getItem('clear_fixture') === '1'`));
    await evaluate(`$('#clear-session-data').click()`);
    await until(`$('#clear-session-status')?.textContent === t('library.cleared')`);
    add('confirmed clear wipes actual session storage and history, not bookmarks', await a.wc.executeJavaScript(`document.cookie === '' && localStorage.getItem('clear_fixture') === null`) && await evaluate(`sessionLibrary.history.length === 0 && sessionLibrary.bookmarks.length > 0`));
    add('new library features never enter persistent settings', await evaluate(`(async () => { const s = (await window.api.settings.get()).settings; return !('history' in s) && !('bookmarks' in s) && !('downloads' in s); })()`));
    await evaluate(`closeSettings(); activate(${JSON.stringify(a.id)})`);
    const position = await evaluate(`state.tabs.findIndex(t => t.id === ${JSON.stringify(a.id)})`);
    await press(a.wc, 'PageDown', ['control', 'shift']);
    add('Ctrl+Shift+PageDown moves the tab and its DOM element together', await evaluate(`state.tabs.indexOf(activeTab()) === ${position + 1} && [...tabstrip.children].map(el => el.dataset.id).join() === state.tabs.map(t => t.id).join()`));
    await press(a.wc, 'PageUp', ['control', 'shift']);
    add('Ctrl+Shift+PageUp moves the tab back without changing identity', await evaluate(`state.tabs.indexOf(activeTab()) === ${position}`));
    await press(a.wc, 'K', ['control']);
    add('Ctrl+K focuses explicit search mode in the address bar', await evaluate(`document.activeElement === omnibox && omnibox.value === '? '`));
    const beforeAltEnter = await evaluate('state.tabs.length');
    await evaluate(`omnibox.value = ${JSON.stringify(origin + '/alt-enter')}`);
    await press(ui, 'Enter', ['alt']);
    await until(`state.tabs.length === ${beforeAltEnter + 1} && activeTab().url === ${JSON.stringify(origin + '/alt-enter')} && !activeTab().loading`);
    add('Alt+Enter opens the address in a real new tab', true);
    await evaluate('closeTab(state.activeId, { silent: true })');
  } finally {
    for (const [pid] of require('./window-launcher').auditWindows) await evaluate(`window.api.library.closeAuditWindow(${pid})`).catch(() => {});
    await evaluate(`closeFind(false); closeSettings(); (async () => {
      for (const t of [...state.tabs]) if (!${JSON.stringify(saved.ids)}.includes(t.id)) await closeTab(t.id, { silent: true });
      closedTabs.splice(0, closedTabs.length, ...${JSON.stringify(saved.closed)});
      sessionLibrary.history = ${JSON.stringify(saved.history)}; sessionLibrary.bookmarks = ${JSON.stringify(saved.bookmarks)};
      bookmarkBarVisible = false; renderBookmarkBar();
      const s = await window.api.settings.set({ shortcuts: ${JSON.stringify(saved.shortcuts)} }); state.settings = s.settings;
      activate(${JSON.stringify(saved.active)});
    })()`).catch(() => {});
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  }
  return checks;
}
module.exports = { run };

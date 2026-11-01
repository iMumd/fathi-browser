'use strict';
const http = require('node:http');
const { webContents } = require('electron');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(ui) {
  const checks = []; const add = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: JSON.stringify(detail) });
  const evaluate = (source) => ui.executeJavaScript(source);
  const saved = await evaluate(`({ ids: state.tabs.map(t => t.id), active: state.activeId, shortcuts: state.settings.shortcuts, closed: closedTabs.slice() })`);
  const server = http.createServer((_req, res) => {
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
  } finally {
    await evaluate(`closeFind(false); closeSettings(); (async () => {
      for (const t of [...state.tabs]) if (!${JSON.stringify(saved.ids)}.includes(t.id)) await closeTab(t.id, { silent: true });
      closedTabs.splice(0, closedTabs.length, ...${JSON.stringify(saved.closed)});
      const s = await window.api.settings.set({ shortcuts: ${JSON.stringify(saved.shortcuts)} }); state.settings = s.settings;
      activate(${JSON.stringify(saved.active)});
    })()`).catch(() => {});
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  }
  return checks;
}
module.exports = { run };

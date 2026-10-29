'use strict';
/* Session-only workspace. No localStorage, settings writes or network calls. */
const researchWorkspace = {
  scope: { include: [], exclude: [], onlyIntercept: false },
  baseline: null,
  input: '', output: '', operation: 'base64Decode'
};

function clearResearchForTab(wcId) {
  if (researchWorkspace.baseline?.wcId === wcId) researchWorkspace.baseline = null;
}

function renderResearch() {
  const body = $('#settings-body');
  const ws = researchWorkspace;
  body.innerHTML = `
    <div class="research-intro"><span class="eyebrow">FATHI / RESEARCH</span><h2>${esc(t('research.title'))}</h2><p>${esc(t('research.subtitle'))}</p></div>
    <div class="card">
      <h3>${esc(t('research.scope'))}</h3><p class="hint">${esc(t('research.scopeHint'))}</p>
      <div class="research-columns">
        <div class="field"><label for="scope-include">${esc(t('research.include'))}</label><textarea id="scope-include" dir="ltr" spellcheck="false" placeholder="example.com&#10;*.example.com">${esc(ws.scope.include.join('\n'))}</textarea></div>
        <div class="field"><label for="scope-exclude">${esc(t('research.exclude'))}</label><textarea id="scope-exclude" dir="ltr" spellcheck="false" placeholder="accounts.example.com">${esc(ws.scope.exclude.join('\n'))}</textarea></div>
      </div>
      <label class="research-check"><input type="checkbox" id="scope-intercept" ${ws.scope.onlyIntercept ? 'checked' : ''} /> ${esc(t('research.onlyIntercept'))}</label>
      <p class="hint">${esc(t('research.scopeBoundary'))}</p>
      <div class="btn-row"><button class="btn primary" id="scope-save">${esc(t('research.apply'))}</button><button class="btn" id="scope-current">${esc(t('research.currentHost'))}</button><button class="btn ghost" id="scope-reset">${esc(t('research.reset'))}</button></div>
      <p id="scope-result" class="hint" role="status"></p>
    </div>
    <div class="card">
      <h3>${esc(t('research.toolbox'))}</h3><p class="hint">${esc(t('research.toolboxHint'))}</p>
      <div class="field"><label for="research-operation">${esc(t('research.operation'))}</label><select id="research-operation">${['base64Decode', 'base64Encode', 'urlDecode', 'urlEncode', 'json', 'jwt', 'sha256'].map((op) => `<option value="${op}" ${ws.operation === op ? 'selected' : ''}>${esc(t('research.op.' + op))}</option>`).join('')}</select></div>
      <div class="field"><label for="research-input">${esc(t('research.input'))}</label><textarea id="research-input" dir="ltr" spellcheck="false" maxlength="65536" rows="6">${esc(ws.input)}</textarea></div>
      <div class="btn-row"><button class="btn primary" id="research-run">${esc(t('research.run'))}</button><button class="btn" id="research-copy">${esc(t('research.copy'))}</button><button class="btn ghost" id="research-clear">${esc(t('research.clear'))}</button></div>
      <p id="research-result" class="hint" role="status">${esc(t('research.jwtWarning'))}</p>
      <pre class="research-output" id="research-output" dir="ltr" tabindex="0">${esc(ws.output)}</pre>
    </div>`;
  $('#scope-save').addEventListener('click', async () => {
    const result = await window.api.research.setScope({ include: $('#scope-include').value, exclude: $('#scope-exclude').value, onlyIntercept: $('#scope-intercept').checked });
    if (!result.ok) { $('#scope-result').textContent = t(result.error); return; }
    ws.scope = result.scope;
    $('#scope-result').textContent = t('research.scopeApplied');
    flowRender();
  });
  $('#scope-current').addEventListener('click', () => {
    try {
      const url = new URL(activeTab()?.url);
      if (!/^https?:$/.test(url.protocol)) throw new Error();
      const list = Research.scopeRules($('#scope-include').value);
      $('#scope-include').value = [...new Set([...list, url.hostname])].join('\n');
    } catch { $('#scope-result').textContent = t('research.noHost'); }
  });
  $('#scope-reset').addEventListener('click', async () => {
    const result = await window.api.research.setScope({});
    if (result.ok) { ws.scope = result.scope; renderResearch(); flowRender(); }
  });
  $('#research-input').addEventListener('input', (e) => { ws.input = e.target.value; });
  $('#research-operation').addEventListener('change', (e) => { ws.operation = e.target.value; });
  $('#research-run').addEventListener('click', async () => {
    const button = $('#research-run'); const output = $('#research-output'); const status = $('#research-result');
    button.disabled = true;
    try {
      ws.output = await Research.transform(ws.operation, ws.input);
      output.textContent = ws.output;
      status.textContent = ws.operation === 'jwt' ? t('research.jwtWarning') : t('research.complete');
    } catch (error) { ws.output = ''; output.textContent = ''; status.textContent = t(error.message); }
    finally { button.disabled = false; }
  });
  $('#research-copy').addEventListener('click', () => copyText(ws.output));
  $('#research-clear').addEventListener('click', () => { ws.input = ''; ws.output = ''; renderResearch(); });
}

function renderSecurityPanel(record, panel) {
  const findings = Research.audit(record);
  panel.innerHTML = `<h4>${esc(t('research.passive'))}</h4><p class="hint">${esc(t('research.passiveHint'))}</p>
    ${findings.length ? findings.map((finding) => `<article class="security-finding"><div class="finding-heading"><span class="badge ${finding.level === 'medium' ? 'warn' : ''}">${esc(t('research.level.' + finding.level))}</span><h5>${esc(t('research.finding.' + finding.id))}</h5></div><p>${esc(t('research.advice.' + finding.id))}</p><code dir="ltr">${esc(finding.evidence)}</code></article>`).join('') : `<div class="net-note info">${esc(t('research.noFindings'))}</div>`}`;
}

function renderComparisonPanel(record, panel) {
  const baseline = researchWorkspace.baseline;
  if (!baseline) { panel.innerHTML = `<p class="hint">${esc(t('research.compareHint'))}</p>`; return; }
  const diff = Research.compare(baseline, record);
  panel.innerHTML = `<h4>${esc(t('research.comparison'))}</h4><p class="hint">${esc(t('research.baselineFrom'))} <b>${esc(baseline.method)}</b> ${esc(baseline.url)}</p>
    <div class="btn-row"><button class="btn sm" id="baseline-clear">${esc(t('research.clearBaseline'))}</button></div>
    <div class="comparison-status" dir="ltr">${esc(diff.statusBefore)} → ${esc(diff.statusAfter)}</div>
    <h4>${esc(t('research.headerChanges'))} (${diff.headers.length})</h4>
    ${diff.headers.map((h) => `<details class="header-diff"><summary>${esc(h.name)}</summary><pre dir="ltr">− ${esc(h.before ?? t('research.absent'))}\n+ ${esc(h.after ?? t('research.absent'))}</pre></details>`).join('')}
    <h4>${esc(t('research.bodyChanges'))}</h4>
    ${!diff.bodyAvailable ? `<p class="hint">${esc(t('research.bodyUnavailable'))}</p>` : diff.identical ? `<p class="hint">${esc(t('research.identical'))}</p>` : `<div class="research-columns"><div><label>${esc(t('research.before'))}</label><pre class="research-output diff-before" dir="ltr">${esc(diff.before)}</pre></div><div><label>${esc(t('research.after'))}</label><pre class="research-output diff-after" dir="ltr">${esc(diff.after)}</pre></div></div>`}
    ${diff.truncated || diff.clipped ? `<p class="net-note info">${esc(t('research.partialComparison'))}</p>` : ''}`;
  $('#baseline-clear').addEventListener('click', () => { researchWorkspace.baseline = null; renderComparisonPanel(record, panel); });
}

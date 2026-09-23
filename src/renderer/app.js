
  if (flow.detailTab === 'code') {
    panel.innerHTML = `
      <div class="code-lang-row">
        <select id="net-code-lang" class="mini-select">
          ${CODE_LANGS.map(([id, label]) => `<option value="${id}" ${flow.codeLang === id ? 'selected' : ''}>${esc(label)}</option>`).join('')}
        </select>
        <button class="btn sm primary" id="net-code-copy">${esc(t('flow.copyCode'))}</button>
      </div>
      <pre class="body-pre code-box" id="net-code-pre">${esc(codeFor(r, flow.codeLang))}</pre>`;
    $('#net-code-lang').addEventListener('change', (e) => {
      flow.codeLang = e.target.value;
      $('#net-code-pre').textContent = codeFor(r, flow.codeLang);
    });
    $('#net-code-copy').addEventListener('click', () => copyText(codeFor(r, flow.codeLang)));
    return;
  }

  // analysis
  const stats = calcStats(flow.records);
  const notes = flowNotes(r);
  const total = Math.max(1, Number(r.timing && r.timing.total) || 1);
  const sc = stats.statuses;
  panel.innerHTML = `
    <h4>${esc(t('flow.notes'))}</h4>
    ${notes.map(([kind, text]) => `<div class="net-note ${kind}">${esc(text)}</div>`).join('')}

    <h4>${esc(t('flow.timing'))}</h4>
    ${barRow(t('flow.hdrWait'), r.timing && r.timing.wait, total)}
    ${barRow(t('flow.hdrReceive'), r.timing && r.timing.receive, total)}
    ${barRow(t('flow.hdrDns'), r.timing && r.timing.dns, total)}
    ${barRow(t('flow.hdrSsl'), r.timing && r.timing.ssl, total)}

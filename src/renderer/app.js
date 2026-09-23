
    <h4>${esc(t('flow.fullFlow'))} · ${esc(t('flow.requests'))}</h4>
    <dl class="kv">
      <dt>${esc(t('flow.requests'))}</dt><dd>${stats.count}</dd>
      <dt>${esc(t('flow.transferred'))}</dt><dd>${fmtBytes(stats.bytes)}</dd>
      <dt>${esc(t('flow.avg'))}</dt><dd>${fmtMs(stats.avgMs)}</dd>
      <dt>${esc(t('flow.failed'))}</dt><dd>${stats.failed}</dd>
      <dt>${esc(t('flow.statuses'))}</dt><dd>2xx ${sc.s2} · 3xx ${sc.s3} · 4xx ${sc.s4} · 5xx ${sc.s5}</dd>
    </dl>

    <h4>${esc(t('flow.slowest'))}</h4>
    ${stats.slowest.length
      ? stats.slowest.map((s) => `<div class="net-slow"><span title="${esc(s.url)}">${esc(prettyUrl(s.url))}</span><span>${fmtMs(s.ms)}</span></div>`).join('')
      : `<div class="ix-empty">${esc(t('flow.empty'))}</div>`}

    <h4>${esc(t('flow.domains'))}</h4>
    <div class="net-domains">
      ${stats.domains.map((d) => `<div class="net-domain"><b>${esc(d.host)}</b><span>${d.count}</span><span>${fmtBytes(d.bytes)}</span></div>`).join('')}
    </div>`;
}

function barRow(label, value, total) {
  const n = Math.max(0, Number(value) || 0);
  const pct = Math.max(0, Math.min(100, (n / Math.max(1, total)) * 100));
  return `<div class="bar-row">
    <span class="lbl">${esc(label)}</span>
    <span class="val">${n > 0 ? Math.round(n) + ' ms' : 'n/a'}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${pct.toFixed(1)}%"></span></span>
  </div>`;
}


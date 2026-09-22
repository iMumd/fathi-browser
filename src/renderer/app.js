}

function netRow(r) {
  return `
    <button class="net-row" data-net="${esc(r.id)}" data-wc="${esc(r.wcId)}" title="${esc(r.url)}">
      <span class="net-status ${statusCls(r.status)}">${r.status || (r.failed ? 'ERR' : 'n/a')}</span>
      <span class="net-m">${esc(r.method)}</span>
      <span class="net-u">${esc(prettyUrl(r.url))}</span>
      <span class="net-size">${fmtBytes(r.size)}</span>
      <span class="net-ms">${fmtMs(r.time)}</span>
    </button>`;
}

function flowRender() {
  const needle = flow.filter.trim().toLowerCase();
  const list = needle
    ? flow.records.filter((r) => `${r.url} ${r.method} ${r.status} ${r.mimeType}`.toLowerCase().includes(needle))
    : flow.records;
  const st = calcStats(list);

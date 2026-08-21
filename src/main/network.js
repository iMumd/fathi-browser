}

function cdata(value) {
  return '<![CDATA[' + String(value == null ? '' : value).replace(/]]>/g, ']]]]><![CDATA[>') + ']]>';
}

function xml(opts = {}) {
  const recs = collect(opts.wcId, !!opts.all);
  const out = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(`<fathi-session exportedAt="${new Date().toISOString()}" count="${recs.length}" version="1.0">`);
  for (const rec of recs) {
    const t = rec.timing || emptyTiming();
    out.push(`  <request id="${xmlEscape(rec.id, true)}" method="${xmlEscape(rec.method, true)}" url="${xmlEscape(rec.url, true)}" status="${rec.status || 0}" type="${xmlEscape(rec.resourceType, true)}" mime="${xmlEscape(rec.mimeType, true)}" startedAt="${new Date(rec.startedAt).toISOString()}" timeMs="${Math.max(0, Math.round(t.total || 0))}" size="${rec.size || 0}" ip="${xmlEscape(rec.remoteIPAddress, true)}" failed="${rec.failed ? 'true' : 'false'}">`);
    out.push('    <requestHeaders>');
    for (const [name, value] of Object.entries(rec.requestHeaders || {})) {
      out.push(`      <header name="${xmlEscape(name, true)}">${xmlEscape(value)}</header>`);
    }
    out.push('    </requestHeaders>');
    if (rec.postData) out.push(`    <requestBody encoding="utf-8">${cdata(rec.postData)}</requestBody>`);
    out.push('    <responseHeaders>');
    for (const [name, value] of Object.entries(rec.extraResponseHeaders || rec.responseHeaders || {})) {
      out.push(`      <header name="${xmlEscape(name, true)}">${xmlEscape(value)}</header>`);
    }
    out.push('    </responseHeaders>');
    if (rec.body != null) {
      out.push(`    <responseBody encoding="utf-8" truncated="${rec.bodyTruncated ? 'true' : 'false'}">${cdata(rec.body)}</responseBody>`);
    }
    out.push(`    <timing dns="${t.dns}" connect="${t.connect}" ssl="${t.ssl}" send="${t.send}" wait="${t.wait}" receive="${t.receive}" total="${t.total}" />`);
    if (rec.errorText) out.push(`    <error>${xmlEscape(rec.errorText)}</error>`);
    out.push('  </request>');
  }
  out.push('</fathi-session>');
  return out.join('\n');
}

function csv(opts = {}) {
  const recs = collect(opts.wcId, !!opts.all);
  const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = [['startedAt', 'method', 'url', 'status', 'type', 'mime', 'size', 'timeMs', 'dns', 'connect', 'ssl', 'send', 'wait', 'failed', 'error'].join(',')];
  for (const r of recs) {
    const t = r.timing || emptyTiming();
    rows.push([
      new Date(r.startedAt).toISOString(),
      esc(r.method), esc(r.url), r.status || 0, esc(r.resourceType), esc(r.mimeType),
      r.size || 0, Math.round(t.total || 0), t.dns, t.connect, t.ssl, t.send, t.wait,
      r.failed ? 1 : 0, esc(r.errorText)
    ].join(','));
  }
  return rows.join('\r\n');

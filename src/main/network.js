function stats(wcId, all) {
  const recs = collect(wcId, all);
  let bytes = 0;
  let failed = 0;
  let ms = 0;
  const domains = new Map();
  const slow = [];
  const statuses = { s2: 0, s3: 0, s4: 0, s5: 0 };
  for (const r of recs) {
    bytes += r.size || 0;
    if (r.failed) failed += 1;
    if (r.timing && r.timing.total > 0) ms += r.timing.total;
    if (r.status >= 200 && r.status < 300) statuses.s2 += 1;
    else if (r.status >= 300 && r.status < 400) statuses.s3 += 1;
    else if (r.status >= 400 && r.status < 500) statuses.s4 += 1;
    else if (r.status >= 500) statuses.s5 += 1;
    let host = '';
    try { host = new URL(r.url).hostname; } catch {}
    if (host) {
      const d = domains.get(host) || { host, count: 0, bytes: 0 };
      d.count += 1;
      d.bytes += r.size || 0;
      domains.set(host, d);
    }
    if (r.timing && r.timing.total > 0) slow.push({ url: r.url, ms: Math.round(r.timing.total), status: r.status });
  }
  slow.sort((a, b) => b.ms - a.ms);
  return {
    count: recs.length,
    bytes,
    failed,
    avgMs: recs.length ? Math.round(ms / recs.length) : 0,
    statuses,
    slowest: slow.slice(0, 6),
    domains: Array.from(domains.values()).sort((a, b) => b.bytes - a.bytes).slice(0, 8)
  };
}

/* ----------------------------------------------------------------- export */

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    for (const t of tabs.values()) {
      if (!t.dirty) continue;
      t.dirty = false;
      send('fathi:net:batch', {
        wcId: t.wc.id,
        records: listSummaries(t.wc.id).slice(-400)
      });
    }
  }, 220);
}

function queryString(url) {
  try {
    const u = new URL(url);
    return Array.from(u.searchParams.entries()).map(([name, value]) => ({ name, value }));
  } catch { return []; }

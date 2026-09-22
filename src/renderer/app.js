function flowWcId() {
  const tab = activeTab();
  if (!tab || !tab.wv) return null;
  try { return tab.wv.getWebContentsId(); } catch { return null; }
}

function flowMerge(list) {
  if (!Array.isArray(list) || !list.length) return;
  const map = new Map(flow.records.map((r) => [r.id, r]));
  for (const r of list) map.set(r.id, r);
  flow.records = Array.from(map.values()).sort((a, b) => a.startedAt - b.startedAt);
  if (flow.records.length > 1500) flow.records = flow.records.slice(-1500);
}

function calcStats(recs) {
  let bytes = 0;
  let failed = 0;
  let ms = 0;
  let timed = 0;
  const statuses = { s2: 0, s3: 0, s4: 0, s5: 0 };
  const domains = new Map();
  const slow = [];
  for (const r of recs) {
    bytes += Number(r.size) || 0;
    if (r.failed) failed += 1;
    if (r.time > 0) { ms += r.time; timed += 1; }
    if (r.status >= 200 && r.status < 300) statuses.s2 += 1;
    else if (r.status >= 300 && r.status < 400) statuses.s3 += 1;
    else if (r.status >= 400 && r.status < 500) statuses.s4 += 1;
    else if (r.status >= 500) statuses.s5 += 1;
    let host = '';
    try { host = new URL(r.url).hostname; } catch {}
    if (host) {
      const d = domains.get(host) || { host, count: 0, bytes: 0 };
      d.count += 1;
      d.bytes += Number(r.size) || 0;
      domains.set(host, d);
    }
    if (r.time > 0) slow.push({ url: r.url, ms: Math.round(r.time), status: r.status });
  }
  slow.sort((a, b) => b.ms - a.ms);
  return {
    count: recs.length,
    bytes,
    failed,
    avgMs: timed ? Math.round(ms / timed) : 0,
    statuses,
    slowest: slow.slice(0, 5),
    domains: Array.from(domains.values()).sort((a, b) => b.bytes - a.bytes).slice(0, 6)
  };

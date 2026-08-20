}

function summary(rec) {
  return {
    id: rec.id,
    wcId: rec.wcId,
    url: rec.url,
    method: rec.method,
    resourceType: rec.resourceType,
    status: rec.status,
    statusText: rec.statusText,
    mimeType: rec.mimeType,
    startedAt: rec.startedAt,
    size: rec.size || rec.encodedSize || 0,
    time: rec.timing ? rec.timing.total : 0,
    failed: rec.failed,
    errorText: rec.errorText,
    fromCache: rec.fromCache,
    initiator: rec.initiator
  };
}

function collect(wcId, all) {
  const out = [];
  if (all) {
    for (const t of tabs.values()) for (const r of t.reqs.values()) out.push(r);
  } else if (wcId != null) {
    const t = tabs.get(wcId);
    if (t) for (const r of t.reqs.values()) out.push(r);
  }
  out.sort((a, b) => a.startedAt - b.startedAt);
  return out;
}

function listSummaries(wcId, all) {
  return collect(wcId, all).map(summary);
}


function pool() {
  const cfg = settings.get().proxy;
  return (cfg.pool || []).map(parseEntry).filter(Boolean);
}

function assign(partition) {
  const cfg = settings.get().proxy;
  const list = pool();
  if (!cfg.enabled || !list.length) {
    assignments.set(partition, null);
    return null;
  }
  const entry = cfg.mode === 'rotate' ? list[rr++ % list.length] : list[0];
  assignments.set(partition, entry);
  return entry;
}

function entryFor(partition) {
  return assignments.has(partition) ? assignments.get(partition) : assign(partition);
}

async function applyTo(ses, partition, forceEntry) {
  const entry = forceEntry !== undefined ? forceEntry : entryFor(partition);
  const cfg = settings.get().proxy;
  try {
    if (!entry || !cfg.enabled) {
      await ses.setProxy({ mode: 'direct' });
      return null;
    }
    await ses.setProxy({
      proxyRules: entry.rules,
      proxyBypassRules: cfg.bypass || '<local>',
      pacScript: ''
    });
    return entry;
  } catch (e) {
    console.error('[proxy] apply failed', e);
    return null;
  }
}

/** Re-apply the (possibly changed) configuration to every live tab session. */

}

const FORMATS = {
  har: { ext: 'har', name: 'HTTP Archive', mime: 'application/json' },
  json: { ext: 'json', name: 'JSON', mime: 'application/json' },
  xml: { ext: 'xml', name: 'XML', mime: 'application/xml' },
  csv: { ext: 'csv', name: 'CSV', mime: 'text/csv' }
};

function serialize(format, opts) {
  switch (format) {
    case 'xml': return xml(opts);
    case 'csv': return csv(opts);
    case 'json':
      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        count: collect(opts.wcId, !!opts.all).length,
        requests: collect(opts.wcId, !!opts.all)
      }, null, 2);
    case 'har':
    default:
      return JSON.stringify(har(opts), null, 2);
  }
}

async function save(opts = {}) {
  const format = FORMATS[opts.format] ? opts.format : 'har';
  const info = FORMATS[format];
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const base = opts.all ? 'fathi-flow-all' : 'fathi-flow';
  const defaultPath = path.join(process.env.USERPROFILE || process.env.HOME || '.', `${base}-${stamp}.${info.ext}`);

  const res = await dialog.showSaveDialog(win, {
    title: 'Save flow',
    defaultPath,
    filters: [
      { name: info.name, extensions: [info.ext] },
      { name: 'All files', extensions: ['*'] }
    ]
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };

  const content = serialize(format, opts);
  await fs.promises.writeFile(res.filePath, content, 'utf8');
  return { ok: true, path: res.filePath, bytes: Buffer.byteLength(content), format };
}


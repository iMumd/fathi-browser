'use strict';
const path = require('node:path');
const { randomUUID } = require('node:crypto');

class Store {
  constructor(notify = () => {}) { this.records = new Map(); this.notify = notify; }
  track(item, directory) {
    if (this.records.size >= 100) {
      const stale = [...this.records].find(([, value]) => value.state !== 'progressing');
      if (stale) this.records.delete(stale[0]);
      else { item.cancel(); return; }
    }
    const id = randomUUID();
    const name = String(item.getFilename() || 'download').replace(/[\\/<>:"|?*\x00-\x1f]/g, '_').slice(0, 180);
    const file = path.join(directory, id + '-' + name);
    item.setSavePath(file);
    const record = { id, name, file, item, state: 'progressing', received: 0, total: item.getTotalBytes(), paused: false };
    this.records.set(id, record);
    const update = (state) => {
      record.state = state; record.received = item.getReceivedBytes(); record.total = item.getTotalBytes();
      record.paused = state === 'progressing' && item.isPaused(); this.notify();
    };
    item.on('updated', (_event, state) => update(state));
    item.once('done', (_event, state) => update(state));
    this.notify();
    return id;
  }
  list() { return [...this.records.values()].map(({ id, name, state, received, total, paused }) => ({ id, name, state, received, total, paused })); }
  get(id) { const item = this.records.get(id); if (!item) throw new Error('Unknown download'); return item; }
  control(id, action) {
    const record = this.get(id);
    if (record.state !== 'progressing') throw new Error('Download is not active');
    if (action === 'cancel') record.item.cancel();
    else if (action === 'pause') record.item.pause();
    else if (action === 'resume') record.item.resume();
    else throw new Error('Unsupported download action');
    record.paused = record.item.isPaused();
    this.notify();
  }
}
module.exports = { Store };

'use strict';
const { Worker } = require('node:worker_threads');
const events = new (require('node:events').EventEmitter)();
const queue = [];
let active = 0;
function pump() {
  while (active < 2 && queue.length) {
    const job = queue.shift(); active++;
    let worker;
    try { worker = new Worker(require.resolve('./rule-test-worker'), { workerData: job.input }); }
    catch (error) { active--; job.reject(error); continue; }
    let finished = false;
    const finish = (error, result) => {
      if (finished) return;
      finished = true; clearTimeout(timer); worker.terminate(); active--;
      if (error) job.reject(error); else job.resolve(result);
      pump();
    };
    const timer = setTimeout(() => finish(new Error('Rule execution timed out')), 1500);
    worker.once('message', (result) => finish(result.error ? new Error(result.error) : null, result));
    worker.once('error', (error) => finish(error));
    worker.once('exit', (code) => { if (!finished) finish(new Error(`Rule worker exited (${code})`)); });
  }
}
function apply(input) {
  const result = queue.length >= 32 ? Promise.reject(new Error('Rule queue is full; request continued unchanged')) : new Promise((resolve, reject) => { queue.push({ input, resolve, reject }); pump(); });
  return result.catch((error) => { events.emit('failure', error); throw error; });
}
module.exports = { apply, events };

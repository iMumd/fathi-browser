'use strict';
const { parentPort, workerData } = require('node:worker_threads');
try {
  const rewrite = require('./rewrite');
  if (workerData.kind === 'headers') {
    if (!rewrite.HEADER_TARGETS.has(workerData.target) || JSON.stringify(workerData.headers).length > 65536) throw new Error('Headers exceed the supported 64 Ki character limit');
    rewrite.test({ rules: workerData.rules, target: workerData.target, payload: '' });
    parentPort.postMessage(rewrite.applyHeaders(workerData.headers, workerData.rules, workerData.target));
  } else parentPort.postMessage(rewrite.test(workerData));
} catch (error) {
  parentPort.postMessage({ error: error.message });
}

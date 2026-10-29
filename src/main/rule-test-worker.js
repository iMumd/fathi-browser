'use strict';
const { parentPort, workerData } = require('node:worker_threads');
try {
  parentPort.postMessage(require('./rewrite').test(workerData));
} catch (error) {
  parentPort.postMessage({ error: error.message });
}

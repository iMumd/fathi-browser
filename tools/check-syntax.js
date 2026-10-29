'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
let count = 0;
function check(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name);
    if (item.isDirectory()) check(filename);
    else if (/\.(?:js|mjs)$/.test(item.name)) {
      const result = spawnSync(process.execPath, ['--check', filename], { stdio: 'inherit' });
      if (result.status !== 0) process.exit(result.status || 1);
      count++;
    }
  }
}
check('src'); check('tools');
console.log(`Syntax checked ${count} JavaScript files`);

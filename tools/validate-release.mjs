import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const root = process.argv[2] || 'artifacts';
const files = new Map();
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) walk(file);
    else {
      if (files.has(item.name)) throw new Error(`Duplicate asset: ${item.name}`);
      files.set(item.name, file);
    }
  }
}
walk(root);
for (const name of [`Fathi-Setup-${version}.exe`, `Fathi-Portable-${version}.exe`, `Fathi-${version}-linux-x64.tar.gz`, `Fathi-${version}-mac-x64.zip`, `Fathi-${version}-mac-arm64.zip`, `Fathi-Setup-${version}.exe.blockmap`, `Fathi-${version}-mac-x64.zip.blockmap`, `Fathi-${version}-mac-arm64.zip.blockmap`, 'latest.yml', 'latest-mac.yml']) {
  if (!files.has(name) || fs.statSync(files.get(name)).size === 0) throw new Error(`Missing release asset: ${name}`);
}
for (const name of ['latest.yml', 'latest-mac.yml']) {
  const yaml = fs.readFileSync(files.get(name), 'utf8');
  if (!yaml.startsWith(`version: ${version}\n`)) throw new Error(`Wrong version in ${name}`);
  const entries = [...yaml.matchAll(/^  - url: ([^\r\n]+)\r?\n    sha512: ([^\r\n]+)\r?\n    size: (\d+)/gm)];
  if (entries.length !== (name === 'latest.yml' ? 1 : 2)) throw new Error(`Unexpected update file entries in ${name}`);
  for (const [, url, sha512, size] of entries) {
    const file = files.get(url);
    if (!file || fs.statSync(file).size !== Number(size)) throw new Error(`Missing or wrong-sized update target: ${url}`);
    const hash = crypto.createHash('sha512');
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    if (hash.digest('base64') !== sha512) throw new Error(`Update checksum mismatch: ${url}`);
  }
}
console.log(`Validated ${version}: all platform assets and update checksums are present`);

'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const http = require('node:http'); const { spawnSync } = require('node:child_process');
const { parseCa, verifies } = require('../src/main/certificate-trust');
const { fetchCa } = require('../src/main/burp-ca');
const candidates = ['openssl', 'C:/Program Files/Git/usr/bin/openssl.exe'];
const openssl = candidates.find((file) => spawnSync(file, ['version'], { stdio: 'ignore' }).status === 0);
let fixture;
function certificates() {
  if (fixture) return fixture;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fathi-ca-test-'));
  const run = (...args) => { const result = spawnSync(openssl, args, { cwd: dir, stdio: 'pipe', env: { ...process.env, MSYS_NO_PATHCONV: '1' } }); if (result.status !== 0) throw new Error(result.stderr.toString()); };
  run('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '2', '-subj', '/CN=Fathi Test CA', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign');
  run('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'leaf.key', '-out', 'leaf.csr', '-subj', '/CN=target.test');
  fs.writeFileSync(path.join(dir, 'extensions'), 'subjectAltName=DNS:target.test\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\n');
  run('x509', '-req', '-in', 'leaf.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'leaf.pem', '-days', '1', '-extfile', 'extensions');
  fixture = { dir, ca: fs.readFileSync(path.join(dir, 'ca.pem')), leaf: fs.readFileSync(path.join(dir, 'leaf.pem')) };
  return fixture;
}
after(() => { if (fixture) fs.rmSync(fixture.dir, { recursive: true, force: true }); });
test('certificate names alone never establish trust', () => {
  assert.equal(verifies({ hostname: 'target.test', certificate: { issuerName: 'PortSwigger CA', subjectName: 'Burp Suite', data: 'not a certificate' } }, ''), false);
  assert.throws(() => parseCa('not a certificate'));
});
test('pinned CA verifies a signed leaf and rejects hostname mismatch and non-CA imports', { skip: !openssl }, () => {
  const { ca, leaf } = certificates();
  assert(parseCa(ca).ca);
  assert.throws(() => parseCa(leaf));
  assert.equal(verifies({ hostname: 'target.test', certificate: { data: leaf } }, ca), true);
  assert.equal(verifies({ hostname: 'other.test', certificate: { data: leaf } }, ca), false);
  assert.equal(verifies({ hostname: 'target.test', certificate: { data: 'corrupt' } }, ca), false);
});
test('automatic CA retrieval is loopback-only, bounded and validates returned certificates', { skip: !openssl }, async () => {
  const { ca } = certificates(); let mode = 'valid'; let target;
  const server = http.createServer((request, response) => {
    target = request.url;
    if (mode === 'redirect') { response.writeHead(302, { Location: 'https://example.test/cert' }); response.end(); }
    else if (mode === 'large') response.end(Buffer.alloc(70000));
    else response.end(parseCa(ca).raw);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const entry = { scheme: 'http', host: '127.0.0.1', port: server.address().port };
  try {
    const result = await fetchCa(entry);
    assert.equal(result.fingerprint256, parseCa(ca).fingerprint256);
    assert.equal(target, 'http://burp/cert');
    await assert.rejects(fetchCa({ ...entry, host: 'remote.test' }), /loopback/);
    await assert.rejects(fetchCa({ ...entry, scheme: 'socks5' }), /loopback/);
    mode = 'redirect'; await assert.rejects(fetchCa(entry), /did not return/);
    mode = 'large'; await assert.rejects(fetchCa(entry), /exceeds/);
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});

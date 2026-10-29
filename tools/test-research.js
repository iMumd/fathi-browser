'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const r = require('../src/shared/research');
test('scope canonicalizes and deduplicates hostnames without accepting URLs or ports', () => {
  assert.deepEqual(r.scopeRules('Example.COM\nexample.com\n*.example.com\n[::1]'), ['example.com', '*.example.com', '[::1]']);
  for (const input of ['https://example.com', 'example.com/path', 'example.com:443', 'name@host', 'a..com', '*example.com', 'example.com\\evil', '*.[::1]']) assert.throws(() => r.scopeRules(input));
  assert.throws(() => r.scopeRules(Array.from({ length: 101 }, (_, i) => `${i}.example.com`).join('\n')));
});
test('scope respects DNS boundaries and exclusions, and defaults to nothing in scope', () => {
  const scope = { include: r.scopeRules('example.com\n*.example.com'), exclude: r.scopeRules('private.example.com') };
  for (const url of ['https://example.com:443/a', 'http://api.example.com/a']) assert.equal(r.inScope(url, scope), true);
  for (const url of ['https://evil-example.com', 'https://example.com.evil.test', 'https://private.example.com', 'file://example.com', 'bad']) assert.equal(r.inScope(url, scope), false);
  assert.equal(r.inScope('https://example.com'), false);
  assert.equal(r.inScope('https://example.com', { include: ['*.example.com'] }), false);
});
test('scope restrictions are session-only and fail closed when interception scope is empty', () => {
  const scope = require('../src/main/research-scope');
  assert.equal(scope.allows('https://example.com'), true);
  assert.throws(() => scope.set({ onlyIntercept: true }), /emptyScope/);
  scope.set({ include: 'example.com', onlyIntercept: true });
  assert.equal(scope.allows('https://example.com'), true);
  assert.equal(scope.allows('https://other.test'), false);
  const value = scope.get(); value.include.push('other.test');
  assert.equal(scope.allows('https://other.test'), false);
  scope.set({});
});
test('offline transforms round-trip Unicode and reject malformed input', async () => {
  const text = 'فتحي / café / <script>';
  assert.equal(await r.transform('base64Decode', await r.transform('base64Encode', text)), text);
  assert.equal(await r.transform('urlDecode', await r.transform('urlEncode', text)), text);
  assert.equal(await r.transform('json', '{"a":1}'), '{\n  "a": 1\n}');
  assert.equal(await r.transform('sha256', 'abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  for (const [op, input] of [['base64Decode', '%%%'], ['base64Decode', '/w=='], ['json', '{'], ['urlDecode', '%zz'], ['jwt', 'one.two'], ['none', 'a'], ['sha256', 'a'.repeat(65537)]]) await assert.rejects(r.transform(op, input));
});
test('JWT inspection never claims to verify a signature', async () => {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const token = `${b64({ alg: 'none' })}.${b64({ sub: 'test', exp: 1 })}.`;
  const result = JSON.parse(await r.transform('jwt', token));
  assert.equal(result.signatureVerified, false);
  assert.equal(result.payload.sub, 'test');
  await assert.rejects(r.transform('jwt', `${b64([])}.${b64({})}.x`));
});
test('passive findings are contextual, bounded and never expose cookie values', () => {
  const record = { url: 'https://example.com', status: 200, mimeType: 'text/html', responseHeaders: { 'Set-Cookie': 'sid=super-secret; SameSite=None\npublic=another-secret; Secure', Server: 'test' } };
  const findings = r.audit(record);
  assert(findings.some((f) => f.id === 'cookieNone'));
  assert(findings.some((f) => f.id === 'csp'));
  assert(!JSON.stringify(findings).includes('super-secret'));
  assert(!JSON.stringify(findings).includes('another-secret'));
  assert.equal(r.audit({ ...record, status: 0 }).length, 0);
  assert(!r.audit({ ...record, mimeType: 'application/json', responseHeaders: {} }).some((f) => f.id === 'csp'));
  const hardened = { 'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'", 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains', 'X-Content-Type-Options': 'nosniff' };
  assert.deepEqual(r.audit({ ...record, responseHeaders: hardened }), []);
});
test('redaction omits URL paths, query values, fragments, userinfo, headers and bodies without mutating originals', () => {
  const rec = { url: 'https://user:pass@example.com/reset/secret?token=secret#secret', method: 'POST', status: 200, requestHeaders: { Authorization: 'secret', 'X-Custom': 'secret' }, responseHeaders: { 'Set-Cookie': 'secret' }, postData: 'secret', body: 'secret', errorText: 'secret' };
  const output = JSON.stringify(r.safeRecord(rec));
  for (const secret of ['secret', 'user:', 'pass@']) assert(!output.includes(secret));
  assert(output.includes('example.com'));
  assert.equal(rec.body, 'secret');
});
test('comparison normalizes header names, handles absent bodies and bounds preview size', () => {
  const before = { status: 200, responseHeaders: { Server: 'a' }, body: 'prefix-old-suffix' };
  const after = { status: 403, responseHeaders: { server: 'b', Vary: 'Origin' }, body: 'prefix-new-suffix' };
  const diff = r.compare(before, after);
  assert.equal(diff.headers.length, 2);
  assert.equal(diff.before, 'old'); assert.equal(diff.after, 'new');
  assert.equal(r.compare(before, before).identical, true);
  assert.equal(r.compare({}, before).bodyAvailable, false);
  assert.equal(r.compare({ body: '' }, { body: 'x'.repeat(10000) }).clipped, true);
  assert.equal(r.compare({ body: '' }, { body: 'x'.repeat(10000) }).after.length, 8192);
});

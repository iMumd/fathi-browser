'use strict';
const { X509Certificate } = require('node:crypto');
const { isIP } = require('node:net');
function valid(cert) { const now = Date.now(); return now >= Date.parse(cert.validFrom) && now <= Date.parse(cert.validTo); }
function parseCa(data) {
  const ca = new X509Certificate(data);
  if (!ca.ca || !valid(ca)) throw new Error('Select a currently valid CA certificate');
  return ca;
}
function verifies(request, pem) {
  try {
    const root = parseCa(pem);
    const leaf = new X509Certificate(request.certificate.data);
    if (!valid(leaf) || !(isIP(request.hostname) ? leaf.checkIP(request.hostname) : leaf.checkHost(request.hostname))) return false;
    const usages = leaf.keyUsage;
    if (usages?.length && !usages.includes('1.3.6.1.5.5.7.3.1') && !usages.includes('2.5.29.37.0')) return false;
    let node = request.certificate;
    const seen = new Set();
    for (let depth = 0; node && depth < 10; depth++) {
      const cert = new X509Certificate(node.data);
      if (!valid(cert) || seen.has(cert.fingerprint256)) return false;
      seen.add(cert.fingerprint256);
      if (cert.fingerprint256 === root.fingerprint256) return true;
      if (cert.checkIssued(root) && cert.verify(root.publicKey)) return true;
      const issuer = node.issuerCert;
      if (!issuer) return false;
      const next = new X509Certificate(issuer.data);
      if (!next.ca || !cert.checkIssued(next) || !cert.verify(next.publicKey)) return false;
      node = issuer;
    }
  } catch {}
  return false;
}
module.exports = { parseCa, verifies };

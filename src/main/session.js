}

/* ------------------------------------------------------------ certificate */

/**
 * Optional: trust certificates issued by Burp Suite's PortSwigger CA so HTTPS
 * traffic can be intercepted without installing anything system-wide.
 * Only active when proxy.trustBurpCert is on; every other cert uses Chromium's
 * normal verification.
 */
function applyCertTrust(ses) {
  try {
    const cfg = settings.get().proxy || {};
    if (!cfg.trustBurpCert) {
      ses.setCertificateVerifyProc(null);
      return;
    }
    ses.setCertificateVerifyProc((request, callback) => {
      const c = request.certificate || {};
      const names = [
        c.issuerName,
        c.issuer && c.issuer.commonName,
        c.issuer && c.issuer.organizationName,
        c.subjectName,
        c.subject && c.subject.commonName
      ].filter(Boolean).join(' ');
      if (/portswigger/i.test(names)) return callback(0);
      callback(-3); // fall back to the default verification
    });
  } catch (e) {
    console.error('[session] cert trust', e);
  }
}

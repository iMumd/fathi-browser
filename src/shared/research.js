'use strict';
/* Pure, offline research helpers shared by the application and unit tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Research = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const MAX_INPUT = 65536;
  function scopeRules(text) {
    const lines = String(text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (lines.length > 100) throw new Error('research.tooManyTargets');
    return [...new Set(lines.map((line) => {
      const wildcard = line.startsWith('*.');
      const host = wildcard ? line.slice(2) : line;
      if (/[\s/?#@\\]/.test(host) || host.includes('*') || (host.includes(':') && !(host.startsWith('[') && host.endsWith(']'))) || (wildcard && host.startsWith('['))) throw new Error('research.invalidTarget');
      let url;
      try { url = new URL('https://' + host); } catch { throw new Error('research.invalidTarget'); }
      if (!url.hostname || url.port || url.username || url.password || url.pathname !== '/' || url.host.endsWith(':')) throw new Error('research.invalidTarget');
      const canonical = url.hostname.toLowerCase().replace(/\.$/, '');
      if (!canonical.startsWith('[') && !canonical.split('.').every((part) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part))) throw new Error('research.invalidTarget');
      return (wildcard ? '*.' : '') + url.hostname.toLowerCase().replace(/\.$/, '');
    }))];
  }
  function inScope(url, scope = {}) {
    let host;
    try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) return false; host = u.hostname.toLowerCase().replace(/\.$/, ''); } catch { return false; }
    const match = (rule) => rule.startsWith('*.') ? host.endsWith('.' + rule.slice(2)) : host === rule;
    return (scope.include || []).some(match) && !(scope.exclude || []).some(match);
  }
  function headers(value) {
    return Object.fromEntries(Object.entries(value || {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
  }
  function audit(record) {
    const out = [];
    let url;
    try { url = new URL(record.url); } catch { return out; }
    if (!/^https?:$/.test(url.protocol) || !record.status) return out;
    const h = headers(record.responseHeaders);
    const html = /text\/html|application\/xhtml\+xml/i.test(record.mimeType || h['content-type'] || '');
    const add = (id, level, evidence) => out.push({ id, level, evidence });
    if (url.protocol === 'http:') add('plaintext', 'medium', 'HTTP');
    if (html && !h['content-security-policy']) add('csp', 'low', 'Content-Security-Policy');
    if (html && !h['x-frame-options'] && !/(?:^|;)\s*frame-ancestors\s+[^;]+/i.test(h['content-security-policy'] || '')) add('framing', 'low', 'X-Frame-Options / frame-ancestors');
    if (html && (h['x-content-type-options'] || '').trim().toLowerCase() !== 'nosniff') add('nosniff', 'low', 'X-Content-Type-Options');
    if (url.protocol === 'https:' && html && !/(?:^|;)\s*max-age\s*=\s*"?[1-9]\d*"?\s*(?:;|$)/i.test(h['strict-transport-security'] || '')) add('hsts', 'low', 'Strict-Transport-Security');
    if (h['access-control-allow-origin'] === '*' && h['access-control-allow-credentials'] === 'true') add('cors', 'info', 'Access-Control-Allow-Origin: *; Access-Control-Allow-Credentials: true');
    if (h['server'] || h['x-powered-by']) add('disclosure', 'info', Object.keys(h).filter((k) => k === 'server' || k === 'x-powered-by').join(', '));
    // CDP separates repeated Set-Cookie headers with newlines, not commas.
    for (const cookie of (h['set-cookie'] || '').split(/\r?\n/).slice(0, 20)) {
      if (!cookie.includes('=')) continue;
      const name = cookie.slice(0, cookie.indexOf('=')).trim().slice(0, 100);
      const attrs = cookie.split(';').slice(1).map((v) => v.trim().toLowerCase());
      if (url.protocol === 'https:' && !attrs.includes('secure')) add('cookieSecure', 'low', name);
      if (!attrs.includes('httponly')) add('cookieHttpOnly', 'info', name);
      if (!attrs.some((v) => /^samesite=(strict|lax|none)$/.test(v))) add('cookieSameSite', 'low', name);
      if (attrs.includes('samesite=none') && !attrs.includes('secure')) add('cookieNone', 'medium', name);
    }
    return out.slice(0, 40);
  }
  function safeRecord(record) {
    let url = '[invalid URL]';
    try {
      const u = new URL(record.url);
      u.username = ''; u.password = ''; u.hash = '';
      // Paths may contain identifiers, reset tokens and other secrets too.
      url = u.origin + '/[path omitted]';
    } catch {}
    const safeHeaders = (value) => Object.fromEntries(Object.entries(value || {}).map(([key]) => [key, '[value omitted]']));
    return { method: record.method, url, status: record.status, mimeType: record.mimeType,
      resourceType: record.resourceType, size: record.size || 0,
      requestHeaders: safeHeaders(record.requestHeaders), responseHeaders: safeHeaders(record.responseHeaders),
      bodies: '[omitted]', note: 'Review before sharing. Hostnames and header names remain visible.' };
  }
  function compare(before, after) {
    const a = headers(before.responseHeaders); const b = headers(after.responseHeaders);
    const changes = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().filter((key) => a[key] !== b[key]).map((name) => ({ name, before: a[name] ?? null, after: b[name] ?? null }));
    const left = typeof before.body === 'string' ? before.body : null;
    const right = typeof after.body === 'string' ? after.body : null;
    let prefix = 0; let suffix = 0;
    if (left !== null && right !== null) {
      while (prefix < Math.min(left.length, right.length) && left[prefix] === right[prefix]) prefix++;
      while (suffix < Math.min(left.length, right.length) - prefix && left[left.length - 1 - suffix] === right[right.length - 1 - suffix]) suffix++;
    }
    return { statusBefore: before.status, statusAfter: after.status, headers: changes,
      bodyAvailable: left !== null && right !== null,
      identical: left !== null && right !== null && left === right,
      before: left === null ? null : left.slice(prefix, left.length - suffix).slice(0, 8192),
      after: right === null ? null : right.slice(prefix, right.length - suffix).slice(0, 8192),
      clipped: (left?.length || 0) - prefix - suffix > 8192 || (right?.length || 0) - prefix - suffix > 8192,
      truncated: !!before.bodyTruncated || !!after.bodyTruncated };
  }
  const encode = (s) => {
    let binary = ''; for (const byte of new TextEncoder().encode(s)) binary += String.fromCharCode(byte);
    return btoa(binary);
  };
  const decode = (s, url = false) => {
    let value = s.trim();
    if (url) value = value.replace(/-/g, '+').replace(/_/g, '/');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) throw new Error('research.invalidBase64');
    try { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(value), (c) => c.charCodeAt(0))); }
    catch { throw new Error('research.invalidBase64'); }
  };
  async function transform(operation, input) {
    if (typeof input !== 'string' || input.length > MAX_INPUT) throw new Error('research.inputLimit');
    switch (operation) {
      case 'base64Encode': return encode(input);
      case 'base64Decode': return decode(input);
      case 'urlEncode': return encodeURIComponent(input);
      case 'urlDecode': try { return decodeURIComponent(input); } catch { throw new Error('research.invalidUrl'); }
      case 'json': try { return JSON.stringify(JSON.parse(input), null, 2); } catch { throw new Error('research.invalidJson'); }
      case 'sha256': return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))), (v) => v.toString(16).padStart(2, '0')).join('');
      case 'jwt': {
        const parts = input.trim().split('.');
        if (parts.length !== 3 || !parts[0] || !parts[1]) throw new Error('research.invalidJwt');
        try {
          const header = JSON.parse(decode(parts[0], true)); const payload = JSON.parse(decode(parts[1], true));
          if (!header || typeof header !== 'object' || Array.isArray(header) || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error();
          return JSON.stringify({ signatureVerified: false, header, payload }, null, 2);
        } catch { throw new Error('research.invalidJwt'); }
      }
      default: throw new Error('research.invalidOperation');
    }
  }
  return { scopeRules, inScope, audit, safeRecord, compare, transform, MAX_INPUT };
});

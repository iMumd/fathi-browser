}

function httpVersion(rec) {
  return rec.protocol ? rec.protocol.replace('http/', 'HTTP/') : 'HTTP/1.1';
}

function toHarRequest(rec) {
  const headers = Object.entries(rec.requestHeaders || {}).map(([name, value]) => ({ name, value: String(value) }));
  const qs = queryString(rec.url);
  const cookies = [];
  if (rec.requestHeaders && rec.requestHeaders.cookie) {
    for (const part of String(rec.requestHeaders.cookie).split(';')) {
      const i = part.indexOf('=');
      if (i > 0) cookies.push({ name: part.slice(0, i).trim(), value: part.slice(i + 1).trim() });
    }
  }
  const req = {
    method: rec.method,
    url: rec.url,
    httpVersion: httpVersion(rec),
    cookies,
    headers,
    queryString: qs,
    headersSize: headerSize(rec.requestHeaders),
    bodySize: rec.postData ? Buffer.byteLength(rec.postData) : 0
  };
  if (rec.postData) {
    req.postData = { mimeType: (rec.requestHeaders && rec.requestHeaders['content-type']) || '', text: rec.postData };
  }
  return req;
}

function toHarResponse(rec) {
  const headers = Object.entries(rec.extraResponseHeaders || rec.responseHeaders || {})
    .map(([name, value]) => ({ name, value: String(value) }));
  const cookies = [];
  const bodySize = rec.body ? Buffer.byteLength(rec.body) : (rec.size || 0);
  return {
    status: rec.status || 0,
    statusText: rec.statusText || '',
    httpVersion: httpVersion(rec),
    cookies,
    headers,
    content: {
      size: bodySize,
      mimeType: rec.mimeType || 'application/octet-stream',
      text: rec.body != null ? rec.body : ''
    },
    redirectURL: rec.redirectURL || '',
    headersSize: headerSize(rec.responseHeaders),
    bodySize
  };

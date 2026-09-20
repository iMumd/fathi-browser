
  if (lang === 'raw') {
    const path = u ? u.pathname + (u.search || '') : url;
    const host = u ? u.host : '';
    const lines = [`${method} ${path} HTTP/1.1`];
    if (host) lines.push(`Host: ${host}`);
    for (const [k, v] of headers) lines.push(`${k}: ${v}`);
    return lines.join('\n') + (body ? '\n\n' + body : '');
  }

  if (lang === 'python') {
    const hs = headers.map(([k, v]) => `    ${dq(k)}: ${dq(v)},`).join('\n');
    return [
      'import requests',
      '',
      `url = ${dq(url)}`,
      'headers = {',
      hs,
      '}',
      body ? `payload = ${dq(body)}` : 'payload = None',
      '',
      `resp = requests.request(${dq(method)}, url, headers=headers, data=payload, timeout=30)`,
      'print(resp.status_code)',
      'print(resp.text)'
    ].join('\n');
  }

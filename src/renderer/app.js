
  if (lang === 'python-http') {
    const secure = u && u.protocol === 'http:' ? 'HTTP' : 'HTTPS';
    const host = u ? u.hostname : '';
    const port = u && u.port ? Number(u.port) : 0;
    const path = u ? u.pathname + (u.search || '') : '/';
    const hs = headers.map(([k, v]) => `    ${dq(k)}: ${dq(v)},`).join('\n');
    return [
      'import http.client',
      '',
      `host = ${dq(host)}`,
      `path = ${dq(path)}`,
      `conn = http.client.${secure}Connection(host${port ? ', ' + port : ''}, timeout=30)`,
      `body = ${body ? dq(body) : 'None'}`,
      'headers = {',
      hs,
      '}',
      '',
      `conn.request(${dq(method)}, path, body=body, headers=headers)`,
      'res = conn.getresponse()',
      'print(res.status, res.reason)',
      'print(res.read().decode("utf-8", "replace"))',
      'conn.close()'
    ].join('\n');
  }

  if (lang === 'php') {
    const hs = headers.map(([k, v]) => `        ${dq(k + ': ' + v)},`).join('\n');
    return [
      '<?php',
      '$ch = curl_init();',
      'curl_setopt_array($ch, [',
      `    CURLOPT_URL => ${dq(url)},`,
      '    CURLOPT_RETURNTRANSFER => true,',
      `    CURLOPT_CUSTOMREQUEST => ${dq(method)},`,
      '    CURLOPT_HTTPHEADER => [',
      hs,
      '    ],',
      body ? `    CURLOPT_POSTFIELDS => ${dq(body)},` : null,
      ']);',
      '$response = curl_exec($ch);',
      '$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);',
      'curl_close($ch);',
      'echo $status . "\\n" . $response;'
    ].filter((x) => x !== null).join('\n');
  }

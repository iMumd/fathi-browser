
  if (lang === 'node') {
    const hs = headers.map(([k, v]) => `    ${dq(k)}: ${dq(v)},`).join('\n');
    return [
      'const res = await fetch(' + dq(url) + ', {',
      `  method: ${dq(method)},`,
      '  headers: {',
      hs,
      '  },',
      body ? `  body: ${dq(body)},` : null,
      '});',
      'console.log(res.status);',
      'console.log(await res.text());'
    ].filter((x) => x !== null).join('\n');
  }

  if (lang === 'powershell') {
    const hs = headers.map(([k, v]) => `    ${dq(k)} = ${dq(v)}`).join('\n');
    return [
      '$headers = @{',
      hs,
      '}',
      body ? `$body = @'\n${body}\n'@` : '$body = $null',
      '',
      `$r = Invoke-WebRequest -Uri ${dq(url)} -Method ${method} -Headers $headers -Body $body`,
      '$r.StatusCode',
      '$r.Content'
    ].join('\n');
  }

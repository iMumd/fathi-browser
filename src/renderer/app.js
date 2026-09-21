
  if (lang === 'go') {
    const hs = headers.map(([k, v]) => `  req.Header.Set(${dq(k)}, ${dq(v)})`).join('\n');
    return [
      'package main',
      '',
      'import (',
      '  "fmt"',
      '  "io"',
      '  "net/http"',
      '  "strings"',
      '  "time"',
      ')',
      '',
      'func main() {',
      body ? `  body := strings.NewReader(${goq(body)})` : '  var body io.Reader',
      `  req, err := http.NewRequest(${dq(method)}, ${dq(url)}, body)`,
      '  if err != nil { panic(err) }',
      hs,
      '  res, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)',
      '  if err != nil { panic(err) }',
      '  defer res.Body.Close()',
      '  out, _ := io.ReadAll(res.Body)',
      '  fmt.Println(res.Status)',
      '  fmt.Println(string(out))',
      '}'
    ].filter((x) => x !== '' || true).join('\n');
  }

  // cURL is the default
  const parts = [`curl -X ${method} ${shq(url)}`];
  for (const [k, v] of headers) parts.push(`  -H ${shq(k + ': ' + v)}`);
  if (body) parts.push(`  --data-raw ${shq(body)}`);
  parts.push('  --compressed --insecure -sS');
  return parts.join(' \\\n');

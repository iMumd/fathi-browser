'use strict';
const http = require('node:http');
const { parseCa } = require('./certificate-trust');
/** Fetch only through the explicitly selected loopback HTTP proxy. */
function fetchCa(entry) {
  if (!entry || entry.scheme !== 'http' || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(entry.host.toLowerCase())) return Promise.reject(new Error('Automatic CA import requires a loopback HTTP Burp proxy'));
  return new Promise((resolve, reject) => {
    const headers = { Host: 'burp', Connection: 'close' };
    if (entry.username) headers['Proxy-Authorization'] = 'Basic ' + Buffer.from(`${entry.username}:${entry.password || ''}`).toString('base64');
    const request = http.request({ hostname: entry.host.replace(/^\[|\]$/g, ''), port: entry.port, method: 'GET', path: 'http://burp/cert', headers, agent: false }, (response) => {
      if (response.statusCode !== 200) { response.resume(); reject(new Error('Burp did not return a CA certificate')); return; }
      const chunks = []; let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > 65536) { request.destroy(new Error('CA certificate exceeds 64 KiB')); return; }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => { try { resolve(parseCa(Buffer.concat(chunks))); } catch (error) { reject(error); } });
    });
    request.setTimeout(5000, () => request.destroy(new Error('Burp CA download timed out. Confirm Burp is listening locally.')));
    request.on('error', reject); request.end();
  });
}
module.exports = { fetchCa };

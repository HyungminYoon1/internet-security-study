import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';

test('preview server exposes dist only, rejects unsafe methods and survives malformed paths', async () => {
  const child = spawn(process.execPath, ['tools/serve.mjs', '0'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  try {
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 10000);
      child.stdout.on('data', chunk => { const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timeout); resolve(match[0]); } });
      child.once('error', error => { clearTimeout(timeout); reject(error); });
    });
    async function request(path, method = 'GET') {
      return new Promise((resolve, reject) => {
        const req = http.request(base, { path, method }, response => {
          const chunks = []; response.on('data', chunk => chunks.push(chunk));
          response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') }));
        }); req.on('error', reject); req.end();
      });
    }
    assert.equal((await request('/')).status, 200);
    const head = await request('/', 'HEAD'); assert.equal(head.status, 200); assert.equal(head.body, '');
    assert.equal((await request('/', 'POST')).status, 405);
    for (const path of ['/package.json', '/architecture.md', '/.git/config', '/%2e%2e%2fpackage.json', '/%5c..%5cpackage.json', '/%00', '/%invalid']) assert.notEqual((await request(path)).status, 200, path);
    const content = await request('/content/week-01.json'); assert.equal(content.status, 200);
    assert.match(content.headers['content-type'], /application\/json/); assert.equal(JSON.parse(content.body).number, 1);
    assert.equal(content.headers['x-content-type-options'], 'nosniff'); assert.equal(content.headers['cache-control'], 'no-store');
  } finally { child.kill(); }
});

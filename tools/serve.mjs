import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
const root = resolve('dist'), port = Number(process.argv[2] ?? 0);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new RangeError('Invalid port');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    const url = new URL(request.url, 'http://localhost'), pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('\\') || pathname.includes('\0')) { response.writeHead(400).end(); return; }
    const path = resolve(root, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
    if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404).end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${server.address().port}/`));

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = process.argv.includes('--dist') ? path.join(project, 'dist') : project;
const testing = process.argv.includes('--test');
const port = testing ? 5174 : Number(process.env.PORT || 5173);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    // Only serve application assets, never repository metadata or local documents.
    const testAsset = testing && ['/tests/browser.html', '/tests/browser.js'].includes(pathname);
    if (!(pathname === '/' || pathname === '/index.html' || /^\/(src|public)\//.test(pathname) || testAsset)) {
      res.writeHead(404).end('Not found'); return;
    }
    const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !(await stat(file)).isFile()) {
      res.writeHead(404).end('Not found'); return;
    }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, process.env.HOST || '0.0.0.0', () => console.log(`拾语已启动：http://127.0.0.1:${port}${testing ? '/tests/browser.html' : ''}（局域网可用本机内网 IP 访问）`));

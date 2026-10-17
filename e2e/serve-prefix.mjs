// Serves a built app under a URL prefix (like a shared host does, e.g. /s/my-proto/), with
// an SPA fallback to index.html. Usage: node e2e/serve-prefix.mjs <dir> <prefix> <port>
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const [dir, prefix = '/s/my-proto/', port = '4318'] = process.argv.slice(2);
const root = resolve(dir);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith(prefix)) {
    res.writeHead(404).end('not found');
    return;
  }
  let file = join(root, normalize(url.pathname.slice(prefix.length)));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(root, 'index.html');
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(Number(port), '127.0.0.1');

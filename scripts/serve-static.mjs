// A tiny static server for trying production builds locally — no dependencies.
//
//   node scripts/serve-static.mjs <dir> <port> [--cors]
//
// Unknown paths fall back to index.html (an SPA), responses are gzipped when the
// browser accepts it (as Vercel compresses them), and --cors adds
// `Access-Control-Allow-Origin: *`, as a remote's host must (Vercel does it with
// the headers in apps/dashboard-reviews/vercel.json).
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { createGzip } from 'node:zlib';

const [dir, port, flag] = process.argv.slice(2);
if (!dir || !port) {
  console.error('usage: node scripts/serve-static.mjs <dir> <port> [--cors]');
  process.exit(1);
}
const root = resolve(dir);
const cors = flag === '--cors';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function fileFor(urlPath) {
  const path = normalize(join(root, decodeURIComponent(urlPath)));
  if (!path.startsWith(root)) return undefined;
  try {
    return statSync(path).isFile() ? path : undefined;
  } catch {
    return undefined;
  }
}

createServer((req, res) => {
  const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname;
  // Unknown paths without an extension are app routes: serve index.html.
  const file = fileFor(urlPath) ?? (extname(urlPath) ? undefined : join(root, 'index.html'));
  if (cors) res.setHeader('Access-Control-Allow-Origin', '*');
  if (!file) {
    res.writeHead(404).end();
    return;
  }
  const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
    Vary: 'Accept-Encoding',
    ...(gzip && { 'Content-Encoding': 'gzip' }),
  });
  const stream = createReadStream(file);
  (gzip ? stream.pipe(createGzip()) : stream).pipe(res);
}).listen(Number(port), () => console.log(`${root} → http://localhost:${port}`));

/**
 * Production HTTP server: serves Vite `dist/` and mounts Airtable-backed `/api/events`.
 * Use this on Railway (or any Node host) instead of `vite preview`, which does not run API routes.
 */
import 'dotenv/config';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import eventsHandler from './api/events';
import { incomingMessageToWebRequest, writeWebResponseToNode } from './api/_lib/nodeHttpAdapter';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distDir = resolve(__dirname, 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.map': 'application/json',
};

const PORT = Number(process.env.PORT) || 4173;

function safeFileUnderRoot(root: string, urlPathname: string): string | null {
  const relative = urlPathname.replace(/^\/+/, '');
  if (!relative || relative.includes('..')) {
    return null;
  }
  const abs = resolve(root, relative);
  const rootResolved = resolve(root);
  if (!abs.startsWith(rootResolved + '/') && abs !== rootResolved) {
    return null;
  }
  return abs;
}

const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host || `localhost:${PORT}`;
    const origin = `http://${host}`;
    const url = new URL(req.url || '/', origin);

    if (url.pathname === '/health') {
      res.statusCode = 200;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end('ok');
      return;
    }

    if (url.pathname === '/api/events') {
      const request = await incomingMessageToWebRequest(req, origin);
      const response = await eventsHandler(request);
      await writeWebResponseToNode(res, response);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      res.setHeader('allow', 'GET, HEAD');
      res.end('Method Not Allowed');
      return;
    }

    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = safeFileUnderRoot(distDir, pathname);

    if (filePath) {
      try {
        const data = await readFile(filePath);
        const ext = extname(filePath);
        res.statusCode = 200;
        res.setHeader('content-type', MIME[ext] || 'application/octet-stream');
        res.end(data);
        return;
      } catch {
        // fall through to SPA fallback
      }
    }

    const html = await readFile(join(distDir, 'index.html'));
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(html);
  } catch (error) {
    console.error('[server]', error);
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end("Database can't be reached.");
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT} (dist + /api/events)`);
});

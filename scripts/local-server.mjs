import http from 'http';
import fs from 'fs';
import path from 'path';
import https from 'https';

const PORT = 3050;
const OUT_DIR = path.resolve('out');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = parsedUrl.pathname;

  // 1. Proxy /api to live production backend (real MySQL & real data)
  if (pathname.startsWith('/api/')) {
    const targetUrl = `https://ticketfestival.tupartnerti.cl${pathname}${parsedUrl.search}`;
    const proxyReq = https.request(
      targetUrl,
      {
        method: req.method,
        headers: {
          ...req.headers,
          host: 'ticketfestival.tupartnerti.cl',
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      }
    );

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Proxy Error: ' + err.message);
    });

    req.pipe(proxyReq, { end: true });
    return;
  }

  // 2. Serve static files from out/ (Windows safe path handling)
  const safeRelativePath = pathname.replace(/^\/+/, '');
  let filePath = path.join(OUT_DIR, safeRelativePath);

  if (fs.existsSync(filePath + '.html') && fs.statSync(filePath + '.html').isFile()) {
    filePath = filePath + '.html';
  } else if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const indexFile = path.join(filePath, 'index.html');
    if (fs.existsSync(indexFile)) {
      filePath = indexFile;
    }
  } else if (!fs.existsSync(filePath)) {
    filePath = path.join(OUT_DIR, '404.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Local review server running at http://localhost:${PORT}`);
});

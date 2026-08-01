import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function deploy() {
  const client = new ftp.Client();
  client.ftp.verbose = true;

  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;

  const localDir = path.resolve(process.cwd(), 'out');

  console.log(`[FTP DEPLOY] 🚀 Deploying "${localDir}" to ${host}:${port} (/festival)...`);

  try {
    await client.access({
      host,
      user,
      password,
      port,
      secure: false,
    });

    console.log('[FTP DEPLOY] ✅ FTP Connected.');

    // 1. Upload static export build to '/festival'
    console.log('[FTP DEPLOY] Syncing build files to "/festival"...');
    await client.ensureDir('/festival');
    await client.uploadFromDir(localDir);

    // 2. Upload root redirect index.html & .htaccess to '/'
    console.log('[FTP DEPLOY] Uploading root redirect to "/"...');
    const redirectHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=/festival/">
  <script>window.location.replace("/festival/");</script>
  <title>Ticket Festival Nacional Danza del Vientre Chile 2026</title>
</head>
<body style="background:#1A1333;color:white;font-family:sans-serif;text-align:center;padding-top:20%;">
  <p>Redirigiendo a Ticket Festival... <a href="/festival/" style="color:#F59E0B">Haz clic aquí</a></p>
</body>
</html>`;

    const rootHtaccess = `Options -Indexes
DirectoryIndex index.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^$ festival/ [L,R=301]
</IfModule>`;

    const tmpIndex = path.resolve(process.cwd(), 'tmp_root_index.html');
    const tmpHtaccess = path.resolve(process.cwd(), 'tmp_root_htaccess');

    fs.writeFileSync(tmpIndex, redirectHtml);
    fs.writeFileSync(tmpHtaccess, rootHtaccess);

    await client.ensureDir('/');
    await client.uploadFrom(tmpIndex, '/index.html');
    await client.uploadFrom(tmpHtaccess, '/.htaccess');

    if (fs.existsSync(tmpIndex)) fs.unlinkSync(tmpIndex);
    if (fs.existsSync(tmpHtaccess)) fs.unlinkSync(tmpHtaccess);

    console.log('[FTP DEPLOY] 🎉 DEPLOYMENT & CSS FIX COMPLETED SUCCESSFULLY!');
    console.log(`[FTP DEPLOY] Live URL: https://ticketfestival.tupartnerti.cl`);
  } catch (err) {
    console.error('[FTP DEPLOY] ❌ Deployment failed:', err);
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy();

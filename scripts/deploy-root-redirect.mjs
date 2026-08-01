import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function deployRootRedirect() {
  const client = new ftp.Client();
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;

  const redirectHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=/festival/">
  <script>window.location.replace("/festival/");</script>
  <title>Ticket Festival Nacional Danza del Vientre Chile 2026</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #1A1333; color: white; display: flex; items-align: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    a { color: #F59E0B; font-weight: bold; }
  </style>
</head>
<body>
  <div>
    <h2>Cargando Ticket Festival 2026...</h2>
    <p><a href="/festival/">Haz clic aquí para ingresar</a></p>
  </div>
</body>
</html>`;

  const tmpPath = path.resolve(process.cwd(), 'temp_root_index.html');
  fs.writeFileSync(tmpPath, redirectHtml);

  try {
    await client.access({ host, user, password, port });
    console.log('[ROOT REDIRECT] Uploading root index.html to /...');
    await client.uploadFrom(tmpPath, '/index.html');
    console.log('[ROOT REDIRECT] ✅ Root index.html uploaded successfully!');
  } catch (err) {
    console.error('[ROOT REDIRECT] Error:', err);
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    client.close();
  }
}

deployRootRedirect();

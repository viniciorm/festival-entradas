import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function uploadRootIndex() {
  const client = new ftp.Client();
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;

  try {
    await client.access({ host, user, password, port });
    console.log('[FTP INDEX] Connected.');

    const redirectHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=festival/">
  <script>window.location.replace("festival/");</script>
  <title>Ticket Festival Nacional Danza del Vientre Chile 2026</title>
</head>
<body style="background:#1A1333;color:white;font-family:sans-serif;text-align:center;padding-top:20%;">
  <p>Cargando Ticket Festival... <a href="festival/" style="color:#F59E0B">Haz clic aquí para ingresar</a></p>
</body>
</html>`;

    const tmpPath = path.join(process.cwd(), 'tmp_root_index.html');
    fs.writeFileSync(tmpPath, redirectHtml);

    await client.ensureDir('/');
    await client.uploadFrom(tmpPath, 'index.html');
    await client.send('SITE CHMOD 644 /index.html');

    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    console.log('[FTP INDEX] Root index.html uploaded.');

  } catch (err) {
    console.error('[FTP INDEX] Error:', err);
  } finally {
    client.close();
  }
}

uploadRootIndex();

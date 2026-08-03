import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function uploadRootRedirect() {
  const client = new ftp.Client();
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;

  try {
    await client.access({ host, user, password, port });
    console.log('[FTP REDIRECT] Connected.');

    const htaccessContent = `Options -Indexes
DirectoryIndex festival/index.html index.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^$ festival/ [L,R=301]
</IfModule>`;

    const tmpPath = path.join(process.cwd(), 'tmp_htaccess_root');
    fs.writeFileSync(tmpPath, htaccessContent);

    await client.ensureDir('/');
    await client.uploadFrom(tmpPath, '.htaccess');
    await client.send('SITE CHMOD 644 /.htaccess');

    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    console.log('[FTP REDIRECT] Root .htaccess uploaded.');

    // Test fetch root
    const r = await fetch('https://ticketfestival.tupartnerti.cl/', { redirect: 'manual' });
    console.log('Fetch / response status:', r.status);
    console.log('Location header:', r.headers.get('location'));

  } catch (err) {
    console.error('[FTP REDIRECT] Error:', err);
  } finally {
    client.close();
  }
}

uploadRootRedirect();

import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function setNoCacheHtaccess() {
  const client = new ftp.Client();
  await client.access({ host: process.env.FTP_HOST, user: process.env.FTP_USER, password: process.env.FTP_PASS, port: Number(process.env.FTP_PORT) || 21 });

  const htaccessContent = `Options +FollowSymLinks -Indexes
DirectoryIndex index.html

<IfModule mod_headers.c>
  Header set Cache-Control "no-cache, no-store, must-revalidate"
  Header set Pragma "no-cache"
  Header set Expires "0"
  Header set Access-Control-Allow-Origin "*"
</IfModule>

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ index.html [L]
</IfModule>`;

  const tmpPath = path.join(process.cwd(), 'tmp_ht_nocache');
  fs.writeFileSync(tmpPath, htaccessContent);

  await client.ensureDir('/');
  await client.uploadFrom(tmpPath, '.htaccess');
  await client.send('SITE CHMOD 644 /.htaccess');

  await client.ensureDir('/festival');
  await client.uploadFrom(tmpPath, '.htaccess');
  await client.send('SITE CHMOD 644 /festival/.htaccess');

  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

  console.log('[FTP] No-cache .htaccess updated in / and /festival');
  client.close();
}

setNoCacheHtaccess();

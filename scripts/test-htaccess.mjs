import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testHtaccessRules() {
  const client = new ftp.Client();
  await client.access({ host: process.env.FTP_HOST, user: process.env.FTP_USER, password: process.env.FTP_PASS, port: Number(process.env.FTP_PORT) || 21 });

  const htaccessContent = `Options +FollowSymLinks -Indexes
DirectoryIndex index.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ index.html [L]
</IfModule>

<FilesMatch "\.(css|js|woff2|svg)$">
  Header set Access-Control-Allow-Origin "*"
</FilesMatch>`;

  const tmpPath = path.join(process.cwd(), 'tmp_htaccess_test');
  fs.writeFileSync(tmpPath, htaccessContent);

  await client.ensureDir('/festival');
  await client.uploadFrom(tmpPath, '.htaccess');
  await client.send('SITE CHMOD 644 /festival/.htaccess');

  await client.ensureDir('/');
  await client.uploadFrom(tmpPath, '.htaccess');
  await client.send('SITE CHMOD 644 /.htaccess');

  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

  const rCss = await fetch('https://ticketfestival.tupartnerti.cl/festival/_next/static/chunks/1er6jvr3so883.css');
  console.log('Test CSS status after htaccess:', rCss.status);

  client.close();
}

testHtaccessRules();

import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function deployStealthRewrite() {
  const client = new ftp.Client();
  client.ftp.verbose = true;
  await client.access({ host: process.env.FTP_HOST, user: process.env.FTP_USER, password: process.env.FTP_PASS, port: Number(process.env.FTP_PORT) || 21 });

  const localDir = path.resolve(process.cwd(), 'out');

  console.log('[STEALTH DEPLOY] Uploading build output to /festival...');
  await client.ensureDir('/festival');
  await client.uploadFromDir(localDir);

  console.log('[STEALTH DEPLOY] Uploading root .htaccess with internal rewrite...');
  const rootHtaccess = `Options +FollowSymLinks -Indexes
DirectoryIndex festival/index.html index.html

<IfModule mod_headers.c>
  Header set Cache-Control "no-cache, no-store, must-revalidate"
  Header set Pragma "no-cache"
  Header set Expires "0"
  Header set Access-Control-Allow-Origin "*"
</IfModule>

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Internal rewrite from root / to festival/index.html
  RewriteRule ^$ festival/index.html [L]

  # Internal rewrite for _next assets
  RewriteRule ^_next/(.*)$ festival/_next/$1 [L]

  # Internal rewrite for static files
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ festival/$1 [L]
</IfModule>`;

  const tmpPath = path.join(process.cwd(), 'tmp_stealth_ht');
  fs.writeFileSync(tmpPath, rootHtaccess);

  await client.ensureDir('/');
  await client.uploadFrom(tmpPath, '.htaccess');
  await client.send('SITE CHMOD 644 /.htaccess');
  await client.send('SITE CHMOD 755 /festival');
  await client.send('SITE CHMOD 644 /festival/index.html');
  await client.send('SITE CHMOD 755 /festival/_next');

  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

  console.log('[STEALTH DEPLOY] Done! Testing HTTP fetch on https://ticketfestival.tupartnerti.cl/...');

  const rRoot = await fetch('https://ticketfestival.tupartnerti.cl/');
  console.log('Root URL Status:', rRoot.status);
  const text = await rRoot.text();
  console.log('Root URL HTML preview:', text.substring(0, 250));

  const cssMatch = text.match(/href=\u0022([^\u0022]+\.css)\u0022/);
  if (cssMatch) {
    const cssUrl = new URL(cssMatch[1], 'https://ticketfestival.tupartnerti.cl/').href;
    const rCss = await fetch(cssUrl);
    console.log('CSS URL:', cssUrl);
    console.log('CSS Status:', rCss.status, 'Size:', (await rCss.text()).length);
  }

  client.close();
}

deployStealthRewrite();

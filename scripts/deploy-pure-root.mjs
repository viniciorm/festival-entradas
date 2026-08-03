import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function deployPureRoot() {
  const client = new ftp.Client();
  client.ftp.verbose = true;

  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;

  const localDir = path.resolve(process.cwd(), 'out');

  const smtpUser = process.env.SMTP_USER || 'festivalnac.danzadelvientre@gmail.com';
  const smtpPass = process.env.SMTP_PASS || '';

  console.log(`[PURE ROOT DEPLOY] 🧹 Preparing deployment with SMTP user "${smtpUser}"...`);

  // Inject SMTP credentials into out/api/send-tickets.php
  const phpApiPath = path.join(localDir, 'api', 'send-tickets.php');
  if (fs.existsSync(phpApiPath) && smtpPass) {
    let phpContent = fs.readFileSync(phpApiPath, 'utf8');
    phpContent = phpContent.replace(
      /\$smtpUser = getenv\('SMTP_USER'\) \?: '[^']*';/,
      `$smtpUser = '${smtpUser}';`
    );
    phpContent = phpContent.replace(
      /\$smtpPass = getenv\('SMTP_PASS'\) \?: '[^']*';/,
      `$smtpPass = '${smtpPass}';`
    );
    fs.writeFileSync(phpApiPath, phpContent, 'utf8');
    console.log('[PURE ROOT DEPLOY] 🔒 Injected Gmail SMTP credentials into API handler.');
  }

  try {
    await client.access({
      host,
      user,
      password,
      port,
      secure: false,
    });

    console.log('[PURE ROOT DEPLOY] ✅ FTP Connected.');

    // 1. Remove old /festival subfolder completely
    try {
      await client.removeDir('/festival');
    } catch (e) {}

    // 2. Prepare robust root .htaccess
    const htaccessPath = path.join(localDir, '.htaccess');
    const htaccessContent = `Options +FollowSymLinks -Indexes
DirectoryIndex index.html

<IfModule mod_mime.c>
  AddType text/css .css
  AddType application/javascript .js
  AddType image/svg+xml .svg
  AddType font/woff2 .woff2
  AddType application/x-httpd-php .php
</IfModule>

<IfModule mod_headers.c>
  Header set Cache-Control "no-cache, no-store, must-revalidate"
  Header set Pragma "no-cache"
  Header set Expires "0"
  Header set Access-Control-Allow-Origin "*"
</IfModule>

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ index.html [L]
</IfModule>`;

    fs.writeFileSync(htaccessPath, htaccessContent);

    // 3. Upload clean build directly to FTP root '/'
    console.log('[PURE ROOT DEPLOY] Uploading build files to FTP root "/"...');
    await client.ensureDir('/');
    await client.uploadFromDir(localDir);

    // 4. Set CHMOD 755 for directories and 644 for files
    console.log('[PURE ROOT DEPLOY] Setting CHMOD 755 for directories and 644 for files...');
    await chmodRecursive(client, '/');

    console.log('[PURE ROOT DEPLOY] 🎉 PURE ROOT DEPLOYMENT COMPLETED SUCCESSFULLY!');
    console.log(`[PURE ROOT DEPLOY] Live URL: https://ticketfestival.tupartnerti.cl`);
  } catch (err) {
    console.error('[PURE ROOT DEPLOY] ❌ Deployment failed:', err);
    process.exit(1);
  } finally {
    client.close();
  }
}

async function chmodRecursive(client, currentPath) {
  try {
    await client.send(`SITE CHMOD 755 ${currentPath}`);
  } catch (e) {}

  const list = await client.list(currentPath);
  for (const item of list) {
    const itemPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
    if (item.isDirectory) {
      await chmodRecursive(client, itemPath);
    } else {
      try {
        await client.send(`SITE CHMOD 644 ${itemPath}`);
      } catch (e) {}
    }
  }
}

deployPureRoot();

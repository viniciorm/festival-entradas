import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function cleanAndDeployRoot() {
  const client = new ftp.Client();
  client.ftp.verbose = true;

  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;
  const remoteDir = process.env.FTP_REMOTE_DIR || '/';

  const localDir = path.resolve(process.cwd(), 'out');

  console.log(`[ROOT DEPLOY] 🚀 Deploying "${localDir}" directly to FTP root "${remoteDir}"...`);

  try {
    await client.access({
      host,
      user,
      password,
      port,
      secure: false,
    });

    console.log('[ROOT DEPLOY] ✅ FTP Connected.');

    // 1. Create robust root .htaccess in out/
    const htaccessPath = path.join(localDir, '.htaccess');
    const htaccessContent = `Options +FollowSymLinks -Indexes
DirectoryIndex index.html

<IfModule mod_mime.c>
  AddType text/css .css
  AddType application/javascript .js
  AddType image/svg+xml .svg
  AddType font/woff2 .woff2
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

    // 2. Clean up old nested /festival directory if it exists
    try {
      console.log('[ROOT DEPLOY] Cleaning old /festival subfolder...');
      await client.removeDir('/festival');
    } catch (e) {
      console.log('[ROOT DEPLOY] No /festival folder to remove or already clean.');
    }

    // 3. Upload clean out/ build directly to remoteDir '/'
    console.log(`[ROOT DEPLOY] Uploading build files to "${remoteDir}"...`);
    await client.ensureDir(remoteDir);
    await client.uploadFromDir(localDir);

    // 4. Set strict 755/644 permissions on directories and files
    console.log('[ROOT DEPLOY] Setting CHMOD 755 for directories and 644 for files...');
    await chmodRecursive(client, remoteDir);

    console.log('[ROOT DEPLOY] 🎉 ROOT DEPLOYMENT COMPLETED SUCCESSFULLY!');
    console.log(`[ROOT DEPLOY] Live URL: https://ticketfestival.tupartnerti.cl`);
  } catch (err) {
    console.error('[ROOT DEPLOY] ❌ Deployment failed:', err);
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

cleanAndDeployRoot();

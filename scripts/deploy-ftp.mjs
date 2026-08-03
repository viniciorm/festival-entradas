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

  console.log(`[FTP DEPLOY] 🚀 Deploying "${localDir}" to ${host}:${port}...`);

  try {
    await client.access({
      host,
      user,
      password,
      port,
      secure: false,
    });

    console.log('[FTP DEPLOY] ✅ FTP Connected.');

    // Ensure .htaccess in out/
    const htaccessPath = path.join(localDir, '.htaccess');
    const htaccessContent = `Options -Indexes
DirectoryIndex index.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ index.html [L]
</IfModule>`;
    fs.writeFileSync(htaccessPath, htaccessContent);

    // 1. Upload build files to '/festival' (cPanel subdomain DocumentRoot)
    console.log('[FTP DEPLOY] Uploading build files to "/festival"...');
    await client.ensureDir('/festival');
    await client.uploadFromDir(localDir);

    // 2. Upload build files to '/' as well
    console.log('[FTP DEPLOY] Uploading build files to "/"...');
    await client.ensureDir('/');
    await client.uploadFromDir(localDir);

    console.log('[FTP DEPLOY] 🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!');
    console.log(`[FTP DEPLOY] Live URL: https://ticketfestival.tupartnerti.cl`);
  } catch (err) {
    console.error('[FTP DEPLOY] ❌ Deployment failed:', err);
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy();

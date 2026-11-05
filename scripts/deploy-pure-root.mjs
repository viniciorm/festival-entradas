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

  const mysqlHost = process.env.MYSQL_HOST || 'localhost';
  const mysqlDb = process.env.MYSQL_DATABASE || '';
  const mysqlUser = process.env.MYSQL_USER || '';
  const mysqlPass = process.env.MYSQL_PASSWORD || '';

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

  // Inject MySQL credentials into out/api/db_config.php
  const dbConfigPath = path.join(localDir, 'api', 'db_config.php');
  if (fs.existsSync(dbConfigPath) && mysqlDb) {
    let dbContent = fs.readFileSync(dbConfigPath, 'utf8');
    dbContent = dbContent.replace(/define\('DB_HOST', '[^']*'\);/, `define('DB_HOST', '${mysqlHost}');`);
    dbContent = dbContent.replace(/define\('DB_NAME', '[^']*'\);/, `define('DB_NAME', '${mysqlDb}');`);
    dbContent = dbContent.replace(/define\('DB_USER', '[^']*'\);/, `define('DB_USER', '${mysqlUser}');`);
    dbContent = dbContent.replace(/define\('DB_PASS', '[^']*'\);/, `define('DB_PASS', '${mysqlPass}');`);

    const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '628041817016-i3519nl5kh7cfdfcio1jene9qkdqplh4.apps.googleusercontent.com';
    const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
    const googleRedirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'https://ticketfestival.tupartnerti.cl/api/auth/google/callback.php';

    dbContent = dbContent.replace(/define\('GOOGLE_OAUTH_CLIENT_ID', [^;]*\);/, `define('GOOGLE_OAUTH_CLIENT_ID', '${googleClientId}');`);
    dbContent = dbContent.replace(/define\('GOOGLE_OAUTH_CLIENT_SECRET', [^;]*\);/, `define('GOOGLE_OAUTH_CLIENT_SECRET', '${googleClientSecret}');`);
    dbContent = dbContent.replace(/define\('GOOGLE_OAUTH_REDIRECT_URI', [^;]*\);/, `define('GOOGLE_OAUTH_REDIRECT_URI', '${googleRedirectUri}');`);

    fs.writeFileSync(dbConfigPath, dbContent, 'utf8');
    console.log(`[PURE ROOT DEPLOY] 🔒 Injected MySQL and Google OAuth credentials into db_config.php.`);
  }

  try {
    await client.access({
      host,
      user,
      password,
      port,
      secure: true,
      secureOptions: { rejectUnauthorized: false },
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

  <IfModule mod_dir.c>
    DirectorySlash Off
  </IfModule>

  # 1. Internal rewrite for explicit routes (0 redirects, clean URL)
  RewriteRule ^admin/?$ admin.html [QSA,L]
  RewriteRule ^puerta/?$ puerta.html [QSA,L]
  RewriteRule ^mis-entradas/?$ mis-entradas.html [QSA,L]
  RewriteRule ^checkout/?$ checkout.html [QSA,L]

  # 2. Direct rewrite if matching .html file exists in filesystem
  RewriteCond %{DOCUMENT_ROOT}/$1.html -f
  RewriteRule ^(.*)$ $1.html [QSA,L]

  # 3. Do not rewrite existing files, directories or API endpoints
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # 4. Clean HTTP 302 Redirect for any unknown non-existing route back to home "/"
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ / [R=302,L]
</IfModule>`;

    fs.writeFileSync(htaccessPath, htaccessContent);

    // 3. Upload clean build directly to FTP root '/'
    console.log('[PURE ROOT DEPLOY] Uploading build files to FTP root "/"...');
    await client.ensureDir('/');
    await client.uploadFromDir(localDir);

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

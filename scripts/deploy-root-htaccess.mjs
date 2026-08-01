import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function fixRootHtaccess() {
  const client = new ftp.Client();
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;

  const htaccessContent = `# Security & Subdomain Routing Fix
Options -Indexes
DirectoryIndex index.html /festival/index.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  
  # If accessing root directly, serve festival/index.html
  RewriteRule ^$ festival/index.html [L]
  
  # If requested path does not exist in root, proxy/rewrite to festival/
  RewriteCond %{REQUEST_URI} !^/festival/
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ festival/$1 [L,QSA]
</IfModule>
`;

  const tmpPath = path.resolve(process.cwd(), 'temp_root_htaccess');
  fs.writeFileSync(tmpPath, htaccessContent);

  try {
    await client.access({ host, user, password, port });
    console.log('[HTACCESS FIX] Uploading root .htaccess to /...');
    await client.uploadFrom(tmpPath, '/.htaccess');
    console.log('[HTACCESS FIX] ✅ Uploaded successfully!');
  } catch (err) {
    console.error('[HTACCESS FIX] Error:', err);
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    client.close();
  }
}

fixRootHtaccess();

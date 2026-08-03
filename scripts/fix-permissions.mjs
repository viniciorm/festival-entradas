import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function fixPermissions() {
  const client = new ftp.Client();
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;

  try {
    await client.access({ host, user, password, port });
    console.log('[FTP CHMOD] Fixing permissions...');

    // 1. Fix root
    await client.send('SITE CHMOD 755 /');
    await client.send('SITE CHMOD 644 /.htaccess');
    await client.send('SITE CHMOD 644 /index.html');
    await client.send('SITE CHMOD 755 /_next');

    // 2. Fix /festival
    await client.send('SITE CHMOD 755 /festival');
    await client.send('SITE CHMOD 644 /festival/.htaccess');
    await client.send('SITE CHMOD 644 /festival/index.html');
    await client.send('SITE CHMOD 755 /festival/_next');

    console.log('[FTP CHMOD] Permissions updated successfully.');

    // Test fetch
    const r1 = await fetch('https://ticketfestival.tupartnerti.cl/');
    console.log('Fetch / status:', r1.status);
    const html1 = await r1.text();
    console.log('Fetch / preview:', html1.substring(0, 150));

    const r2 = await fetch('https://ticketfestival.tupartnerti.cl/index.html');
    console.log('Fetch /index.html status:', r2.status);

  } catch (err) {
    console.error('[FTP CHMOD] Error:', err);
  } finally {
    client.close();
  }
}

fixPermissions();

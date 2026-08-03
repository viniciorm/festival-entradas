import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testChmod() {
  const client = new ftp.Client();
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;

  try {
    await client.access({ host, user, password, port });
    console.log('[FTP CHMOD] Connected.');

    // Try CHMOD on root-test.txt
    try {
      const res = await client.send('SITE CHMOD 644 root-test.txt');
      console.log('SITE CHMOD 644 result:', res.message);
    } catch (e) {
      console.log('SITE CHMOD failed:', e.message);
    }

    // Try CHMOD on index.html
    try {
      const res = await client.send('SITE CHMOD 644 index.html');
      console.log('SITE CHMOD 644 index.html result:', res.message);
    } catch (e) {
      console.log('SITE CHMOD index.html failed:', e.message);
    }

    // Test fetch again
    const rRoot = await fetch('https://ticketfestival.tupartnerti.cl/root-test.txt');
    console.log('Fetch /root-test.txt after CHMOD:', rRoot.status, rRoot.status === 200 ? await rRoot.text() : '');

    const rIndex = await fetch('https://ticketfestival.tupartnerti.cl/index.html');
    console.log('Fetch /index.html after CHMOD:', rIndex.status);

  } catch (err) {
    console.error('[FTP CHMOD] Error:', err);
  } finally {
    client.close();
  }
}

testChmod();

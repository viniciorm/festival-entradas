import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function uploadAndFixAll() {
  const client = new ftp.Client();
  client.ftp.verbose = true;

  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;

  const localDir = path.resolve(process.cwd(), 'out');

  try {
    await client.access({ host, user, password, port, secure: false });
    console.log('[FTP] Connected.');

    // Upload to /festival
    await client.ensureDir('/festival');
    await client.uploadFromDir(localDir);

    // Chmod /festival and contents
    try { await client.send('SITE CHMOD 755 /festival'); } catch(e){}
    try { await client.send('SITE CHMOD 644 /festival/index.html'); } catch(e){}
    try { await client.send('SITE CHMOD 755 /festival/_next'); } catch(e){}
    try { await client.send('SITE CHMOD 755 /festival/_next/static'); } catch(e){}
    try { await client.send('SITE CHMOD 755 /festival/_next/static/chunks'); } catch(e){}

    const chunks = fs.readdirSync(path.join(localDir, '_next/static/chunks'));
    for (const chunk of chunks) {
      try {
        await client.send(`SITE CHMOD 644 /festival/_next/static/chunks/${chunk}`);
      } catch (e) {}
    }

    console.log('[FTP] Upload and permissions completed!');

    // Test fetch
    const rHtml = await fetch('https://ticketfestival.tupartnerti.cl/festival/index.html');
    console.log('/festival/index.html status:', rHtml.status);

    const rCss = await fetch('https://ticketfestival.tupartnerti.cl/festival/_next/static/chunks/1er6jvr3so883.css');
    console.log('/festival/_next CSS status:', rCss.status);

  } catch (err) {
    console.error('[FTP] Error:', err);
  } finally {
    client.close();
  }
}

uploadAndFixAll();

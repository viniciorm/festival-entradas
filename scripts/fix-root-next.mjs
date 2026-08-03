import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function fixRootNext() {
  const client = new ftp.Client();
  client.ftp.verbose = true;
  await client.access({ host: process.env.FTP_HOST, user: process.env.FTP_USER, password: process.env.FTP_PASS, port: Number(process.env.FTP_PORT) || 21 });

  const localDir = path.resolve(process.cwd(), 'out');
  const localNext = path.join(localDir, '_next');

  console.log('[FTP FIX] Uploading _next to root "/"...');
  await client.ensureDir('/_next');
  await client.uploadFromDir(localNext);

  console.log('[FTP FIX] Applying CHMOD 755/644 to root /_next...');
  try { await client.send('SITE CHMOD 755 /_next'); } catch(e){}
  try { await client.send('SITE CHMOD 755 /_next/static'); } catch(e){}
  try { await client.send('SITE CHMOD 755 /_next/static/chunks'); } catch(e){}

  const chunks = fs.readdirSync(path.join(localNext, 'static/chunks'));
  for (const chunk of chunks) {
    try {
      await client.send(`SITE CHMOD 644 /_next/static/chunks/${chunk}`);
    } catch (e) {}
  }

  console.log('[FTP FIX] Done uploading and setting permissions on root /_next.');

  // Test fetch CSS
  const rCss = await fetch('https://ticketfestival.tupartnerti.cl/_next/static/chunks/1er6jvr3so883.css');
  console.log('ROOT CSS Status:', rCss.status, 'Content-Length:', (await rCss.text()).length);

  client.close();
}

fixRootNext();

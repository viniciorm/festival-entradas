import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function probeServer() {
  const client = new ftp.Client();
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;

  try {
    await client.access({ host, user, password, port });
    console.log('[FTP PROBE] Connected.');

    const tmpRoot = path.join(process.cwd(), 'tmp_root.txt');
    const tmpFest = path.join(process.cwd(), 'tmp_fest.txt');

    fs.writeFileSync(tmpRoot, 'ROOT_MARKER_' + Date.now());
    fs.writeFileSync(tmpFest, 'FESTIVAL_MARKER_' + Date.now());

    await client.ensureDir('/');
    await client.uploadFrom(tmpRoot, 'root-test.txt');

    await client.ensureDir('/festival');
    await client.uploadFrom(tmpFest, 'fest-test.txt');

    if (fs.existsSync(tmpRoot)) fs.unlinkSync(tmpRoot);
    if (fs.existsSync(tmpFest)) fs.unlinkSync(tmpFest);

    console.log('[FTP PROBE] Test markers uploaded successfully.');

    const rRoot = await fetch('https://ticketfestival.tupartnerti.cl/root-test.txt');
    console.log('Fetch /root-test.txt status:', rRoot.status, rRoot.status === 200 ? await rRoot.text() : '');

    const rFest = await fetch('https://ticketfestival.tupartnerti.cl/festival/fest-test.txt');
    console.log('Fetch /festival/fest-test.txt status:', rFest.status, rFest.status === 200 ? await rFest.text() : '');

    const rFestDirect = await fetch('https://ticketfestival.tupartnerti.cl/fest-test.txt');
    console.log('Fetch /fest-test.txt status:', rFestDirect.status, rFestDirect.status === 200 ? await rFestDirect.text() : '');

  } catch (err) {
    console.error('[FTP PROBE] Error:', err);
  } finally {
    client.close();
  }
}

probeServer();

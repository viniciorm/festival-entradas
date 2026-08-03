import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkFtpFiles() {
  const client = new ftp.Client();
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;

  try {
    await client.access({ host, user, password, port });
    console.log('[FTP LIST] Listing root folder (/):');
    const rootList = await client.list('/');
    rootList.forEach((f) => console.log(`  /${f.name} (${f.isDirectory ? 'DIR' : 'FILE'}, size: ${f.size})`));

    console.log('\n[FTP LIST] Listing /festival folder:');
    const festList = await client.list('/festival');
    festList.forEach((f) => console.log(`  /festival/${f.name} (${f.isDirectory ? 'DIR' : 'FILE'}, size: ${f.size})`));
  } catch (err) {
    console.error('[FTP LIST] Error:', err);
  } finally {
    client.close();
  }
}

checkFtpFiles();

import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkFestivalDir() {
  const client = new ftp.Client();
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;

  try {
    await client.access({ host, user, password, port });
    console.log('[FTP CHECK] Listing /festival:');
    const festList = await client.list('/festival');
    console.log(`Found ${festList.length} items inside /festival:`);
    festList.forEach((item) => console.log(`  - ${item.name} (${item.isDirectory ? 'DIR' : 'FILE'})`));
  } catch (err) {
    console.error('[FTP CHECK] Error:', err.message);
  } finally {
    client.close();
  }
}

checkFestivalDir();

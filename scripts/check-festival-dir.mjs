import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkParents() {
  const client = new ftp.Client();
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;

  try {
    await client.access({ host, user, password, port });
    console.log('[FTP PWD]:', await client.pwd());
    
    try {
      await client.cdup();
      console.log('[FTP PWD after CDUP]:', await client.pwd());
      const list = await client.list();
      console.log('Listing parent:', list.map(f => f.name));
    } catch (e) {
      console.log('CDUP not allowed or restricted (jail chroot):', e.message);
    }
  } catch (err) {
    console.error('[FTP CHECK] Error:', err);
  } finally {
    client.close();
  }
}

checkParents();

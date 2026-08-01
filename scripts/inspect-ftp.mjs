import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function inspectFTP() {
  const client = new ftp.Client();
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;

  try {
    await client.access({ host, user, password, port });
    console.log('[INSPECT] Connected. Root listing (/):');
    const rootList = await client.list('/');
    rootList.forEach((item) => console.log(` /${item.name} (${item.isDirectory ? 'DIR' : 'FILE'})`));

    try {
      console.log('\n[INSPECT] Listing /festival:');
      const festList = await client.list('/festival');
      festList.forEach((item) => console.log(` /festival/${item.name} (${item.isDirectory ? 'DIR' : 'FILE'})`));
    } catch (e) {
      console.log('No /festival folder');
    }

    try {
      console.log('\n[INSPECT] Listing /public_html:');
      const pubList = await client.list('/public_html');
      pubList.slice(0, 10).forEach((item) => console.log(` /public_html/${item.name} (${item.isDirectory ? 'DIR' : 'FILE'})`));
    } catch (e) {
      console.log('No /public_html folder');
    }
  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    client.close();
  }
}

inspectFTP();

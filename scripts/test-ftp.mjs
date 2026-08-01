import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testConnection() {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;
  const remoteDir = process.env.FTP_REMOTE_DIR || '/';

  console.log(`[FTP TEST] Connecting to ${host}:${port} as ${user}...`);

  try {
    await client.access({
      host,
      user,
      password,
      port,
      secure: false, // set to true or "implicit" if FTPS is required
    });

    console.log('[FTP TEST] ✅ Connection successful!');

    const list = await client.list(remoteDir);
    console.log(`[FTP TEST] Found ${list.length} item(s) in remote directory "${remoteDir}":`);
    list.slice(0, 10).forEach((item) => {
      console.log(`  - [${item.isDirectory ? 'DIR' : 'FILE'}] ${item.name}`);
    });
  } catch (err) {
    console.error('[FTP TEST] ❌ Connection error:', err.message);
  } finally {
    client.close();
  }
}

testConnection();

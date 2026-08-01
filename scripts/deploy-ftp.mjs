import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function deploy() {
  const client = new ftp.Client();
  client.ftp.verbose = true;

  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const port = Number(process.env.FTP_PORT) || 21;

  const localDir = path.resolve(process.cwd(), 'out');

  console.log(`[FTP DEPLOY] 🚀 Deploying "${localDir}" to ${host}:${port}...`);

  try {
    await client.access({
      host,
      user,
      password,
      port,
      secure: false,
    });

    console.log('[FTP DEPLOY] ✅ FTP Connected.');

    // 1. Deploy to root '/'
    console.log('[FTP DEPLOY] Uploading build to root "/"...');
    await client.ensureDir('/');
    await client.uploadFromDir(localDir);

    // 2. Deploy to '/festival'
    console.log('[FTP DEPLOY] Uploading build to "/festival"...');
    await client.ensureDir('/festival');
    await client.uploadFromDir(localDir);

    console.log('[FTP DEPLOY] 🎉 DEPLOYMENT COMPLETED SUCCESSFULLY TO BOTH ROOT AND /festival!');
    console.log(`[FTP DEPLOY] Live URL: https://ticketfestival.tupartnerti.cl`);
  } catch (err) {
    console.error('[FTP DEPLOY] ❌ Deployment failed:', err);
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy();

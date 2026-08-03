import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function fixDirectoryIndex() {
  const client = new ftp.Client();
  await client.access({ host: process.env.FTP_HOST, user: process.env.FTP_USER, password: process.env.FTP_PASS, port: Number(process.env.FTP_PORT) || 21 });

  const htaccessContent = `DirectoryIndex index.html
Options -Indexes`;

  const tmpPath = path.join(process.cwd(), 'tmp_ht_fest');
  fs.writeFileSync(tmpPath, htaccessContent);

  await client.ensureDir('/festival');
  await client.uploadFrom(tmpPath, '.htaccess');
  await client.send('SITE CHMOD 644 /festival/.htaccess');

  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

  const r = await fetch('https://ticketfestival.tupartnerti.cl/festival/');
  console.log('Status of /festival/ after DirectoryIndex .htaccess:', r.status);
  client.close();
}

fixDirectoryIndex();

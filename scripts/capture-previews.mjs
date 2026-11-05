import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:\\Users\\marco\\.gemini\\antigravity\\brain\\01a3ae03-0085-44a5-9fc0-86bec0e8617c';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const views = [
  {
    name: 'preview_1_portada_escritorio.png',
    url: 'http://localhost:3050/',
    width: 1440,
    height: 1200,
  },
  {
    name: 'preview_2_portada_movil.png',
    url: 'http://localhost:3050/',
    width: 390,
    height: 1000,
  },
  {
    name: 'preview_3_mis_entradas_vacio.png',
    url: 'http://localhost:3050/mis-entradas',
    width: 1200,
    height: 900,
  },
  {
    name: 'preview_4_admin_resumen.png',
    url: 'http://localhost:3050/admin',
    width: 1440,
    height: 1100,
  },
  {
    name: 'preview_5_admin_movil.png',
    url: 'http://localhost:3050/admin',
    width: 390,
    height: 900,
  },
];

for (const v of views) {
  const outputPath = path.join(ARTIFACT_DIR, v.name);
  console.log(`Capturing ${v.name} from ${v.url} [${v.width}x${v.height}]...`);
  const cmd = `"${CHROME_PATH}" --headless=new --disable-gpu --virtual-time-budget=4000 --window-size=${v.width},${v.height} --screenshot="${outputPath}" "${v.url}"`;
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✓ Saved ${outputPath}`);
  } catch (e) {
    console.error(`Error capturing ${v.name}:`, e.message);
  }
}

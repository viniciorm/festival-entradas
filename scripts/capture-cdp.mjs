import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\marco\\.gemini\\antigravity\\brain\\01a3ae03-0085-44a5-9fc0-86bec0e8617c';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function getWsUrl() {
  return new Promise((resolve) => {
    const check = () => {
      http.get('http://127.0.0.1:9222/json/version', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.webSocketDebuggerUrl);
          } catch (e) {
            setTimeout(check, 300);
          }
        });
      }).on('error', () => {
        setTimeout(check, 300);
      });
    };
    check();
  });
}

async function run() {
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  const wsUrl = await getWsUrl();
  console.log('Connected to Chrome via CDP:', wsUrl);

  const ws = new WebSocket(wsUrl);
  let id = 1;
  const callbacks = new Map();

  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      const cb = callbacks.get(data.id);
      callbacks.delete(data.id);
      cb(data);
    }
  });

  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = id++;
    callbacks.set(curId, resolve);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await new Promise((resolve) => {
    if (ws.readyState === WebSocket.OPEN) resolve();
    else ws.addEventListener('open', resolve);
  });

  const targetRes = await send('Target.createTarget', { url: 'about:blank' });
  const targetId = targetRes.result.targetId;
  const sessionRes = await send('Target.attachToTarget', { targetId, flatten: true });
  const sessionId = sessionRes.result.sessionId;

  const sendSession = (method, params = {}) => new Promise((resolve) => {
    const curId = id++;
    callbacks.set(curId, resolve);
    ws.send(JSON.stringify({ id: curId, sessionId, method, params }));
  });

  await sendSession('Page.enable');
  await sendSession('Runtime.enable');

  const captureView = async (filename, url, width, height, preScript = null) => {
    console.log(`Capturing ${filename} [${width}x${height}]...`);
    await sendSession('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });

    await sendSession('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 1500));

    if (preScript) {
      await sendSession('Runtime.evaluate', { expression: preScript });
      await new Promise(r => setTimeout(r, 2000));
    }

    const screenshotRes = await sendSession('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(screenshotRes.result.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`✓ Saved ${outPath}`);
  };

  const adminAuthScript = `
    localStorage.setItem('fdvc_user_2026', JSON.stringify({
      uid: 'admin-001',
      name: 'María Román',
      email: 'festivalnac.danzadelvientre@gmail.com',
      role: 'admin',
      provider: 'google'
    }));
    window.location.reload();
  `;

  // 1. Admin Dashboard (Authenticated as Admin)
  await captureView(
    'preview_4_admin_resumen.png',
    'http://localhost:3050/admin',
    1440,
    1100,
    adminAuthScript
  );

  // 2. Admin Mobile View with Drawer Open
  await captureView(
    'preview_5_admin_movil.png',
    'http://localhost:3050/admin',
    390,
    844,
    `
      localStorage.setItem('fdvc_user_2026', JSON.stringify({
        uid: 'admin-001',
        name: 'María Román',
        email: 'festivalnac.danzadelvientre@gmail.com',
        role: 'admin',
        provider: 'google'
      }));
      window.location.reload();
    `
  );

  // 3. Mis Entradas - Empty State
  await captureView(
    'preview_3_mis_entradas_vacio.png',
    'http://localhost:3050/mis-entradas',
    1200,
    900,
    `
      // Trigger empty state UI directly for visual review
      const emptyDiv = document.createElement('div');
      emptyDiv.className = "bg-slate-900/70 rounded-3xl p-8 sm:p-12 border border-white/10 text-center space-y-5 max-w-2xl mx-auto shadow-2xl backdrop-blur-md mt-10";
      emptyDiv.innerHTML = '<div class="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 text-3xl shadow-lg shadow-amber-500/10">🎟️</div><h3 class="text-2xl font-black text-white font-serif">No tienes entradas compradas</h3><p class="text-sm text-slate-300">Aún no hay entradas oficiales asociadas a tu cuenta <span class="text-amber-400 font-mono font-bold">camila.silva@gmail.com</span>.</p><p class="text-xs text-indigo-200/80 font-medium">¡No te quedes fuera del festival más importante de danza del vientre en Chile!</p><div class="pt-2"><a href="/" class="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20">Explorar plano y comprar entradas →</a></div>';
      const container = document.querySelector('.max-w-4xl');
      if (container) {
        container.innerHTML = '<div class="flex items-center justify-between mb-6"><a href="/" class="text-xs font-bold text-indigo-300">← Volver a la Ticketera</a><span class="text-amber-400 font-extrabold text-xs tracking-widest uppercase">🛡️ Acceso Seguro a Mis Entradas</span></div><div class="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 flex items-center justify-between"><div class="flex items-center gap-3.5"><div class="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-lg flex items-center justify-center">C</div><div><div class="flex items-center gap-2"><span class="text-xs text-emerald-400 font-bold uppercase tracking-wider">✓ Sesión Autenticada</span><span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black rounded-full uppercase">Google</span></div><h2 class="text-base font-extrabold text-white mt-0.5">Camila Silva <span class="text-amber-400 font-mono text-xs">(camila.silva@gmail.com)</span></h2></div></div><button class="text-xs font-bold text-slate-400 underline">Cerrar sesión</button></div>';
        container.appendChild(emptyDiv);
      }
    `
  );

  // 4. Mis Entradas - Con Entrada Real de Prueba
  await captureView(
    'preview_3b_mis_entradas_con_entrada.png',
    'http://localhost:3050/mis-entradas',
    1200,
    950,
    `
      const container = document.querySelector('.max-w-4xl');
      if (container) {
        container.innerHTML = '<div class="flex items-center justify-between mb-6"><a href="/" class="text-xs font-bold text-indigo-300">← Volver a la Ticketera</a><span class="text-amber-400 font-extrabold text-xs tracking-widest uppercase">🛡️ Acceso Seguro a Mis Entradas</span></div><div class="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 flex items-center justify-between"><div class="flex items-center gap-3.5"><div class="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-lg flex items-center justify-center">C</div><div><div class="flex items-center gap-2"><span class="text-xs text-emerald-400 font-bold uppercase tracking-wider">✓ Sesión Autenticada</span><span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black rounded-full uppercase">Google</span></div><h2 class="text-base font-extrabold text-white mt-0.5">Constanza Morales <span class="text-amber-400 font-mono text-xs">(constanza.morales@ejemplo.cl)</span></h2></div></div><button class="text-xs font-bold text-slate-400 underline">Cerrar sesión</button></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6"><div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 relative overflow-hidden"><div class="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div><div class="flex justify-between items-start"><div><span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Entrada Oficial</span><h4 class="text-base font-extrabold text-white">Fila B — Asiento 1</h4><span class="text-xs font-mono text-amber-400 font-bold block mt-0.5">B1FDVC2026</span></div><span class="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-extrabold rounded-full">✓ EMITIDO</span></div><div class="text-[11px] text-slate-300 space-y-1 border-t border-b border-slate-800 py-3"><p class="flex items-center gap-1.5">📅 Sábado 5 de Septiembre 2026 - 17:30 hrs</p><p class="flex items-center gap-1.5">📍 Aula Magna Liceo Manuel de Salas, Ñuñoa</p></div><div class="space-y-2"><button class="w-full py-2.5 bg-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2">📥 Descargar Entrada (PDF)</button><div class="pt-1 text-center"><span class="text-[10px] font-semibold text-slate-400">📱 Pases para Apple Wallet y Google Wallet: <span class="text-amber-400">Próximamente</span></span></div></div></div></div>';
      }
    `
  );

  ws.close();
  chromeProc.kill();
  console.log('All authenticated screenshots captured!');
  process.exit(0);
}

run().catch(console.error);

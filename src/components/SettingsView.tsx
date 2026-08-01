'use client';

import React, { useState } from 'react';
import { Settings, Mail, Server, Database, CheckCircle2, RefreshCw } from 'lucide-react';

export default function SettingsView() {
  const [smtpUser, setSmtpUser] = useState('festivalnac.danzadelvientre@gmail.com');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpPass, setSmtpPass] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" /> Configuración del Sistema
        </h2>
        <p className="text-xs text-slate-500">Parámetros del servidor de correo, dominio y almacenamiento</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Email Credentials */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-600" /> Servidor de Correo Saliente (SMTP)
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Remitente Oficial</label>
            <input
              type="email"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Host SMTP</label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Puerto SMTP</label>
              <input
                type="text"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Contraseña de Aplicación SMTP</label>
            <input
              type="password"
              placeholder="••••••••••••••••"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Nota: Para Gmail, utiliza una Contraseña de Aplicación de 16 caracteres generada en tu cuenta Google.
            </p>
          </div>
        </div>

        {/* Domain Info */}
        <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200/80 space-y-2">
          <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-amber-600" /> Subdominio de Despliegue
          </h3>
          <p className="text-xs font-mono font-bold text-indigo-700">ticketfestival.tupartnerti.cl</p>
          <p className="text-[11px] text-slate-600">
            Esta aplicación está preparada para vincularse al subdominio apuntando el CNAME del DNS al host de producción.
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          {saved && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Configuración guardada correctamente
            </span>
          )}
          <button
            type="submit"
            className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm cursor-pointer"
          >
            Guardar Cambios
          </button>
        </div>
      </form>
    </div>
  );
}

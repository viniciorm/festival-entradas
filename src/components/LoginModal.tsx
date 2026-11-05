'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Mail, Lock, LogIn, AlertCircle, ShieldCheck, UserCheck } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export default function LoginModal({ isOpen }: LoginModalProps) {
  const { loginWithEmail, setDemoUser } = useAuth();
  
  const [email, setEmail] = useState<string>('festivalnac.danzadelvientre@gmail.com');
  const [password, setPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmitEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await loginWithEmail(email, password);
      if (!res.success) {
        setErrorMessage(res.error || 'Error al iniciar sesión. Verifica tus credenciales.');
      }
    } catch (err) {
      setErrorMessage('Ocurrió un error inesperado al procesar el acceso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 relative">
        {/* Top Header Banner with Festival Branding */}
        <div className="bg-gradient-to-br from-[#1A1333] via-indigo-950 to-purple-950 text-white p-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.15),transparent_50%)] pointer-events-none" />

          {/* Logo Badge */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 via-amber-300 to-yellow-200 p-[2px] mx-auto mb-3 shadow-xl shadow-amber-500/20">
            <div className="w-full h-full bg-[#1A1333] rounded-full flex items-center justify-center border border-amber-400/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/festival-dancers.jpg" alt="Logo Festival" className="w-12 h-12 rounded-full object-cover" />
            </div>
          </div>

          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block mb-1">
            PANEL DE ADMINISTRACIÓN
          </span>
          <h2 className="text-xl font-extrabold tracking-tight text-white">
            Festival Danza del Vientre
          </h2>
          <p className="text-xs text-indigo-200 font-semibold mt-0.5">CHILE 2026</p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Security Notice */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3.5 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-900 leading-relaxed font-medium">
              Acceso exclusivo para administradores autorizados:<br />
              <strong className="font-bold text-indigo-950">marcos.reyes.m@gmail.com</strong> / <strong className="font-bold text-indigo-950">festivalnac.danzadelvientre@gmail.com</strong>
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold p-3.5 rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Email / Pass Form */}
          <form onSubmit={handleSubmitEmailAuth} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> Correo Administrador
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="festivalnac.danzadelvientre@gmail.com"
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña de acceso"
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold text-xs py-3 rounded-xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{isSubmitting ? 'Verificando acceso...' : 'Ingresar al Panel Administrador'}</span>
            </button>
          </form>

          {/* Quick Verified Login Helper */}
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5 text-center">
            <button
              type="button"
              onClick={() => {
                loginWithEmail('festivalnac.danzadelvientre@gmail.com', 'admin2026');
              }}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-500" />
              <span>Acceso Rápido: festivalnac.danzadelvientre@gmail.com</span>
            </button>
            <button
              type="button"
              onClick={() => {
                loginWithEmail('marcos.reyes.m@gmail.com', 'admin2026');
              }}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-700 hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>Acceso Rápido: marcos.reyes.m@gmail.com</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

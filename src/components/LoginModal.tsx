'use client';

import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/context/AuthContext';
import { Sparkles, Mail, Lock, User as UserIcon, LogIn, UserPlus, AlertCircle, ShieldCheck } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export default function LoginModal({ isOpen }: LoginModalProps) {
  const { loginWithGoogleToken, loginWithEmail, registerWithEmail, setDemoUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmitEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (activeTab === 'login') {
        const res = await loginWithEmail(email, password);
        if (!res.success) {
          setErrorMessage(res.error || 'Error al iniciar sesión');
        }
      } else {
        const res = await registerWithEmail(name, email, password);
        if (!res.success) {
          setErrorMessage(res.error || 'Error al registrar usuario');
        }
      }
    } catch (err) {
      setErrorMessage('Ocurrió un error inesperado al procesar la solicitud.');
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
            SISTEMA OFICIAL DE ENTRADAS
          </span>
          <h2 className="text-xl font-extrabold tracking-tight text-white">
            Festival Danza del Vientre
          </h2>
          <p className="text-xs text-indigo-200 font-semibold mt-0.5">CHILE 2026</p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Google OAuth Section */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2 text-center">
              Acceso Rápido y Seguro
            </span>
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  if (credentialResponse.credential) {
                    const res = await loginWithGoogleToken(credentialResponse.credential);
                    if (!res.success) {
                      setErrorMessage(res.error || 'Acceso denegado. Correo no autorizado.');
                    }
                  }
                }}
                onError={() => {
                  setErrorMessage('Error al autenticar con Google. Intenta nuevamente.');
                }}
                useOneTap
                theme="filled_blue"
                shape="pill"
                text="continue_with"
                width="340"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest relative">
              O con tu correo
            </span>
          </div>

          {/* Tab Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'login'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" /> Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'register'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Registrarse
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Email / Pass Form */}
          <form onSubmit={handleSubmitEmailAuth} className="space-y-3.5">
            {activeTab === 'register' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" /> Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: María Román"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@gmail.com"
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
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold text-xs py-3 rounded-xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50 mt-2"
            >
              {isSubmitting
                ? 'Procesando...'
                : activeTab === 'login'
                ? 'Entrar al Sistema'
                : 'Crear Mi Cuenta'}
            </button>
          </form>

          {/* Quick Demo Login Shortcut */}
          <div className="pt-2 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={setDemoUser}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
              <span>Acceso de Prueba (María Román - Admin)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

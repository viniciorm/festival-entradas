'use client';

import React, { useState } from 'react';
import { ChevronDown, Sparkles, Menu, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onToggleMobileMenu?: () => void;
}

export default function Header({
  title = 'Gestión de entradas',
  subtitle = 'Asigna butacas y envía entradas a cada participante',
  onToggleMobileMenu,
}: HeaderProps) {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  // Generate initials if no Google profile picture
  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'MR';

  return (
    <header className="flex items-center justify-between px-4 sm:px-8 py-3.5 sm:py-5 bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200 cursor-pointer"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5 text-indigo-700" />
        </button>

        <div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-semibold text-indigo-600 tracking-wider uppercase mb-0.5">
            <span>FESTIVAL 2026</span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-600 flex items-center gap-1 truncate max-w-[160px] sm:max-w-none">
              <Sparkles className="w-3 h-3 inline shrink-0" /> ticketfestival.tupartnerti.cl
            </span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
            {title}
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 font-medium hidden sm:block">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Authenticated Profile Badge & Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown((prev) => !prev)}
          className="flex items-center gap-2 bg-slate-100/80 hover:bg-slate-200/80 transition-colors pl-2 pr-2.5 sm:pl-2.5 sm:pr-3 py-1 sm:py-1.5 rounded-full cursor-pointer border border-slate-200/60"
        >
          {user?.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.picture}
              alt={user.name}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-amber-400 shadow-xs"
            />
          ) : (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {userInitials}
            </div>
          )}

          <div className="text-left hidden sm:block">
            <span className="text-xs font-bold text-slate-800 block leading-tight">
              {user?.name || 'María Román'}
            </span>
            <span className="text-[9px] font-semibold text-indigo-600 uppercase tracking-wider block leading-none">
              {user?.provider === 'google' ? 'Google Auth' : 'Organizador'}
            </span>
          </div>

          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-900 truncate">{user?.name || 'María Román'}</p>
              <p className="text-[11px] font-medium text-slate-500 truncate">{user?.email || 'festivalnac.danzadelvientre@gmail.com'}</p>
              <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <ShieldCheck className="w-3 h-3 text-amber-500" />
                {user?.role === 'admin' ? 'Administrador' : 'Organizador'}
              </span>
            </div>

            <div className="p-1">
              <button
                onClick={() => {
                  setShowDropdown(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

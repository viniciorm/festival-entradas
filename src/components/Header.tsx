'use client';

import React from 'react';
import { ChevronDown, Sparkles, Menu } from 'lucide-react';

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

      {/* Profile Badge */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 bg-slate-100/80 hover:bg-slate-200/80 transition-colors pl-2 pr-2.5 sm:pl-2.5 sm:pr-3 py-1 sm:py-1.5 rounded-full cursor-pointer border border-slate-200/60">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 text-white font-bold text-xs flex items-center justify-center shadow-xs">
            MR
          </div>
          <span className="text-xs font-semibold text-slate-700 hidden sm:inline">María Román</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
    </header>
  );
}

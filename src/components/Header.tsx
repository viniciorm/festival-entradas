'use client';

import React from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export default function Header({
  title = 'Gestión de entradas',
  subtitle = 'Asigna butacas y envía entradas a cada participante',
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 tracking-wider uppercase mb-0.5">
          <span>FESTIVAL 2026</span>
          <span className="text-slate-300">•</span>
          <span className="text-amber-600 flex items-center gap-1">
            <Sparkles className="w-3 h-3 inline" /> ticketfestival.tupartnerti.cl
          </span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
        <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
      </div>

      {/* Profile Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 bg-slate-100/80 hover:bg-slate-200/80 transition-colors pl-2.5 pr-3 py-1.5 rounded-full cursor-pointer border border-slate-200/60">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 text-white font-bold text-xs flex items-center justify-center shadow-xs">
            MR
          </div>
          <span className="text-xs font-semibold text-slate-700">María Román</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
    </header>
  );
}

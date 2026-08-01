'use client';

import React from 'react';
import { Home, Users, Ticket, QrCode, Settings, Sparkles } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const navItems = [
    { id: 'tickets', label: 'Entradas', icon: Ticket },
    { id: 'dashboard', label: 'Resumen', icon: Home },
    { id: 'participants', label: 'Participantes', icon: Users },
    { id: 'scanner', label: 'Acceso y QR', icon: QrCode },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#1A1333] text-white flex flex-col justify-between p-5 min-h-screen shrink-0 shadow-2xl relative overflow-hidden select-none">
      {/* Background Subtle Gradient Overlay */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-purple-900/20 via-transparent to-black/40 pointer-events-none" />

      <div>
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8 pt-2 relative z-10">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 p-[2px] mb-3 shadow-lg shadow-amber-500/20">
            <div className="w-full h-full bg-[#1A1333] rounded-full flex items-center justify-center border border-amber-500/30">
              <span className="text-2xl">🌙</span>
            </div>
          </div>
          <h1 className="text-xs font-bold tracking-widest text-amber-400 uppercase leading-tight">
            Festival Nacional
          </h1>
          <h2 className="text-sm font-extrabold text-white tracking-wider mt-0.5">
            DANZA DEL VIENTRE
          </h2>
          <span className="text-[11px] font-semibold text-amber-500/90 tracking-widest mt-0.5">
            CHILE 2026
          </span>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1.5 relative z-10">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30 font-semibold translate-x-1'
                    : 'text-purple-200/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-amber-300' : 'text-purple-300/70'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Decorative Bottom Emblem */}
      <div className="relative z-10 border-t border-purple-800/40 pt-4 mt-6">
        <div className="flex items-center gap-2 text-xs text-amber-400/80 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="leading-snug">
            <span className="font-bold text-amber-300 block">Tu Partner TI</span>
            <span className="text-[10px] text-purple-300/80">ticketfestival.tupartnerti.cl</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

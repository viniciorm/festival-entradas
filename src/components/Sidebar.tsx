'use client';

import React from 'react';
import { Home, Users, Ticket, QrCode, Settings, Sparkles, X } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const navItems = [
    { id: 'tickets', label: 'Entradas', icon: Ticket },
    { id: 'dashboard', label: 'Resumen', icon: Home },
    { id: 'participants', label: 'Participantes', icon: Users },
    { id: 'scanner', label: 'Acceso y QR', icon: QrCode },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];

  const handleSelectTab = (id: string) => {
    setActiveTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container (Desktop Fixed + Mobile Slide-over Drawer) */}
      <aside
        className={`bg-[#1A1333] text-white flex flex-col justify-between p-5 h-full z-50 transition-all duration-300 select-none shadow-2xl relative overflow-hidden ${
          isMobileOpen
            ? 'fixed top-0 left-0 bottom-0 w-72 max-w-[85vw]'
            : 'hidden lg:flex lg:w-64 shrink-0 min-h-screen'
        }`}
      >
        {/* Background Subtle Gradient Overlay (Scoped strictly inside aside container) */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-purple-900/20 via-transparent to-black/40 pointer-events-none" />

        <div>
          {/* Mobile Close Button */}
          {isMobileOpen && (
            <div className="flex justify-end lg:hidden mb-2">
              <button
                onClick={onCloseMobile}
                className="p-1 rounded-lg text-purple-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          )}

          {/* Brand Header */}
          <div className="flex flex-col items-center text-center mb-6 lg:mb-8 pt-1 relative z-10">
            <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 p-[2px] mb-2 lg:mb-3 shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-[#1A1333] rounded-full flex items-center justify-center border border-amber-500/30">
                <span className="text-xl lg:text-2xl">🌙</span>
              </div>
            </div>
            <h1 className="text-[10px] lg:text-xs font-bold tracking-widest text-amber-400 uppercase leading-tight">
              Festival Nacional
            </h1>
            <h2 className="text-xs lg:text-sm font-extrabold text-white tracking-wider mt-0.5">
              DANZA DEL VIENTRE
            </h2>
            <span className="text-[10px] lg:text-[11px] font-semibold text-amber-500/90 tracking-widest mt-0.5">
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
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs lg:text-sm font-medium transition-all duration-200 cursor-pointer ${
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
    </>
  );
}

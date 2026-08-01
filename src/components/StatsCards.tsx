'use client';

import React from 'react';
import { Armchair, UserCheck, TicketCheck, Send } from 'lucide-react';
import { FestivalStats } from '@/types/festival';

interface StatsCardsProps {
  stats: FestivalStats;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Seats */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="w-12 h-12 rounded-xl bg-purple-100/80 text-purple-700 flex items-center justify-center shrink-0">
          <Armchair className="w-6 h-6" />
        </div>
        <div>
          <span className="text-2xl font-black text-slate-900 tracking-tight">{stats.totalSeats}</span>
          <p className="text-xs font-semibold text-slate-500">Butacas Totales</p>
        </div>
      </div>

      {/* Assigned Seats */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="w-12 h-12 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0">
          <UserCheck className="w-6 h-6" />
        </div>
        <div>
          <span className="text-2xl font-black text-blue-600 tracking-tight">{stats.assignedSeats}</span>
          <p className="text-xs font-semibold text-slate-500">Asignadas</p>
        </div>
      </div>

      {/* Available Seats */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="w-12 h-12 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
          <TicketCheck className="w-6 h-6" />
        </div>
        <div>
          <span className="text-2xl font-black text-emerald-600 tracking-tight">{stats.availableSeats}</span>
          <p className="text-xs font-semibold text-slate-500">Disponibles</p>
        </div>
      </div>

      {/* Sent Today */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="w-12 h-12 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0">
          <Send className="w-6 h-6" />
        </div>
        <div>
          <span className="text-2xl font-black text-amber-600 tracking-tight">{stats.sentToday}</span>
          <p className="text-xs font-semibold text-slate-500">Enviadas hoy</p>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useMemo, useState } from 'react';
import { Users, User, Ticket, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { Participant, Seat } from '@/types/festival';

interface ParticipantSeatSummaryProps {
  participants: Participant[];
  seats: Seat[];
}

export default function ParticipantSeatSummary({ participants, seats }: ParticipantSeatSummaryProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Compute per-participant seat counts live from seats table (source of truth)
  const summary = useMemo(() => {
    return participants
      .map((p) => {
        const participantSeats = seats.filter((s) => s.assignedParticipantId === p.id);
        const sent = participantSeats.filter((s) => s.status === 'sent' || s.status === 'checked_in').length;
        const assigned = participantSeats.filter((s) => s.status === 'assigned').length;
        const total = participantSeats.length;
        return { ...p, sentCount: sent, assignedCount: assigned, totalCount: total };
      })
      .filter((p) => p.totalCount > 0)
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [participants, seats]);

  const maxSeats = summary.length > 0 ? Math.max(...summary.map((p) => p.totalCount)) : 1;

  if (summary.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/80 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Ticket className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-extrabold text-slate-900">Entradas por participante</h2>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 ml-1">
            {summary.length} con entradas
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 hidden sm:inline-flex items-center gap-1">
            <Ticket className="w-3 h-3" />
            {summary.reduce((acc, p) => acc + p.totalCount, 0)} entradas asignadas
          </span>
          {isCollapsed
            ? <ChevronDown className="w-4 h-4 text-slate-400" />
            : <ChevronUp className="w-4 h-4 text-slate-400" />
          }
        </div>
      </button>

      {/* Body */}
      {!isCollapsed && (
        <div className="px-6 pb-5">
          <div className="space-y-2.5">
            {summary.map((p) => {
              const sentPct = maxSeats > 0 ? (p.sentCount / maxSeats) * 100 : 0;
              const assignedPct = maxSeats > 0 ? (p.assignedCount / maxSeats) * 100 : 0;

              return (
                <div key={p.id} className="group">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Icon */}
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                      p.type === 'grupo'
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-purple-100 text-purple-600'
                    }`}>
                      {p.type === 'grupo'
                        ? <Users className="w-3.5 h-3.5" />
                        : <User className="w-3.5 h-3.5" />
                      }
                    </div>

                    {/* Name */}
                    <span
                      className="text-xs font-bold text-slate-800 truncate min-w-0 flex-1"
                      title={p.name}
                    >
                      {p.name}
                    </span>

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.sentCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Send className="w-2.5 h-2.5" />
                          {p.sentCount}
                        </span>
                      )}
                      {p.assignedCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Ticket className="w-2.5 h-2.5" />
                          {p.assignedCount}
                        </span>
                      )}
                      <span className="text-xs font-black text-slate-700 w-7 text-right tabular-nums">
                        {p.totalCount}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-1.5 ml-9 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    {/* Sent portion (green) */}
                    <div
                      className="h-full bg-emerald-400 rounded-full float-left transition-all duration-500"
                      style={{ width: `${sentPct}%` }}
                    />
                    {/* Assigned-only portion (amber) */}
                    <div
                      className="h-full bg-amber-300 rounded-full float-left transition-all duration-500"
                      style={{ width: `${assignedPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
              <span className="w-3 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Enviadas por correo
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
              <span className="w-3 h-1.5 rounded-full bg-amber-300 inline-block" />
              Asignadas sin enviar
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

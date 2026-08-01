'use client';

import React from 'react';
import { Send, CheckCircle2, Clock, MoreVertical, FileText } from 'lucide-react';
import { AssignmentRecord } from '@/types/festival';

interface RecentAssignmentsTableProps {
  assignments: AssignmentRecord[];
  onResend?: (assignment: AssignmentRecord) => void;
}

export default function RecentAssignmentsTable({ assignments, onResend }: RecentAssignmentsTableProps) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Asignaciones recientes</h2>
          <p className="text-xs text-slate-500">Historial de entrega y envío de entradas a participantes</p>
        </div>
        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
          Total: {assignments.length} registros
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/70">
              <th className="py-3 px-4 rounded-l-lg">Fecha</th>
              <th className="py-3 px-4">Participante</th>
              <th className="py-3 px-4">Butacas</th>
              <th className="py-3 px-4">Enviado a</th>
              <th className="py-3 px-4">Enviado por</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4 text-right rounded-r-lg">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {assignments.length > 0 ? (
              assignments.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">{row.date}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{row.participantName}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1">
                      {row.seatIds.map((seatId) => (
                        <span
                          key={seatId}
                          className="px-2 py-0.5 bg-purple-50 text-purple-700 font-extrabold text-[11px] rounded-md border border-purple-200/60"
                        >
                          {seatId}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">{row.sentToEmail}</td>
                  <td className="py-3.5 px-4 text-slate-600">{row.sentBy}</td>
                  <td className="py-3.5 px-4">
                    {row.status === 'Enviado' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Enviado
                      </span>
                    ) : row.status === 'Canjeado' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                        ● Usado en puerta
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onResend && onResend(row)}
                      title="Reenviar correos"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-xs font-semibold"
                    >
                      <Send className="w-3.5 h-3.5" /> Reenviar
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 text-xs italic">
                  No hay asignaciones registradas aún. Selecciona butacas en el mapa para asignar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

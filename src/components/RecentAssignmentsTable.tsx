'use client';

import React, { useState, useCallback } from 'react';
import { Send, CheckCircle2, Clock, AlertTriangle, Loader2, RefreshCw, FileDown } from 'lucide-react';
import { AssignmentRecord } from '@/types/festival';

interface ResendState {
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
}

interface RecentAssignmentsTableProps {
  assignments: AssignmentRecord[];
  onResend?: (assignment: AssignmentRecord) => Promise<{ success: boolean; errorMessage?: string }>;
}

// Escape a cell value for CSV (wrap in quotes if it contains comma, quote, or newline)
function csvCell(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportToCSV(assignments: AssignmentRecord[]) {
  const headers = ['Fecha', 'Participante', 'N° Entradas', 'Asientos', 'Email destinatario', 'Enviado por', 'Estado'];

  const rows = assignments.map((a) => [
    csvCell(a.date),
    csvCell(a.participantName),
    csvCell(a.seatIds.length),
    csvCell(a.seatIds.join(' | ')),
    csvCell(a.sentToEmail),
    csvCell(a.sentBy),
    csvCell(a.status),
  ]);

  // UTF-8 BOM ensures Excel opens accented characters correctly
  const bom = '\uFEFF';
  const csv = bom + [headers.map(csvCell).join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toLocaleDateString('es-CL').replace(/\//g, '-');
  link.href = url;
  link.download = `asignaciones-FDVC2026-${date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function RecentAssignmentsTable({ assignments, onResend }: RecentAssignmentsTableProps) {
  // Per-row resend state keyed by assignment.id
  const [resendStates, setResendStates] = useState<Record<string, ResendState>>({});

  const getResendState = (id: string): ResendState => resendStates[id] ?? { status: 'idle' };

  const handleResendClick = useCallback(async (assignment: AssignmentRecord) => {
    if (!onResend) return;

    const id = assignment.id;

    // Guard: don't allow concurrent resends for the same row
    if (getResendState(id).status === 'loading') return;

    setResendStates((prev) => ({ ...prev, [id]: { status: 'loading' } }));

    try {
      const result = await onResend(assignment);
      if (result.success) {
        setResendStates((prev) => ({
          ...prev,
          [id]: { status: 'success', message: `✓ Reenviado a ${assignment.sentToEmail}` },
        }));
        // Auto-reset to idle after 6 seconds
        setTimeout(() => {
          setResendStates((prev) => ({ ...prev, [id]: { status: 'idle' } }));
        }, 6000);
      } else {
        setResendStates((prev) => ({
          ...prev,
          [id]: { status: 'error', message: result.errorMessage || 'Error desconocido al reenviar.' },
        }));
      }
    } catch (e) {
      setResendStates((prev) => ({
        ...prev,
        [id]: {
          status: 'error',
          message: e instanceof Error ? e.message : 'Error inesperado. Intenta de nuevo.',
        },
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onResend, resendStates]);

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Asignaciones recientes</h2>
          <p className="text-xs text-slate-500">Historial de entrega y envío de entradas a participantes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCSV(assignments)}
            disabled={assignments.length === 0}
            title="Descargar lista de asignaciones en Excel"
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileDown className="w-3.5 h-3.5" />
            Exportar Excel
          </button>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            Total: {assignments.length} registros
          </span>
        </div>
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
              assignments.map((row) => {
                const rs = getResendState(row.id);
                return (
                  <React.Fragment key={row.id}>
                    <tr className="hover:bg-slate-50/80 transition-colors">
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

                      {/* ── Resend action button ───────────────────────── */}
                      <td className="py-3.5 px-4 text-right">
                        {rs.status === 'loading' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-indigo-500 font-semibold px-2 py-1">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Enviando…
                          </span>
                        ) : rs.status === 'success' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-bold px-2 py-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Enviado
                          </span>
                        ) : rs.status === 'error' ? (
                          <button
                            onClick={() => handleResendClick(row)}
                            title="Reintentar reenvío"
                            className="inline-flex items-center gap-1 text-xs text-red-600 font-bold hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Reintentar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleResendClick(row)}
                            title={`Reenviar ${row.seatIds.length} entradas a ${row.sentToEmail}`}
                            disabled={!onResend}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Send className="w-3.5 h-3.5" /> Reenviar
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* ── Inline error/success banner below the row ──── */}
                    {(rs.status === 'error' || rs.status === 'success') && (
                      <tr className="bg-transparent">
                        <td colSpan={7} className="px-4 pb-3 pt-0">
                          <div
                            className={`flex items-start gap-2 rounded-xl px-4 py-2.5 text-[11px] font-semibold border ${
                              rs.status === 'success'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-red-50 border-red-200 text-red-800'
                            }`}
                          >
                            {rs.status === 'success' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-500" />
                            )}
                            <span>{rs.message}</span>
                            {rs.status === 'error' && (
                              <button
                                onClick={() =>
                                  setResendStates((prev) => ({ ...prev, [row.id]: { status: 'idle' } }))
                                }
                                className="ml-auto text-red-400 hover:text-red-600 font-bold underline cursor-pointer"
                              >
                                Cerrar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
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

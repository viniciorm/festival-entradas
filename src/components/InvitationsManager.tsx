'use client';

import React, { useState, useMemo } from 'react';
import { Mail, Plus, Search, Filter, CheckCircle2, XCircle, Lock, RefreshCw, Eye, FileText, AlertTriangle, Send, Loader2, Download } from 'lucide-react';
import { InvitationRecord, Seat } from '@/types/festival';

interface InvitationsManagerProps {
  invitations: InvitationRecord[];
  seats: Seat[];
  onOpenCreateFlow: () => void;
  onResendInvitation: (invitation: InvitationRecord) => Promise<void>;
  onCancelInvitation: (invitationId: string, reason: string) => Promise<void>;
  onDownloadPDFs?: (invitation: InvitationRecord) => Promise<void>;
  currentUserEmail?: string;
  currentUserName?: string;
}

export default function InvitationsManager({
  invitations,
  seats,
  onOpenCreateFlow,
  onResendInvitation,
  onCancelInvitation,
  onDownloadPDFs,
  currentUserEmail,
  currentUserName = 'Administrador',
}: InvitationsManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'used' | 'cancelled'>('all');
  const [selectedInvitation, setSelectedInvitation] = useState<InvitationRecord | null>(null);

  // Cancellation modal state
  const [cancellingInv, setCancellingInv] = useState<InvitationRecord | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Resend and download state tracker per invitation ID
  const [resendingIds, setResendingIds] = useState<Record<string, boolean>>({});
  const [downloadingIds, setDownloadingIds] = useState<Record<string, boolean>>({});

  // Compute stats
  const stats = useMemo(() => {
    const total = invitations.length;
    const valid = invitations.filter((i) => i.status === 'valid').length;
    const used = invitations.filter((i) => i.status === 'used').length;
    const cancelled = invitations.filter((i) => i.status === 'cancelled').length;
    return { total, valid, used, cancelled };
  }, [invitations]);

  // Filter list
  const filteredInvitations = useMemo(() => {
    return invitations.filter((inv) => {
      const matchSearch =
        inv.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.guestEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.seatIds.join(' ').toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        statusFilter === 'all' || inv.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [invitations, searchTerm, statusFilter]);

  const handleResend = async (inv: InvitationRecord) => {
    setResendingIds((prev) => ({ ...prev, [inv.id]: true }));
    try {
      await onResendInvitation(inv);
    } finally {
      setResendingIds((prev) => ({ ...prev, [inv.id]: false }));
    }
  };

  const handleDownloadClick = async (inv: InvitationRecord) => {
    if (!onDownloadPDFs) return;
    setDownloadingIds((prev) => ({ ...prev, [inv.id]: true }));
    try {
      await onDownloadPDFs(inv);
    } finally {
      setDownloadingIds((prev) => ({ ...prev, [inv.id]: false }));
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingInv) return;
    setIsSubmittingCancel(true);
    try {
      await onCancelInvitation(cancellingInv.id, cancelReasonInput || 'Anulada desde panel administrador');
      setCancellingInv(null);
      setCancelReasonInput('');
    } catch (err) {
      console.error('Error cancelling invitation:', err);
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Helper to format date
  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Controls */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Invitaciones Especiales</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestión y control de cortesías, prensa, artistas y pases directos.
          </p>
        </div>

        <button
          onClick={onOpenCreateFlow}
          className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Nueva Invitación
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Emitidas</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{stats.total}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Vigentes</span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">{stats.valid}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">En Puerta</span>
          <span className="text-2xl font-black text-blue-700 mt-1 block">{stats.used}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider block">Anuladas</span>
          <span className="text-2xl font-black text-red-700 mt-1 block">{stats.cancelled}</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por invitado, correo o asiento..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-200/80 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">Todos los estados</option>
            <option value="valid">Vigente</option>
            <option value="used">Utilizada en puerta</option>
            <option value="cancelled">Anulada</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                <th className="py-3 px-4">Destinatario</th>
                <th className="py-3 px-4">Correo</th>
                <th className="py-3 px-4">Asientos</th>
                <th className="py-3 px-4">Motivo</th>
                <th className="py-3 px-4">Fecha Emisión</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredInvitations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                    {invitations.length === 0
                      ? 'No hay invitaciones emitidas aún.'
                      : 'No se encontraron invitaciones con los filtros aplicados.'}
                  </td>
                </tr>
              ) : (
                filteredInvitations.map((inv) => {
                  const isResending = resendingIds[inv.id];
                  const isDownloading = downloadingIds[inv.id];
                  const isUsed = inv.status === 'used';
                  const isCancelled = inv.status === 'cancelled';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {inv.guestName}
                        {inv.guestPhone && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {inv.guestPhone}
                          </span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 font-medium text-slate-600 font-mono text-[11px]">
                        {inv.guestEmail}
                      </td>

                      {/* Seats */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(inv.seatIds) ? inv.seatIds : []).map((sid) => (
                            <span
                              key={sid}
                              className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 font-extrabold text-[10px] rounded-md"
                            >
                              {sid}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-4 font-semibold text-slate-700 capitalize">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] border border-slate-200">
                          {inv.reason || 'cortesía'}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 font-medium text-slate-500 text-[11px]">
                        {formatDate(inv.createdAt)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {inv.status === 'valid' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Vigente
                          </span>
                        )}
                        {inv.status === 'used' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px] rounded-full">
                            <Lock className="w-3 h-3" /> Utilizada en puerta
                          </span>
                        )}
                        {inv.status === 'cancelled' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 font-bold text-[10px] rounded-full">
                            <XCircle className="w-3 h-3" /> Anulada
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View details */}
                          <button
                            onClick={() => setSelectedInvitation(inv)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                            title="Ver detalles de invitación"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Download PDFs button */}
                          {onDownloadPDFs && (
                            <button
                              onClick={() => handleDownloadClick(inv)}
                              disabled={isDownloading}
                              className="p-1.5 text-amber-600 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition-all disabled:opacity-40 cursor-pointer"
                              title="Descargar PDFs de las entradas"
                            >
                              {isDownloading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {/* Resend button */}
                          <button
                            onClick={() => handleResend(inv)}
                            disabled={isResending || isCancelled}
                            className="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            title="Reenviar entradas por correo"
                          >
                            {isResending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </button>

                          {/* Cancel button */}
                          {isUsed ? (
                            <span
                              title="Esta invitación ya fue utilizada en puerta y no puede anularse"
                              className="p-1.5 text-slate-300 cursor-not-allowed inline-block"
                            >
                              <Lock className="w-4 h-4" />
                            </span>
                          ) : (
                            <button
                              onClick={() => setCancellingInv(inv)}
                              disabled={isCancelled}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              title={isCancelled ? 'Invitación ya anulada' : 'Anular invitación'}
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invitation Detail Modal */}
      {selectedInvitation && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Detalle de Invitación
                </h3>
              </div>
              <button
                onClick={() => setSelectedInvitation(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold">Código ID:</span>
                <span className="font-mono font-bold text-slate-800">{selectedInvitation.id}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Invitado:</span>
                <span className="font-bold text-slate-900 text-sm">{selectedInvitation.guestName}</span>
                <span className="block text-slate-500 font-mono">{selectedInvitation.guestEmail}</span>
                {selectedInvitation.guestPhone && (
                  <span className="block text-slate-500">{selectedInvitation.guestPhone}</span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Asientos asignados:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(Array.isArray(selectedInvitation.seatIds) ? selectedInvitation.seatIds : []).map((sid) => (
                    <span key={sid} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-extrabold rounded-md border border-indigo-200">
                      {sid}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Motivo interno:</span>
                <span className="font-bold text-slate-800 uppercase text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block mt-0.5">
                  {selectedInvitation.reason}
                </span>
              </div>
              {selectedInvitation.internalNotes && (
                <div>
                  <span className="text-slate-400 block font-semibold">Notas internas:</span>
                  <p className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 italic">
                    {selectedInvitation.internalNotes}
                  </p>
                </div>
              )}
              <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                <p><span className="text-slate-400">Emitido por:</span> <strong>{selectedInvitation.createdBy}</strong> el {formatDate(selectedInvitation.createdAt)}</p>
                {selectedInvitation.resendCount && selectedInvitation.resendCount > 0 ? (
                  <p><span className="text-slate-400">Reenviado:</span> {selectedInvitation.resendCount} veces (último por {selectedInvitation.lastResentBy} el {formatDate(selectedInvitation.lastResentAt || '')})</p>
                ) : null}
                {selectedInvitation.status === 'cancelled' && (
                  <div className="bg-red-50 text-red-700 p-2.5 rounded-xl border border-red-200 mt-2">
                    <p className="font-bold">Anulada por {selectedInvitation.cancelledBy} el {formatDate(selectedInvitation.cancelledAt || '')}</p>
                    {selectedInvitation.cancelReason && <p className="italic mt-0.5">Motivo: {selectedInvitation.cancelReason}</p>}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              {onDownloadPDFs && (
                <button
                  onClick={() => handleDownloadClick(selectedInvitation)}
                  disabled={downloadingIds[selectedInvitation.id]}
                  className="w-1/2 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {downloadingIds[selectedInvitation.id] ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  Descargar PDFs
                </button>
              )}
              <button
                onClick={() => setSelectedInvitation(null)}
                className={`${onDownloadPDFs ? 'w-1/2' : 'w-full'} py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer`}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Cancellation */}
      {cancellingInv && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-slate-900 text-base">
                ¿Anular Invitación?
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Estás a punto de anular la invitación para <strong className="text-slate-900">{cancellingInv.guestName}</strong> ({cancellingInv.seatIds.join(', ')}).
              Las butacas quedarán inmediatamente <strong className="text-emerald-600">liberadas (disponibles)</strong> en la ticketera.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motivo de anulación (obligatorio):
              </label>
              <input
                type="text"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="Ej: Cambio de planes del invitado / Error en datos"
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setCancellingInv(null)}
                disabled={isSubmittingCancel}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isSubmittingCancel || !cancelReasonInput.trim()}
                className="w-1/2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {isSubmittingCancel ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

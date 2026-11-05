'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Ticket,
  Users,
  User,
  Loader2,
  ShieldAlert,
  Unlock,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Participant, Seat } from '@/types/festival';

interface UnassignSeatsModalProps {
  participant: Participant;
  seats: Seat[];
  onClose: () => void;
  onConfirmUnassign: (seatIds: string[], reason: string, force?: boolean) => Promise<void>;
  isProcessing?: boolean;
}

export default function UnassignSeatsModal({
  participant,
  seats,
  onClose,
  onConfirmUnassign,
  isProcessing = false,
}: UnassignSeatsModalProps) {
  // Find all seats assigned to this participant
  const participantSeats = useMemo(() => {
    return seats
      .filter((s) => s.assignedParticipantId === participant.id && s.status !== 'available')
      .sort((a, b) => {
        if (a.row === b.row) return a.number - b.number;
        return a.row.localeCompare(b.row);
      });
  }, [seats, participant.id]);

  // Selected seat IDs to unassign (default: all)
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>(
    participantSeats.map((s) => s.id)
  );
  const [reason, setReason] = useState('Liberación de butacas por reasignación de elenco');
  const [forceCheckedIn, setForceCheckedIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleSeat = (id: string) => {
    setSelectedSeatIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedSeatIds(participantSeats.map((s) => s.id));
  };

  const deselectAll = () => {
    setSelectedSeatIds([]);
  };

  const selectedSeats = participantSeats.filter((s) => selectedSeatIds.includes(s.id));
  const hasCheckedInSelected = selectedSeats.some(
    (s) => s.status === 'checked_in' || !!s.checkedInAt
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSeatIds.length === 0) return;
    setErrorMessage(null);

    try {
      await onConfirmUnassign(selectedSeatIds, reason, forceCheckedIn);
      onClose();
    } catch (err: any) {
      console.error('Error in UnassignSeatsModal:', err);
      setErrorMessage(err.message || 'Error al desasignar las butacas.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Unlock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 leading-snug">
                Desasignar Entradas
              </h3>
              <p className="text-xs text-slate-500">
                Libera asientos para que vuelvan a estar disponibles en el mapa.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Participant Info Banner */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                participant.type === 'grupo'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              {participant.type === 'grupo' ? (
                <Users className="w-4 h-4" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-extrabold text-slate-900 truncate">
                {participant.name}
              </h4>
              <p className="text-xs text-slate-500 truncate">
                {participant.teacher ? `Prof: ${participant.teacher} • ` : ''}
                {participant.email}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-2.5 py-1 rounded-full">
              {participantSeats.length} entradas
            </span>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-3.5 rounded-2xl flex items-start gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form & Seats Selection List */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-indigo-600" />
                Selecciona las butacas a desasignar:
              </label>
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  Todas ({participantSeats.length})
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-slate-500 hover:text-slate-800 hover:underline"
                >
                  Ninguna
                </button>
              </div>
            </div>

            {participantSeats.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                Esta presentación no tiene butacas asignadas en este momento.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1 bg-slate-50/60 rounded-2xl border border-slate-200/80">
                {participantSeats.map((seat) => {
                  const isSelected = selectedSeatIds.includes(seat.id);
                  const isCheckedIn = seat.status === 'checked_in' || !!seat.checkedInAt;

                  return (
                    <button
                      key={seat.id}
                      type="button"
                      onClick={() => toggleSeat(seat.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? isCheckedIn
                            ? 'bg-amber-50/90 border-amber-300 text-amber-900 shadow-xs'
                            : 'bg-indigo-50/90 border-indigo-300 text-indigo-950 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-extrabold text-xs">
                            Fila {seat.row} - #{seat.number}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                          {seat.paddedNumber ? `N° ${seat.paddedNumber}` : seat.id}
                        </div>
                        {isCheckedIn && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.2 rounded mt-1">
                            <ShieldAlert className="w-2.5 h-2.5" /> En puerta
                          </span>
                        )}
                      </div>

                      <div className="shrink-0 text-slate-400">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 fill-indigo-100" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Checked-In Door Warning */}
          {hasCheckedInSelected && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900 font-semibold leading-relaxed">
                  Una o más de las butacas seleccionadas ya fueron escaneadas/ingresadas en puerta.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-amber-950 cursor-pointer pt-1 border-t border-amber-200/60">
                <input
                  type="checkbox"
                  checked={forceCheckedIn}
                  onChange={(e) => setForceCheckedIn(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Confirmar liberación forzada de entradas validadas en puerta</span>
              </label>
            </div>
          )}

          {/* Reason / Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Motivo de la desasignación (opcional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ej. Cambio de butacas, error de digitación, baja de participante"
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-medium rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                selectedSeatIds.length === 0 ||
                isProcessing ||
                (hasCheckedInSelected && !forceCheckedIn)
              }
              className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs py-2.5 px-5 rounded-xl shadow-md shadow-amber-600/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Desasignando...
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" /> Desasignar {selectedSeatIds.length} Butaca(s)
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import { Seat } from '@/types/festival';
import { ROWS } from '@/utils/theater';
import {
  Ban,
  EyeOff,
  Wrench,
  Sliders,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Info,
  Lock,
  Unlock,
} from 'lucide-react';

interface BlockedSeatsManagerProps {
  seats: Seat[];
  onBlockSeats: (seatIds: string[], reason: string, notes?: string) => Promise<void>;
  onUnblockSeats: (seatIds: string[]) => Promise<void>;
  isProcessing?: boolean;
}

const BLOCK_REASONS = [
  { id: 'Mala visión / Ángulo ciego o visibilidad reducida', label: '👁️ Mala visión / Ángulo ciego o visibilidad reducida', icon: EyeOff },
  { id: 'Butaca dañada / Mecanismo en mal estado', label: '🛠️ Butaca dañada / Mecanismo en mal estado', icon: Wrench },
  { id: 'Espacio técnico / Mesa de sonido e iluminación', label: '🎛️ Espacio técnico / Mesa de sonido e iluminación', icon: Sliders },
  { id: 'Seguridad / Pasillo de evacuación', label: '🚪 Seguridad / Pasillo de evacuación', icon: ShieldAlert },
  { id: 'Otro motivo institucional', label: '📝 Otro motivo institucional', icon: Info },
];

export default function BlockedSeatsManager({
  seats,
  onBlockSeats,
  onUnblockSeats,
  isProcessing = false,
}: BlockedSeatsManagerProps) {
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [reason, setReason] = useState<string>(BLOCK_REASONS[0].id);
  const [notes, setNotes] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [unblockingIds, setUnblockingIds] = useState<Record<string, boolean>>({});

  // Map seats by row
  const seatsByRow = useMemo(() => {
    const map: Record<string, Seat[]> = {};
    ROWS.forEach((r) => {
      map[r] = seats.filter((s) => s.row === r);
    });
    return map;
  }, [seats]);

  // Blocked seats inventory list
  const blockedSeats = useMemo(() => {
    return seats.filter((s) => s.status === 'blocked');
  }, [seats]);

  // Metrics
  const stats = useMemo(() => {
    const total = blockedSeats.length;
    const malaVision = blockedSeats.filter((s) => (s.blockedReason || '').toLowerCase().includes('visión') || (s.blockedReason || '').toLowerCase().includes('visibilidad') || (s.blockedReason || '').toLowerCase().includes('ciego')).length;
    const danadas = blockedSeats.filter((s) => (s.blockedReason || '').toLowerCase().includes('dañada') || (s.blockedReason || '').toLowerCase().includes('mal estado')).length;
    const tecnicas = blockedSeats.filter((s) => (s.blockedReason || '').toLowerCase().includes('técnico') || (s.blockedReason || '').toLowerCase().includes('sonido')).length;
    return { total, malaVision, danadas, tecnicas };
  }, [blockedSeats]);

  // Filtered blocked seats table
  const filteredBlockedSeats = useMemo(() => {
    return blockedSeats.filter((s) => {
      const matchSearch =
        s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.blockedReason || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.blockedNotes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.blockedBy || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchReason =
        reasonFilter === 'all' || (s.blockedReason || '') === reasonFilter;

      return matchSearch && matchReason;
    });
  }, [blockedSeats, searchTerm, reasonFilter]);

  const handleToggleSeat = (seatId: string) => {
    const targetSeat = seats.find((s) => s.id === seatId);
    if (!targetSeat) return;

    // Prevent selecting sold or assigned seats unless they are blocked or available
    if (['assigned', 'sent', 'invitation', 'sold', 'checked_in'].includes(targetSeat.status)) {
      alert(`La butaca ${seatId} se encuentra actualmente en estado "${targetSeat.status}". Para bloquearla, debes desasignarla primero en su módulo respectivo.`);
      return;
    }

    setSelectedSeatIds((prev) =>
      prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId]
    );
  };

  const handleSelectAllInRow = (row: string) => {
    const rowSeats = seatsByRow[row] || [];
    const eligibleIds = rowSeats
      .filter((s) => s.status === 'available' || s.status === 'blocked')
      .map((s) => s.id);

    const allSelected = eligibleIds.every((id) => selectedSeatIds.includes(id));
    if (allSelected) {
      setSelectedSeatIds((prev) => prev.filter((id) => !eligibleIds.includes(id)));
    } else {
      setSelectedSeatIds((prev) => Array.from(new Set([...prev, ...eligibleIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedSeatIds([]);
  };

  const handleConfirmBlock = async () => {
    if (selectedSeatIds.length === 0) return;
    try {
      await onBlockSeats(selectedSeatIds, reason, notes);
      setSelectedSeatIds([]);
      setNotes('');
    } catch (e) {
      // handled by parent toast
    }
  };

  const handleConfirmUnblockSelected = async () => {
    if (selectedSeatIds.length === 0) return;
    try {
      await onUnblockSeats(selectedSeatIds);
      setSelectedSeatIds([]);
    } catch (e) {
      // handled by parent toast
    }
  };

  const handleUnblockSingle = async (seatId: string) => {
    setUnblockingIds((prev) => ({ ...prev, [seatId]: true }));
    try {
      await onUnblockSeats([seatId]);
    } finally {
      setUnblockingIds((prev) => ({ ...prev, [seatId]: false }));
    }
  };

  const getSeatColor = (seat: Seat) => {
    const isSelected = selectedSeatIds.includes(seat.id);

    if (isSelected) {
      return 'bg-amber-500 text-white font-bold border-amber-600 ring-2 ring-amber-300 scale-110 shadow-lg z-10';
    }

    if (seat.status === 'blocked') {
      return 'bg-slate-900 text-rose-300 font-bold border-rose-950 line-through ring-1 ring-rose-500/50 hover:bg-slate-800 cursor-pointer';
    }

    if (seat.status === 'available') {
      return 'bg-purple-100/90 text-purple-900 border-purple-200 hover:bg-purple-300/80 hover:scale-105 cursor-pointer';
    }

    // Occupied by other processes
    return 'bg-slate-200 text-slate-400 border-slate-300 opacity-60 cursor-not-allowed';
  };

  const currentlyBlockedSelected = selectedSeatIds.filter((id) =>
    blockedSeats.some((b) => b.id === id)
  );
  const currentlyAvailableSelected = selectedSeatIds.filter((id) =>
    seats.find((s) => s.id === id && s.status === 'available')
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1A1333] via-[#2D1854] to-[#1A1333] rounded-3xl p-6 lg:p-8 text-white shadow-xl border border-purple-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-400">
                <Ban className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-rose-400 tracking-wider uppercase">
                Control de Aforo y Mantenimiento
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
              Gestión de Butacas No Disponibles
            </h1>
            <p className="text-xs lg:text-sm text-purple-200/80 mt-1 max-w-2xl">
              Inhabilita butacas con mala visión, daños físicos o reservadas para equipamiento técnico. Las butacas bloqueadas quedan excluidas de la venta pública y de asignaciones.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-center min-w-[110px]">
              <span className="block text-2xl font-black text-rose-400">{stats.total}</span>
              <span className="text-[11px] font-semibold text-purple-200">No Disponibles</span>
            </div>
            <div className="px-4 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-center min-w-[110px]">
              <span className="block text-2xl font-black text-amber-400">{stats.malaVision}</span>
              <span className="text-[11px] font-semibold text-purple-200">Mala Visión</span>
            </div>
            <div className="px-4 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-center min-w-[110px]">
              <span className="block text-2xl font-black text-indigo-400">{stats.tecnicas}</span>
              <span className="text-[11px] font-semibold text-purple-200">Uso Técnico</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Map (2 cols) + Action Control Panel (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left: Dedicated Interactive Map */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 lg:p-7 border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base lg:text-lg font-extrabold text-slate-900">
                Seleccionador de Butacas para Bloqueo
              </h2>
              <p className="text-xs text-slate-500">
                Haz clic en las butacas que deseas inhabilitar o reactivar
              </p>
            </div>

            {/* Map Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-purple-100 border border-purple-300 inline-block" />
                <span>Disponible</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 inline-block shadow-xs" />
                <span>Seleccionada</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-rose-500/50 inline-block" />
                <span className="text-rose-700 font-bold">No Disponible (Bloqueada)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-slate-200 border border-slate-300 inline-block opacity-60" />
                <span className="text-slate-400">Ocupada / Asignada</span>
              </div>
            </div>
          </div>

          {/* Stage Banner */}
          <div className="w-full flex justify-center mb-6">
            <div className="w-4/5 max-w-md bg-gradient-to-r from-purple-100 via-indigo-100 to-purple-100 border border-purple-200/80 text-purple-900 font-extrabold text-xs tracking-widest uppercase py-2 px-6 rounded-b-2xl text-center">
              ESCENARIO PRINCIPAL
            </div>
          </div>

          {/* Seats Matrix */}
          <div className="overflow-x-auto pb-4">
            <div className="min-w-[780px] space-y-2 px-2">
              {ROWS.map((row) => {
                const rowSeats = seatsByRow[row] || [];
                const leftBlock = rowSeats.filter((s) => s.block === 'left');
                const centerBlock = rowSeats.filter((s) => s.block === 'center');
                const rightBlock = rowSeats.filter((s) => s.block === 'right');

                return (
                  <div key={row} className="flex items-center justify-between gap-3 group">
                    <button
                      type="button"
                      onClick={() => handleSelectAllInRow(row)}
                      title={`Seleccionar toda la fila ${row}`}
                      className="w-6 text-center text-xs font-bold text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors"
                    >
                      {row}
                    </button>

                    <div className="flex items-center justify-center gap-4 flex-1">
                      {/* Left Block (8 Seats) */}
                      <div className="flex items-center gap-1.5">
                        {leftBlock.map((seat) => (
                          <button
                            key={seat.id}
                            type="button"
                            onClick={() => handleToggleSeat(seat.id)}
                            className={`w-7 h-7 rounded-lg text-[10px] flex items-center justify-center transition-all duration-150 border ${getSeatColor(
                              seat
                            )}`}
                            title={`Butaca ${seat.id} - ${seat.status.toUpperCase()}${
                              seat.blockedReason ? ` (${seat.blockedReason})` : ''
                            }`}
                          >
                            {seat.number}
                          </button>
                        ))}
                      </div>

                      {/* Center Block (18 Seats) */}
                      <div className="flex items-center gap-1.5">
                        {centerBlock.map((seat) => (
                          <button
                            key={seat.id}
                            type="button"
                            onClick={() => handleToggleSeat(seat.id)}
                            className={`w-7 h-7 rounded-lg text-[10px] flex items-center justify-center transition-all duration-150 border ${getSeatColor(
                              seat
                            )}`}
                            title={`Butaca ${seat.id} - ${seat.status.toUpperCase()}${
                              seat.blockedReason ? ` (${seat.blockedReason})` : ''
                            }`}
                          >
                            {seat.number}
                          </button>
                        ))}
                      </div>

                      {/* Right Block (8 Seats) */}
                      <div className="flex items-center gap-1.5">
                        {rightBlock.map((seat) => (
                          <button
                            key={seat.id}
                            type="button"
                            onClick={() => handleToggleSeat(seat.id)}
                            className={`w-7 h-7 rounded-lg text-[10px] flex items-center justify-center transition-all duration-150 border ${getSeatColor(
                              seat
                            )}`}
                            title={`Butaca ${seat.id} - ${seat.status.toUpperCase()}${
                              seat.blockedReason ? ` (${seat.blockedReason})` : ''
                            }`}
                          >
                            {seat.number}
                          </button>
                        ))}
                      </div>
                    </div>

                    <span className="w-6 text-center text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                      {row}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Action Panel */}
        <div className="bg-white rounded-3xl p-6 lg:p-7 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Acciones de Bloqueo
              </h3>
              <p className="text-xs text-slate-500">
                Aplica o remueve restricciones
              </p>
            </div>
            {selectedSeatIds.length > 0 && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Limpiar ({selectedSeatIds.length})
              </button>
            )}
          </div>

          {/* Selection preview chips */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">
              Butacas Seleccionadas ({selectedSeatIds.length}):
            </label>
            {selectedSeatIds.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-medium">
                Haz clic en las butacas del mapa para seleccionarlas
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
                {selectedSeatIds.map((id) => {
                  const isAlreadyBlocked = blockedSeats.some((b) => b.id === id);
                  return (
                    <span
                      key={id}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                        isAlreadyBlocked
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}
                    >
                      {id} {isAlreadyBlocked ? '(🚫)' : ''}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reason Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">
              Motivo del Bloqueo:
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            >
              {BLOCK_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Internal Notes */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">
              Notas Internas (Opcional):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Foco de luz tapa visibilidad directa / Butaca reclinable rota"
              rows={2}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleConfirmBlock}
              disabled={isProcessing || selectedSeatIds.length === 0}
              className="w-full py-3 px-4 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Ban className="w-4 h-4" />
              <span>
                {isProcessing
                  ? 'Procesando bloqueo...'
                  : `Marcar como No Disponibles (${selectedSeatIds.length})`}
              </span>
            </button>

            {currentlyBlockedSelected.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmUnblockSelected}
                disabled={isProcessing}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Unlock className="w-4 h-4" />
                <span>
                  Reactivar / Desbloquear ({currentlyBlockedSelected.length})
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Inventory Table of Blocked Seats */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span>Inventario de Butacas Inhabilitadas</span>
              <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-full text-xs font-black">
                {blockedSeats.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Registro completo de butacas marcadas como no disponibles
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por butaca, motivo o nota..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Filter by reason */}
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos los motivos</option>
              {BLOCK_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id.split('/')[0]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredBlockedSeats.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-sm font-extrabold text-slate-700">
              No hay butacas bloqueadas con este filtro
            </p>
            <p className="text-xs text-slate-500">
              Todas las butacas sin asignación están disponibles para el público
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Butaca</th>
                  <th className="py-3 px-4">Fila / Asiento</th>
                  <th className="py-3 px-4">Motivo del Bloqueo</th>
                  <th className="py-3 px-4">Notas Internas</th>
                  <th className="py-3 px-4">Bloqueado Por</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredBlockedSeats.map((seat) => (
                  <tr key={seat.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-black">
                      <span className="px-3 py-1 bg-slate-900 text-rose-300 border border-rose-950 rounded-lg text-xs tracking-wider">
                        {seat.id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      Fila <strong className="text-slate-900">{seat.row}</strong> — Butaca{' '}
                      <strong className="text-slate-900">{seat.number}</strong>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
                        {seat.blockedReason || 'Mala visión / No disponible'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                      {seat.blockedNotes || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      <div>{seat.blockedBy || 'Administrador'}</div>
                      {seat.blockedAt && (
                        <div className="text-[10px] text-slate-400">
                          {new Date(seat.blockedAt).toLocaleDateString('es-CL', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleUnblockSingle(seat.id)}
                        disabled={unblockingIds[seat.id]}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1.5 ml-auto cursor-pointer transition-all disabled:opacity-50"
                        title="Reactivar butaca como disponible"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>
                          {unblockingIds[seat.id] ? 'Reactivando...' : 'Desbloquear'}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

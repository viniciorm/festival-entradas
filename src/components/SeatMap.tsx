'use client';

import React from 'react';
import { Seat, SeatStatus } from '@/types/festival';
import { ROWS } from '@/utils/theater';

interface SeatMapProps {
  seats: Seat[];
  selectedSeatIds: string[];
  onToggleSeat: (seatId: string) => void;
  onSelectRow?: (row: string) => void;
  onClearSelection?: () => void;
}

export default function SeatMap({
  seats,
  selectedSeatIds,
  onToggleSeat,
  onClearSelection,
}: SeatMapProps) {
  // Map seats by row for fast layout rendering
  const seatsByRow = React.useMemo(() => {
    const map: Record<string, Seat[]> = {};
    ROWS.forEach((r) => {
      map[r] = seats.filter((s) => s.row === r);
    });
    return map;
  }, [seats]);

  const getSeatStyle = (seat: Seat) => {
    const isSelected = selectedSeatIds.includes(seat.id);

    if (isSelected) {
      return 'bg-blue-600 text-white font-bold border-blue-700 shadow-md scale-110 ring-2 ring-blue-400 z-10';
    }

    switch (seat.status) {
      case 'assigned':
        return 'bg-slate-300 text-slate-700 border-slate-400 hover:bg-slate-400/80 cursor-pointer';
      case 'sent':
        return 'bg-indigo-600 text-white font-bold border-indigo-800 ring-1 ring-indigo-400 cursor-pointer';
      case 'checked_in':
        return 'bg-red-500 text-white font-bold border-red-700 cursor-not-allowed opacity-90';
      case 'available':
      default:
        return 'bg-purple-100/90 text-purple-900 border-purple-200 hover:bg-purple-300/80 hover:scale-105 cursor-pointer';
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col h-full">
      {/* Map Header & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Mapa de butacas</h2>
          <p className="text-xs text-slate-500">Selecciona las butacas para asignar o enviar</p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-purple-100 border border-purple-300 inline-block" />
            <span>Disponible</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-blue-600 inline-block shadow-xs" />
            <span>Seleccionada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-slate-300 border border-slate-400 inline-block" />
            <span>Asignada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 inline-block" />
            <span>Enviada por Mail</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block" />
            <span>Ingresado (Puerta)</span>
          </div>
        </div>
      </div>

      {/* Theater Stage Banner */}
      <div className="w-full flex justify-center mb-8">
        <div className="w-4/5 max-w-lg bg-gradient-to-r from-purple-100 via-indigo-100 to-purple-100 border border-purple-200/80 text-purple-900 font-extrabold text-xs tracking-widest uppercase py-2.5 px-6 rounded-b-2xl shadow-xs text-center relative">
          <span className="relative z-10">ESCENARIO PRINCIPAL</span>
          <div className="absolute inset-0 bg-white/40 blur-xs rounded-b-2xl pointer-events-none" />
        </div>
      </div>

      {/* Seat Grid - 3 Blocks (Left: 8, Center: 18, Right: 8) */}
      <div className="overflow-x-auto pb-4 flex-1">
        <div className="min-w-[780px] space-y-2.5 px-2">
          {ROWS.map((row) => {
            const rowSeats = seatsByRow[row] || [];
            const leftBlock = rowSeats.filter((s) => s.block === 'left');
            const centerBlock = rowSeats.filter((s) => s.block === 'center');
            const rightBlock = rowSeats.filter((s) => s.block === 'right');

            return (
              <div key={row} className="flex items-center justify-between gap-3 group">
                {/* Left Row Indicator */}
                <span className="w-6 text-center text-xs font-bold text-slate-400 group-hover:text-purple-700 transition-colors">
                  {row}
                </span>

                {/* Seats Blocks Wrapper */}
                <div className="flex items-center justify-center gap-4 flex-1">
                  {/* Left Block (8 Seats) */}
                  <div className="flex items-center gap-1.5">
                    {leftBlock.map((seat) => (
                      <button
                        key={seat.id}
                        onClick={() => onToggleSeat(seat.id)}
                        title={`Fila ${seat.row} - Asiento ${seat.number}\nArchivo: ${seat.pdfFilename}\nEstado: ${seat.status}${
                          seat.assignedParticipantName ? `\nAsignada a: ${seat.assignedParticipantName}` : ''
                        }`}
                        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full text-[11px] flex items-center justify-center transition-all duration-150 border ${getSeatStyle(
                          seat
                        )}`}
                      >
                        {seat.number}
                      </button>
                    ))}
                  </div>

                  {/* Aisle 1 Separator */}
                  <div className="w-4 h-6 border-x border-dashed border-slate-200 flex items-center justify-center">
                    <span className="text-[8px] text-slate-300 rotate-90 select-none">PASILLO</span>
                  </div>

                  {/* Center Block (18 Seats) */}
                  <div className="flex items-center gap-1.5">
                    {centerBlock.map((seat) => (
                      <button
                        key={seat.id}
                        onClick={() => onToggleSeat(seat.id)}
                        title={`Fila ${seat.row} - Asiento ${seat.number}\nArchivo: ${seat.pdfFilename}\nEstado: ${seat.status}${
                          seat.assignedParticipantName ? `\nAsignada a: ${seat.assignedParticipantName}` : ''
                        }`}
                        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full text-[11px] flex items-center justify-center transition-all duration-150 border ${getSeatStyle(
                          seat
                        )}`}
                      >
                        {seat.number}
                      </button>
                    ))}
                  </div>

                  {/* Aisle 2 Separator */}
                  <div className="w-4 h-6 border-x border-dashed border-slate-200 flex items-center justify-center">
                    <span className="text-[8px] text-slate-300 rotate-90 select-none">PASILLO</span>
                  </div>

                  {/* Right Block (8 Seats) */}
                  <div className="flex items-center gap-1.5">
                    {rightBlock.map((seat) => (
                      <button
                        key={seat.id}
                        onClick={() => onToggleSeat(seat.id)}
                        title={`Fila ${seat.row} - Asiento ${seat.number}\nArchivo: ${seat.pdfFilename}\nEstado: ${seat.status}${
                          seat.assignedParticipantName ? `\nAsignada a: ${seat.assignedParticipantName}` : ''
                        }`}
                        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full text-[11px] flex items-center justify-center transition-all duration-150 border ${getSeatStyle(
                          seat
                        )}`}
                      >
                        {seat.number}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Row Indicator */}
                <span className="w-6 text-center text-xs font-bold text-slate-400 group-hover:text-purple-700 transition-colors">
                  {row}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Map Footer Action Controls */}
      {selectedSeatIds.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between bg-blue-50/70 p-3 rounded-xl border border-blue-100">
          <div className="text-xs font-semibold text-blue-900">
            <span>{selectedSeatIds.length} butaca(s) seleccionada(s)</span>
          </div>
          <button
            onClick={onClearSelection}
            className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
          >
            Deseleccionar todas
          </button>
        </div>
      )}
    </div>
  );
}

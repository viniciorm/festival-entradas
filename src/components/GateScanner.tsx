'use client';

import React, { useState } from 'react';
import { QrCode, Search, CheckCircle2, AlertTriangle, Armchair, ShieldCheck, User, Camera } from 'lucide-react';
import { Seat } from '@/types/festival';

interface GateScannerProps {
  seats: Seat[];
  onCheckInSeat: (seatId: string) => boolean;
}

export default function GateScanner({ seats, onCheckInSeat }: GateScannerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    seat?: Seat;
  } | null>(null);

  const handleManualCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const query = searchQuery.trim().toUpperCase();

    // Find seat by ID (e.g. C12 or C-12) or ticket code or PDF filename
    const matchedSeat = seats.find(
      (s) =>
        s.id.toUpperCase() === query ||
        s.id.replace('-', '').toUpperCase() === query ||
        (s.ticketCode && s.ticketCode.toUpperCase().includes(query)) ||
        (s.pdfFilename && s.pdfFilename.toUpperCase().includes(query))
    );

    if (!matchedSeat) {
      setScanResult({
        success: false,
        message: `No se encontró ninguna entrada correspondiente al código o asiento "${searchQuery}".`,
      });
      return;
    }

    if (matchedSeat.status === 'checked_in') {
      setScanResult({
        success: false,
        message: `⚠️ ATENCIÓN: Esta entrada (Fila ${matchedSeat.row} - Asiento ${matchedSeat.number}) YA FUE ESCANEADA E INGRESADA a las ${matchedSeat.checkedInAt || 'hora previa'}.`,
        seat: matchedSeat,
      });
      return;
    }

    const success = onCheckInSeat(matchedSeat.id);
    if (success) {
      setScanResult({
        success: true,
        message: `✅ ENTRADA VÁLIDA. Acceso autorizado para Fila ${matchedSeat.row} - Asiento ${matchedSeat.number}.`,
        seat: { ...matchedSeat, status: 'checked_in' },
      });
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs max-w-3xl mx-auto">
      <div className="text-center mb-6 pb-4 border-b border-slate-100">
        <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-2">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">Control de Acceso y Escáner de Puerta</h2>
        <p className="text-xs text-slate-500">Valida los códigos QR o números de entrada al momento del ingreso al teatro</p>
      </div>

      {/* Manual Code Input Form */}
      <form onSubmit={handleManualCheckIn} className="space-y-4 mb-6">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Buscar por número de butaca, código QR o nombre de archivo PDF:
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ej. C12, C000012FDVC2026-CL.pdf o FDVC2026-C012"
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm font-semibold rounded-xl pl-9 pr-3.5 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-sm cursor-pointer"
            >
              Validar Entrada
            </button>
          </div>
        </div>
      </form>

      {/* Result Card */}
      {scanResult && (
        <div
          className={`p-5 rounded-2xl border text-sm transition-all ${
            scanResult.success
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-red-50 border-red-300 text-red-950'
          }`}
        >
          <div className="flex items-start gap-3">
            {scanResult.success ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-2 flex-1">
              <p className="font-extrabold text-base leading-snug">{scanResult.message}</p>

              {scanResult.seat && (
                <div className="bg-white/80 rounded-xl p-3 border border-slate-200/60 text-xs space-y-1 text-slate-800">
                  <div className="flex items-center justify-between font-bold">
                    <span>Ubicación:</span>
                    <span className="text-indigo-600 font-extrabold">
                      Fila {scanResult.seat.row} - Asiento {scanResult.seat.number} ({scanResult.seat.id})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Asignado a:</span>
                    <span className="font-semibold">{scanResult.seat.assignedParticipantName || 'No especificado'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Archivo PDF:</span>
                    <span className="font-mono text-[11px]">{scanResult.seat.pdfFilename}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

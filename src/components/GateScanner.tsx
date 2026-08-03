'use client';

import React, { useState } from 'react';
import { Search, CheckCircle2, AlertTriangle, ShieldCheck, Lock, ShieldAlert } from 'lucide-react';
import { Seat } from '@/types/festival';
import { verifyTicketQRPayload } from '@/utils/security';

interface GateScannerProps {
  seats: Seat[];
  onCheckInSeat: (seatId: string) => boolean;
}

export default function GateScanner({ seats, onCheckInSeat }: GateScannerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    isSecurityAlert?: boolean;
    message: string;
    seat?: Seat;
    securityHash?: string;
  } | null>(null);

  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const query = searchQuery.trim();

    // Check if input is a cryptographic JSON QR string
    if (query.startsWith('{') && query.endsWith('}')) {
      const securityCheck = await verifyTicketQRPayload(query);

      if (!securityCheck.isValid) {
        setScanResult({
          success: false,
          isSecurityAlert: true,
          message: securityCheck.reason || '🚨 ALERTA CRÍTICA: Código QR falsificado o firma no válida.',
        });
        return;
      }

      const seatId = securityCheck.data?.seatId;
      const matchedSeat = seats.find((s) => s.id.toUpperCase() === seatId?.toUpperCase());

      if (!matchedSeat) {
        setScanResult({
          success: false,
          isSecurityAlert: true,
          message: `🚨 ALERTA: La firma QR es válida pero la butaca "${seatId}" no existe en el sistema.`,
        });
        return;
      }

      if (matchedSeat.status === 'checked_in') {
        setScanResult({
          success: false,
          message: `⚠️ ATENCIÓN: Entrada válida (Fila ${matchedSeat.row} - Asiento ${matchedSeat.number}) PERO YA FUE ESCANEADA previa ingreso.`,
          seat: matchedSeat,
          securityHash: securityCheck.data?.hash,
        });
        return;
      }

      const success = onCheckInSeat(matchedSeat.id);
      if (success) {
        setScanResult({
          success: true,
          message: `✅ ENTRADA AUTÉNTICA Y VÁLIDA. Acceso autorizado para Fila ${matchedSeat.row} - Asiento ${matchedSeat.number}.`,
          seat: { ...matchedSeat, status: 'checked_in' },
          securityHash: securityCheck.data?.hash,
        });
      }
      return;
    }

    // Standard ID / File / Code search
    const cleanQuery = query.toUpperCase();
    const matchedSeat = seats.find(
      (s) =>
        s.id.toUpperCase() === cleanQuery ||
        s.id.replace('-', '').toUpperCase() === cleanQuery ||
        (s.ticketCode && s.ticketCode.toUpperCase().includes(cleanQuery)) ||
        (s.pdfFilename && s.pdfFilename.toUpperCase().includes(cleanQuery))
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
          <ShieldCheck className="w-6 h-6 text-indigo-600" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 flex items-center justify-center gap-2">
          Control de Acceso y Validación Anti-Fraude QR
        </h2>
        <p className="text-xs text-slate-500">
          Escanea el código QR firmado criptográficamente o busca manualmente por butaca
        </p>
      </div>

      {/* Manual Code / QR String Form */}
      <form onSubmit={handleManualCheckIn} className="space-y-4 mb-6">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Escanea con pistola lectora QR o ingresa número de butaca / archivo PDF:
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Escanea el código QR o ingresa A1, A000001FDVC2026-CL.pdf..."
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm font-semibold rounded-xl pl-9 pr-3.5 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
            <button
              type="submit"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <Lock className="w-4 h-4 text-amber-300" /> Validar Firma QR
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
              : scanResult.isSecurityAlert
              ? 'bg-red-100 border-red-400 text-red-950 font-black shadow-md'
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex items-start gap-3">
            {scanResult.success ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            ) : scanResult.isSecurityAlert ? (
              <ShieldAlert className="w-7 h-7 text-red-600 shrink-0 mt-0.5 animate-bounce" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-2 flex-1">
              <p className="font-extrabold text-base leading-snug">{scanResult.message}</p>

              {scanResult.securityHash && (
                <div className="inline-flex items-center gap-2 bg-indigo-950 text-amber-400 text-xs px-3 py-1 rounded-lg font-mono font-bold">
                  <Lock className="w-3.5 h-3.5 text-amber-400" /> HASH AUTÉNTICO: {scanResult.securityHash}
                </div>
              )}

              {scanResult.seat && (
                <div className="bg-white/90 rounded-xl p-3 border border-slate-200 text-xs space-y-1 text-slate-800">
                  <div className="flex items-center justify-between font-bold">
                    <span>Ubicación:</span>
                    <span className="text-indigo-700 font-extrabold">
                      Fila {scanResult.seat.row} - Asiento {scanResult.seat.number} ({scanResult.seat.id})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Titular asignado:</span>
                    <span className="font-semibold">{scanResult.seat.assignedParticipantName || 'No especificado'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Archivo PDF:</span>
                    <span className="font-mono text-[11px] text-slate-700 font-bold">{scanResult.seat.pdfFilename}</span>
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

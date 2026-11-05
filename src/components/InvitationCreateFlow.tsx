'use client';

import React, { useState } from 'react';
import { Mail, CheckCircle2, ArrowLeft, ArrowRight, User, Ticket, FileCheck, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import SeatMap from '@/components/SeatMap';
import { Seat } from '@/types/festival';
import { generateTicketPDF } from '@/utils/pdfGenerator';

interface InvitationCreateFlowProps {
  seats: Seat[];
  onCancel: () => void;
  onConfirmEmit: (formData: {
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    seatIds: string[];
    reason: string;
    internalNotes: string;
  }) => Promise<void>;
  currentAdminName?: string;
}

export default function InvitationCreateFlow({
  seats,
  onCancel,
  onConfirmEmit,
  currentAdminName = 'Administrador',
}: InvitationCreateFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [reason, setReason] = useState<'artista' | 'prensa' | 'auspiciador' | 'cortesía' | 'producción' | 'otro'>('cortesía');
  const [internalNotes, setInternalNotes] = useState('');

  // Processing state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleSeat = (seatId: string) => {
    setSelectedSeatIds((prev) =>
      prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId]
    );
  };

  const selectedSeats = seats.filter((s) => selectedSeatIds.includes(s.id));

  const handleNextStep1 = () => {
    if (selectedSeatIds.length === 0) return;
    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestEmail.trim()) return;
    setStep(3);
  };

  const handleConfirmFinal = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onConfirmEmit({
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim(),
        seatIds: selectedSeatIds,
        reason,
        internalNotes: internalNotes.trim(),
      });
    } catch (err: any) {
      console.error('Error emitting invitation:', err);
      setErrorMessage(err.message || 'Error al emitir la invitación. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
      {/* Header & Steps Indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-extrabold text-slate-900">Nueva Invitación</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Emisión directa de pases sin cobro económico ni paso por Webpay.
          </p>
        </div>

        {/* Step Pills */}
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className={`px-3 py-1 rounded-full border ${step === 1 ? 'bg-amber-500 text-white border-amber-600' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
            1. Butacas ({selectedSeatIds.length})
          </span>
          <span className="text-slate-300">→</span>
          <span className={`px-3 py-1 rounded-full border ${step === 2 ? 'bg-amber-500 text-white border-amber-600' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
            2. Datos del Invitado
          </span>
          <span className="text-slate-300">→</span>
          <span className={`px-3 py-1 rounded-full border ${step === 3 ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
            3. Revisar y Confirmar
          </span>
        </div>
      </div>

      {/* ERROR MESSAGE DISPLAY */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs font-bold flex items-center gap-2 animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: MAP SELECTION */}
      {step === 1 && (
        <div className="space-y-6">
          <SeatMap
            seats={seats}
            selectedSeatIds={selectedSeatIds}
            onToggleSeat={toggleSeat}
            onClearSelection={() => setSelectedSeatIds([])}
          />

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={onCancel}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancelar
            </button>

            <button
              onClick={handleNextStep1}
              disabled={selectedSeatIds.length === 0}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 font-extrabold text-xs py-2.5 px-5 rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Continuar con datos del invitado</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: GUEST DETAILS FORM */}
      {step === 2 && (
        <form onSubmit={handleNextStep2} className="max-w-xl mx-auto space-y-5 py-4">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between text-xs">
            <span className="font-bold text-amber-900">
              Butacas seleccionadas: <strong className="text-indigo-900 font-mono text-sm ml-1">{selectedSeatIds.join(', ')}</strong>
            </span>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-amber-700 hover:underline font-bold"
            >
              Cambiar butacas
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" /> Nombre completo del invitado *
            </label>
            <input
              type="text"
              required
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Ej: Carolina Fuentes"
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> Correo electrónico de destino *
            </label>
            <input
              type="email"
              required
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="ejemplo@invitado.cl"
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Teléfono (opcional)
            </label>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="+56912345678"
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Motivo interno de la invitación *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="artista">Artista / Jurado</option>
              <option value="prensa">Prensa / Media</option>
              <option value="auspiciador">Auspiciador / Sponsor</option>
              <option value="cortesía">Cortesía especial</option>
              <option value="producción">Producción / Staff</option>
              <option value="otro">Otro motivo</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Notas internas (visibles solo para administración)
            </label>
            <textarea
              rows={3}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Agrega cualquier observación sobre esta invitación..."
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl p-3 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              ← Volver al mapa
            </button>

            <button
              type="submit"
              disabled={!guestName.trim() || !guestEmail.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs py-2.5 px-5 rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
            >
              <span>Revisar invitación</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: REVIEW BEFORE EMITTING */}
      {step === 3 && (
        <div className="max-w-xl mx-auto space-y-6 py-2">
          <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-4 shadow-xl border border-slate-800">
            <div className="flex items-center gap-2 text-amber-400 font-extrabold text-sm border-b border-slate-800 pb-3">
              <FileCheck className="w-5 h-5" />
              <span>Resumen antes de emitir</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block">Invitado:</span>
                <strong className="text-white text-sm block">{guestName}</strong>
                <span className="text-amber-300 font-mono">{guestEmail}</span>
                {guestPhone && <span className="block text-slate-400">{guestPhone}</span>}
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">Butacas a emitir:</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSeatIds.map((sid) => (
                    <span key={sid} className="px-2.5 py-1 bg-amber-400/20 text-amber-300 border border-amber-400/40 font-extrabold rounded-lg text-xs">
                      {sid}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block">Motivo interno:</span>
                <span className="capitalize font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 inline-block mt-0.5">
                  {reason}
                </span>
              </div>

              {internalNotes && (
                <div>
                  <span className="text-slate-400 font-semibold block">Notas internas:</span>
                  <p className="text-slate-300 italic bg-slate-800/80 p-2 rounded-lg border border-slate-700/80">
                    {internalNotes}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Sin cobro económico. No pasa por Webpay.</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Mail className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Se enviará desde <strong className="text-white font-mono">festivalnac.danzadelvientre@gmail.com</strong></span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                  <FileCheck className="w-4 h-4 shrink-0 text-slate-400" />
                  <span>Generará {selectedSeatIds.length} PDF(s) individuales con sello <strong className="text-amber-400">INVITACIÓN</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 font-semibold">
            ⚠️ Al confirmar, las {selectedSeatIds.length} butaca(s) quedará(n) automáticamente marcada(s) como <strong className="text-slate-900 uppercase">Ocupado</strong> en la ticketera pública.
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              ← Volver a editar
            </button>

            <button
              onClick={handleConfirmFinal}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs py-3 px-6 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Emitiendo invitaciones...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>✓ Confirmar y emitir entradas</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Send, Download, Save, Mail, User, Ticket, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import QRCode from 'qrcode';
import { Seat, Participant } from '@/types/festival';
import { generateTicketPDF, downloadPDFBlob } from '@/utils/pdfGenerator';

interface AssignmentPanelProps {
  selectedSeats: Seat[];
  participants: Participant[];
  onAssignAndSend: (participantId: string, email: string, mode: 'send' | 'save') => Promise<void>;
  isProcessing?: boolean;
}

export default function AssignmentPanel({
  selectedSeats,
  participants,
  onAssignAndSend,
  isProcessing = false,
}: AssignmentPanelProps) {
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>(participants[0]?.id || '');
  const [email, setEmail] = useState<string>(participants[0]?.email || '');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const selectedParticipant = participants.find((p) => p.id === selectedParticipantId);

  // Update email when selected participant changes
  useEffect(() => {
    if (selectedParticipant) {
      setEmail(selectedParticipant.email);
    }
  }, [selectedParticipantId, selectedParticipant]);

  // Generate QR Code preview for first selected seat
  const previewSeat = selectedSeats[0] || {
    id: 'C12',
    row: 'C',
    number: 12,
    paddedNumber: '000012',
    status: 'available',
    pdfFilename: 'C000012FDVC2026-CL.pdf',
  };

  useEffect(() => {
    const generatePreviewQR = async () => {
      try {
        const url = await QRCode.toDataURL(
          JSON.stringify({
            ticketCode: `FDVC2026-${previewSeat.id}`,
            seatId: previewSeat.id,
            participant: selectedParticipant?.name || 'Compañía Al Zahra',
            event: 'Festival Nacional Danza del Vientre Chile 2026',
          }),
          { width: 120, margin: 1 }
        );
        setQrDataUrl(url);
      } catch (err) {
        console.error('Error generating preview QR:', err);
      }
    };
    generatePreviewQR();
  }, [previewSeat.id, selectedParticipant?.name]);

  const handleDownloadPDFs = async () => {
    if (selectedSeats.length === 0) return;
    setIsDownloading(true);
    try {
      for (const seat of selectedSeats) {
        const { pdfBlob, filename } = await generateTicketPDF(seat, selectedParticipant);
        downloadPDFBlob(pdfBlob, filename);
      }
    } catch (err) {
      console.error('Error al generar los PDFs:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between h-full space-y-6">
      <div>
        {/* Panel Title */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-indigo-600" /> Asignar entradas
          </h2>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/80">
            FDVC 2026
          </span>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          {/* Select Participant */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" /> Participante / Grupo o Solista
            </label>
            <select
              value={selectedParticipantId}
              onChange={(e) => setSelectedParticipantId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
            >
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.dancersCount} {p.dancersCount === 1 ? 'bailarina' : 'bailarinas'} ({p.type})
                </option>
              ))}
            </select>
          </div>

          {/* Selected Seats Summary */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-700">Resumen de butacas:</span>
              <span className="font-semibold text-indigo-600">
                {selectedSeats.length} {selectedSeats.length === 1 ? 'butaca' : 'butacas'} seleccionada(s)
              </span>
            </div>

            <div className="min-h-12 bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-wrap gap-1.5 items-center">
              {selectedSeats.length > 0 ? (
                selectedSeats.map((seat) => (
                  <span
                    key={seat.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-xs rounded-lg shadow-2xs"
                  >
                    {seat.id}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 italic">Haz clic en las butacas del mapa para seleccionar</span>
              )}
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> Correo electrónico de destino
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@festival.cl"
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl pl-9 pr-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 mt-6">
          <button
            onClick={() => onAssignAndSend(selectedParticipantId, email, 'send')}
            disabled={selectedSeats.length === 0 || isProcessing}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Assignar y enviar por correo</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onAssignAndSend(selectedParticipantId, email, 'save')}
              disabled={selectedSeats.length === 0 || isProcessing}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" /> Guardar sin enviar
            </button>

            <button
              onClick={handleDownloadPDFs}
              disabled={selectedSeats.length === 0 || isDownloading}
              className="w-full bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs py-2.5 px-3 rounded-xl border border-amber-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-amber-600" />}
              <span>Descargar PDFs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Ticket Preview Box */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 relative overflow-hidden">
        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">
          Vista previa de entrada
        </span>

        <div className="bg-white rounded-lg p-3 border border-purple-100 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#1A1333] text-amber-400 flex items-center justify-center shrink-0 border border-amber-400/40">
              <span className="text-sm">🌙</span>
            </div>
            <div className="leading-tight">
              <h4 className="text-[10px] font-black text-purple-950 uppercase tracking-tight">
                FESTIVAL NACIONAL
              </h4>
              <p className="text-[9px] font-bold text-amber-600">DANZA DEL VIENTRE 2026</p>
              <p className="text-[10px] font-extrabold text-slate-800 mt-1 truncate max-w-[120px]">
                {selectedParticipant?.name || 'Compañía Al Zahra'}
              </p>
              <p className="text-[9px] text-slate-400">
                Fila {previewSeat.row} - Asiento {previewSeat.number}
              </p>
            </div>
          </div>

          {/* QR Code Graphic */}
          {qrDataUrl && (
            <div className="w-14 h-14 bg-slate-100 p-1 rounded-md border border-slate-200 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR Preview" className="w-full h-full object-contain" />
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400 font-semibold">
          <span>Nombre de archivo PDF:</span>
          <span className="text-indigo-600 font-mono font-bold">
            {previewSeat.pdfFilename || `${previewSeat.row}${previewSeat.paddedNumber}FDVC2026-CL.pdf`}
          </span>
        </div>
      </div>
    </div>
  );
}

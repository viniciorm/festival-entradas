'use client';

import React, { useState, useEffect } from 'react';
import { Send, Download, Save, Mail, User, Ticket, Loader2, Eye, X, FileCheck } from 'lucide-react';
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
  
  // PDF Live Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string>('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState<boolean>(false);

  const selectedParticipant = participants.find((p) => p.id === selectedParticipantId);

  // Update email when selected participant changes
  useEffect(() => {
    if (selectedParticipant) {
      setEmail(selectedParticipant.email);
    }
  }, [selectedParticipantId, selectedParticipant]);

  const previewSeat = selectedSeats[0] || {
    id: 'A1',
    row: 'A',
    number: 1,
    paddedNumber: '000001',
    status: 'available',
    pdfFilename: 'A000001FDVC2026-CL.pdf',
  };

  useEffect(() => {
    const generatePreviewQR = async () => {
      try {
        const url = await QRCode.toDataURL(
          JSON.stringify({
            ticketCode: `FDVC2026-${previewSeat.id}`,
            seatId: previewSeat.id,
            participant: selectedParticipant?.name || 'Academia Raks Sharqi Chile',
            event: 'Festival Nacional Danza del Vientre Chile 2026',
          }),
          { width: 120, margin: 1, color: { dark: '#1E1B4B', light: '#FFFFFF' } }
        );
        setQrDataUrl(url);
      } catch (err) {
        console.error('Error generating preview QR:', err);
      }
    };
    generatePreviewQR();
  }, [previewSeat.id, selectedParticipant?.name]);

  const handleOpenPdfPreview = async () => {
    setIsGeneratingPreview(true);
    try {
      const seatToPreview = selectedSeats[0] || previewSeat;
      const { dataUrl, filename } = await generateTicketPDF(seatToPreview, selectedParticipant);
      setPreviewPdfUrl(dataUrl);
      setPreviewFilename(filename);
      setShowPreviewModal(true);
    } catch (err) {
      console.error('Error generating PDF preview:', err);
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleDownloadPDFs = async () => {
    if (selectedSeats.length === 0) return;
    setIsDownloading(true);
    try {
      for (const seat of selectedSeats) {
        const { pdfBlob, filename } = await generateTicketPDF(seat, selectedParticipant);
        downloadPDFBlob(pdfBlob, filename);
      }
    } catch (err) {
      console.error('Error downloading PDFs:', err);
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
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Asignar y enviar por correo</span>
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
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
            Entrada PDF Oficial
          </span>
          <button
            onClick={handleOpenPdfPreview}
            disabled={isGeneratingPreview}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200/80 transition-all cursor-pointer"
          >
            {isGeneratingPreview ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
            <span>👁️ Previsualizar PDF</span>
          </button>
        </div>

        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 rounded-xl p-3 text-white shadow-md border border-amber-400/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/festival-dancers.jpg" alt="Logo Festival" className="w-10 h-10 rounded-full object-cover border-2 border-amber-400 shadow-sm shrink-0" />
            <div className="leading-tight">
              <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-tight">
                FESTIVAL DANZA DEL VIENTRE
              </h4>
              <p className="text-[9px] font-bold text-indigo-200">CHILE 2026</p>
              <p className="text-[10px] font-extrabold text-white mt-0.5 truncate max-w-[120px]">
                {selectedParticipant?.name || 'Academia Raks Sharqi Chile'}
              </p>
              <p className="text-[9px] text-amber-300 font-extrabold">
                Fila {previewSeat.row} - Asiento {previewSeat.number}
              </p>
            </div>
          </div>

          {/* QR Code Graphic */}
          {qrDataUrl && (
            <div className="w-12 h-12 bg-white p-1 rounded-md border border-amber-400 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR Preview" className="w-full h-full object-contain" />
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-[9px] text-slate-500 font-semibold">
          <span>Formato nombre PDF:</span>
          <span className="text-indigo-700 font-mono font-extrabold">
            {previewSeat.pdfFilename || `${previewSeat.row}${previewSeat.paddedNumber}FDVC2026-CL.pdf`}
          </span>
        </div>
      </div>

      {/* PDF Live Preview Modal */}
      {showPreviewModal && previewPdfUrl && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-sm text-white">
                  Vista Previa de Entrada PDF ({previewFilename})
                </h3>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: PDF iframe viewer */}
            <div className="flex-1 bg-slate-100 p-4 min-h-[400px] flex items-center justify-center">
              <iframe
                src={previewPdfUrl}
                title="Vista previa PDF Entrada Festival"
                className="w-full h-[480px] rounded-xl border border-slate-300 shadow-lg"
              />
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold">
                Nomenclatura: <strong className="font-mono text-slate-800">{previewFilename}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Cerrar
                </button>
                <button
                  onClick={handleDownloadPDFs}
                  className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

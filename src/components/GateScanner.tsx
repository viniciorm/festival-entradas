'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Lock,
  ShieldAlert,
  Volume2,
  VolumeX,
  History,
  RotateCcw,
} from 'lucide-react';
import { Seat } from '@/types/festival';
import { verifyTicketQRPayload } from '@/utils/security';

export interface ScanLogItem {
  id: string;
  time: string;
  seatId: string;
  row: string;
  number: number;
  participantName: string;
  status: 'valid' | 'already_used' | 'fake';
  message: string;
}

interface GateScannerProps {
  seats: Seat[];
  onCheckInSeat: (seatId: string) => boolean;
  scanLogs?: ScanLogItem[];
  onAddScanLog?: (newLog: ScanLogItem) => void;
  onClearScanLogs?: () => void;
}

export default function GateScanner({
  seats,
  onCheckInSeat,
  scanLogs = [],
  onAddScanLog,
  onClearScanLogs,
}: GateScannerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [scanResult, setScanResult] = useState<{
    success: boolean;
    isSecurityAlert?: boolean;
    message: string;
    seat?: Seat;
    securityHash?: string;
  } | null>(null);

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef<boolean>(false);

  // Synthesize audio beeps using native Web Audio API
  const playSound = (type: 'success' | 'alert') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.3);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.setValueAtTime(140, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch (e) {
      console.warn('Audio feedback notice:', e);
    }
  };

  // Process raw text scanned from Camera or Gun/Manual
  const processScannedToken = async (rawCode: string) => {
    if (!rawCode || isScanningRef.current) return;
    isScanningRef.current = true;

    const timeStr = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      // 1. Check if token is a cryptographic verification URL or JSON string
      const securityCheck = await verifyTicketQRPayload(rawCode);

      if (securityCheck.isValid && securityCheck.data) {
        const seatId = securityCheck.data.seatId;
        const matchedSeat = seats.find((s) => s.id.toUpperCase() === seatId.toUpperCase());

        if (!matchedSeat) {
          playSound('alert');
          setScanResult({
            success: false,
            isSecurityAlert: true,
            message: `🚨 ALERTA: Firma válida pero el asiento "${seatId}" no existe en la base de datos.`,
          });
          return;
        }

        // Already checked in check
        if (matchedSeat.status === 'checked_in') {
          playSound('alert');
          setScanResult({
            success: false,
            message: `⚠️ ENTRADA YA USADA PREVIAMENTE: Fila ${matchedSeat.row} Asiento ${matchedSeat.number} ingresó a las ${matchedSeat.checkedInAt || 'hora anterior'}.`,
            seat: matchedSeat,
            securityHash: securityCheck.data.hash,
          });

          if (onAddScanLog) {
            onAddScanLog({
              id: `log-${Date.now()}`,
              time: timeStr,
              seatId: matchedSeat.id,
              row: matchedSeat.row,
              number: matchedSeat.number,
              participantName: matchedSeat.assignedParticipantName || 'Asistente',
              status: 'already_used',
              message: 'RE-INGRESO RECHAZADO',
            });
          }
          return;
        }

        // Check in seat
        const success = onCheckInSeat(matchedSeat.id);
        if (success) {
          playSound('success');
          setScanResult({
            success: true,
            message: `✅ ACCESO AUTORIZADO — Fila ${matchedSeat.row} Asiento ${matchedSeat.number}`,
            seat: { ...matchedSeat, status: 'checked_in' },
            securityHash: securityCheck.data.hash,
          });

          if (onAddScanLog) {
            onAddScanLog({
              id: `log-${Date.now()}`,
              time: timeStr,
              seatId: matchedSeat.id,
              row: matchedSeat.row,
              number: matchedSeat.number,
              participantName: matchedSeat.assignedParticipantName || 'Asistente',
              status: 'valid',
              message: 'ACCESO PERMITIDO',
            });
          }
        }
        return;
      }

      // If invalid signature / failed security check
      if (rawCode.includes('verify=') || rawCode.includes('sig=') || (rawCode.startsWith('{') && rawCode.endsWith('}'))) {
        playSound('alert');
        setScanResult({
          success: false,
          isSecurityAlert: true,
          message: securityCheck.reason || '🚨 ALERTA CRÍTICA: Código QR falsificado o firma criptográfica alterada.',
        });

        if (onAddScanLog) {
          onAddScanLog({
            id: `log-${Date.now()}`,
            time: timeStr,
            seatId: 'FALSA',
            row: '?',
            number: 0,
            participantName: 'DESCONOCIDO',
            status: 'fake',
            message: 'QR FALSIFICADO DETECTADO',
          });
        }
        return;
      }

      // 2. Fallback to direct seat ID or PDF filename matching
      const cleanQuery = rawCode.trim().toUpperCase();
      const matchedSeat = seats.find(
        (s) =>
          s.id.toUpperCase() === cleanQuery ||
          (s.ticketCode && s.ticketCode.toUpperCase().includes(cleanQuery)) ||
          (s.pdfFilename && s.pdfFilename.toUpperCase().includes(cleanQuery))
      );

      if (!matchedSeat) {
        playSound('alert');
        setScanResult({
          success: false,
          message: `No se encontró ninguna entrada correspondiente al código "${rawCode}".`,
        });
        return;
      }

      if (matchedSeat.status === 'checked_in') {
        playSound('alert');
        setScanResult({
          success: false,
          message: `⚠️ ENTRADA YA INGRESADA: Fila ${matchedSeat.row} Asiento ${matchedSeat.number} ingresó previamente.`,
          seat: matchedSeat,
        });
        return;
      }

      const success = onCheckInSeat(matchedSeat.id);
      if (success) {
        playSound('success');
        setScanResult({
          success: true,
          message: `✅ ACCESO AUTORIZADO — Fila ${matchedSeat.row} Asiento ${matchedSeat.number}`,
          seat: { ...matchedSeat, status: 'checked_in' },
        });

        if (onAddScanLog) {
          onAddScanLog({
            id: `log-${Date.now()}`,
            time: timeStr,
            seatId: matchedSeat.id,
            row: matchedSeat.row,
            number: matchedSeat.number,
            participantName: matchedSeat.assignedParticipantName || 'Asistente',
            status: 'valid',
            message: 'ACCESO PERMITIDO',
          });
        }
      }
    } finally {
      setTimeout(() => {
        isScanningRef.current = false;
      }, 1200);
    }
  };

  // Toggle Live Camera Video Stream
  const toggleCamera = async () => {
    if (isCameraActive) {
      if (html5QrcodeRef.current) {
        try {
          await html5QrcodeRef.current.stop();
          html5QrcodeRef.current.clear();
        } catch (e) {
          console.warn('Error stopping camera:', e);
        }
      }
      setIsCameraActive(false);
    } else {
      setIsCameraActive(true);
    }
  };

  // Initialize camera instance when container is ready
  useEffect(() => {
    let html5QrcodeScanner: Html5Qrcode | null = null;

    if (isCameraActive) {
      const qrRegionId = 'qr-reader-container';
      html5QrcodeScanner = new Html5Qrcode(qrRegionId);
      html5QrcodeRef.current = html5QrcodeScanner;

      html5QrcodeScanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            processScannedToken(decodedText);
          },
          () => {} // Ignore frame scan errors
        )
        .catch((err) => {
          console.error('Error starting camera stream:', err);
          setIsCameraActive(false);
          setScanResult({
            success: false,
            message: 'No se pudo acceder a la cámara. Asegúrate de conceder permisos de cámara en tu navegador.',
          });
        });
    }

    return () => {
      if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().catch(() => {});
      }
    };
  }, [isCameraActive]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    processScannedToken(searchQuery.trim());
    setSearchQuery('');
  };

  // Calculate live gate stats
  const checkedInCount = seats.filter((s) => s.status === 'checked_in').length;
  const assignedCount = seats.filter((s) => s.status !== 'available').length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-indigo-600" /> Control de Acceso y Puerta (Check-In)
            </h2>
            <p className="text-xs text-slate-500">
              Escaneo en tiempo real de entradas con cámara, pistola QR o código manual con validación criptográfica anti-fraude.
            </p>
          </div>

          {/* Sound Effect Toggle */}
          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            <span>{soundEnabled ? 'Sonido Activado' : 'Sonido Silenciado'}</span>
          </button>
        </div>

        {/* Live Gate Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-center">
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest block">
              INGRESADOS (EN SALA)
            </span>
            <span className="text-2xl font-black text-emerald-950 mt-1 block">{checkedInCount}</span>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 text-center">
            <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-widest block">
              ENTRADAS ASIGNADAS
            </span>
            <span className="text-2xl font-black text-indigo-950 mt-1 block">{assignedCount}</span>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-center col-span-2 sm:col-span-1">
            <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-widest block">
              PENDIENTES POR ENTRAR
            </span>
            <span className="text-2xl font-black text-amber-950 mt-1 block">
              {Math.max(0, assignedCount - checkedInCount)}
            </span>
          </div>
        </div>

        {/* Camera Toggle Button & Video Reader Area */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <button
              onClick={toggleCamera}
              className={`py-3 px-6 rounded-2xl font-extrabold text-xs shadow-lg flex items-center gap-2 transition-all cursor-pointer ${
                isCameraActive
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30 animate-pulse'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white shadow-indigo-600/30 scale-105'
              }`}
            >
              <Camera className="w-5 h-5" />
              <span>{isCameraActive ? '📷 Apagar Cámara de Escaneo' : '📷 Abrir Cámara del Teléfono / Laptop'}</span>
            </button>
          </div>

          {/* HTML5 QR Camera Container */}
          {isCameraActive && (
            <div className="max-w-md mx-auto bg-slate-950 p-4 rounded-3xl border-2 border-amber-400 shadow-2xl space-y-3">
              <div className="flex items-center justify-between text-xs text-amber-400 font-extrabold px-2">
                <span>ESCÁNER EN VIVO ACTIVO</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div id="qr-reader-container" className="overflow-hidden rounded-2xl border border-slate-800" />
              <p className="text-[11px] text-slate-300 text-center font-medium">
                Apunta la cámara del dispositivo al código QR impreso o en la pantalla del teléfono.
              </p>
            </div>
          )}

          {/* Manual Input / QR Gun Input Form */}
          <form onSubmit={handleManualSubmit} className="pt-2">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              O escanea con Pistola Lectora QR / Código Manual:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Apunte la pistola QR aquí o escriba A1, A000001FDVC2026-CL.pdf..."
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl pl-9 pr-3.5 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Lock className="w-4 h-4 text-amber-400" /> Validar
              </button>
            </div>
          </form>
        </div>

        {/* Scan Result Card */}
        {scanResult && (
          <div
            className={`mt-6 p-5 rounded-2xl border text-sm transition-all animate-in zoom-in-95 ${
              scanResult.success
                ? 'bg-emerald-500 text-white border-emerald-400 shadow-xl shadow-emerald-500/20'
                : scanResult.isSecurityAlert
                ? 'bg-red-600 text-white border-red-500 shadow-xl shadow-red-600/30 animate-shake'
                : 'bg-amber-500 text-slate-950 border-amber-400 shadow-xl shadow-amber-500/20'
            }`}
          >
            <div className="flex items-start gap-3">
              {scanResult.success ? (
                <CheckCircle2 className="w-8 h-8 text-amber-300 shrink-0" />
              ) : scanResult.isSecurityAlert ? (
                <ShieldAlert className="w-9 h-9 text-yellow-300 shrink-0 animate-bounce" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-slate-950 shrink-0" />
              )}

              <div className="space-y-2 flex-1">
                <p className="font-extrabold text-lg leading-snug">{scanResult.message}</p>

                {scanResult.securityHash && (
                  <div className="inline-flex items-center gap-2 bg-slate-950 text-amber-400 text-xs px-3 py-1 rounded-lg font-mono font-bold border border-amber-400/40">
                    <Lock className="w-3.5 h-3.5 text-amber-400" /> HASH AUTÉNTICO: {scanResult.securityHash}
                  </div>
                )}

                {scanResult.seat && (
                  <div className="bg-white/95 rounded-xl p-3.5 text-slate-900 text-xs space-y-1.5 shadow-sm font-semibold">
                    <div className="flex items-center justify-between font-bold text-sm">
                      <span>UBICACIÓN EN SALA:</span>
                      <span className="text-indigo-700 font-extrabold text-base">
                        FILA {scanResult.seat.row} — ASIENTO {scanResult.seat.number}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Titular / Escuela:</span>
                      <span className="font-bold text-slate-900">{scanResult.seat.assignedParticipantName || 'Sin asignar'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                      <span>Archivo Oficial:</span>
                      <span className="text-indigo-900 font-bold">{scanResult.seat.pdfFilename}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Gate Scan Activity Log */}
      {scanLogs.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" /> Historial de Ingresos en Vivo ({scanLogs.length})
            </h3>
            {onClearScanLogs && (
              <button
                onClick={onClearScanLogs}
                className="text-[11px] text-slate-400 hover:text-slate-600 font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Limpiar Historial
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {scanLogs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                  log.status === 'valid'
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : log.status === 'fake'
                    ? 'bg-red-50 border-red-200 text-red-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-slate-400 font-bold">{log.time}</span>
                  <div>
                    <span className="font-extrabold block">
                      FILA {log.row} — ASIENTO {log.number} ({log.seatId})
                    </span>
                    <span className="text-[11px] text-slate-600">{log.participantName}</span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    log.status === 'valid'
                      ? 'bg-emerald-200 text-emerald-900'
                      : log.status === 'fake'
                      ? 'bg-red-200 text-red-900 animate-pulse'
                      : 'bg-amber-200 text-amber-900'
                  }`}
                >
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

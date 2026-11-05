'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';
import {
  Camera,
  CameraOff,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  RefreshCw,
  Volume2,
  VolumeX,
  ShieldCheck,
  Ticket,
  Armchair,
  Users,
  Clock,
  Maximize2,
  Minimize2,
  Printer,
  ExternalLink,
  ArrowRight,
  X,
  Sparkles,
  ChevronRight,
  Undo2,
  Check,
  Building2,
  Smartphone
} from 'lucide-react';

interface PuertaStats {
  totalSeats: number;
  available: number;
  sold: number;
  checkedIn: number;
  pending: number;
}

interface ScanLog {
  id: string | number;
  seat_id: string;
  row_name: string;
  seat_number: number;
  participant_name: string;
  status: 'valid' | 'already_used' | 'fake' | 'cancelled';
  message: string;
  created_at: string;
}

interface SoldSeat {
  id: string;
  row_name: string;
  seat_number: number;
  block: string;
  status: string;
  assigned_participant_name: string | null;
  ticket_code: string | null;
  checked_in_at: string | null;
}

interface CheckinResult {
  success: boolean;
  status: 'valid' | 'already_used' | 'fake' | 'not_sold' | 'blocked';
  title: string;
  message: string;
  seat?: {
    id: string;
    row: string;
    number: number;
    block?: string;
    assignedParticipantName?: string;
    ticketCode?: string;
    checkedInAt?: string;
  };
  checkedInAt?: string;
  rawToken?: string;
}

export default function PuertaControlPage() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'totem' | 'list'>('scanner');
  const [stats, setStats] = useState<PuertaStats>({
    totalSeats: 364,
    available: 0,
    sold: 0,
    checkedIn: 0,
    pending: 0,
  });
  const [recentScans, setRecentScans] = useState<ScanLog[]>([]);
  const [soldSeats, setSoldSeats] = useState<SoldSeat[]>([]);
  const [listSearch, setListSearch] = useState('');
  const [listFilter, setListFilter] = useState<'all' | 'pending' | 'checked_in'>('all');

  // Scanner State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<CheckinResult | null>(null);

  // Totem State
  const [totemQrDataUrl, setTotemQrDataUrl] = useState<string>('');
  const [isTotemFullscreen, setIsTotemFullscreen] = useState(false);

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningLock = useRef<boolean>(false);
  const totemContainerRef = useRef<HTMLDivElement>(null);

  // ── 1. Synthesize Web Audio Chimes ───────────────────────────────────────────
  const playSound = useCallback((type: 'success' | 'alert') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'success') {
        // High-pitched pleasant dual chime (C6 - G6)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1567.98, ctx.currentTime + 0.08); // G6

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.15);
        osc2.start(ctx.currentTime + 0.08);
        osc2.stop(ctx.currentTime + 0.35);
      } else {
        // Dual low warning buzz
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.setValueAtTime(120, ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.45);
      }
    } catch (e) {
      console.warn('Audio notice:', e);
    }
  }, [soundEnabled]);

  // ── 2. Fetch Live Door Stats & Recent Scans ──────────────────────────────────
  const fetchDoorStats = useCallback(async () => {
    try {
      const res = await fetch('/api/puerta-checkin.php?action=stats');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.stats) {
          setStats(data.stats);
          if (Array.isArray(data.recentScans)) {
            setRecentScans(data.recentScans);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching door stats:', e);
    }
  }, []);

  // ── 3. Fetch Sold Seats for List View ────────────────────────────────────────
  const fetchSoldSeats = useCallback(async () => {
    try {
      const res = await fetch('/api/puerta-checkin.php?action=all_sold');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.seats)) {
          setSoldSeats(data.seats);
        }
      }
    } catch (e) {
      console.error('Error fetching sold seats:', e);
    }
  }, []);

  useEffect(() => {
    fetchDoorStats();
    const interval = setInterval(fetchDoorStats, 8000);
    return () => clearInterval(interval);
  }, [fetchDoorStats]);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchSoldSeats();
    }
  }, [activeTab, fetchSoldSeats]);

  // ── 4. Generate Totem QR Code ────────────────────────────────────────────────
  useEffect(() => {
    const buyUrl = 'https://ticketfestival.tupartnerti.cl/?ref=puerta';
    QRCode.toDataURL(buyUrl, {
      width: 480,
      margin: 2,
      color: {
        dark: '#070614',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setTotemQrDataUrl(url))
      .catch((err) => console.error('Error generating Totem QR:', err));
  }, []);

  // ── 5. Process Check-in Execution ────────────────────────────────────────────
  const executeCheckin = async (rawCode: string) => {
    if (!rawCode || isProcessing || isScanningLock.current) return;
    isScanningLock.current = true;
    setIsProcessing(true);

    try {
      const res = await fetch('/api/puerta-checkin.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkin',
          token: rawCode.trim(),
          staffName: 'Staff Control Puerta',
        }),
      });

      const data: CheckinResult = await res.json();
      setScanResult(data);

      if (data.success && data.status === 'valid') {
        playSound('success');
        fetchDoorStats();
        if (activeTab === 'list') fetchSoldSeats();
      } else {
        playSound('alert');
        fetchDoorStats();
      }

      // Automatically scroll to top so the validation banner is immediately visible on phone screens
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Checkin network error:', err);
      playSound('alert');
      setScanResult({
        success: false,
        status: 'fake',
        title: 'ERROR DE CONEXIÓN',
        message: 'No se pudo contactar al servidor de verificación. Revisa tu conexión a internet.',
      });
    } finally {
      setIsProcessing(false);
      // Wait 1.8s before unlocking camera to avoid multi-reads
      setTimeout(() => {
        isScanningLock.current = false;
      }, 1800);
    }
  };

  // ── 6. Undo / Cancel Check-in ─────────────────────────────────────────────────
  const undoCheckin = async (seatId: string) => {
    try {
      const res = await fetch('/api/puerta-checkin.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'uncheckin',
          seatId,
          staffName: 'Staff Control Puerta',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setScanResult(null);
        fetchDoorStats();
        if (activeTab === 'list') fetchSoldSeats();
      }
    } catch (e) {
      console.error('Error undoing checkin:', e);
    }
  };

  // ── 7. Html5Qrcode Camera Scanner Lifecycle ──────────────────────────────────
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

  useEffect(() => {
    let scanner: Html5Qrcode | null = null;

    if (isCameraActive && activeTab === 'scanner') {
      const containerId = 'puerta-camera-viewport';
      scanner = new Html5Qrcode(containerId);
      html5QrcodeRef.current = scanner;

      scanner
        .start(
          { facingMode: 'environment' },
          {
            fps: 15,
            aspectRatio: 1.0,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minDimension = Math.min(viewfinderWidth, viewfinderHeight);
              const qrboxSize = Math.floor(minDimension * 0.72);
              return { width: qrboxSize, height: qrboxSize };
            },
          },
          (decodedText) => {
            executeCheckin(decodedText);
          },
          () => {} // silent frame reject
        )
        .catch((err) => {
          console.error('Camera startup error:', err);
          setIsCameraActive(false);
          setScanResult({
            success: false,
            status: 'fake',
            title: 'CÁMARA NO DISPONIBLE',
            message: 'No se pudo acceder a la cámara. Concede permisos de cámara en tu navegador.',
          });
        });
    }

    return () => {
      if (scanner && scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, [isCameraActive, activeTab]);

  // Handle Manual Form Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      executeCheckin(manualCode.trim());
      setManualCode('');
    }
  };

  // Filtered sold seats for list tab
  const filteredSeats = soldSeats.filter((seat) => {
    const matchesFilter =
      listFilter === 'all'
        ? true
        : listFilter === 'checked_in'
        ? !!seat.checked_in_at
        : !seat.checked_in_at;

    if (!matchesFilter) return false;

    if (!listSearch.trim()) return true;
    const q = listSearch.toLowerCase().trim();
    return (
      seat.id.toLowerCase().includes(q) ||
      (seat.assigned_participant_name && seat.assigned_participant_name.toLowerCase().includes(q)) ||
      (seat.ticket_code && seat.ticket_code.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#070614] text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950 flex flex-col">

      {/* ── TOP APP BAR ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0c0824]/95 backdrop-blur-xl border-b border-white/10 shadow-2xl px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Brand & Gate Badge */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-amber-400/80 shadow-md shadow-amber-500/20 bg-slate-900 shrink-0">
                <img src="/logo-festival.jpg" alt="Logo Festival" className="w-full h-full object-cover" />
              </div>
              <div>
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block leading-none">
                  Control de Acceso • Aula Magna
                </span>
                <span className="text-xs sm:text-sm font-black text-white font-serif block mt-0.5">
                  Puerta de Entrada Festival 2026
                </span>
              </div>
            </Link>

            {/* Live Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>En Vivo</span>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/10 w-full sm:w-auto justify-center">
            <button
              onClick={() => setActiveTab('scanner')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'scanner'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Escanear Entradas</span>
            </button>

            <button
              onClick={() => setActiveTab('totem')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'totem'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>QR Compra en Puerta</span>
            </button>

            <button
              onClick={() => setActiveTab('list')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'list'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Lista de Asistentes</span>
            </button>
          </div>

          {/* Quick Sound Toggle & Refresh */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled((v) => !v)}
              title={soundEnabled ? 'Silenciar sonidos de alerta' : 'Activar sonido'}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-white/5 text-slate-400 border-white/10'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={() => {
                fetchDoorStats();
                if (activeTab === 'list') fetchSoldSeats();
              }}
              title="Actualizar datos"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* ── LIVE KPI STATS BAR ────────────────────────────────────────────── */}
      <section className="bg-[#0e0a26] border-b border-white/10 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 text-center">
          
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-2.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 block">
              ✅ Ingresados (Check-in)
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono block mt-0.5">
              {stats.checkedIn}
            </span>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-2.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 block">
              ⏳ Pendientes por Ingresar
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono block mt-0.5">
              {stats.pending}
            </span>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/25 rounded-2xl p-2.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 block">
              🎟️ Total Vendidas / Asignadas
            </span>
            <span className="text-xl sm:text-2xl font-black text-purple-300 font-mono block mt-0.5">
              {stats.sold}
            </span>
          </div>

          <div className="bg-indigo-500/10 border border-indigo-500/25 rounded-2xl p-2.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300 block">
              🪑 Butacas Libres en Puerta
            </span>
            <span className="text-xl sm:text-2xl font-black text-indigo-300 font-mono block mt-0.5">
              {stats.available}
            </span>
          </div>

        </div>
      </section>

      {/* ── MAIN CONTENT CONTAINER ────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">

        {/* ═════════════════════════════════════════════════════════════════
            VISTA 1: ESCÁNER DE CONTROL DE ACCESO (CÁMARA + MANUAL)
            ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'scanner' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Columna Izquierda: Banner de Validación Inmediata (Arriba de la Cámara) + Cámara + Validación Manual */}
            <div className="lg:col-span-7 space-y-5">

              {/* ── BANNER DE VALIDACIÓN INMEDIATA (ARRIBA DE LA CÁMARA) ─────── */}
              {scanResult && (
                <div
                  className={`rounded-3xl p-5 sm:p-6 border-3 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-200 ${
                    scanResult.status === 'valid'
                      ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-600 border-emerald-300 text-white shadow-[0_0_40px_rgba(16,185,129,0.5)]'
                      : scanResult.status === 'already_used'
                      ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 border-amber-300 text-slate-950 shadow-[0_0_40px_rgba(245,158,11,0.5)]'
                      : 'bg-gradient-to-r from-red-700 via-rose-600 to-red-800 border-red-300 text-white shadow-[0_0_40px_rgba(239,68,68,0.5)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {scanResult.status === 'valid' && (
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                          <CheckCircle2 className="w-8 h-8 text-white animate-bounce" />
                        </div>
                      )}
                      {scanResult.status === 'already_used' && (
                        <div className="w-12 h-12 rounded-full bg-black/15 flex items-center justify-center shrink-0 shadow-inner">
                          <AlertTriangle className="w-8 h-8 text-slate-950" />
                        </div>
                      )}
                      {(scanResult.status === 'fake' || scanResult.status === 'not_sold' || scanResult.status === 'blocked') && (
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                          <XCircle className="w-8 h-8 text-white" />
                        </div>
                      )}

                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest block opacity-90">
                          {scanResult.status === 'valid' ? '✅ Ingreso Autorizado' : '⚠️ Atención en Puerta'}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black font-serif uppercase tracking-wide leading-tight">
                          {scanResult.title}
                        </h3>
                        <p className="text-xs sm:text-sm font-medium mt-0.5 opacity-95">
                          {scanResult.message}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setScanResult(null)}
                      className="p-1.5 rounded-full bg-black/20 hover:bg-black/30 text-white cursor-pointer shrink-0 transition-colors"
                      title="Cerrar aviso"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Seat and Attendee Details */}
                  {scanResult.seat && (
                    <div className={`rounded-2xl p-4 border space-y-2 text-sm font-sans ${
                      scanResult.status === 'valid'
                        ? 'bg-black/30 border-white/20 text-white'
                        : scanResult.status === 'already_used'
                        ? 'bg-black/20 border-slate-950/20 text-slate-950'
                        : 'bg-black/30 border-white/20 text-white'
                    }`}>
                      <div className="flex justify-between items-center pb-2 border-b border-current/10">
                        <span className="text-xs uppercase font-extrabold opacity-80">Asistente:</span>
                        <span className="font-black text-base sm:text-lg">
                          {scanResult.seat.assignedParticipantName || 'Entrada General'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pb-2 border-b border-current/10">
                        <span className="text-xs uppercase font-extrabold opacity-80">Ubicación / Asiento:</span>
                        <span className="font-mono font-black text-lg sm:text-xl tracking-wider">
                          Fila {scanResult.seat.row} — Asiento {scanResult.seat.number}
                        </span>
                      </div>

                      {scanResult.checkedInAt && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="uppercase font-bold opacity-80">Hora de Registro:</span>
                          <span className="font-mono font-extrabold">{scanResult.checkedInAt}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    {scanResult.status === 'valid' && scanResult.seat && (
                      <button
                        onClick={() => undoCheckin(scanResult.seat!.id)}
                        className="py-2.5 px-4 bg-black/20 hover:bg-black/30 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Undo2 className="w-4 h-4" />
                        <span>Anular Check-in</span>
                      </button>
                    )}

                    <button
                      onClick={() => setScanResult(null)}
                      className={`flex-1 py-3 font-black text-xs sm:text-sm rounded-xl uppercase tracking-wider shadow-lg cursor-pointer transition-transform hover:scale-[1.01] ${
                        scanResult.status === 'valid'
                          ? 'bg-white text-emerald-950 hover:bg-slate-100'
                          : scanResult.status === 'already_used'
                          ? 'bg-slate-950 text-amber-300 hover:bg-slate-900'
                          : 'bg-white text-red-950 hover:bg-slate-100'
                      }`}
                    >
                      ✓ Siguiente Entrada
                    </button>
                  </div>
                </div>
              )}

              {/* Card Escáner de Cámara */}
              <div className="bg-gradient-to-b from-[#140b2e] to-[#0d0724] border-2 border-amber-400/50 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
                
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Camera className="w-5 h-5 text-amber-400" />
                    <h2 className="font-serif font-black text-white text-base sm:text-lg">
                      Cámara Lectora de Entradas QR
                    </h2>
                  </div>

                  <button
                    onClick={toggleCamera}
                    className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                      isCameraActive
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                        : 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 hover:bg-emerald-400'
                    }`}
                  >
                    {isCameraActive ? (
                      <>
                        <CameraOff className="w-3.5 h-3.5" />
                        <span>Apagar Cámara</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5" />
                        <span>Activar Cámara</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Camera Viewfinder Box */}
                <div className="relative w-full aspect-square max-w-sm mx-auto bg-slate-950 rounded-2xl overflow-hidden border-2 border-dashed border-amber-400/40 flex items-center justify-center">
                  <div id="puerta-camera-viewport" className="w-full h-full" />

                  {!isCameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-[#0a0518]/90">
                      <QrCode className="w-16 h-16 text-amber-400/60 animate-pulse" />
                      <div className="space-y-1">
                        <p className="font-extrabold text-white text-sm">Cámara en Espera</p>
                        <p className="text-xs text-slate-400 max-w-xs">
                          Haz clic en &ldquo;Activar Cámara&rdquo; para escanear los códigos QR de los asistentes desde la pantalla de su teléfono o impresos.
                        </p>
                      </div>
                      <button
                        onClick={toggleCamera}
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 cursor-pointer uppercase tracking-wider"
                      >
                        Encender Cámara Ahora
                      </button>
                    </div>
                  )}

                  {/* Perfect Square Viewfinder Target Frame with Corner Brackets */}
                  {isCameraActive && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="w-[72%] aspect-square border-2 border-amber-400/80 rounded-2xl relative shadow-[0_0_30px_rgba(245,158,11,0.35)]">
                        {/* Golden Corner Indicators */}
                        <span className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
                        <span className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
                        <span className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />
                        <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />
                        {/* Scanning Laser Beam */}
                        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_10px_rgba(245,158,11,1)] animate-pulse" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Scanner Instruction */}
                <p className="text-[11px] text-center text-slate-400">
                  💡 Enfoca el código QR de la entrada. La verificación y el registro de acceso se realizan de forma automática e instantánea.
                </p>

                {/* Manual Input Form (For typing seat ID or barcode reader gun) */}
                <div className="pt-3 border-t border-white/10">
                  <form onSubmit={handleManualSubmit} className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">
                      ⌨️ ¿Problemas con la cámara? Ingresa Fila y Asiento (ej: <span className="text-amber-300 font-mono">D12</span>) o Código:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        placeholder="Ej: D12, B5, o código de entrada..."
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white font-mono text-sm uppercase placeholder:normal-case placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                      />
                      <button
                        type="submit"
                        disabled={!manualCode.trim() || isProcessing}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md cursor-pointer uppercase tracking-wider shrink-0"
                      >
                        {isProcessing ? 'Validando...' : 'Validar'}
                      </button>
                    </div>
                  </form>
                </div>

              </div>

            </div>

            {/* Columna Derecha: Resultado Inmediato de Validación & Historial Reciente */}
            <div className="lg:col-span-5 space-y-6">

              {/* Card Guía Rápida para el Operador */}
              <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 space-y-3">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    Protocolo de Acceso en Puerta
                  </h3>
                </div>
                <ul className="text-xs text-slate-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">🟢</span>
                    <span><strong>Verde:</strong> Entrada válida. El ingreso queda registrado automáticamente.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">🟡</span>
                    <span><strong>Amarillo:</strong> Entrada ya utilizada. Ver hora de ingreso previo para rechazar re-ingresos.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 font-bold">🔴</span>
                    <span><strong>Rojo:</strong> Butaca bloqueada o no vendida. No autorizar ingreso.</span>
                  </li>
                </ul>
              </div>

              {/* ── RECENT SCANS FEED ─────────────────────────────────────── */}
              <div className="bg-[#100a26] border border-white/10 rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Últimos Ingresos Registrados
                  </h3>
                  <button
                    onClick={fetchDoorStats}
                    className="text-[11px] text-amber-400 hover:underline cursor-pointer"
                  >
                    Actualizar
                  </button>
                </div>

                {recentScans.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">
                    Aún no se han registrado ingresos en esta sesión.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {recentScans.map((log) => (
                      <div
                        key={log.id}
                        className="bg-slate-950/70 border border-white/5 rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              log.status === 'valid'
                                ? 'bg-emerald-400'
                                : log.status === 'already_used'
                                ? 'bg-amber-400'
                                : 'bg-red-400'
                            }`}
                          />
                          <div>
                            <span className="font-mono font-bold text-amber-300 block">
                              Fila {log.row_name} - Asiento {log.seat_number}
                            </span>
                            <span className="text-[11px] text-slate-300 block truncate max-w-[170px]">
                              {log.participant_name || 'Asistente'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                              log.status === 'valid'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : log.status === 'already_used'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}
                          >
                            {log.status === 'valid' ? 'Admitido' : log.status === 'already_used' ? 'Duplicado' : 'Rechazado'}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">
                            {log.created_at ? log.created_at.split(' ')[1] : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            VISTA 2: TÓTEM QR PARA COMPRAS EN PUERTA (PARA EL PÚBLICO)
            ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'totem' && (
          <div
            ref={totemContainerRef}
            className={`max-w-2xl mx-auto rounded-3xl p-6 sm:p-10 border-2 border-amber-400/80 shadow-[0_0_60px_rgba(245,158,11,0.3)] text-center space-y-6 transition-all ${
              isTotemFullscreen
                ? 'fixed inset-0 z-50 bg-[#070614] overflow-y-auto max-w-none rounded-none border-none flex flex-col justify-center'
                : 'bg-gradient-to-b from-[#180c38] via-[#100726] to-[#070614]'
            }`}
          >
            {/* Action Bar (Fullscreen, Print, Close) */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Punto de Venta Rápido en Puerta
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Letrero</span>
                </button>

                <button
                  onClick={() => setIsTotemFullscreen((v) => !v)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-md"
                >
                  {isTotemFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>Salir de Pantalla Completa</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Modo Pantalla Completa (Kiosco)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Header Titles */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-wider">
                <Ticket className="w-3.5 h-3.5" /> ¿Vienes llegando sin entrada?
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-white font-serif leading-tight">
                Compra tus Asientos en Vivo
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                Escanea el código QR con la cámara de tu celular para elegir tus butacas numeradas en el mapa del teatro y pagar al instante con <strong className="text-white">Webpay Plus (Débito/Crédito)</strong>.
              </p>
            </div>

            {/* BIG CRISP QR CODE CONTAINER */}
            <div className="relative inline-block p-4 sm:p-6 bg-white rounded-3xl shadow-2xl shadow-amber-500/30 border-4 border-amber-400 group">
              {totemQrDataUrl ? (
                <img
                  src={totemQrDataUrl}
                  alt="QR para comprar entradas"
                  className="w-56 h-56 sm:w-72 sm:h-72 mx-auto object-contain rounded-xl"
                />
              ) : (
                <div className="w-56 h-56 sm:w-72 sm:h-72 flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                </div>
              )}

              <div className="mt-3 text-center">
                <span className="text-[11px] font-mono font-black text-slate-900 uppercase tracking-widest block">
                  ticketfestival.tupartnerti.cl
                </span>
              </div>
            </div>

            {/* Live Available Counter Badge */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <div className="bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 rounded-2xl flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs sm:text-sm font-black text-emerald-300">
                  🔥 {stats.available} Butacas Disponibles Ahora
                </span>
              </div>

              <div className="bg-amber-500/20 border border-amber-500/40 px-4 py-2 rounded-2xl">
                <span className="text-xs sm:text-sm font-black text-amber-300">
                  Valor: $10.000 / butaca
                </span>
              </div>
            </div>

            {/* 3 Step Instructions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-left border-t border-white/10">
              <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-white/5 space-y-1">
                <span className="text-xs font-black text-amber-400 block font-mono">PASO 1</span>
                <p className="text-xs font-extrabold text-white">Escanea el QR</p>
                <p className="text-[11px] text-slate-400">Abre la cámara de tu smartphone y enfoca el código.</p>
              </div>

              <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-white/5 space-y-1">
                <span className="text-xs font-black text-amber-400 block font-mono">PASO 2</span>
                <p className="text-xs font-extrabold text-white">Elige tus Asientos</p>
                <p className="text-[11px] text-slate-400">Selecciona tus butacas en el plano interactivo.</p>
              </div>

              <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-white/5 space-y-1">
                <span className="text-xs font-black text-amber-400 block font-mono">PASO 3</span>
                <p className="text-xs font-extrabold text-white">Paga y Entra</p>
                <p className="text-[11px] text-slate-400">Paga con Transbank y muéstranos tu entrada digital.</p>
              </div>
            </div>

            {/* Direct Link Button */}
            <div className="pt-2">
              <a
                href="https://ticketfestival.tupartnerti.cl/?ref=puerta"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 hover:text-amber-300 underline"
              >
                <span>Abrir ticketera directamente en una nueva pestaña</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            VISTA 3: LISTA COMPLETA DE ASISTENTES & BÚSQUEDA RÁPIDA
            ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'list' && (
          <div className="bg-[#120a28] border border-white/10 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white font-serif flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  Nómina de Asistentes & Butacas Vendidas
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Búsqueda directa para marcar asistencia o resolver consultas de asistentes sin entrada a mano.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setListFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    listFilter === 'all' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({soldSeats.length})
                </button>
                <button
                  onClick={() => setListFilter('pending')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    listFilter === 'pending' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pendientes ({soldSeats.filter((s) => !s.checked_in_at).length})
                </button>
                <button
                  onClick={() => setListFilter('checked_in')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    listFilter === 'checked_in' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ingresados ({soldSeats.filter((s) => s.checked_in_at).length})
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Buscar por nombre, fila, asiento (ej: D12) o código..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-white text-xs sm:text-sm placeholder:text-slate-500 focus:outline-none focus:border-amber-400 font-sans"
              />
            </div>

            {/* Table / List */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px] font-mono">
                    <th className="py-2.5 px-3">Butaca</th>
                    <th className="py-2.5 px-3">Asistente / Titular</th>
                    <th className="py-2.5 px-3">Código Ticket</th>
                    <th className="py-2.5 px-3">Estado Ingreso</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-sans">
                  {filteredSeats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 text-xs">
                        No se encontraron asistentes con el criterio de búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredSeats.map((seat) => (
                      <tr key={seat.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                          {seat.id} (Fila {seat.row_name} - {seat.seat_number})
                        </td>
                        <td className="py-2.5 px-3 font-extrabold text-white">
                          {seat.assigned_participant_name || 'Entrada General'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">
                          {seat.ticket_code || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          {seat.checked_in_at ? (
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-md font-extrabold text-[10px]">
                              Ingresó ({seat.checked_in_at.split(' ')[1]})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-md font-bold text-[10px]">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {seat.checked_in_at ? (
                            <button
                              onClick={() => undoCheckin(seat.id)}
                              className="px-2.5 py-1 bg-white/10 hover:bg-red-500/20 text-slate-300 hover:text-red-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Anular
                            </button>
                          ) : (
                            <button
                              onClick={() => executeCheckin(seat.id)}
                              className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-[11px] shadow-sm transition-all cursor-pointer"
                            >
                              Marcar Ingreso
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </main>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-[#05030e] text-slate-500 py-4 px-4 text-center text-xs">
        <p>Módulo de Puerta y Control de Acceso — Festival Nacional Danza del Vientre Chile 2026</p>
      </footer>

    </div>
  );
}

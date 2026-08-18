'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Armchair, Ticket, ShieldCheck, CalendarDays, MapPin, Clock, ChevronRight, Info } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type SeatStatus = 'available' | 'occupied';
type SeatBlock = 'left' | 'center' | 'right';

interface PublicSeat {
  id: string;
  row: string;
  number: number;
  block: SeatBlock;
  status: SeatStatus; // only available or occupied shown to public
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TICKET_PRICE = 10000; // CLP – presale price
const SERVICE_FEE_PCT = 0.04;
const MAX_SEATS_PER_ORDER = 6;

function formatCLP(n: number) {
  return `$${n.toLocaleString('es-CL')}`;
}

// ─── Seat block definitions (mirrors the actual theater layout) ───────────────
const ROWS = ['A','B','C','D','E','F','G','H','I','J','K','L','M'];
const ROW_SEATS: Record<string, number> = {
  A:34, B:34, C:34, D:28, E:28, F:28, G:28,
  H:28, I:28, J:28, K:28, L:28, M:28,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function PublicTicketing() {
  const [seats, setSeats] = useState<PublicSeat[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch public seat availability (only available/occupied — no names/types)
  const fetchSeats = useCallback(async () => {
    try {
      const res = await fetch('/api/sync-data.php?public=1');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.seats)) {
        const publicSeats: PublicSeat[] = data.seats.map((s: {
          id: string; row_name: string; seat_number: number; block: SeatBlock; status: string;
        }) => ({
          id: s.id,
          row: s.row_name,
          number: s.seat_number,
          block: s.block,
          // All non-available statuses become "occupied" — no type info exposed
          status: s.status === 'available' ? 'available' : 'occupied',
        }));
        setSeats(publicSeats);
      }
    } catch {
      // On error, generate empty local seats (all available) so UI doesn't break
      const fallback: PublicSeat[] = [];
      for (const row of ROWS) {
        for (let n = 1; n <= ROW_SEATS[row]; n++) {
          fallback.push({
            id: `${row}${n}`,
            row,
            number: n,
            block: n <= 10 ? 'left' : n <= 24 ? 'center' : 'right',
            status: 'available',
          });
        }
      }
      setSeats(fallback);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeats();
    // Poll every 15 seconds so availability stays fresh
    const interval = setInterval(fetchSeats, 15000);
    return () => clearInterval(interval);
  }, [fetchSeats]);

  const toggleSeat = (seat: PublicSeat) => {
    if (seat.status === 'occupied') return;
    setSelectedIds((prev) => {
      if (prev.includes(seat.id)) return prev.filter((id) => id !== seat.id);
      if (prev.length >= MAX_SEATS_PER_ORDER) return prev; // limit enforced
      return [...prev, seat.id];
    });
  };

  // ─── Price calculation ───────────────────────────────────────────────────
  const subtotal = selectedIds.length * TICKET_PRICE;
  const serviceFee = Math.round(subtotal * SERVICE_FEE_PCT);
  const total = subtotal + serviceFee;

  // ─── Seat style helper (public: only green=available, gray=occupied) ─────
  const getSeatClass = (seat: PublicSeat) => {
    if (seat.status === 'occupied') {
      return 'bg-slate-200 border-slate-300 cursor-not-allowed opacity-60';
    }
    if (selectedIds.includes(seat.id)) {
      return 'bg-emerald-500 border-emerald-600 text-white ring-2 ring-emerald-300 scale-110 z-10 cursor-pointer';
    }
    return 'bg-purple-100 border-purple-200 text-purple-900 hover:bg-purple-300 hover:scale-105 cursor-pointer';
  };

  // ─── Group seats by row ──────────────────────────────────────────────────
  const seatsByRow = ROWS.reduce<Record<string, PublicSeat[]>>((acc, row) => {
    acc[row] = seats.filter((s) => s.row === row);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-purple-950 text-white">

      {/* ── Hero Header ──────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-purple-500/10" />
        <div className="relative max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">Ticketera Oficial</p>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
              Festival Nacional<br />
              <span className="text-amber-400">Danza del Vientre</span>
            </h1>
            <p className="text-indigo-200 text-sm font-semibold mt-2">Chile 2026</p>
          </div>

          {/* Event info pills */}
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-xl">
              <CalendarDays className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-semibold">Viernes 5 de Septiembre 2026</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-xl">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-semibold">Teatro Municipal de Santiago</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-xl">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-semibold">20:00 hrs — Puertas abren 19:30</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Price Banner ─────────────────────────────────────────────────── */}
      <div className="bg-amber-500/20 border-y border-amber-500/30 py-3">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Ticket className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-bold text-amber-200">
              Preventa: <span className="text-white text-base">{formatCLP(TICKET_PRICE)}</span>
              <span className="text-amber-400/70 text-xs ml-2">(hasta el 4 de septiembre)</span>
            </span>
          </div>
          <span className="text-xs text-amber-300/80 font-semibold flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            Precio en puerta: {formatCLP(12000)} el día del evento
          </span>
        </div>
      </div>

      {/* ── Main Grid ────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Seat Map ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Armchair className="w-5 h-5 text-indigo-400" />
                Selecciona tus butacas
              </h2>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-purple-300 inline-block" /> Libre
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Seleccionada
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-slate-400 inline-block" /> Ocupado
                </span>
              </div>
            </div>

            {/* Stage */}
            <div className="w-full bg-slate-700/50 border border-slate-500/30 rounded-xl py-2 text-center text-xs font-bold text-slate-400 tracking-widest uppercase mb-5">
              🎭 Escenario
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-48 gap-3 text-indigo-300">
                <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-semibold">Cargando disponibilidad...</span>
              </div>
            ) : (
              <div className="space-y-1.5 overflow-x-auto pb-2">
                {ROWS.map((row) => (
                  <div key={row} className="flex items-center gap-1.5 min-w-max">
                    <span className="text-[10px] font-bold text-slate-400 w-4 text-center shrink-0">{row}</span>
                    <div className="flex gap-0.5 flex-wrap">
                      {(seatsByRow[row] ?? []).map((seat) => (
                        <button
                          key={seat.id}
                          onClick={() => toggleSeat(seat)}
                          disabled={seat.status === 'occupied'}
                          title={seat.status === 'occupied' ? 'Ocupado' : `Fila ${seat.row} N° ${seat.number}`}
                          className={`w-6 h-6 text-[9px] font-bold rounded-sm border transition-all duration-100 ${getSeatClass(seat)}`}
                        >
                          {seat.number}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedIds.length >= MAX_SEATS_PER_ORDER && (
              <p className="mt-3 text-xs text-amber-300 font-semibold text-center">
                Máximo {MAX_SEATS_PER_ORDER} entradas por compra
              </p>
            )}
          </div>
        </div>

        {/* ── Order Summary + CTA ──────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">

          {/* Selected seats */}
          <div className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10">
            <h3 className="text-sm font-extrabold text-white mb-3 flex items-center gap-2">
              <Ticket className="w-4 h-4 text-amber-400" />
              Tu selección
            </h3>

            {selectedIds.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">
                Haz clic en las butacas del mapa para elegir tu lugar
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {selectedIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => setSelectedIds((prev) => prev.filter((s) => s !== id))}
                    className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-lg hover:bg-red-500/20 hover:border-red-400/40 hover:text-red-300 transition-colors"
                    title="Quitar"
                  >
                    {id} ×
                  </button>
                ))}
              </div>
            )}

            {/* Price breakdown */}
            {selectedIds.length > 0 && (
              <div className="border-t border-white/10 pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>{selectedIds.length} entrada{selectedIds.length > 1 ? 's' : ''} × {formatCLP(TICKET_PRICE)}</span>
                  <span className="font-semibold">{formatCLP(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Cargo por servicio (4%)</span>
                  <span>+{formatCLP(serviceFee)}</span>
                </div>
                <div className="flex justify-between font-black text-white text-sm border-t border-white/10 pt-2 mt-1">
                  <span>TOTAL</span>
                  <span className="text-amber-400">{formatCLP(total)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Checkout CTA */}
          <Link
            href={selectedIds.length > 0
              ? `/checkout?seats=${selectedIds.join(',')}`
              : '#'}
            onClick={(e) => selectedIds.length === 0 && e.preventDefault()}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm transition-all shadow-lg
              ${selectedIds.length > 0
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-indigo-500/30 cursor-pointer'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
          >
            {selectedIds.length > 0 ? (
              <>Continuar al pago <ChevronRight className="w-4 h-4" /></>
            ) : (
              'Selecciona al menos 1 butaca'
            )}
          </Link>

          {/* Trust badges */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Pago seguro con <strong className="text-white">Webpay / Transbank</strong></span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Ticket className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Entradas digitales enviadas a tu correo</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>QR único e intransferible por asiento</span>
            </div>
          </div>

          {/* Admin link (discreet) */}
          <div className="text-center">
            <Link
              href="/admin"
              className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors font-semibold"
            >
              Acceso administración
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

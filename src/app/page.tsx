'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Armchair,
  Ticket,
  ShieldCheck,
  CalendarDays,
  MapPin,
  Clock,
  LogIn,
  Sparkles,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  CreditCard,
  Mail,
  QrCode,
  ArrowRight,
  X,
  ExternalLink,
  Award,
  Play,
  Lock,
  Bell,
  Crown,
  Star
} from 'lucide-react';
import { ROWS, EVENT_CONFIG, isSalesClosed } from '@/utils/theater';
import LoginModal from '@/components/LoginModal';

// ─── Types ────────────────────────────────────────────────────────────────────
type SeatStatus = 'available' | 'occupied';
type SeatBlock = 'left' | 'center' | 'right';

interface PublicSeat {
  id: string;
  row: string;
  number: number;
  block: SeatBlock;
  status: SeatStatus;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TICKET_PRICE = EVENT_CONFIG.generalPriceCLP;
const SERVICE_FEE_PCT = EVENT_CONFIG.serviceFeePct;
const MAX_SEATS_PER_ORDER = 6;

// 29 Official Posters in numerical sequence (2.png to 30.png)
const POSTER_SLIDES = Array.from({ length: 29 }, (_, i) => `/invitadasyparticipantes/${i + 2}.png`);

function formatCLP(n: number) {
  return `$${n.toLocaleString('es-CL')}`;
}

export default function PublicTicketing() {
  const [seats, setSeats] = useState<PublicSeat[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'seats' | 'location' | 'faq'>('info');
  const [salesClosed, setSalesClosed] = useState(false);

  // 25th Anniversary Newsletter State
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [isSubmittingNewsletter, setIsSubmittingNewsletter] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState<string | null>(null);
  const [newsletterError, setNewsletterError] = useState<string | null>(null);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setIsSubmittingNewsletter(true);
    setNewsletterError(null);
    setNewsletterSuccess(null);
    try {
      const res = await fetch('/api/newsletter.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewsletterSuccess(data.message || '¡Listo! Te avisaremos de forma prioritaria.');
        setNewsletterEmail('');
      } else {
        setNewsletterError(data.error || 'No pudimos registrar tu correo.');
      }
    } catch {
      setNewsletterError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setIsSubmittingNewsletter(false);
    }
  };

  // Check sales closed on mount
  useEffect(() => {
    setSalesClosed(isSalesClosed());
  }, []);

  // Carousel State
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  const seatMapRef = useRef<HTMLDivElement>(null);

  // Auto advance carousel every 3.0s
  useEffect(() => {
    if (isCarouselPaused) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % POSTER_SLIDES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isCarouselPaused]);

  // Close video modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsVideoModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + POSTER_SLIDES.length) % POSTER_SLIDES.length);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % POSTER_SLIDES.length);
  };

  // Fetch public seat availability
  const fetchSeats = useCallback(async () => {
    try {
      const res = await fetch('/api/sync-data.php?public=1');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.seats)) {
          const publicSeats: PublicSeat[] = data.seats.map((s: {
            id: string; row_name: string; seat_number: number; block: SeatBlock; status: string;
          }) => ({
            id: s.id,
            row: s.row_name,
            number: s.seat_number,
            block: s.block || (s.seat_number <= 8 ? 'left' : s.seat_number >= 27 ? 'right' : 'center'),
            status: s.status === 'available' ? 'available' : 'occupied',
          }));
          setSeats(publicSeats);
          setApiError(null);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setApiError(errData.error || 'No se pudo cargar el inventario de butacas.');
      }
    } catch {
      setApiError('No se pudo conectar con el servidor de inventario.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeats();
    const interval = setInterval(fetchSeats, 15000);
    return () => clearInterval(interval);
  }, [fetchSeats]);

  const toggleSeat = (seat: PublicSeat) => {
    if (salesClosed) return;
    if (seat.status === 'occupied') return;
    setSelectedIds((prev) => {
      if (prev.includes(seat.id)) return prev.filter((id) => id !== seat.id);
      if (prev.length >= MAX_SEATS_PER_ORDER) return prev;
      return [...prev, seat.id];
    });
  };

  const removeSeat = (id: string) => {
    setSelectedIds((prev) => prev.filter((seatId) => seatId !== id));
  };

  const scrollToSeatMap = () => {
    setActiveTab('seats');
    seatMapRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ─── Price calculations ───────────────────────────────────────────────────
  const subtotal = selectedIds.length * TICKET_PRICE;
  const serviceFee = Math.round(subtotal * SERVICE_FEE_PCT);
  const total = subtotal + serviceFee;

  const availableCount = seats.filter((s) => s.status === 'available').length;

  const getSeatClass = (seat: PublicSeat) => {
    if (seat.status === 'occupied') {
      return 'bg-slate-700/60 border-slate-700 text-slate-500 cursor-not-allowed opacity-50';
    }
    if (selectedIds.includes(seat.id)) {
      return 'bg-emerald-500 border-emerald-400 text-white ring-2 ring-emerald-300 scale-110 z-10 cursor-pointer font-extrabold shadow-lg shadow-emerald-500/50';
    }
    return 'bg-purple-100/90 border-purple-200 text-purple-950 hover:bg-amber-300 hover:text-slate-950 hover:border-amber-400 hover:scale-110 cursor-pointer font-bold transition-all';
  };

  return (
    <div className="min-h-screen bg-[#070614] text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950">

      {/* ── 1. GLOBAL NAVBAR ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#0c0a22]/90 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          
          {/* Logo & Festival Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-amber-400/80 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform bg-slate-900 shrink-0">
              <img
                src="/logo-festival.jpg"
                alt="Logo Festival Nacional Danza del Vientre"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <span className="text-[10px] sm:text-xs font-extrabold text-amber-400 uppercase tracking-widest block leading-none">
                Festival Nacional
              </span>
              <span className="text-sm sm:text-base font-black text-white tracking-wide block leading-tight font-serif">
                Danza del Vientre 2026
              </span>
            </div>
          </Link>

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-slate-300">
            <button
              onClick={() => setActiveTab('info')}
              className={`hover:text-amber-300 transition-colors cursor-pointer ${activeTab === 'info' ? 'text-amber-400 font-extrabold' : ''}`}
            >
              Sobre el Festival
            </button>
            <button
              onClick={scrollToSeatMap}
              className={`hover:text-amber-300 transition-colors cursor-pointer ${activeTab === 'seats' ? 'text-amber-400 font-extrabold' : ''}`}
            >
              Plano de Butacas
            </button>
            <button
              onClick={() => setActiveTab('location')}
              className={`hover:text-amber-300 transition-colors cursor-pointer ${activeTab === 'location' ? 'text-amber-400 font-extrabold' : ''}`}
            >
              Ubicación
            </button>
            <button
              onClick={() => setActiveTab('faq')}
              className={`hover:text-amber-300 transition-colors cursor-pointer ${activeTab === 'faq' ? 'text-amber-400 font-extrabold' : ''}`}
            >
              Preguntas Frecuentes
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/mis-entradas"
              className="px-3 sm:px-4 py-2 bg-white/5 hover:bg-white/10 text-indigo-200 hover:text-white font-bold text-xs rounded-xl border border-white/15 transition-all flex items-center gap-1.5 shadow-xs"
            >
              <Ticket className="w-3.5 h-3.5 text-amber-400" />
              <span>Mis Entradas</span>
            </Link>

            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="px-3 sm:px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </div>
        </div>
      </header>

      {/* Login Modal */}
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

      {/* ── 2. HERO SHOWCASE CON CARRUSEL DE AFICHES OFICIALES (9:16) ──────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#130b2e] via-[#0d0724] to-[#070614] border-b border-white/10">
        {/* Theatrical Ambient Glow using the Current Poster */}
        <div className="absolute inset-0 opacity-25 mix-blend-screen pointer-events-none transition-all duration-700">
          <img
            src={POSTER_SLIDES[currentSlide]}
            alt=""
            className="w-full h-full object-cover filter blur-2xl scale-125"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#070614] via-[#070614]/85 to-transparent" />
        <div className="absolute inset-0 bg-radial-at-c from-amber-500/15 via-transparent to-transparent pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* ── Official Poster 9:16 Reel Carousel (Left / Top) ───────────── */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div
                onMouseEnter={() => setIsCarouselPaused(true)}
                onMouseLeave={() => setIsCarouselPaused(false)}
                className="relative w-full max-w-[280px] sm:max-w-[330px] aspect-[9/16] max-h-[560px] rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.4)] border-2 border-amber-400/80 ring-2 ring-amber-400/30 group bg-[#150a2b] p-1.5 flex items-center justify-center cursor-pointer"
              >
                
                {/* Overhead Spotlight & Stage Floor Aura */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(245,158,11,0.4)_0%,transparent_75%)] pointer-events-none z-10" />
                <div className="absolute inset-x-0 bottom-0 h-28 bg-[radial-gradient(ellipse_at_50%_100%,rgba(245,158,11,0.35)_0%,transparent_75%)] pointer-events-none z-10" />

                {/* Animated Sparkles on the Frame */}
                <div className="absolute top-4 left-4 text-amber-300 text-sm animate-sparkle-1 pointer-events-none z-20">✦</div>
                <div className="absolute top-6 right-5 text-yellow-200 text-xs animate-sparkle-3 pointer-events-none z-20">★</div>
                <div className="absolute bottom-16 left-4 text-amber-400 text-base animate-sparkle-2 pointer-events-none z-20">✨</div>
                <div className="absolute bottom-20 right-4 text-amber-300 text-sm animate-sparkle-4 pointer-events-none z-20">✦</div>

                {/* Floating Gold Dust */}
                <div className="absolute bottom-10 left-8 w-2 h-2 rounded-full bg-amber-400/80 blur-[0.5px] animate-float-dust-1 pointer-events-none z-20 shadow-[0_0_6px_rgba(245,158,11,0.9)]" />
                <div className="absolute top-24 right-8 w-1.5 h-1.5 rounded-full bg-yellow-200/90 blur-[0.5px] animate-float-dust-2 pointer-events-none z-20 shadow-[0_0_6px_rgba(253,224,71,0.9)]" />

                {/* The 9:16 Official Poster Image */}
                <img
                  key={currentSlide}
                  src={POSTER_SLIDES[currentSlide]}
                  alt={`Afiche Oficial ${currentSlide + 1}`}
                  className="w-full h-full object-cover rounded-2xl transition-all duration-500 transform group-hover:scale-[1.02] shadow-2xl"
                />

                {/* Floating Badge on Bottom */}
                <div className="absolute bottom-3 left-3 right-3 z-20 text-center">
                  <span className="inline-block px-3 py-1 bg-slate-950/85 backdrop-blur-md text-amber-300 font-extrabold text-[11px] rounded-xl border border-amber-400/40 shadow-lg tracking-wider uppercase">
                    ✨ Participante {currentSlide + 1} de {POSTER_SLIDES.length}
                  </span>
                </div>

                {/* Carousel Left/Right Controls */}
                <button
                  onClick={prevSlide}
                  aria-label="Afiche anterior"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-950/80 hover:bg-amber-500 hover:text-slate-950 text-white border border-white/20 flex items-center justify-center backdrop-blur-md transition-all shadow-md cursor-pointer opacity-80 group-hover:opacity-100"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={nextSlide}
                  aria-label="Siguiente afiche"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-950/80 hover:bg-amber-500 hover:text-slate-950 text-white border border-white/20 flex items-center justify-center backdrop-blur-md transition-all shadow-md cursor-pointer opacity-80 group-hover:opacity-100"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Mini Counter / Fast Navigation Bar */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={prevSlide}
                  className="text-xs font-bold text-slate-400 hover:text-amber-400 cursor-pointer px-2 py-0.5"
                >
                  ← Anterior
                </button>
                <span className="text-xs font-mono font-extrabold text-amber-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                  {currentSlide + 1} / {POSTER_SLIDES.length}
                </span>
                <button
                  onClick={nextSlide}
                  className="text-xs font-bold text-slate-400 hover:text-amber-400 cursor-pointer px-2 py-0.5"
                >
                  Siguiente →
                </button>
              </div>
            </div>

            {/* ── Event Info & Headlines (Right / Center) ──────────────────── */}
            <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
              
              {/* Category Badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                <span className="px-3.5 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black uppercase tracking-widest flex items-center gap-1.5 shadow-xs">
                  <Award className="w-3.5 h-3.5" /> XXIV Festival Nacional Chile 2026
                </span>
                <span className="px-3.5 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-extrabold uppercase">
                  🎭 Todo Espectador
                </span>
                {salesClosed ? (
                  <span className="px-3.5 py-1.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-extrabold uppercase flex items-center gap-1.5 shadow-xs">
                    <Lock className="w-3.5 h-3.5" /> Venta Finalizada (5 Sept 21:00 hrs)
                  </span>
                ) : (
                  <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-extrabold uppercase flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    {availableCount > 0 ? `${availableCount} Butacas Disponibles` : 'Entradas a la Venta'}
                  </span>
                )}
              </div>

              {/* Event Title */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white font-serif leading-tight">
                Festival Nacional <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-200">
                  Danza del Vientre Chile
                </span>
                <span className="text-xl sm:text-2xl font-sans font-bold text-amber-200/80 block mt-1 tracking-widest uppercase">
                  XXIV EDICIÓN 2026
                </span>
              </h1>

              <p className="text-sm sm:text-base text-slate-300 max-w-2xl font-normal leading-relaxed">
                El gran encuentro de danza oriental más esperado del país. Más de 280 bailarinas en escena, destacadas solistas invitadas y escuelas consagradas en el histórico Aula Magna del Liceo Manuel de Salas.
              </p>

              {/* Event Key Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-left">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-start gap-3">
                  <CalendarDays className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-extrabold text-slate-400 block">Fecha</span>
                    <span className="text-xs sm:text-sm font-bold text-white block mt-0.5">{EVENT_CONFIG.date}</span>
                  </div>
                </div>

                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-extrabold text-slate-400 block">Horario</span>
                    <span className="text-xs sm:text-sm font-bold text-white block mt-0.5">
                      {EVENT_CONFIG.time}
                      <span className="text-[10px] text-slate-400 block font-normal">(Apertura: {EVENT_CONFIG.doorsOpen})</span>
                    </span>
                  </div>
                </div>

                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-extrabold text-slate-400 block">Recinto</span>
                    <span className="text-xs sm:text-sm font-bold text-white block mt-0.5">
                      Teatro Aula Magna LMS
                      <span className="text-[10px] text-slate-400 block font-normal">Av. Irarrázaval 3780, Ñuñoa</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* CTA Buttons in Hero */}
              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <button
                  onClick={scrollToSeatMap}
                  className="px-7 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-amber-500/25 transition-all flex items-center gap-2 transform hover:scale-105 cursor-pointer"
                >
                  <Ticket className="w-5 h-5" />
                  <span>Comprar Entradas • {formatCLP(TICKET_PRICE)}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Video Reel Modal Trigger */}
                <button
                  onClick={() => setIsVideoModalOpen(true)}
                  className="px-6 py-4 bg-gradient-to-r from-purple-600/40 via-purple-500/30 to-pink-600/40 hover:from-purple-600/60 hover:to-pink-600/60 text-white font-extrabold text-xs sm:text-sm rounded-2xl border border-purple-400/40 transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-purple-500/20 transform hover:scale-105"
                >
                  <Play className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>Ver Video del Elenco</span>
                </button>

                <button
                  onClick={() => setActiveTab('location')}
                  className="px-5 py-4 bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-xs sm:text-sm rounded-2xl border border-white/15 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span>Ubicación</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── 3. VIDEO REEL MODAL POPUP ──────────────────────────────────────── */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-[#140b2b] border-2 border-amber-400/60 rounded-3xl overflow-hidden shadow-2xl p-4 sm:p-6 space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif font-black text-white text-base">
                  Participantes & Escuelas 2026
                </h3>
              </div>
              <button
                onClick={() => setIsVideoModalOpen(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-red-500 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Cerrar video"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Container */}
            <div className="relative w-full aspect-[9/16] max-h-[70vh] bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
              <video
                src="/Participantes Festival 2026.mp4"
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              >
                Tu navegador no soporta la reproducción de video HTML5.
              </video>
            </div>

            {/* Modal Footer */}
            <div className="text-center pt-2">
              <button
                onClick={() => {
                  setIsVideoModalOpen(false);
                  scrollToSeatMap();
                }}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-black text-xs rounded-xl uppercase tracking-wider shadow-md cursor-pointer"
              >
                Comprar Entradas Ahora
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── 4. MAIN 2-COLUMN LAYOUT (Estilo Ticketplus) ───────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">

          {/* ═════════════════════════════════════════════════════════════════
              COLUMNA PRINCIPAL IZQUIERDA (65% Ancho - Info, Plano, Ubicación)
              ═════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-8 space-y-10">

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-4 overflow-x-auto">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'info'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-white/5 text-slate-300 hover:text-white'
                }`}
              >
                📝 Sobre el Festival
              </button>
              <button
                onClick={() => setActiveTab('seats')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'seats'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-white/5 text-slate-300 hover:text-white'
                }`}
              >
                🎭 Plano de Butacas
              </button>
              <button
                onClick={() => setActiveTab('location')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'location'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-white/5 text-slate-300 hover:text-white'
                }`}
              >
                📍 Ubicación & Accesos
              </button>
              <button
                onClick={() => setActiveTab('faq')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'faq'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-white/5 text-slate-300 hover:text-white'
                }`}
              >
                ❓ Preguntas Frecuentes
              </button>
            </div>

            {/* ── TAB 1: SOBRE EL FESTIVAL ─────────────────────────────────── */}
            {(activeTab === 'info' || activeTab === 'seats') && (
              <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                  <Sparkles className="w-6 h-6 text-amber-400" />
                  <h2 className="text-xl sm:text-2xl font-black text-white font-serif">
                    Sobre el Festival Nacional 2026
                  </h2>
                </div>

                <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-4 font-normal">
                  <p>
                    El <strong className="text-amber-300">XXIV Festival Nacional de Danza del Vientre Chile 2026</strong> es el evento insignia y más prestigioso de la danza oriental en nuestro país. Con una sólida trayectoria de excelencia, este festival reúne el talento, la disciplina y la belleza escénica de <strong className="text-white">más de 280 bailarinas</strong> pertenecientes a las más destacadas escuelas y agrupaciones de Chile.
                  </p>
                  <p>
                    El espectáculo se desarrollará en el emblemático <strong className="text-white">Aula Magna del Liceo Manuel de Salas en Ñuñoa</strong>, un espacio de acústica excepcional y gradería con visibilidad óptima, equipado con 100% de butacas numeradas para garantizar una experiencia cómoda e inolvidable a toda la familia.
                  </p>
                </div>

                {/* Festival Highlights Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10 text-center">
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5">
                    <span className="text-2xl font-black text-amber-400 font-serif block">+280</span>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Bailarinas en Escena</span>
                  </div>
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5">
                    <span className="text-2xl font-black text-amber-400 font-serif block">3 hrs</span>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Espectáculo en Vivo</span>
                  </div>
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5">
                    <span className="text-2xl font-black text-amber-400 font-serif block">544</span>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Capacidad Aula Magna</span>
                  </div>
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5">
                    <span className="text-2xl font-black text-amber-400 font-serif block">100%</span>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Butacas Numeradas</span>
                  </div>
                </div>
              </section>
            )}

            {/* ── 25 ANIVERSARIO • BODAS DE PLATA (2027) COMMEMORATIVE BANNER (OPCIÓN A) ── */}
            {salesClosed && (
              <section className="bg-gradient-to-br from-[#1d1042] via-[#2a135e] to-[#12082b] border-2 border-amber-400/60 rounded-3xl p-6 sm:p-10 shadow-[0_0_50px_rgba(245,158,11,0.25)] space-y-6 relative overflow-hidden text-center animate-in fade-in duration-300">
                {/* Background Shimmer & Sparkles */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-b from-amber-400/20 to-transparent rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-t from-purple-500/20 to-transparent rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 space-y-4 max-w-2xl mx-auto">
                  
                  {/* Edition Closed Badge */}
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/15 border border-amber-300/40 text-amber-300 text-[11px] font-black tracking-widest uppercase shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>XXIV Edición Concluida • ¡Gracias Chile!</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  </div>

                  {/* Grand 25th Anniversary Title */}
                  <div className="space-y-1">
                    <span className="text-xs sm:text-sm font-extrabold text-amber-200 tracking-[0.25em] uppercase block">
                      Próxima Gran Cita
                    </span>
                    <h2 className="text-3xl sm:text-5xl font-black font-serif text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-100 uppercase leading-tight">
                      🎉 RUMBO A LOS 25 AÑOS
                    </h2>
                    <h3 className="text-xl sm:text-2xl font-black text-white font-serif tracking-wider uppercase">
                      ✨ BODAS DE PLATA 2027 ✨
                    </h3>
                  </div>

                  {/* Narrative description */}
                  <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed max-w-xl mx-auto font-medium">
                    Un cuarto de siglo celebrando la magia, el arte y la pasión de la danza oriental en nuestro país. Nos preparamos para una edición histórica de gala con grandes maestras internacionales invitadas y una puesta en escena inolvidable.
                  </p>

                  {/* Pre-registration Form */}
                  <div className="pt-3 max-w-md mx-auto">
                    <div className="bg-black/50 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-amber-400/30 shadow-xl space-y-3">
                      <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-300">
                        <Bell className="w-4 h-4" />
                        <span>Acceso Prioritario a Preventa 2027</span>
                      </div>

                      {newsletterSuccess ? (
                        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs font-bold flex items-center justify-center gap-2 animate-in zoom-in-95">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{newsletterSuccess}</span>
                        </div>
                      ) : (
                        <form onSubmit={handleNewsletterSubmit} className="space-y-2">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="email"
                              value={newsletterEmail}
                              onChange={(e) => setNewsletterEmail(e.target.value)}
                              placeholder="Tu correo electrónico..."
                              required
                              className="flex-1 px-4 py-2.5 bg-slate-900 border border-white/15 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 text-center sm:text-left"
                            />
                            <button
                              type="submit"
                              disabled={isSubmittingNewsletter}
                              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer transition-all hover:scale-[1.02] uppercase tracking-wider shrink-0"
                            >
                              {isSubmittingNewsletter ? 'Enviando...' : '🔔 Notificarme'}
                            </button>
                          </div>
                          {newsletterError && (
                            <p className="text-[11px] text-red-300 font-semibold">{newsletterError}</p>
                          )}
                          <p className="text-[10px] text-slate-400">
                            Te avisaremos antes que a nadie cuando abran las entradas y butacas de los 25 años.
                          </p>
                        </form>
                      )}
                    </div>
                  </div>

                  {/* Direct links for current attendees */}
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Link
                      href="/mis-entradas"
                      className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl border border-white/20 flex items-center gap-2 transition-colors"
                    >
                      <Ticket className="w-3.5 h-3.5 text-amber-400" />
                      <span>Descargar Mis Entradas 2026</span>
                    </Link>
                    <button
                      onClick={() => setIsVideoModalOpen(true)}
                      className="px-5 py-2.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 font-bold text-xs rounded-xl border border-purple-400/30 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 text-amber-300" />
                      <span>Ver Video del Elenco 2026</span>
                    </button>
                  </div>

                </div>
              </section>
            )}

            {/* ── TAB 2: PLANO INTERACTIVO DE BUTACAS (TEATRO) ─────────────── */}
            <section ref={seatMapRef} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 sm:p-7 shadow-2xl space-y-6">
              
              {apiError && (
                <div className="p-4 bg-red-500/20 border border-red-500/40 text-red-200 font-extrabold rounded-2xl text-center text-xs">
                  ⚠️ ALERTA DE INVENTARIO: {apiError}
                </div>
              )}

              {/* Map Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 font-serif">
                    <Armchair className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                    Selección de Butacas — Aula Magna
                  </h2>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    {salesClosed ? (
                      <span className="text-rose-300 font-bold">
                        🔒 Venta de entradas finalizada a las 21:00 hrs del 5 de septiembre. Plano en modo de solo visualización.
                      </span>
                    ) : (
                      <span>Haz clic en los asientos disponibles para agregarlos a tu orden (máx. {MAX_SEATS_PER_ORDER} por compra).</span>
                    )}
                  </p>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 text-xs font-bold bg-slate-900/80 px-3.5 py-2 rounded-2xl border border-white/10">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-purple-200 inline-block shadow-xs" /> Libre
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-300" /> Tu Selección
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-slate-600 inline-block" /> Ocupada
                  </span>
                </div>
              </div>

              {/* Stage Banner */}
              <div className="w-full max-w-xl mx-auto bg-gradient-to-r from-purple-600/30 via-amber-500/30 to-purple-600/30 border border-amber-400/40 rounded-2xl py-2.5 text-center text-xs sm:text-sm font-black text-amber-300 tracking-widest uppercase shadow-md">
                🎭 ESCENARIO PRINCIPAL
              </div>

              {/* Seat Map Grid (16 Rows x 34 Seats with 2 Aisles) */}
              <div className="overflow-x-auto pb-4">
                <div className="min-w-[680px] lg:min-w-0 w-full space-y-1.5 sm:space-y-2 px-1">
                  {ROWS.map((row) => {
                    const rowSeats = seats.filter((s) => s.row === row);
                    const leftBlock = rowSeats.filter((s) => s.number <= 8);
                    const centerBlock = rowSeats.filter((s) => s.number >= 9 && s.number <= 26);
                    const rightBlock = rowSeats.filter((s) => s.number >= 27);

                    return (
                      <div key={row} className="flex items-center gap-1.5 sm:gap-2 group w-full">
                        {/* Row Left Label */}
                        <span className="w-5 sm:w-6 text-center text-xs sm:text-sm font-black text-slate-400 group-hover:text-amber-400 transition-colors shrink-0 font-mono">
                          {row}
                        </span>

                        {/* Left Block (8 Seats) */}
                        <div
                          className="grid gap-0.5 sm:gap-1 min-w-0"
                          style={{
                            flex: '8 8 0%',
                            gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                          }}
                        >
                          {leftBlock.map((seat) => (
                            <button
                              key={seat.id}
                              onClick={() => toggleSeat(seat)}
                              disabled={seat.status === 'occupied'}
                              title={`Fila ${seat.row} - Asiento ${seat.number} (${seat.status === 'occupied' ? 'Ocupado' : 'Disponible'})`}
                              className={`w-full aspect-square max-w-[32px] max-h-[32px] mx-auto rounded-full text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] flex items-center justify-center transition-all duration-150 border ${getSeatClass(
                                seat
                              )}`}
                            >
                              {seat.number}
                            </button>
                          ))}
                        </div>

                        {/* Left Aisle */}
                        <div className="w-3 sm:w-4 flex items-center justify-center shrink-0">
                          <span className="w-0.5 h-3 bg-amber-500/20 rounded-full" />
                        </div>

                        {/* Center Block (18 Seats) */}
                        <div
                          className="grid gap-0.5 sm:gap-1 min-w-0"
                          style={{
                            flex: '18 18 0%',
                            gridTemplateColumns: 'repeat(18, minmax(0, 1fr))',
                          }}
                        >
                          {centerBlock.map((seat) => (
                            <button
                              key={seat.id}
                              onClick={() => toggleSeat(seat)}
                              disabled={seat.status === 'occupied'}
                              title={`Fila ${seat.row} - Asiento ${seat.number} (${seat.status === 'occupied' ? 'Ocupado' : 'Disponible'})`}
                              className={`w-full aspect-square max-w-[32px] max-h-[32px] mx-auto rounded-full text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] flex items-center justify-center transition-all duration-150 border ${getSeatClass(
                                seat
                              )}`}
                            >
                              {seat.number}
                            </button>
                          ))}
                        </div>

                        {/* Right Aisle */}
                        <div className="w-3 sm:w-4 flex items-center justify-center shrink-0">
                          <span className="w-0.5 h-3 bg-amber-500/20 rounded-full" />
                        </div>

                        {/* Right Block (8 Seats) */}
                        <div
                          className="grid gap-0.5 sm:gap-1 min-w-0"
                          style={{
                            flex: '8 8 0%',
                            gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                          }}
                        >
                          {rightBlock.map((seat) => (
                            <button
                              key={seat.id}
                              onClick={() => toggleSeat(seat)}
                              disabled={seat.status === 'occupied'}
                              title={`Fila ${seat.row} - Asiento ${seat.number} (${seat.status === 'occupied' ? 'Ocupado' : 'Disponible'})`}
                              className={`w-full aspect-square max-w-[32px] max-h-[32px] mx-auto rounded-full text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] flex items-center justify-center transition-all duration-150 border ${getSeatClass(
                                seat
                              )}`}
                            >
                              {seat.number}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ── TAB 3: UBICACIÓN & ACCESOS ───────────────────────────────── */}
            {activeTab === 'location' && (
              <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                  <MapPin className="w-6 h-6 text-amber-400" />
                  <h2 className="text-xl sm:text-2xl font-black text-white font-serif">
                    Ubicación y Cómo Llegar
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4 text-xs sm:text-sm text-slate-300">
                    <div className="bg-slate-900/80 p-4 rounded-2xl border border-white/10 space-y-2">
                      <h3 className="font-bold text-white flex items-center gap-2">
                        📍 Dirección Oficial:
                      </h3>
                      <p className="text-amber-300 font-medium">
                        Teatro Aula Magna LMS<br />
                        Av. Irarrázaval 3780, Ñuñoa, Santiago.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-white">🚇 En Metro:</h4>
                      <p>
                        Estación <strong className="text-amber-300">Chile España (Línea 3)</strong> o <strong className="text-amber-300">Villa Frei</strong>: A pasos por Av. Irarrázaval cruzando hacia Plaza Ñuñoa.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-white">🚗 Estacionamiento:</h4>
                      <p>
                        Disponibilidad de estacionamiento subterráneo público en Plaza Ñuñoa (Plaza Jorge Washington) y en calles aledañas a Av. Irarrázaval.
                      </p>
                    </div>
                  </div>

                  {/* Embedded Google Maps Box */}
                  <div className="rounded-2xl overflow-hidden border border-white/15 h-64 bg-slate-900 flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <MapPin className="w-10 h-10 text-amber-400 animate-bounce" />
                    <div>
                      <p className="font-extrabold text-white text-xs">Teatro Aula Magna LMS</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Av. Irarrázaval 3780, Ñuñoa</p>
                    </div>
                    <a
                      href="https://maps.google.com/?q=Av.+Irarrazaval+3780,+Nunoa,+Santiago"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                    >
                      <span>Abrir en Google Maps</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </section>
            )}

            {/* ── TAB 4: PREGUNTAS FRECUENTES (FAQ) ────────────────────────── */}
            {activeTab === 'faq' && (
              <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                  <HelpCircle className="w-6 h-6 text-amber-400" />
                  <h2 className="text-xl sm:text-2xl font-black text-white font-serif">
                    Preguntas Frecuentes (FAQ)
                  </h2>
                </div>

                <div className="space-y-3">
                  <div className="bg-slate-900/80 p-4 rounded-2xl border border-white/10 space-y-1.5">
                    <h3 className="font-extrabold text-white text-xs sm:text-sm">
                      ¿Cómo recibiré mis entradas tras la compra?
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Tus entradas oficiales se generan automáticamente en formato PDF de alta resolución con su código QR único y se despachan de forma inmediata al correo electrónico que ingreses en el checkout (firmadas por nuestra cuenta oficial de Google Gmail).
                    </p>
                  </div>

                  <div className="bg-slate-900/80 p-4 rounded-2xl border border-white/10 space-y-1.5">
                    <h3 className="font-extrabold text-white text-xs sm:text-sm">
                      ¿A qué hora abren las puertas del teatro?
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      La apertura de puertas se realizará a las <strong className="text-amber-300">{EVENT_CONFIG.doorsOpen}</strong>. El inicio del festival será puntual a las <strong className="text-amber-300">{EVENT_CONFIG.time}</strong>. Te recomendamos llegar con anticipación para validar tu QR cómodamente.
                    </p>
                  </div>

                  <div className="bg-slate-900/80 p-4 rounded-2xl border border-white/10 space-y-1.5">
                    <h3 className="font-extrabold text-white text-xs sm:text-sm">
                      ¿Las butacas son numeradas?
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Sí, el 100% de las butacas son numeradas. El asiento que elijas en el mapa interactivo será reservado exclusivamente para ti.
                    </p>
                  </div>

                  <div className="bg-slate-900/80 p-4 rounded-2xl border border-white/10 space-y-1.5">
                    <h3 className="font-extrabold text-white text-xs sm:text-sm">
                      ¿Puedo mostrar mi entrada desde el celular?
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Sí, puedes presentar el código QR directamente desde la pantalla de tu teléfono o llevar el PDF impreso si lo prefieres.
                    </p>
                  </div>
                </div>
              </section>
            )}

          </div>

          {/* ═════════════════════════════════════════════════════════════════
              COLUMNA LATERAL DERECHA (35% Ancho - Sticky Purchase Box)
              ═════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">

            <div className="bg-gradient-to-b from-[#160d38] to-[#0d0724] border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-5">
              
              {/* Header Box */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] uppercase font-extrabold text-amber-400 tracking-wider block">Entrada General</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-white font-mono">{formatCLP(TICKET_PRICE)}</span>
                    <span className="text-xs text-slate-400">/ butaca</span>
                  </div>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-400">
                  <Ticket className="w-6 h-6" />
                </div>
              </div>

              {/* Selection Status */}
              {salesClosed ? (
                <div className="bg-gradient-to-b from-rose-950/40 via-slate-900 to-slate-950 border-2 border-rose-500/40 rounded-2xl p-5 text-center space-y-4 shadow-xl">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-400/40 flex items-center justify-center mx-auto text-rose-300 shadow-inner">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 block">
                      Evento en Curso / Concluido
                    </span>
                    <h4 className="font-serif font-black text-white text-base uppercase tracking-wide">
                      Venta de Entradas Finalizada
                    </h4>
                    <p className="text-xs text-rose-200/90 leading-relaxed">
                      El proceso de venta online para la XXIV Edición del Festival ha cerrado oficialmente a las <strong>21:00 hrs del sábado 5 de septiembre de 2026</strong>.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/10 space-y-2 text-left">
                    <p className="text-[11px] text-slate-300 text-center">
                      ¿Ya compraste tus entradas? Puedes consultarlas y descargarlas en cualquier momento con tu correo o Google:
                    </p>
                    <Link
                      href="/mis-entradas"
                      className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 uppercase tracking-wider transition-transform hover:scale-[1.01]"
                    >
                      <Ticket className="w-4 h-4" />
                      <span>Ver Mis Entradas Descargables</span>
                    </Link>
                  </div>
                </div>
              ) : selectedIds.length === 0 ? (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center space-y-3">
                  <Armchair className="w-8 h-8 mx-auto text-amber-400/80 animate-pulse" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">No has seleccionado butacas</p>
                    <p className="text-[11px] text-slate-400">
                      Haz clic en el plano del teatro para elegir tus asientos favoritos.
                    </p>
                  </div>
                  <button
                    onClick={scrollToSeatMap}
                    className="w-full py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-extrabold text-xs rounded-xl border border-amber-500/40 transition-all cursor-pointer"
                  >
                    Ir al Plano de Butacas
                  </button>
                </div>
              ) : (
                /* Selected Seats List */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {selectedIds.length} {selectedIds.length === 1 ? 'butaca seleccionada' : 'butacas seleccionadas'}
                    </span>
                    <button
                      onClick={() => setSelectedIds([])}
                      className="text-[11px] text-slate-400 hover:text-red-400 underline cursor-pointer"
                    >
                      Limpiar selección
                    </button>
                  </div>

                  {/* Seat Tags */}
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                    {selectedIds.map((id) => (
                      <span
                        key={id}
                        className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 font-mono text-xs font-extrabold rounded-lg border border-emerald-500/40 flex items-center gap-1.5"
                      >
                        <span>{id}</span>
                        <button
                          onClick={() => removeSeat(id)}
                          className="hover:text-red-300 cursor-pointer"
                          title="Eliminar butaca"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Order Totals Summary */}
                  <div className="space-y-2 pt-3 border-t border-white/10 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Subtotal ({selectedIds.length} entradas)</span>
                      <span className="font-mono font-bold text-white">{formatCLP(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Cargo por servicio ({SERVICE_FEE_PCT * 100}%)</span>
                      <span className="font-mono font-semibold">{formatCLP(serviceFee)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-amber-300 pt-2 border-t border-white/10">
                      <span>Total Final</span>
                      <span className="font-mono text-lg">{formatCLP(total)}</span>
                    </div>
                  </div>

                  {/* Proceed to Checkout Button */}
                  <Link
                    href={`/checkout?seats=${selectedIds.join(',')}`}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-amber-500/30 transition-all flex items-center justify-center gap-2 uppercase tracking-wider transform hover:scale-[1.02] cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Continuar al Pago ({formatCLP(total)})</span>
                  </Link>
                </div>
              )}

              {/* Trust Badges */}
              <div className="pt-2 border-t border-white/10 space-y-2.5 text-[11px] text-slate-300">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Pago Seguro con <strong>Webpay Plus (Transbank)</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Entrada Digital Inmediata con <strong>Código QR Único</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Despacho Oficial vía <strong>Google Gmail</strong></span>
                </div>
              </div>

            </div>

            {/* Already Purchased Help Box */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center space-y-2">
              <span className="text-xs font-extrabold text-white block">¿Ya compraste tus entradas?</span>
              <p className="text-[11px] text-slate-400">
                Accede a tu panel seguro para verlas o descargarlas en PDF.
              </p>
              <Link
                href="/mis-entradas"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 underline pt-1"
              >
                <span>Ir a Mis Entradas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

          </div>

        </div>
      </main>

      {/* ── 5. FOOTER INSTITUCIONAL ───────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-[#060411] text-slate-400 py-12 px-4 sm:px-6 lg:px-8 mt-16">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-amber-400/60 shrink-0 bg-slate-900">
              <img src="/logo-festival.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="text-xs font-black text-white block">XXIV Festival Nacional Danza del Vientre Chile 2026</span>
              <span className="text-[11px] text-slate-500 block">Sábado 5 de Septiembre • Teatro Aula Magna (Av. Irarrázaval 3780, Ñuñoa)</span>
            </div>
          </div>

          <div className="text-xs space-y-1">
            <p>Contacto Oficial: <a href="mailto:festivalnac.danzadelvientre@gmail.com" className="text-amber-400 hover:underline">festivalnac.danzadelvientre@gmail.com</a></p>
            <p className="text-[11px] text-slate-500">Plataforma y Pasarela de Entradas operada por TuPartnerTI</p>
          </div>

        </div>
      </footer>

    </div>
  );
}

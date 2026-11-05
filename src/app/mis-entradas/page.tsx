'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Ticket, Download, ArrowLeft, Mail, Calendar, MapPin, Loader2, ShieldCheck, Lock, CheckCircle2, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';
import { generateTicketPDF, downloadPDFBlob } from '@/utils/pdfGenerator';
import { Seat } from '@/types/festival';
import { EVENT_CONFIG } from '@/utils/theater';

function MisEntradasContent() {
  const searchParams = useSearchParams();
  const magicTokenParam = searchParams.get('token') || '';

  const [emailInput, setEmailInput] = useState('');
  const [isRequestingMagicLink, setIsRequestingMagicLink] = useState(false);
  const [magicLinkSentMsg, setMagicLinkSentMsg] = useState<string | null>(null);

  const [authenticatedEmail, setAuthenticatedEmail] = useState<string | null>(null);
  const [purchasedSeats, setPurchasedSeats] = useState<Seat[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If magic token is present in URL -> verify immediately
  useEffect(() => {
    if (magicTokenParam) {
      verifyMagicToken(magicTokenParam);
    }
  }, [magicTokenParam]);

  const verifyMagicToken = async (token: string) => {
    setIsLoadingTickets(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/magic-link.php?action=verify&token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!res.ok || !json.valid) {
        throw new Error(json.error || 'El enlace mágico es inválido o ha expirado. Por favor solicita uno nuevo.');
      }
      setAuthenticatedEmail(json.email);
      if (json.seats && Array.isArray(json.seats)) {
        setPurchasedSeats(json.seats);
      } else {
        await loadTicketsForEmail(json.email);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al validar el enlace mágico');
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const loadTicketsForEmail = async (email: string) => {
    setIsLoadingTickets(true);
    try {
      const res = await fetch('/api/sync-data.php');
      if (res.ok) {
        const json = await res.json();
        const allSeats: Seat[] = json.seats || [];
        const matching = allSeats.filter(
          (s) =>
            s.assignedParticipantName &&
            s.assignedParticipantName.toLowerCase().includes(email.toLowerCase())
        );
        setPurchasedSeats(matching);
      }
    } catch (err) {
      console.error('Error loading tickets:', err);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const handleRequestMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setIsRequestingMagicLink(true);
    setErrorMsg(null);
    setMagicLinkSentMsg(null);
    try {
      const res = await fetch('/api/magic-link.php?action=request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim().toLowerCase() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al enviar enlace de acceso');
      }
      setMagicLinkSentMsg(json.message || 'Enlace de acceso seguro enviado a tu correo.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al solicitar el enlace mágico');
    } finally {
      setIsRequestingMagicLink(false);
    }
  };

  const handleDownloadPDF = async (seat: Seat) => {
    const { pdfBlob, filename } = await generateTicketPDF(seat, { name: seat.assignedParticipantName || 'Asistente' });
    downloadPDFBlob(pdfBlob, filename);
  };

  const handleLogout = () => {
    setAuthenticatedEmail(null);
    setPurchasedSeats([]);
    setMagicLinkSentMsg(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-purple-950 text-white py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-indigo-300 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver a la Ticketera
          </Link>

          <span className="text-amber-400 font-extrabold text-xs tracking-widest uppercase flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Portal de Entradas Oficial
          </span>
        </div>

        {/* Error message display */}
        {errorMsg && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-200 p-4 rounded-2xl text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* IF AUTHENTICATED: Display Purchased Tickets */}
        {authenticatedEmail ? (
          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-extrabold text-lg flex items-center justify-center shadow-md">
                  {authenticatedEmail.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Acceso Autenticado
                    </span>
                  </div>
                  <h2 className="text-base font-extrabold text-white mt-0.5">
                    Entradas de: <span className="text-amber-400 font-mono text-xs">{authenticatedEmail}</span>
                  </h2>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="text-xs font-bold text-slate-400 hover:text-red-300 underline transition-colors cursor-pointer"
              >
                Cerrar sesión
              </button>
            </div>

            {isLoadingTickets ? (
              <div className="bg-white/5 rounded-2xl p-12 text-center text-indigo-300 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-400" />
                <p className="text-xs font-bold">Cargando tus entradas de forma segura...</p>
              </div>
            ) : purchasedSeats.length === 0 ? (
              <div className="bg-slate-900/70 rounded-3xl p-8 sm:p-12 border border-white/10 text-center space-y-5 max-w-2xl mx-auto shadow-2xl backdrop-blur-md">
                <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/10">
                  <Ticket className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl sm:text-2xl font-black text-white font-serif">
                    No se encontraron entradas
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300">
                    No hay entradas registradas con el correo <span className="text-amber-400 font-mono font-bold">{authenticatedEmail}</span>.
                  </p>
                  <p className="text-xs text-indigo-200/80 font-medium">
                    Si compraste con otro correo, solicita el enlace con la dirección correspondiente.
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <span>Explorar plano y comprar entradas</span>
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-amber-400" />
                    Tus Entradas Oficiales ({purchasedSeats.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {purchasedSeats.map((seat) => (
                    <div key={seat.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />

                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Entrada Oficial</span>
                          <h4 className="text-base font-extrabold text-white">Fila {seat.row} — Asiento {seat.number}</h4>
                          <span className="text-xs font-mono text-amber-400 font-bold block mt-0.5">{seat.ticketCode || `${seat.id}FDVC2026`}</span>
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-extrabold rounded-full">
                          {seat.status === 'sold' ? '✓ PAGADO' : '✓ EMITIDO'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-300 space-y-1 border-t border-b border-slate-800 py-3">
                        <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" /> {EVENT_CONFIG.date} • {EVENT_CONFIG.time}</p>
                        <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" /> {EVENT_CONFIG.venue}</p>
                      </div>

                      <div className="space-y-2">
                        <button
                          onClick={() => handleDownloadPDF(seat)}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>Descargar Entrada (PDF)</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* UNAUTHENTICATED: Show Magic Link Request Form */
          <div className="bg-white/5 backdrop-blur rounded-2xl p-6 md:p-8 border border-white/10 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 text-amber-400 font-extrabold text-base">
                <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/30">
                  <Lock className="w-5 h-5 text-amber-400" />
                </div>
                <h2>Acceso Seguro a tus Entradas</h2>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-4 md:p-5 rounded-2xl text-xs text-slate-300 leading-relaxed space-y-2">
                <p>
                  🔒 <strong className="text-white">Por seguridad de tu compra:</strong> Ingresa el correo electrónico que utilizaste al comprar tus entradas o donde recibiste tus asignaciones.
                </p>
                <p>
                  Te enviaremos un <strong className="text-amber-300">Enlace Mágico de Acceso Seguro</strong> directo desde nuestra cuenta oficial de Google (<code className="text-amber-200">festivalnac.danzadelvientre@gmail.com</code>) para que puedas ver y descargar tus entradas en PDF con código QR (válido por 15 minutos).
                </p>
              </div>
            </div>

            {magicLinkSentMsg ? (
              <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 p-5 rounded-2xl text-xs font-bold space-y-3">
                <p className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{magicLinkSentMsg}</span>
                </p>
                <p className="text-[11px] text-slate-300 font-normal leading-relaxed">
                  Revisa tu bandeja de entrada (y la carpeta de SPAM o Promociones) en <strong className="text-white">{emailInput}</strong> y haz clic en el botón <em>"✨ Ver y Descargar Mis Entradas"</em> para ingresar.
                </p>
                <div className="pt-2 border-t border-emerald-500/30 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setMagicLinkSentMsg(null);
                      setEmailInput('');
                    }}
                    className="text-xs text-amber-400 hover:text-amber-300 underline cursor-pointer"
                  >
                    ← Probar con otro correo
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestMagicLink}
                    disabled={isRequestingMagicLink}
                    className="text-xs text-emerald-300 hover:text-white underline cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRequestingMagicLink ? 'animate-spin' : ''}`} />
                    <span>Reenviar enlace</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRequestMagicLink} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Correo electrónico utilizado en la compra *
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="tu.correo@ejemplo.cl"
                      className="w-full bg-slate-900/80 border border-slate-700 text-white text-xs font-semibold rounded-xl pl-9 pr-3.5 py-3 focus:ring-2 focus:ring-amber-500 outline-none placeholder-slate-500"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isRequestingMagicLink || !emailInput.trim()}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-40 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isRequestingMagicLink ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando enlace seguro por Google Gmail...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Enviar Enlace Mágico de Acceso Seguro</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyTicketsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <p className="text-xs font-bold text-slate-300">Cargando acceso seguro...</p>
        </div>
      </div>
    }>
      <MisEntradasContent />
    </Suspense>
  );
}

'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Ticket, ShieldCheck, Tag, Clock, ArrowLeft, CheckCircle2, User, Mail, Phone, Lock, Loader2, AlertTriangle, CreditCard, Sparkles } from 'lucide-react';
import { isSalesClosed } from '@/utils/theater';

function formatCLP(n: number) {
  return `$${n.toLocaleString('es-CL')}`;
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const seatIdsParam = searchParams.get('seats') || '';
  const seatIds = seatIdsParam ? seatIdsParam.split(',').filter(Boolean) : [];

  // Price & Discount state
  const unitPrice = 10000;
  const subtotal = seatIds.length * unitPrice;

  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    type: string;
    value: number;
    discountAmount: number;
    netSubtotal: number;
    serviceCharge: number;
    totalAmount: number;
  } | null>(null);

  const [discountError, setDiscountError] = useState<string | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Processing state
  const [orderId, setOrderId] = useState<string | null>(null);
  const [isInitializingReservation, setIsInitializingReservation] = useState(true);
  const [isReserving, setIsReserving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [salesClosed, setSalesClosed] = useState(false);

  // Timer 15 min TTL countdown state (synced with MySQL backend)
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(900);

  // Check sales closed on mount
  useEffect(() => {
    if (isSalesClosed()) {
      setSalesClosed(true);
      setErrorMsg('La venta de entradas para el festival ha finalizado oficialmente a las 21:00 hrs del 5 de septiembre de 2026.');
    }
  }, []);

  // Load draft from sessionStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedDraft = sessionStorage.getItem('festival_checkout_draft');
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        if (draft.buyerName) setBuyerName(draft.buyerName);
        if (draft.buyerEmail) setBuyerEmail(draft.buyerEmail);
        if (draft.buyerPhone) setBuyerPhone(draft.buyerPhone);
        if (draft.acceptedTerms) setAcceptedTerms(true);
        if (draft.appliedDiscount) setAppliedDiscount(draft.appliedDiscount);
      }
    } catch {
      // Ignore sessionStorage parsing errors
    }
  }, []);

  // Persist draft to sessionStorage on changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem('festival_checkout_draft', JSON.stringify({
        buyerName,
        buyerEmail,
        buyerPhone,
        acceptedTerms,
        appliedDiscount,
      }));
    } catch {
      // Ignore storage errors
    }
  }, [buyerName, buyerEmail, buyerPhone, acceptedTerms, appliedDiscount]);

  // Synchronize reservation TTL from server (immune to F5)
  useEffect(() => {
    if (seatIds.length === 0) {
      setIsInitializingReservation(false);
      return;
    }

    let isMounted = true;

    async function syncServerReservation() {
      try {
        const res = await fetch(`/api/checkout/reserve.php?seats=${seatIds.join(',')}`);
        const data = await res.json();
        if (isMounted) {
          if (data.success && typeof data.remainingSeconds === 'number') {
            setTimeLeftSeconds(data.remainingSeconds);
            setOrderId(data.orderId);
            setErrorMsg(null); // Clear any stale errors on valid rehydration

            // Restore buyer fields from server if local is empty
            if (data.buyerName && !buyerName) setBuyerName(data.buyerName);
            if (data.buyerEmail && !buyerEmail) setBuyerEmail(data.buyerEmail);
            if (data.buyerPhone && !buyerPhone) setBuyerPhone(data.buyerPhone);
          } else if (data.error) {
            setErrorMsg(data.error);
            setTimeLeftSeconds(0);
          }
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (isMounted) {
          setIsInitializingReservation(false);
        }
      }
    }

    syncServerReservation();

    return () => {
      isMounted = false;
    };
  }, [seatIdsParam]);

  useEffect(() => {
    if (timeLeftSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeftSeconds]);

  // Validation formula
  const isNameValid = buyerName.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim());
  const isTimeValid = timeLeftSeconds > 0;
  const canPay = !isInitializingReservation && !salesClosed && isTimeValid && isNameValid && isEmailValid && acceptedTerms && !isReserving;

  // Recalculated Breakdown (Client Preview, but Server always enforces it strictly)
  const discountAmount = appliedDiscount ? appliedDiscount.discountAmount : 0;
  const netSubtotal = Math.max(0, subtotal - discountAmount);
  const serviceCharge = Math.round(netSubtotal * 0.04);
  const finalTotal = netSubtotal + serviceCharge;

  // Handle Discount validation
  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discountCodeInput.trim()) return;
    setIsValidatingCode(true);
    setDiscountError(null);
    try {
      const res = await fetch('/api/discounts.php?action=validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCodeInput.trim(), seatCount: seatIds.length }),
      });
      const json = await res.json();
      if (!res.ok || !json.valid) {
        setDiscountError(json.error || 'Código de descuento no válido');
        setAppliedDiscount(null);
      } else {
        setAppliedDiscount(json);
        setDiscountError(null);
      }
    } catch {
      setDiscountError('Fallo al validar código de descuento');
    } finally {
      setIsValidatingCode(false);
    }
  };

  // Handle Proceed to Webpay Payment
  const handleProceedToWebpay = async () => {
    if (salesClosed || isSalesClosed()) {
      setErrorMsg('La venta de entradas para el festival ha finalizado oficialmente a las 21:00 hrs del 5 de septiembre de 2026.');
      return;
    }

    if (!acceptedTerms) {
      setErrorMsg('Debes aceptar los Términos de compra y tratamiento de datos para continuar con el pago.');
      return;
    }

    if (!buyerName.trim() || !buyerEmail.trim()) {
      setErrorMsg('Por favor completa tu nombre y correo electrónico.');
      return;
    }

    if (timeLeftSeconds <= 0) {
      setErrorMsg('Tu tiempo de reserva ha expirado. Por favor, selecciona tus butacas nuevamente.');
      return;
    }

    setIsReserving(true);
    setErrorMsg(null);

    try {
      // 1. Confirm order and buyer info atomically on backend
      const resReserve = await fetch('/api/checkout/reserve.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId || undefined,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          buyerPhone: buyerPhone.trim(),
          seatIds,
          discountCode: appliedDiscount?.code || '',
        }),
      });

      const jsonReserve = await resReserve.json();
      if (!resReserve.ok || !jsonReserve.success) {
        throw new Error(jsonReserve.error || 'No se pudo confirmar tu reserva de butacas.');
      }

      const activeOrderId = jsonReserve.orderId;

      // 2. Initiate Webpay Transaction
      const resWebpay = await fetch('/api/webpay/create.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: activeOrderId }),
      });

      const jsonWebpay = await resWebpay.json();
      if (!resWebpay.ok || !jsonWebpay.success) {
        throw new Error(jsonWebpay.error || 'No se pudo iniciar la transacción en Webpay.');
      }

      // 3. Redirect to Webpay payment gateway
      if (jsonWebpay.url && jsonWebpay.token) {
        window.location.href = `${jsonWebpay.url}?token_ws=${jsonWebpay.token}`;
      } else {
        throw new Error('Respuesta incompleta de Transbank Webpay');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMsg(err.message || 'Error al iniciar el pago. Inténtalo de nuevo.');
      setIsReserving(false);
    }
  };

  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelReservation = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await fetch('/api/checkout/reserve.php?action=cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      sessionStorage.removeItem('festival_checkout_draft');
    } catch {
      // Ignore network errors on cancel
    }
    router.push('/');
  };

  const minutesLeft = Math.floor(timeLeftSeconds / 60);
  const secondsLeft = timeLeftSeconds % 60;
  const timerDisplay = `${minutesLeft.toString().padStart(2, '0')}:${secondsLeft.toString().padStart(2, '0')}`;

  if (seatIds.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 max-w-md w-full text-center space-y-4 shadow-2xl">
          <Ticket className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-xl font-extrabold">No has seleccionado butacas</h2>
          <p className="text-xs text-slate-400">
            Regresa al mapa del teatro para seleccionar tus entradas antes de realizar el pago.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl transition-all"
          >
            ← Volver al Mapa de Butacas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-purple-950 text-white py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Top Navbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            onClick={handleCancelReservation}
            disabled={isCancelling}
            className="inline-flex items-center gap-2 text-xs font-bold text-indigo-300 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isCancelling ? 'Liberando butacas...' : 'Cancelar reserva y volver a la selección'}</span>
          </button>

          {/* 15-Minute Countdown Timer */}
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold text-amber-300 self-start sm:self-auto">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span>Tiempo de reserva: <strong className="font-mono text-white text-sm">{timerDisplay}</strong></span>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">

          {/* Left Column: Buyer Details & Auth Options */}
          <div className="md:col-span-2 space-y-6">

            {/* Status & Verification banners */}
            {isInitializingReservation && (
              <div className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 shadow-sm">
                <Loader2 className="w-4 h-4 shrink-0 text-amber-400 animate-spin" />
                <span>Verificando tu reserva de butacas en el servidor...</span>
              </div>
            )}

            {!isInitializingReservation && timeLeftSeconds <= 0 && (
              <div className="bg-amber-500/20 border border-amber-500/40 text-amber-200 p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>⏱️ Tu reserva de 15 minutos ha expirado.</span>
                </div>
                <Link href="/" className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase">
                  Volver al Mapa
                </Link>
              </div>
            )}

            {!isInitializingReservation && timeLeftSeconds > 0 && errorMsg && (
              <div className="bg-red-500/20 border border-red-500/40 text-red-200 p-4 rounded-2xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Buyer Details Box (Invitado) */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-amber-400" />
                    Datos del Comprador
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Las entradas oficiales en PDF con su código QR serán enviadas a este correo tras el pago.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-amber-400" /> Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Ej: Constanza Morales"
                    className="w-full bg-slate-900/80 border border-slate-700 text-white text-xs font-semibold rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-amber-400" /> Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    placeholder="tu.correo@ejemplo.cl"
                    className="w-full bg-slate-900/80 border border-slate-700 text-white text-xs font-semibold rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Asegúrate de escribirlo correctamente para recibir tus entradas sin demora.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Teléfono / WhatsApp (Opcional)
                  </label>
                  <input
                    type="tel"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="+56 9 1234 5678"
                    className="w-full bg-slate-900/80 border border-slate-700 text-white text-xs font-semibold rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-500"
                  />
                </div>
              </div>
            </div>

            {/* Discount Code Box */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 space-y-3">
              <h3 className="text-xs font-extrabold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                ¿Tienes un código de descuento?
              </h3>

              <form onSubmit={handleApplyDiscount} className="flex gap-2">
                <input
                  type="text"
                  value={discountCodeInput}
                  onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                  placeholder="Ej: PREVENTA10"
                  className="flex-1 bg-slate-900/80 border border-slate-700 text-white text-xs font-mono font-bold rounded-xl px-3.5 py-2.5 uppercase outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  disabled={isValidatingCode || !discountCodeInput.trim()}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {isValidatingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
                </button>
              </form>

              {discountError && (
                <p className="text-xs text-red-400 font-semibold">{discountError}</p>
              )}

              {appliedDiscount && (
                <div className="bg-emerald-500/20 border border-emerald-500/40 p-3 rounded-xl flex items-center justify-between text-xs text-emerald-300 font-bold">
                  <span>✅ Código <strong>{appliedDiscount.code}</strong> aplicado ({appliedDiscount.type === 'percentage' ? `${appliedDiscount.value}%` : `$${appliedDiscount.value}`} de dto.)</span>
                  <button onClick={() => setAppliedDiscount(null)} className="text-red-400 hover:underline">Quitar</button>
                </div>
              )}
            </div>

            {/* Legal Notices & Terms Box */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 space-y-4 text-xs">
              <h3 className="text-xs font-extrabold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Términos de Compra & Tratamiento de Datos
              </h3>

              <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl space-y-2 text-[11px] text-slate-300 leading-relaxed">
                <p>
                  📜 <strong className="text-white">Formato Oficial de Entradas:</strong> Tras confirmar tu pago en Webpay, recibirás tus entradas en formato PDF nominativo adjunto con el nombre oficial: <code className="text-amber-300 font-mono font-bold bg-slate-800 px-1.5 py-0.5 rounded">&lt;Fila&gt;&lt;00000N&gt;FDVC2026-CL.pdf</code>.
                </p>
                <p>
                  🔄 <strong className="text-white">Política de Reenvío:</strong> Si pierdes o no recibes tu correo, puedes recuperar y descargar tus entradas en cualquier momento ingresando tu correo en la sección <strong className="text-indigo-300">Mis Entradas</strong> mediante un Enlace Mágico de acceso seguro (15 min TTL).
                </p>
                <p>
                  🔒 <strong className="text-white">Aviso de Privacidad:</strong> Tus datos personales (Nombre, Correo y Teléfono) son utilizados de manera estrictamente confidencial para la emisión, envío de PDFs y control de acceso al evento.
                </p>
              </div>

              {/* Mandatory Checkbox */}
              <label className="flex items-start gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer select-none transition-all">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-900 border-slate-700 cursor-pointer"
                />
                <span className="text-xs text-slate-200 font-medium">
                  He leído y acepto los <strong className="text-amber-300">Términos de compra</strong>, políticas de emisión de entradas nominativas y tratamiento de datos personales para este evento.
                </span>
              </label>
            </div>
          </div>

          {/* Right Column: Order Calculation Breakdown & Webpay Button */}
          <div className="md:col-span-1 space-y-4">
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 space-y-4">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Ticket className="w-4 h-4 text-amber-400" />
                Resumen del Pedido
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex flex-wrap gap-1 mb-2">
                  {seatIds.map((sid) => (
                    <span key={sid} className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-extrabold rounded-md">
                      {sid}
                    </span>
                  ))}
                </div>

                <div className="flex justify-between text-slate-300">
                  <span>Subtotal ({seatIds.length} butacas)</span>
                  <span>{formatCLP(subtotal)}</span>
                </div>

                {appliedDiscount && (
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Descuento ({appliedDiscount.code})</span>
                    <span>-{formatCLP(discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-300">
                  <span>Subtotal Neto</span>
                  <span>{formatCLP(netSubtotal)}</span>
                </div>

                <div className="flex justify-between text-slate-400">
                  <span>Cargo por Servicio (4%)</span>
                  <span>+{formatCLP(serviceCharge)}</span>
                </div>

                <div className="flex justify-between font-black text-white text-base border-t border-white/10 pt-3 mt-2">
                  <span>TOTAL A PAGAR</span>
                  <span className="text-amber-400">{formatCLP(finalTotal)}</span>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-500/20 border border-red-500/40 text-red-200 text-xs rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Webpay Payment CTA */}
              <button
                onClick={handleProceedToWebpay}
                disabled={!canPay}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 disabled:grayscale text-slate-950 font-black text-sm rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed"
              >
                {isReserving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Iniciando pago en Webpay...</span>
                  </>
                ) : isInitializingReservation ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verificando reserva...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Pagar con Webpay Plus ({formatCLP(finalTotal)})</span>
                  </>
                )}
              </button>

              {/* Helper text when button is disabled */}
              {!canPay && !isInitializingReservation && (
                <div className="text-[11px] text-amber-300/90 font-semibold text-center pt-1 leading-snug">
                  {salesClosed ? (
                    <span className="text-red-400 font-bold">🔒 La venta de entradas ha finalizado oficialmente para esta edición</span>
                  ) : !isTimeValid ? (
                    <span className="text-red-400">⚠️ Tiempo de reserva agotado</span>
                  ) : !isNameValid || !isEmailValid ? (
                    <span>📝 Completa tu nombre y correo para habilitar el pago</span>
                  ) : !acceptedTerms ? (
                    <span>☑️ Marca la casilla de aceptación de Términos para continuar</span>
                  ) : null}
                </div>
              )}
            </div>

            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Pago seguro procesado por Webpay Plus / Transbank</span>
              </div>
              <p>Reserva atómica garantizada por 15 minutos en el servidor.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <p className="text-xs font-bold text-slate-300">Cargando checkout...</p>
        </div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}

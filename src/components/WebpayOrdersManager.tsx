'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  ExternalLink, 
  UserCheck, 
  Mail, 
  Phone, 
  ShieldCheck, 
  FileText, 
  Check, 
  AlertCircle,
  Eye,
  ArrowUpDown,
  Filter
} from 'lucide-react';

interface OrderItem {
  id: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  seatIds: string[];
  subtotal: number;
  discountCode: string | null;
  discountAmount: number;
  netSubtotal: number;
  serviceCharge: number;
  totalAmount: number;
  status: 'paid' | 'reserved' | 'cancelled' | 'expired' | 'failed' | string;
  webpayToken: string | null;
  authorizationCode: string | null;
  responseCode: number | null;
  responseJson: string | null;
  paidAt: string | null;
  reservedUntil: string | null;
  createdAt: string;
}

interface WebpayLogItem {
  id: number;
  order_id: string | null;
  token_ws: string | null;
  event_type: string;
  amount: number | null;
  status_code: number | null;
  buyer_email: string | null;
  raw_data: string | null;
  error_message: string | null;
  ip_address: string | null;
  created_at: string;
}

interface WebpayOrdersManagerProps {
  onRefreshGlobalData?: () => void;
}

export default function WebpayOrdersManager({ onRefreshGlobalData }: WebpayOrdersManagerProps) {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [logs, setLogs] = useState<WebpayLogItem[]>([]);
  const [stats, setStats] = useState({
    totalPaidOrders: 0,
    totalPaidAmount: 0,
    totalPaidTickets: 0,
    totalFailedOrders: 0,
    totalPendingOrders: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeSubView, setActiveSubView] = useState<'orders' | 'logs'>('orders');

  // Modal State for Viewing JSON & Details
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

  // Modal State for Manual Confirmation
  const [confirmOrderModal, setConfirmOrderModal] = useState<OrderItem | null>(null);
  const [manualAuthCode, setManualAuthCode] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [isConfirmingManual, setIsConfirmingManual] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  const fetchOrdersData = async () => {
    setIsLoading(true);
    setActionErrorMsg(null);
    try {
      const res = await fetch('/api/admin/orders.php');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setOrders(json.orders || []);
        setLogs(json.logs || []);
        if (json.stats) setStats(json.stats);
      } else {
        throw new Error(json.error || 'Error al obtener datos');
      }
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setActionErrorMsg(err.message || 'Error al conectar con la base de datos de órdenes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdersData();
  }, []);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const matchesStatus = statusFilter === 'all' || ord.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesStatus;

      const inId = ord.id.toLowerCase().includes(q);
      const inName = (ord.buyerName || '').toLowerCase().includes(q);
      const inEmail = (ord.buyerEmail || '').toLowerCase().includes(q);
      const inPhone = (ord.buyerPhone || '').toLowerCase().includes(q);
      const inSeats = ord.seatIds.some((s) => s.toLowerCase().includes(q));
      const inAuth = (ord.authorizationCode || '').toLowerCase().includes(q);

      return matchesStatus && (inId || inName || inEmail || inPhone || inSeats || inAuth);
    });
  }, [orders, searchQuery, statusFilter]);

  // Handle Manual Confirmation Action
  const handleConfirmManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmOrderModal) return;

    setIsConfirmingManual(true);
    setActionErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/orders.php?action=manual_confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: confirmOrderModal.id,
          authCode: manualAuthCode.trim() || 'MANUAL-ADMIN',
          notes: manualNotes.trim() || 'Confirmado manualmente tras validación de comprobante bancario',
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al regularizar la orden.');
      }

      setActionSuccessMsg(`¡Orden ${confirmOrderModal.id} regularizada exitosamente! Butacas marcadas como vendidas.`);
      setConfirmOrderModal(null);
      setManualAuthCode('');
      setManualNotes('');
      fetchOrdersData();
      if (onRefreshGlobalData) onRefreshGlobalData();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Fallo al confirmar la orden.');
    } finally {
      setIsConfirmingManual(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 p-6 rounded-3xl border border-white/10 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider font-serif">
                Compras y Pagos Webpay Plus
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Auditoría en tiempo real de transacciones Transbank, órdenes pagadas y registro de errores.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={fetchOrdersData}
            disabled={isLoading}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-200 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-300 hover:text-white cursor-pointer font-black text-sm">×</button>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-4 bg-red-500/20 border border-red-500/40 rounded-2xl text-red-200 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{actionErrorMsg}</span>
          </div>
          <button onClick={() => setActionErrorMsg(null)} className="text-red-300 hover:text-white cursor-pointer font-black text-sm">×</button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-4 shadow-lg">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 block">Total Recaudado</span>
          <div className="text-2xl font-black text-white font-mono mt-1">
            ${stats.totalPaidAmount.toLocaleString('es-CL')}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Vía Transbank Webpay</span>
        </div>

        <div className="bg-slate-900/80 border border-indigo-500/30 rounded-2xl p-4 shadow-lg">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 block">Órdenes Pagadas</span>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {stats.totalPaidOrders} <span className="text-xs font-sans text-slate-400 font-normal">compras</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{stats.totalPaidTickets} butacas emitidas</span>
        </div>

        <div className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-4 shadow-lg">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 block">En Proceso / Pendientes</span>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {stats.totalPendingOrders} <span className="text-xs font-sans text-slate-400 font-normal">reservas</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Esperando confirmación</span>
        </div>

        <div className="bg-slate-900/80 border border-rose-500/30 rounded-2xl p-4 shadow-lg">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400 block">Rechazadas / Fallidas</span>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {stats.totalFailedOrders} <span className="text-xs font-sans text-slate-400 font-normal">intentos</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Liberadas automáticamente</span>
        </div>
      </div>

      {/* Tabs Switcher: Orders vs Webpay Error Logs */}
      <div className="flex border-b border-white/10 gap-2">
        <button
          onClick={() => setActiveSubView('orders')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubView === 'orders'
              ? 'border-amber-400 text-amber-300'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Órdenes de Compra ({filteredOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveSubView('logs')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubView === 'logs'
              ? 'border-amber-400 text-amber-300'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Log de Eventos y Errores Transbank ({logs.length})</span>
        </button>
      </div>

      {/* SUBVIEW 1: ORDERS TABLE */}
      {activeSubView === 'orders' && (
        <div className="space-y-4">
          
          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por comprador, correo, butaca (ej: D17), o ID de orden..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer w-full sm:w-auto"
              >
                <option value="all">Todos los estados</option>
                <option value="paid">✅ Pagadas (Aprobadas)</option>
                <option value="reserved">⏳ Reservadas (Pendientes)</option>
                <option value="failed">❌ Fallidas / Rechazadas</option>
                <option value="cancelled">🚫 Canceladas por usuario</option>
                <option value="expired">⏰ Expiradas (15 min)</option>
              </select>
            </div>
          </div>

          {/* Orders Table Card */}
          <div className="bg-slate-900/90 border border-white/10 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/40 text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/10">
                  <tr>
                    <th className="py-3.5 px-4">Orden / Fecha</th>
                    <th className="py-3.5 px-4">Comprador</th>
                    <th className="py-3.5 px-4">Butacas</th>
                    <th className="py-3.5 px-4">Total / Descuento</th>
                    <th className="py-3.5 px-4">Estado</th>
                    <th className="py-3.5 px-4">Webpay Auth</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        {isLoading ? 'Cargando órdenes...' : 'No se encontraron órdenes registradas con este filtro.'}
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((ord) => {
                      const isPaid = ord.status === 'paid';
                      const isPending = ord.status === 'reserved';
                      const isFailed = ord.status === 'failed';
                      const isCancelled = ord.status === 'cancelled';
                      const isExpired = ord.status === 'expired';

                      return (
                        <tr key={ord.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-amber-300 block">{ord.id}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{ord.createdAt}</span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-bold text-white block">{ord.buyerName}</span>
                            <a href={`mailto:${ord.buyerEmail}`} className="text-[11px] text-slate-400 hover:text-amber-300 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-500" />
                              <span>{ord.buyerEmail}</span>
                            </a>
                            {ord.buyerPhone && (
                              <a href={`https://wa.me/${ord.buyerPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 mt-0.5">
                                <Phone className="w-2.5 h-2.5" />
                                <span>{ord.buyerPhone}</span>
                              </a>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {ord.seatIds.map((s) => (
                                <span key={s} className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30 font-mono font-bold text-[10px]">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-white text-sm block">
                              ${ord.totalAmount.toLocaleString('es-CL')}
                            </span>
                            {ord.discountCode && ord.discountAmount > 0 && (
                              <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
                                Descuento: -${ord.discountAmount.toLocaleString('es-CL')} ({ord.discountCode})
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {isPaid && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold uppercase">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Pagado</span>
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold uppercase">
                                <Clock className="w-3 h-3" />
                                <span>Pendiente</span>
                              </span>
                            )}
                            {isFailed && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-extrabold uppercase">
                                <XCircle className="w-3 h-3" />
                                <span>Fallido</span>
                              </span>
                            )}
                            {isCancelled && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/40 text-[10px] font-extrabold uppercase">
                                <span>Cancelado</span>
                              </span>
                            )}
                            {isExpired && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40 text-[10px] font-extrabold uppercase">
                                <span>Expirado</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                            {ord.authorizationCode ? (
                              <span className="font-bold text-amber-300">#{ord.authorizationCode}</span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button
                              onClick={() => setSelectedOrder(ord)}
                              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer inline-flex items-center justify-center transition-colors"
                              title="Ver detalles de la orden"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {!isPaid && (
                              <button
                                onClick={() => {
                                  setConfirmOrderModal(ord);
                                  setManualAuthCode('');
                                  setManualNotes('');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer inline-flex items-center gap-1 transition-colors"
                                title="Aprobar pago manualmente si el cliente pagó en el banco"
                              >
                                <Check className="w-3 h-3" />
                                <span>Confirmar</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW 2: AUDIT LOGS TABLE */}
      {activeSubView === 'logs' && (
        <div className="bg-slate-900/90 border border-white/10 rounded-3xl overflow-hidden shadow-xl space-y-4 p-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="font-bold text-white text-sm">Historial de Eventos y Errores Transbank</h3>
              <p className="text-xs text-slate-400">Auditoría técnica de transacciones, retornos y excepciones.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black/40 text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/10">
                <tr>
                  <th className="py-3 px-3">Fecha</th>
                  <th className="py-3 px-3">Evento</th>
                  <th className="py-3 px-3">Orden</th>
                  <th className="py-3 px-3">Email Comprador</th>
                  <th className="py-3 px-3">Monto</th>
                  <th className="py-3 px-3">Detalle / Mensaje de Error</th>
                  <th className="py-3 px-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500 font-sans">
                      No hay registros de eventos aún.
                    </td>
                  </tr>
                ) : (
                  logs.map((lg) => {
                    const isOk = lg.event_type === 'APPROVED' || lg.event_type === 'MANUAL_REPAIR_SUCCESS' || lg.event_type === 'MANUAL_ADMIN_CONFIRM';
                    const isWarn = lg.event_type === 'USER_ABORTED' || lg.event_type === 'ALREADY_PAID';
                    const isErr = !isOk && !isWarn;

                    return (
                      <tr key={lg.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 text-slate-400">{lg.created_at}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isOk ? 'bg-emerald-500/20 text-emerald-300' : isWarn ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'
                          }`}>
                            {lg.event_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-amber-300">{lg.order_id || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-300">{lg.buyer_email || '—'}</td>
                        <td className="py-2.5 px-3 text-white">
                          {lg.amount ? `$${lg.amount.toLocaleString('es-CL')}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-sans max-w-sm truncate" title={lg.error_message || lg.raw_data || ''}>
                          {lg.error_message || lg.raw_data || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[10px]">{lg.ip_address || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: VIEW ORDER DETAILS */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-slate-900 border border-white/20 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-white text-base">Detalle de la Orden: {selectedOrder.id}</h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Comprador</span>
                <p className="font-extrabold text-white text-sm">{selectedOrder.buyerName}</p>
                <p className="text-slate-300">{selectedOrder.buyerEmail}</p>
                <p className="text-slate-400">{selectedOrder.buyerPhone || 'Sin teléfono'}</p>
              </div>

              <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Desglose de Pago</span>
                <p className="font-mono text-emerald-400 font-extrabold text-base">
                  Total: ${selectedOrder.totalAmount.toLocaleString('es-CL')}
                </p>
                <p className="text-slate-400">Subtotal: ${selectedOrder.subtotal.toLocaleString('es-CL')}</p>
                {selectedOrder.discountCode && (
                  <p className="text-emerald-300 font-bold">
                    Descuento: -${selectedOrder.discountAmount.toLocaleString('es-CL')} ({selectedOrder.discountCode})
                  </p>
                )}
                <p className="text-slate-400">Servicio (4%): ${selectedOrder.serviceCharge.toLocaleString('es-CL')}</p>
              </div>
            </div>

            <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-2 text-xs">
              <span className="text-slate-400 font-bold uppercase text-[10px] block">Butacas Asignadas</span>
              <div className="flex flex-wrap gap-2">
                {selectedOrder.seatIds.map((s) => (
                  <span key={s} className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-400/40 rounded-lg font-mono font-extrabold text-xs">
                    Asiento {s}
                  </span>
                ))}
              </div>
            </div>

            {selectedOrder.responseJson && (
              <div className="space-y-1.5">
                <span className="text-slate-400 font-bold uppercase text-[10px] block">Respuesta de Transbank Webpay (JSON)</span>
                <pre className="p-3 bg-black/60 rounded-xl border border-white/10 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(selectedOrder.responseJson), null, 2);
                    } catch {
                      return selectedOrder.responseJson;
                    }
                  })()}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMAR PAGO MANUAL */}
      {confirmOrderModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <form onSubmit={handleConfirmManualSubmit} className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-white text-base">Confirmar Pago Manualmente</h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOrderModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Utiliza esta opción si el cliente pagó mediante transferencia bancaria o si el banco procesó el cobro en su tarjeta pero la pasarela se interrumpió.
            </p>

            <div className="bg-black/40 p-3 rounded-xl border border-white/10 space-y-1 text-xs">
              <p><strong className="text-slate-400">Orden:</strong> <span className="font-mono text-amber-300">{confirmOrderModal.id}</span></p>
              <p><strong className="text-slate-400">Titular:</strong> <span className="text-white">{confirmOrderModal.buyerName}</span></p>
              <p><strong className="text-slate-400">Monto:</strong> <span className="font-mono text-emerald-400 font-bold">${confirmOrderModal.totalAmount.toLocaleString('es-CL')}</span></p>
              <p><strong className="text-slate-400">Butacas:</strong> <span className="font-mono text-amber-300">{confirmOrderModal.seatIds.join(', ')}</span></p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Código de Autorización / N° Transacción (Opcional):
                </label>
                <input
                  type="text"
                  value={manualAuthCode}
                  onChange={(e) => setManualAuthCode(e.target.value)}
                  placeholder="Ej: 7847 o N° Transferencia"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Notas de Auditoría:
                </label>
                <textarea
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Ej: Comprobante Banco de Chile verificado por administración..."
                  rows={2}
                  className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmOrderModal(null)}
                className="w-1/2 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isConfirmingManual}
                className="w-1/2 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isConfirmingManual ? 'Procesando...' : '✓ Confirmar y Emitir'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

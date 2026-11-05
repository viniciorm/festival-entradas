'use client';

import React from 'react';
import { Armchair, UserCheck, TicketCheck, Send, ArrowRight, Sparkles, TrendingUp, ShieldCheck, Mail, Percent, QrCode, Ticket, CreditCard } from 'lucide-react';
import { FestivalStats, AssignmentRecord, Seat } from '@/types/festival';

interface DashboardOverviewProps {
  stats: FestivalStats;
  assignments: AssignmentRecord[];
  seats: Seat[];
  onNavigateTab: (tab: string) => void;
}

export default function DashboardOverview({
  stats,
  assignments,
  seats,
  onNavigateTab,
}: DashboardOverviewProps) {
  const occupancyPct = stats.totalSeats > 0 ? Math.round(((stats.totalSeats - stats.availableSeats) / stats.totalSeats) * 100) : 0;
  const recentAssignments = assignments.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white p-6 sm:p-8 rounded-3xl border border-white/10 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-extrabold uppercase tracking-widest mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Panel Ejecutivo de Control
          </div>
          <h2 className="text-2xl sm:text-3xl font-black font-serif text-white">
            Festival Nacional Danza del Vientre 2026
          </h2>
          <p className="text-xs sm:text-sm text-indigo-200 mt-1">
            Resumen global del estado de inventario, asignaciones de participantes y control de acceso.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => onNavigateTab('orders')}
            className="flex-1 md:flex-initial px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            <span>Compras Webpay</span>
          </button>
          <button
            onClick={() => onNavigateTab('tickets')}
            className="flex-1 md:flex-initial px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Ticket className="w-4 h-4" />
            <span>Gestionar Butacas</span>
          </button>
          <button
            onClick={() => onNavigateTab('scanner')}
            className="flex-1 md:flex-initial px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-2xl border border-white/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-amber-400" />
            <span>Escáner QR</span>
          </button>
        </div>
      </div>

      {/* Main KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Seats */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Butacas</span>
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Armchair className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{stats.totalSeats}</span>
            <span className="text-xs text-slate-400 font-semibold">Aula Magna</span>
          </div>
          <p className="text-[11px] text-slate-500">16 filas (A–P) x 34 asientos</p>
        </div>

        {/* Assigned Seats */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Asignadas</span>
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-600">{stats.assignedSeats}</span>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{occupancyPct}% ocupación</span>
          </div>
          <p className="text-[11px] text-slate-500">Participantes y cortesías</p>
        </div>

        {/* Available Seats */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Disponibles</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <TicketCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">{stats.availableSeats}</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{100 - occupancyPct}% libres</span>
          </div>
          <p className="text-[11px] text-slate-500">Para venta y asignación</p>
        </div>

        {/* Sent Assignments */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Asignaciones Enviadas</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">{stats.sentToday}</span>
            <span className="text-xs text-slate-400 font-semibold">lotes</span>
          </div>
          <p className="text-[11px] text-slate-500">Con código QR y PDF oficial</p>
        </div>
      </div>

      {/* Quick Access Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Invitaciones */}
        <div
          onClick={() => onNavigateTab('invitations')}
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Mail className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 group-hover:text-purple-700 transition-colors">
              Pases de Invitación
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Emite cortesías para jurados, invitados VIP y prensa con control de canje.
            </p>
          </div>
          <span className="text-xs font-bold text-purple-700 inline-flex items-center gap-1">
            Administrar Invitaciones →
          </span>
        </div>

        {/* Card 2: Descuentos */}
        <div
          onClick={() => onNavigateTab('discounts')}
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Percent className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 group-hover:text-amber-700 transition-colors">
              Códigos de Descuento
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Crea promociones porcentuales o fijas con límite de uso y trazabilidad.
            </p>
          </div>
          <span className="text-xs font-bold text-amber-700 inline-flex items-center gap-1">
            Administrar Cupones →
          </span>
        </div>

        {/* Card 3: Participantes */}
        <div
          onClick={() => onNavigateTab('participants')}
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Armchair className="w-6 h-6" />
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 group-hover:text-indigo-700 transition-colors">
              Grupos y Participantes
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Consulta las 218 butacas asignadas por elenco y reenvía correos con PDFs.
            </p>
          </div>
          <span className="text-xs font-bold text-indigo-700 inline-flex items-center gap-1">
            Ver Participantes →
          </span>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Últimas Asignaciones Realizadas
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Historial reciente de lotes y emisiones con respaldo en MySQL</p>
          </div>
          <button
            onClick={() => onNavigateTab('tickets')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
          >
            Ver todas
          </button>
        </div>

        {recentAssignments.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6">No hay registros recientes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-extrabold">
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Participante</th>
                  <th className="py-2.5 px-3">Correo Destino</th>
                  <th className="py-2.5 px-3 text-center">Butacas</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {recentAssignments.map((asgn) => (
                  <tr key={asgn.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 text-slate-500 font-mono">{asgn.date}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{asgn.participantName}</td>
                    <td className="py-3 px-3 text-slate-600 truncate max-w-[200px]">{asgn.sentToEmail}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2.5 py-1 bg-purple-50 text-purple-700 font-black rounded-lg text-[11px]">
                        {asgn.seatIds ? asgn.seatIds.length : 0}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-full text-[10px]">
                        ✓ {asgn.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Percent, Plus, Tag, Calendar, Hash, CheckCircle2, PauseCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';

export interface DiscountCode {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  startDate?: string;
  endDate?: string;
  totalLimit: number;
  usedCount: number;
  maxPerPurchase: number;
  status: 'active' | 'paused' | 'expired' | 'exhausted';
  createdAt: string;
}

interface DiscountsManagerProps {
  discounts: DiscountCode[];
  onRefresh: () => void;
}

export default function DiscountsManager({ discounts, onRefresh }: DiscountsManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState<number>(10);
  const [totalLimit, setTotalLimit] = useState<number>(50);
  const [maxPerPurchase, setMaxPerPurchase] = useState<number>(4);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || value <= 0) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/discounts.php?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          type,
          value,
          totalLimit,
          maxPerPurchase,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al crear código de descuento');
      }
      setIsModalOpen(false);
      setCode('');
      setValue(10);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear código');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">Códigos de Descuento</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Administra promociones, cupones de preventa y descuentos para la ticketera pública.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs py-3 px-5 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nuevo Código</span>
        </button>
      </div>

      {/* Discounts Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Tipo & Valor</th>
                <th className="py-3 px-4">Usos Realizados</th>
                <th className="py-3 px-4">Máx / Compra</th>
                <th className="py-3 px-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {discounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                    No hay códigos de descuento registrados. Crea uno con el botón "+ Nuevo Código".
                  </td>
                </tr>
              ) : (
                (discounts || []).map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900">
                      <span className="px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-900 rounded-lg">
                        {d.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      {d.type === 'percentage' ? `${d.value}% de descuento` : `$${d.value.toLocaleString('es-CL')} dto. fijo`}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">
                      <span className="font-bold text-slate-900">{d.usedCount}</span> / {d.totalLimit > 0 ? d.totalLimit : 'Sin límite'}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">
                      Hasta {d.maxPerPurchase} entradas
                    </td>
                    <td className="py-3.5 px-4">
                      {d.status === 'active' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Activo
                        </span>
                      )}
                      {d.status === 'paused' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px] rounded-full">
                          <PauseCircle className="w-3 h-3" /> Pausado
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateDiscount} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-purple-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">Crear Código de Descuento</h3>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Código Promocional (ej. PREVENTA10)</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PREVENTA10"
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-mono font-bold rounded-xl px-3 py-2.5 outline-none uppercase focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Descuento</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2.5 outline-none"
                >
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="fixed">Monto Fijo ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Valor ({type === 'percentage' ? '%' : '$'})</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={value}
                  onChange={(e) => setValue(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2.5 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Límite Total Usos</label>
                <input
                  type="number"
                  min={0}
                  value={totalLimit}
                  onChange={(e) => setTotalLimit(parseInt(e.target.value) || 0)}
                  placeholder="0 = Sin límite"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2.5 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Máx entradas/compra</label>
                <input
                  type="number"
                  min={1}
                  value={maxPerPurchase}
                  onChange={(e) => setMaxPerPurchase(parseInt(e.target.value) || 4)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2.5 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !code.trim()}
                className="w-1/2 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear Código'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Users, Plus, Mail, Phone, UserCheck, Trash2, Upload, FileText, CheckCircle2, Sparkles } from 'lucide-react';
import { Participant } from '@/types/festival';

interface ParticipantsManagerProps {
  participants: Participant[];
  onAddParticipant: (participant: Omit<Participant, 'id' | 'assignedSeatsCount'>) => void;
  onDeleteParticipant?: (id: string) => void;
  onBulkAddParticipants?: (participantsList: Omit<Participant, 'id' | 'assignedSeatsCount'>[]) => void;
}

export default function ParticipantsManager({
  participants,
  onAddParticipant,
  onDeleteParticipant,
  onBulkAddParticipants,
}: ParticipantsManagerProps) {
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Single participant state
  const [name, setName] = useState('');
  const [type, setType] = useState<'grupo' | 'solista'>('grupo');
  const [dancersCount, setDancersCount] = useState(1);
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Bulk import state
  const [bulkText, setBulkText] = useState('');
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    onAddParticipant({
      name,
      type,
      dancersCount,
      contactPerson: contactPerson || name,
      email: email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@festival.cl`,
      phone: phone || '+56 9 0000 0000',
    });

    // Reset form
    setName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setDancersCount(1);
    setShowModal(false);
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) return;

    // Parse pasted lines (e.g. from Excel column copy-paste)
    const lines = bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const newParticipants = lines.map((lineName) => ({
      name: lineName,
      type: 'grupo' as const,
      dancersCount: 1,
      contactPerson: lineName,
      email: `${lineName.toLowerCase().replace(/[^a-z0-9]/g, '')}@festival.cl`,
      phone: '+56 9 0000 0000',
    }));

    if (onBulkAddParticipants) {
      onBulkAddParticipants(newParticipants);
    } else {
      newParticipants.forEach((p) => onAddParticipant(p));
    }

    setImportedCount(newParticipants.length);
    setTimeout(() => {
      setBulkText('');
      setImportedCount(null);
      setShowBulkModal(false);
    }, 1500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setBulkText(text);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" /> Gestión de Participantes ({participants.length})
          </h2>
          <p className="text-xs text-slate-500">
            Administra la lista de grupos, escuelas y solistas del Festival Nacional Danza del Vientre Chile 2026
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs py-2.5 px-4 rounded-xl border border-purple-200 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 text-purple-600" /> Carga Masiva (Excel / Lista)
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Agregar Uno a Uno
          </button>
        </div>
      </div>

      {/* Grid of Participants Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {participants.map((p) => (
          <div
            key={p.id}
            className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span
                    className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      p.type === 'grupo'
                        ? 'bg-purple-100 text-purple-700 border border-purple-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {p.type} • {p.dancersCount} {p.dancersCount === 1 ? 'bailarina' : 'bailarinas'}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 mt-1">{p.name}</h3>
                </div>

                {onDeleteParticipant && (
                  <button
                    onClick={() => onDeleteParticipant(p.id)}
                    className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 my-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Representante: {p.contactPerson}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono text-[11px]">{p.email}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Entradas asignadas:</span>
              <span className="font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                {p.assignedSeatsCount} entradas
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Add Single Participant */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900">Agregar Grupo o Solista</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre de la Escuela, Grupo o Solista *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. Compañía Al Zahra"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoría</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'grupo' | 'solista')}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 outline-none"
                  >
                    <option value="grupo">Grupo / Compañía</option>
                    <option value="solista">Solista</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">N° Bailarinas</label>
                  <input
                    type="number"
                    min={1}
                    value={dancersCount}
                    onChange={(e) => setDancersCount(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico (Opcional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contacto@escuela.cl"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm cursor-pointer"
                >
                  Guardar Participante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Bulk Import */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" /> Carga Masiva desde Excel / Planilla
              </h3>
              <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">
                ✕
              </button>
            </div>

            {importedCount !== null ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-6 rounded-2xl text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="font-extrabold text-lg">¡{importedCount} Participantes Cargas Exitosamente!</h4>
                <p className="text-xs text-emerald-700 font-medium">Se han agregado a tu lista de asignaciones.</p>
              </div>
            ) : (
              <form onSubmit={handleBulkSubmit} className="space-y-4">
                <p className="text-xs text-slate-600">
                  Copia la columna con los nombres de los grupos/solistas desde tu Excel o Google Sheets y pégala a continuación (un participante por línea):
                </p>

                <textarea
                  rows={8}
                  required
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`Ejemplo:\nCompañía Al Zahra\nAcademia Bellydance Santiago\nSolista Amira Said\nEscuela Danza del Sol`}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-mono font-semibold rounded-xl p-3.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                />

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <label className="cursor-pointer hover:text-indigo-600 flex items-center gap-1 font-bold">
                    <Upload className="w-4 h-4" />
                    <span>O subir archivo .CSV / .TXT</span>
                    <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                  </label>
                  <span>{bulkText.split('\n').filter((l) => l.trim()).length} elemento(s) detectado(s)</span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md cursor-pointer"
                  >
                    Importar Todo
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Users, Plus, Mail, Phone, UserCheck, Trash2, Edit2, Sparkles, CheckCircle } from 'lucide-react';
import { Participant } from '@/types/festival';

interface ParticipantsManagerProps {
  participants: Participant[];
  onAddParticipant: (participant: Omit<Participant, 'id' | 'assignedSeatsCount'>) => void;
  onDeleteParticipant?: (id: string) => void;
}

export default function ParticipantsManager({
  participants,
  onAddParticipant,
  onDeleteParticipant,
}: ParticipantsManagerProps) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'grupo' | 'solista'>('grupo');
  const [dancersCount, setDancersCount] = useState(1);
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    onAddParticipant({
      name,
      type,
      dancersCount,
      contactPerson: contactPerson || name,
      email,
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

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" /> Gestión de Participantes
          </h2>
          <p className="text-xs text-slate-500">
            Administra la lista de grupos y solistas inscritos en el Festival Nacional Danza del Vientre Chile 2026
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Registrar Participante
        </button>
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
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{p.phone}</span>
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

      {/* Modal Add Participant */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <h3 className="text-lg font-extrabold text-slate-900 mb-4">Agregar Nuevo Participante</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre de la Academia o Solista *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. Compañía Al Zahra"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoría</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'grupo' | 'solista')}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2"
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
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Persona de Contacto</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="ej. Amira Said"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contacto@alzahra.cl"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+56 9 8765 4321"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2"
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
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm"
                >
                  Guardar Participante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

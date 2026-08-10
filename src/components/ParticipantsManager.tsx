'use client';

import React, { useState } from 'react';
import {
  Users,
  Plus,
  Mail,
  Phone,
  UserCheck,
  Trash2,
  Upload,
  FileText,
  CheckCircle2,
  Video,
  GraduationCap,
  Sparkles,
  ExternalLink,
  Globe,
} from 'lucide-react';
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
  const [school, setSchool] = useState('');
  const [teacher, setTeacher] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [tiktok, setTiktok] = useState('');

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
      school,
      teacher,
      contactPerson: contactPerson || teacher || name,
      email: email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@festival.cl`,
      phone: phone || '+56900000000',
      instagram,
      facebook,
      tiktok,
    });

    // Reset form
    setName('');
    setSchool('');
    setTeacher('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setInstagram('');
    setFacebook('');
    setTiktok('');
    setDancersCount(1);
    setShowModal(false);
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) return;

    // Parse pasted lines
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
      phone: '+56900000000',
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

  // Helper to render Instagram handles into clickable links
  const renderInstagramLinks = (str?: string) => {
    if (!str) return null;
    const items = str.split(',').map((s) => s.trim()).filter(Boolean);
    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        {items.map((item, idx) => {
          const isUrl = item.startsWith('http');
          const cleanHandle = item.replace(/^@/, '');
          const url = isUrl ? item : `https://instagram.com/${cleanHandle}`;
          const displayLabel = item.startsWith('@') || isUrl ? item : `@${item}`;
          return (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-600 hover:text-pink-700 bg-pink-50 hover:bg-pink-100 px-2 py-0.5 rounded-lg border border-pink-200/80 transition-colors"
            >
              <svg className="w-3 h-3 text-pink-500 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              <span>{displayLabel}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" /> Gestión de Presentaciones y Participantes ({participants.length})
          </h2>
          <p className="text-xs text-slate-500">
            Listado oficial de las 26 presentaciones independientes del Festival Nacional Danza del Vientre Chile 2026
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
            <Plus className="w-4 h-4" /> Agregar Presentación
          </button>
        </div>
      </div>

      {/* Grid of Participants Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {participants.map((p) => (
          <div
            key={p.id}
            className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 transition-all flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        p.type === 'grupo'
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {p.type}
                    </span>
                    {p.school && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                        <GraduationCap className="w-3 h-3 text-indigo-500" /> {p.school}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 mt-1.5 leading-snug">{p.name}</h3>
                </div>

                {onDeleteParticipant && (
                  <button
                    onClick={() => onDeleteParticipant(p.id)}
                    className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                    title="Eliminar presentación"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-2 text-xs text-slate-600 my-3">
                {p.teacher && (
                  <div className="flex items-center gap-2 font-medium">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>Profesora: <strong className="text-slate-800">{p.teacher}</strong></span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <a href={`mailto:${p.email}`} className="font-mono text-[11px] text-indigo-600 hover:underline">
                    {p.email}
                  </a>
                </div>

                {p.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono text-[11px] text-slate-700">{p.phone}</span>
                  </div>
                )}

                {/* Social Networks Links */}
                {p.instagram && (
                  <div className="pt-1.5">{renderInstagramLinks(p.instagram)}</div>
                )}

                {p.facebook && (
                  <div className="flex items-center gap-1.5 text-[11px] text-blue-700 font-semibold">
                    <Globe className="w-3 h-3 text-blue-600 shrink-0" />
                    <span className="truncate">{p.facebook}</span>
                  </div>
                )}

                {p.tiktok && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-800 font-semibold">
                    <Video className="w-3 h-3 text-slate-600 shrink-0" />
                    <span className="truncate">{p.tiktok}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
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
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-extrabold text-slate-900">Agregar Presentación</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Escuela / Academia</label>
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="ej. Reflejos de Oriente"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre de la Presentación / Participante *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. Grupo Shazaditas Teens"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tipo</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'grupo' | 'solista')}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 outline-none"
                  >
                    <option value="grupo">Grupal</option>
                    <option value="solista">Solista</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Profesora</label>
                  <input
                    type="text"
                    value={teacher}
                    onChange={(e) => setTeacher(e.target.value)}
                    placeholder="Nombre profesora"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contacto@ejemplo.com"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+56912345678"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Instagram (@usuario)</label>
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@miusuario"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
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
                  Guardar Presentación
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
                <h4 className="font-extrabold text-lg">¡{importedCount} Presentaciones Cargadas Exitosamente!</h4>
                <p className="text-xs text-emerald-700 font-medium">Se han agregado a tu lista de asignaciones.</p>
              </div>
            ) : (
              <form onSubmit={handleBulkSubmit} className="space-y-4">
                <p className="text-xs text-slate-600">
                  Copia las líneas desde tu Excel o Google Sheets y pégala a continuación (una presentación por línea):
                </p>

                <textarea
                  rows={8}
                  required
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`Ejemplo:\nGrupo Shazaditas Teens\nAdriana Campos\nGrupo Malikas`}
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

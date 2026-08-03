'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import StatsCards from '@/components/StatsCards';
import SeatMap from '@/components/SeatMap';
import AssignmentPanel from '@/components/AssignmentPanel';
import RecentAssignmentsTable from '@/components/RecentAssignmentsTable';
import ParticipantsManager from '@/components/ParticipantsManager';
import GateScanner from '@/components/GateScanner';
import SettingsView from '@/components/SettingsView';

import { Seat, Participant, AssignmentRecord, FestivalStats } from '@/types/festival';
import {
  generateInitialSeats,
  INITIAL_PARTICIPANTS,
  INITIAL_ASSIGNMENTS,
  generateTicketCode,
} from '@/utils/theater';
import { generateTicketPDF } from '@/utils/pdfGenerator';
import { verifyTicketQRPayload } from '@/utils/security';
import { ShieldCheck, CheckCircle2, AlertTriangle, Ticket, Home as HomeIcon, Users, QrCode, Settings } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>('tickets');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Phone Camera QR Scan Modal Result
  const [urlScanResult, setUrlScanResult] = useState<{
    isValid: boolean;
    seatId?: string;
    row?: string;
    number?: number;
    hash?: string;
    message: string;
  } | null>(null);

  // Initialize data from LocalStorage or default mocks & handle ?verify= URL parameter
  useEffect(() => {
    const savedSeats = localStorage.getItem('fdvc_seats_2026');
    const savedParticipants = localStorage.getItem('fdvc_participants_2026');
    const savedAssignments = localStorage.getItem('fdvc_assignments_2026');

    if (savedSeats) {
      setSeats(JSON.parse(savedSeats));
    } else {
      const initialSeats = generateInitialSeats();
      setSeats(initialSeats);
      localStorage.setItem('fdvc_seats_2026', JSON.stringify(initialSeats));
    }

    if (savedParticipants) {
      setParticipants(JSON.parse(savedParticipants));
    } else {
      setParticipants(INITIAL_PARTICIPANTS);
      localStorage.setItem('fdvc_participants_2026', JSON.stringify(INITIAL_PARTICIPANTS));
    }

    if (savedAssignments) {
      setAssignments(JSON.parse(savedAssignments));
    } else {
      setAssignments(INITIAL_ASSIGNMENTS);
      localStorage.setItem('fdvc_assignments_2026', JSON.stringify(INITIAL_ASSIGNMENTS));
    }

    // Check for ?verify= or ?v= in URL from mobile phone camera scan
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const verifyToken = urlParams.get('verify') || urlParams.get('v');

      if (verifyToken) {
        verifyTicketQRPayload(verifyToken).then((res) => {
          if (res.isValid && res.data) {
            setUrlScanResult({
              isValid: true,
              seatId: res.data.seatId,
              row: res.data.row,
              number: res.data.seatNumber,
              hash: res.data.hash,
              message: `✅ ENTRADA OFICIAL Y AUTÉNTICA — Fila ${res.data.row} Asiento ${res.data.seatNumber}`,
            });
          } else {
            setUrlScanResult({
              isValid: false,
              message: res.reason || '⚠️ ALERTA DE SEGURIDAD: Código QR no válido o alterado.',
            });
          }
        });
      }
    }
  }, []);

  // Save to LocalStorage whenever state changes
  const saveSeatsState = (newSeats: Seat[]) => {
    setSeats(newSeats);
    localStorage.setItem('fdvc_seats_2026', JSON.stringify(newSeats));
  };

  const saveParticipantsState = (newParticipants: Participant[]) => {
    setParticipants(newParticipants);
    localStorage.setItem('fdvc_participants_2026', JSON.stringify(newParticipants));
  };

  const saveAssignmentsState = (newAssignments: AssignmentRecord[]) => {
    setAssignments(newAssignments);
    localStorage.setItem('fdvc_assignments_2026', JSON.stringify(newAssignments));
  };

  // Calculate live stats
  const stats: FestivalStats = React.useMemo(() => {
    const totalSeats = seats.length || 544;
    const assignedSeats = seats.filter((s) => s.status !== 'available').length;
    const availableSeats = totalSeats - assignedSeats;
    const sentToday = assignments.filter((a) => a.status === 'Enviado').length;
    const checkedInCount = seats.filter((s) => s.status === 'checked_in').length;

    return { totalSeats, assignedSeats, availableSeats, sentToday, checkedInCount };
  }, [seats, assignments]);

  // Toggle seat selection
  const handleToggleSeat = (seatId: string) => {
    setSelectedSeatIds((prev) =>
      prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId]
    );
  };

  const handleClearSelection = () => {
    setSelectedSeatIds([]);
  };

  // Handle Seat Assignment and Email Dispatch
  const handleAssignAndSend = async (participantId: string, email: string, mode: 'send' | 'save') => {
    if (selectedSeatIds.length === 0) return;
    setIsProcessing(true);

    try {
      const participant = participants.find((p) => p.id === participantId);
      const participantName = participant ? participant.name : 'Participante';

      // Prepare updated seat state
      const updatedSeats = seats.map((seat) => {
        if (selectedSeatIds.includes(seat.id)) {
          const tCode = generateTicketCode(seat.row, seat.number);
          return {
            ...seat,
            status: (mode === 'send' ? 'sent' : 'assigned') as Seat['status'],
            assignedParticipantId: participantId,
            assignedParticipantName: participantName,
            assignedAt: new Date().toISOString(),
            ticketCode: tCode,
            sentAt: mode === 'send' ? new Date().toISOString() : undefined,
          };
        }
        return seat;
      });

      // If mode === 'send', generate base64 PDFs and call API route
      if (mode === 'send') {
        const selectedSeatObjects = updatedSeats.filter((s) => selectedSeatIds.includes(s.id));
        const ticketPayloads = [];

        for (const seat of selectedSeatObjects) {
          const { pdfBlob, filename } = await generateTicketPDF(seat, participant);
          const arrayBuffer = await pdfBlob.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          ticketPayloads.push({
            row: seat.row,
            number: seat.number,
            filename: filename,
            ticketCode: seat.ticketCode,
            pdfBase64: `data:application/pdf;base64,${base64}`,
          });
        }

        const res = await fetch('/api/send-tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: email,
            participantName: participantName,
            seatTickets: ticketPayloads,
            sentBy: 'María Román',
          }),
        });

        const data = await res.json();
        if (data.success) {
          setToastMessage(`🚀 Correos con PDF adjuntos enviados a ${email}`);
        }
      } else {
        setToastMessage(`💾 ${selectedSeatIds.length} butacas guardadas sin enviar`);
      }

      // Update seats & participant ticket count
      saveSeatsState(updatedSeats);

      const updatedParticipants = participants.map((p) => {
        if (p.id === participantId) {
          return { ...p, assignedSeatsCount: p.assignedSeatsCount + selectedSeatIds.length };
        }
        return p;
      });
      saveParticipantsState(updatedParticipants);

      // Create Assignment record
      const newRecord: AssignmentRecord = {
        id: `asgn-${Date.now()}`,
        date: new Date().toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }),
        participantId: participantId,
        participantName: participantName,
        seatIds: [...selectedSeatIds],
        sentToEmail: email,
        sentBy: 'María Román',
        status: mode === 'send' ? 'Enviado' : 'Asignado',
      };
      saveAssignmentsState([newRecord, ...assignments]);

      setSelectedSeatIds([]);
    } catch (err) {
      console.error('Error durante la asignación:', err);
      setToastMessage('❌ Ocurrió un error al procesar la asignación');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Add new participant
  const handleAddParticipant = (newP: Omit<Participant, 'id' | 'assignedSeatsCount'>) => {
    const created: Participant = {
      ...newP,
      id: `part-${Date.now()}`,
      assignedSeatsCount: 0,
    };
    const updated = [created, ...participants];
    saveParticipantsState(updated);
    setToastMessage(`✅ Participante "${created.name}" registrado con éxito`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Check-In Gate Scanner action
  const handleCheckInSeat = (seatId: string): boolean => {
    const seat = seats.find((s) => s.id === seatId);
    if (!seat || seat.status === 'checked_in') return false;

    const updated = seats.map((s) => {
      if (s.id === seatId) {
        return {
          ...s,
          status: 'checked_in' as Seat['status'],
          checkedInAt: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        };
      }
      return s;
    });

    saveSeatsState(updated);
    return true;
  };

  const selectedSeatObjects = seats.filter((s) => selectedSeatIds.includes(s.id));

  const mobileNavItems = [
    { id: 'tickets', label: 'Entradas', icon: Ticket },
    { id: 'dashboard', label: 'Resumen', icon: HomeIcon },
    { id: 'participants', label: 'Participantes', icon: Users },
    { id: 'scanner', label: 'Acceso QR', icon: QrCode },
  ];

  return (
    <div className="flex bg-slate-100 min-h-screen text-slate-900 font-sans antialiased pb-16 lg:pb-0">
      {/* Sidebar (Responsive Desktop & Mobile Drawer) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onToggleMobileMenu={() => setIsMobileMenuOpen(true)} />

        <main className="p-3.5 sm:p-8 flex-1 overflow-y-auto">
          {/* Mobile Camera Scan Verification Modal Banner */}
          {urlScanResult && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in">
                <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${urlScanResult.isValid ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                  {urlScanResult.isValid ? <CheckCircle2 className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
                </div>

                <div>
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-1">
                    FESTIVAL DANZA DEL VIENTRE CHILE 2026
                  </span>
                  <h3 className="text-xl font-black text-slate-900">
                    {urlScanResult.isValid ? '✅ Entrada Auténtica Verificada' : '🚨 Alerta de Seguridad'}
                  </h3>
                  <p className="text-sm font-semibold text-slate-600 mt-2">
                    {urlScanResult.message}
                  </p>
                </div>

                {urlScanResult.isValid && (
                  <div className="bg-purple-950 text-white rounded-2xl p-4 text-left border border-amber-400/40 space-y-2">
                    <div className="flex items-center justify-between text-xs text-amber-400 font-extrabold">
                      <span>VERIFICACIÓN CRIPTOGRÁFICA</span>
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-lg font-black text-white">
                      FILA {urlScanResult.row} — ASIENTO {urlScanResult.number}
                    </div>
                    <div className="text-xs text-slate-300 font-mono">
                      HASH: <span className="text-amber-300 font-bold">{urlScanResult.hash}</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setUrlScanResult(null)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl cursor-pointer"
                >
                  Cerrar Verificación
                </button>
              </div>
            </div>
          )}

          {/* Notification Toast */}
          {toastMessage && (
            <div className="mb-4 sm:mb-6 p-3.5 sm:p-4 bg-indigo-900 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-between border border-amber-400/40 animate-bounce">
              <span>{toastMessage}</span>
              <button onClick={() => setToastMessage(null)} className="text-amber-400 font-extrabold ml-4">
                ✕
              </button>
            </div>
          )}

          {/* Stats Bar */}
          <StatsCards stats={stats} />

          {/* Tab Views */}
          {activeTab === 'tickets' || activeTab === 'dashboard' ? (
            <div>
              {/* Map + Assignment Panel 2-Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
                <div className="lg:col-span-2">
                  <SeatMap
                    seats={seats}
                    selectedSeatIds={selectedSeatIds}
                    onToggleSeat={handleToggleSeat}
                    onClearSelection={handleClearSelection}
                  />
                </div>
                <div className="lg:col-span-1">
                  <AssignmentPanel
                    selectedSeats={selectedSeatObjects}
                    participants={participants}
                    onAssignAndSend={handleAssignAndSend}
                    isProcessing={isProcessing}
                  />
                </div>
              </div>

              {/* Recent Assignments Table */}
              <RecentAssignmentsTable assignments={assignments} />
            </div>
          ) : activeTab === 'participants' ? (
            <ParticipantsManager participants={participants} onAddParticipant={handleAddParticipant} />
          ) : activeTab === 'scanner' ? (
            <GateScanner seats={seats} onCheckInSeat={handleCheckInSeat} />
          ) : activeTab === 'settings' ? (
            <SettingsView />
          ) : null}
        </main>
      </div>

      {/* Mobile Bottom Quick Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#1A1333] border-t border-purple-800/40 flex items-center justify-around py-2 px-1 shadow-2xl">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                isActive ? 'text-amber-400 font-black' : 'text-purple-300/70 hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-amber-400 scale-110' : 'text-purple-300/70'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

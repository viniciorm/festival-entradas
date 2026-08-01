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

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>('tickets');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialize data from LocalStorage or default mocks
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

  return (
    <div className="flex bg-slate-100 min-h-screen text-slate-900 font-sans antialiased">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="p-8 flex-1 overflow-y-auto">
          {/* Notification Toast */}
          {toastMessage && (
            <div className="mb-6 p-4 bg-indigo-900 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-between border border-amber-400/40 animate-bounce">
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
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
    </div>
  );
}

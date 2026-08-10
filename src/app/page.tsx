'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import StatsCards from '@/components/StatsCards';
import SeatMap from '@/components/SeatMap';
import AssignmentPanel from '@/components/AssignmentPanel';
import RecentAssignmentsTable from '@/components/RecentAssignmentsTable';
import ParticipantsManager from '@/components/ParticipantsManager';
import GateScanner, { ScanLogItem } from '@/components/GateScanner';
import SettingsView from '@/components/SettingsView';
import LoginModal from '@/components/LoginModal';
import { useAuth } from '@/context/AuthContext';

import { Seat, Participant, AssignmentRecord, FestivalStats } from '@/types/festival';
import {
  generateInitialSeats,
  INITIAL_PARTICIPANTS,
  INITIAL_ASSIGNMENTS,
  generateTicketCode,
} from '@/utils/theater';
import { generateTicketPDF, downloadPDFBlob } from '@/utils/pdfGenerator';
import { verifyTicketQRPayload } from '@/utils/security';
import { ShieldCheck, CheckCircle2, AlertTriangle, Ticket, Home as HomeIcon, Users, QrCode } from 'lucide-react';

export default function Home() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('tickets');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [scanLogs, setScanLogs] = useState<ScanLogItem[]>([]);
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

  // Central Server Data Fetch & Real-Time Sync
  const fetchCentralData = useCallback(async () => {
    try {
      const res = await fetch('/api/sync-data.php');
      if (res.ok) {
        const json = await res.json();
        if (json.seats && Array.isArray(json.seats) && json.seats.length > 0) {
          setSeats(json.seats);
          localStorage.setItem('fdvc_seats_2026', JSON.stringify(json.seats));
        }
        if (json.participants && Array.isArray(json.participants) && json.participants.length > 0) {
          setParticipants(json.participants);
          localStorage.setItem('fdvc_participants_2026', JSON.stringify(json.participants));
        }
        if (json.assignments && Array.isArray(json.assignments)) {
          setAssignments(json.assignments);
          localStorage.setItem('fdvc_assignments_2026', JSON.stringify(json.assignments));
        }
        if (json.scanLogs && Array.isArray(json.scanLogs)) {
          setScanLogs(json.scanLogs);
        }
      }
    } catch (e) {
      console.warn('Central server sync notice:', e);
    }
  }, []);

  // Post Data Updates to Central Server (Atomic Batch Update)
  const postCentralDataUpdate = async (updatePayload: {
    seats?: Seat[];
    participants?: Participant[];
    assignments?: AssignmentRecord[];
    scanLogs?: ScanLogItem[];
    newScanLog?: ScanLogItem;
  }) => {
    try {
      await fetch('/api/sync-data.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });
    } catch (e) {
      console.warn('Error pushing data to central server:', e);
    }
  };

  // Initialize data on mount and set up real-time polling every 2 seconds
  useEffect(() => {
    fetchCentralData();
    const interval = setInterval(fetchCentralData, 2000);

    // Check for ?verify= URL parameter
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

    return () => clearInterval(interval);
  }, [fetchCentralData]);

  // Save state helpers with optional instant server push
  const saveSeatsState = (newSeats: Seat[], skipPush = false) => {
    setSeats(newSeats);
    localStorage.setItem('fdvc_seats_2026', JSON.stringify(newSeats));
    if (!skipPush) postCentralDataUpdate({ seats: newSeats });
  };

  const saveParticipantsState = (newParticipants: Participant[], skipPush = false) => {
    setParticipants(newParticipants);
    localStorage.setItem('fdvc_participants_2026', JSON.stringify(newParticipants));
    if (!skipPush) postCentralDataUpdate({ participants: newParticipants });
  };

  const saveAssignmentsState = (newAssignments: AssignmentRecord[], skipPush = false) => {
    setAssignments(newAssignments);
    localStorage.setItem('fdvc_assignments_2026', JSON.stringify(newAssignments));
    if (!skipPush) postCentralDataUpdate({ assignments: newAssignments });
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
      const currentSenderName = user?.name || 'María Román';

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

      // Generate PDFs for all selected seats
      const selectedSeatObjects = updatedSeats.filter((s) => selectedSeatIds.includes(s.id));
      const generatedPDFs = [];

      for (const seat of selectedSeatObjects) {
        const { pdfBlob, filename } = await generateTicketPDF(seat, participant);
        generatedPDFs.push({ seat, pdfBlob, filename });
      }

      let emailAttempted = false;

      if (mode === 'send') {
        try {
          const ticketPayloads = await Promise.all(
            generatedPDFs.map(async ({ seat, pdfBlob, filename }) => {
              const arrayBuffer = await pdfBlob.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              return {
                row: seat.row,
                number: seat.number,
                filename: filename,
                ticketCode: seat.ticketCode,
                pdfBase64: `data:application/pdf;base64,${base64}`,
              };
            })
          );

          // Try calling PHP email endpoint on hosting server
          const phpRes = await fetch('/api/send-tickets.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipientEmail: email,
              participantName: participantName,
              seatTickets: ticketPayloads,
              sentBy: currentSenderName,
            }),
          });

          if (phpRes.ok) {
            emailAttempted = true;
          }
        } catch (e) {
          console.warn('Backend email dispatch notice:', e);
        }

        // Auto-download PDFs for the user as backup
        for (const { pdfBlob, filename } of generatedPDFs) {
          downloadPDFBlob(pdfBlob, filename);
        }

        setToastMessage(
          emailAttempted
            ? `🚀 Entradas enviadas por correo a ${email} y descargadas localmente`
            : `✅ Entradas asignadas a ${participantName}. PDFs descargados para enviar a ${email}`
        );
      } else {
        setToastMessage(`💾 ${selectedSeatIds.length} butacas guardadas sin enviar`);
      }

      // Update local state without separate parallel HTTP pushes
      saveSeatsState(updatedSeats, true);

      const updatedParticipants = participants.map((p) => {
        if (p.id === participantId) {
          return { ...p, assignedSeatsCount: p.assignedSeatsCount + selectedSeatIds.length };
        }
        return p;
      });
      saveParticipantsState(updatedParticipants, true);

      // Create Assignment record
      const newRecord: AssignmentRecord = {
        id: `asgn-${Date.now()}`,
        date: new Date().toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }),
        participantId: participantId,
        participantName: participantName,
        seatIds: [...selectedSeatIds],
        sentToEmail: email,
        sentBy: currentSenderName,
        status: mode === 'send' ? 'Enviado' : 'Asignado',
      };
      const updatedAssignments = [newRecord, ...assignments];
      saveAssignmentsState(updatedAssignments, true);

      // Single atomic POST push to central server
      await postCentralDataUpdate({
        seats: updatedSeats,
        participants: updatedParticipants,
        assignments: updatedAssignments,
      });

      setSelectedSeatIds([]);
    } catch (err) {
      console.error('Error durante la asignación:', err);
      setToastMessage('❌ Ocurrió un error al procesar la asignación');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setToastMessage(null), 5000);
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

  // Bulk add participants from Excel/Paste
  const handleBulkAddParticipants = (
    newList: Omit<Participant, 'id' | 'assignedSeatsCount'>[]
  ) => {
    const created: Participant[] = newList.map((item, idx) => ({
      ...item,
      id: `part-${Date.now()}-${idx}`,
      assignedSeatsCount: 0,
    }));
    const updated = [...created, ...participants];
    saveParticipantsState(updated);
    setToastMessage(`✅ ${created.length} participantes agregados masivamente`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Delete participant
  const handleDeleteParticipant = (id: string) => {
    const p = participants.find((item) => item.id === id);
    if (!p) return;
    if (confirm(`¿Estás seguro de eliminar a "${p.name}"?`)) {
      const updated = participants.filter((item) => item.id !== id);
      saveParticipantsState(updated);
      setToastMessage(`🗑️ Participante "${p.name}" eliminado`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Gate Check-in Validation & Recording
  const handleCheckInSeat = async (seatId: string) => {
    const targetSeat = seats.find((s) => s.id === seatId);
    if (!targetSeat) return;

    const timeNow = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    let newLog: ScanLogItem;

    if (targetSeat.status === 'checked_in') {
      newLog = {
        id: `scan-${Date.now()}`,
        time: timeNow,
        seatId: targetSeat.id,
        row: targetSeat.row,
        number: targetSeat.number,
        participantName: targetSeat.assignedParticipantName || 'Sin Nombre',
        status: 'already_used',
        message: '¡ALERTA! Entrada ya fue ingresada anteriormente en puerta',
      };
    } else if (targetSeat.status === 'available') {
      newLog = {
        id: `scan-${Date.now()}`,
        time: timeNow,
        seatId: targetSeat.id,
        row: targetSeat.row,
        number: targetSeat.number,
        participantName: 'Sin Asignar',
        status: 'fake',
        message: 'Butaca no asignada ni emitida en sistema',
      };
    } else {
      newLog = {
        id: `scan-${Date.now()}`,
        time: timeNow,
        seatId: targetSeat.id,
        row: targetSeat.row,
        number: targetSeat.number,
        participantName: targetSeat.assignedParticipantName || 'Participante',
        status: 'valid',
        message: 'Acceso Permitido — Entrada Validada OK',
      };

      // Mark seat checked_in in state
      const updatedSeats = seats.map((s) => (s.id === seatId ? { ...s, status: 'checked_in' as const, checkedInAt: new Date().toISOString() } : s));
      saveSeatsState(updatedSeats, true);
      await postCentralDataUpdate({ seats: updatedSeats, newScanLog: newLog });
    }

    const updatedLogs = [newLog, ...scanLogs];
    setScanLogs(updatedLogs);
    if (targetSeat.status !== 'checked_in' && targetSeat.status !== 'available') {
      saveSeatsState(seats.map((s) => (s.id === seatId ? { ...s, status: 'checked_in' as const } : s)));
    }
  };

  const selectedSeats = seats.filter((s) => selectedSeatIds.includes(s.id));

  // If user authentication is still loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold tracking-wide">Cargando sistema de entradas...</p>
        </div>
      </div>
    );
  }

  // Mandatory Login Gatekeeper
  if (!user) {
    return <LoginModal isOpen={true} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 animate-bounce flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Camera Scan Result Modal overlay */}
      {urlScanResult && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-center">
            {urlScanResult.isValid ? (
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-pulse" />
            ) : (
              <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
            )}

            <h3 className="text-xl font-extrabold text-slate-900">{urlScanResult.isValid ? 'Entrada Válida' : 'Verificación Fallida'}</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">{urlScanResult.message}</p>

            <button
              onClick={() => {
                setUrlScanResult(null);
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('verify');
                  url.searchParams.delete('v');
                  window.history.replaceState({}, '', url.toString());
                }
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer"
            >
              Cerrar y Continuar
            </button>
          </div>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Content Container */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Header Bar */}
          <Header
            onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
          />

          {/* Body Content by Active Tab */}
          <main className="flex-1 p-4 md:p-8 space-y-8 max-w-7xl w-full mx-auto">
            {/* Top Dashboard Metrics */}
            <StatsCards stats={stats} />

            {/* TAB: Entradas / Dashboard Principal */}
            {(activeTab === 'tickets' || activeTab === 'overview') && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
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
                      selectedSeats={selectedSeats}
                      participants={participants}
                      onAssignAndSend={handleAssignAndSend}
                      isProcessing={isProcessing}
                    />
                  </div>
                </div>

                <RecentAssignmentsTable assignments={assignments} />
              </>
            )}

            {/* TAB: Participantes / Escuelas */}
            {activeTab === 'participants' && (
              <ParticipantsManager
                participants={participants}
                onAddParticipant={handleAddParticipant}
                onDeleteParticipant={handleDeleteParticipant}
                onBulkAddParticipants={handleBulkAddParticipants}
              />
            )}

            {/* TAB: Control de Acceso y QR */}
            {activeTab === 'scanner' && (
              <GateScanner
                seats={seats}
                scanLogs={scanLogs}
                onCheckInSeat={handleCheckInSeat}
              />
            )}

            {/* TAB: Configuración */}
            {activeTab === 'settings' && <SettingsView />}
          </main>
        </div>
      </div>
    </div>
  );
}

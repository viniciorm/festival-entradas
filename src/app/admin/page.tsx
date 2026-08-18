'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import ParticipantSeatSummary from '@/components/ParticipantSeatSummary';
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
  const isProcessingRef = useRef<boolean>(false);
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
    if (isProcessingRef.current) return;
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

  // Post Data Updates to Central Server (Delta/Atomic Update with retry)
  const postCentralDataUpdate = async (updatePayload: {
    changedSeats?: Seat[];       // Only the seats that changed (preferred)
    seats?: Seat[];              // Legacy: full array fallback
    participants?: Participant[];
    assignments?: AssignmentRecord[];
    newAssignment?: AssignmentRecord; // Only the new record (preferred)
    scanLogs?: ScanLogItem[];
    newScanLog?: ScanLogItem;
  }): Promise<boolean> => {
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch('/api/sync-data.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) return true;
        }
      } catch (e) {
        console.warn(`Central server sync attempt ${attempt} failed:`, e);
      }
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 500 * attempt));
    }
    console.error('All retries exhausted — assignment may not have saved to server');
    return false;
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

  // ── Resend existing assignment (no mutations to seats/assignments) ────────
  const handleResendAssignment = async (assignment: AssignmentRecord): Promise<{
    success: boolean;
    errorMessage?: string;
  }> => {
    // ── Guard: validate assignment has email and seats ──────────────────────
    if (!assignment.sentToEmail || assignment.sentToEmail.trim() === '') {
      return { success: false, errorMessage: 'La asignación no tiene correo registrado. Edítala antes de reenviar.' };
    }
    if (!assignment.seatIds || assignment.seatIds.length === 0) {
      return { success: false, errorMessage: 'La asignación no tiene asientos asociados. No hay PDFs que generar.' };
    }

    const currentSenderName = user?.name || 'María Román';
    const email = assignment.sentToEmail.trim();
    const participantName = assignment.participantName;

    // ── Look up full seat objects from current state ────────────────────────
    const seatObjects = seats.filter((s) => assignment.seatIds.includes(s.id));
    const missingSeats = assignment.seatIds.filter((id) => !seatObjects.find((s) => s.id === id));
    if (missingSeats.length > 0) {
      return {
        success: false,
        errorMessage: `No se encontraron los siguientes asientos en el sistema: ${missingSeats.join(', ')}. Recarga la página e intenta de nuevo.`,
      };
    }

    // ── Find participant for PDF generation ────────────────────────────────
    const participant = participants.find((p) => p.id === assignment.participantId);

    // ── Generate PDFs — validate each one individually ──────────────────────
    const generatedPDFs: Array<{ seat: Seat; pdfBlob: Blob; filename: string }> = [];
    const failedSeats: string[] = [];

    for (const seat of seatObjects) {
      try {
        const { pdfBlob, filename } = await generateTicketPDF(seat, participant);
        if (!pdfBlob || pdfBlob.size < 100) {
          failedSeats.push(seat.id);
          continue;
        }
        generatedPDFs.push({ seat, pdfBlob, filename });
      } catch {
        failedSeats.push(seat.id);
      }
    }

    if (failedSeats.length > 0) {
      return {
        success: false,
        errorMessage: `No se pudo generar PDF para: ${failedSeats.join(', ')}. Intenta de nuevo.`,
      };
    }

    // ── Build ticket payloads ───────────────────────────────────────────────
    let allTicketPayloads;
    try {
      allTicketPayloads = await Promise.all(
        generatedPDFs.map(async ({ seat, pdfBlob, filename }) => {
          const arrayBuffer = await pdfBlob.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          return {
            row: seat.row,
            number: seat.number,
            filename,
            ticketCode: seat.ticketCode,
            pdfBase64: `data:application/pdf;base64,${base64}`,
          };
        })
      );
    } catch {
      return { success: false, errorMessage: 'Error al codificar los PDFs en base64. Intenta de nuevo.' };
    }

    // ── Send in batches of 5 ────────────────────────────────────────────────
    const BATCH_SIZE = 5;
    const batches: typeof allTicketPayloads[] = [];
    for (let i = 0; i < allTicketPayloads.length; i += BATCH_SIZE) {
      batches.push(allTicketPayloads.slice(i, i + BATCH_SIZE));
    }

    let successfulBatches = 0;
    let lastErrorMsg = '';

    for (let idx = 0; idx < batches.length; idx++) {
      try {
        const phpRes = await fetch('/api/send-tickets.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: email,
            participantName,
            seatTickets: batches[idx],
            sentBy: currentSenderName,
            batchIndex: idx + 1,
            totalBatches: batches.length,
            isResend: true,
          }),
        });
        if (phpRes.ok) {
          const json = await phpRes.json();
          if (json.success) {
            successfulBatches++;
          } else {
            lastErrorMsg = json.error || `El servidor rechazó el lote ${idx + 1}`;
          }
        } else {
          lastErrorMsg = `El servidor respondió con error HTTP ${phpRes.status} en lote ${idx + 1}`;
        }
      } catch (e) {
        lastErrorMsg = `Error de red al enviar lote ${idx + 1}: ${e instanceof Error ? e.message : 'desconocido'}`;
      }
    }

    const resendSucceeded = successfulBatches === batches.length;

    // ── Post traceability log to server (fire-and-forget) ──────────────────
    const resendLog = {
      id: `resend-${Date.now()}`,
      assignmentId: assignment.id,
      participantName,
      sentToEmail: email,
      seatIds: assignment.seatIds,
      pdfCount: generatedPDFs.length,
      batchCount: batches.length,
      successfulBatches,
      result: resendSucceeded ? 'success' : 'failed',
      errorMessage: resendSucceeded ? null : lastErrorMsg,
      sentBy: currentSenderName,
      timestamp: new Date().toISOString(),
    };
    fetch('/api/sync-data.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newResendLog: resendLog }),
    }).catch(() => {/* traceability is best-effort */});

    if (!resendSucceeded) {
      return {
        success: false,
        errorMessage: lastErrorMsg || `Solo ${successfulBatches} de ${batches.length} lotes enviados correctamente.`,
      };
    }

    return { success: true };
  };

  // Handle Seat Assignment and Email Dispatch
  const handleAssignAndSend = async (participantId: string, email: string, mode: 'send' | 'save') => {
    if (selectedSeatIds.length === 0) return;
    setIsProcessing(true);
    isProcessingRef.current = true;

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

      const updatedParticipants = participants.map((p) => {
        if (p.id === participantId) {
          return { ...p, assignedSeatsCount: p.assignedSeatsCount + selectedSeatIds.length };
        }
        return p;
      });

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

      // 1. UPDATE LOCAL STATE AND POST TO CENTRAL DATABASE IMMEDIATELY (<50ms)
      saveSeatsState(updatedSeats, true);
      saveParticipantsState(updatedParticipants, true);
      saveAssignmentsState(updatedAssignments, true);

      // Use delta update: only send the changed seats and the new assignment record
      // This reduces payload from ~300KB to ~2KB, preventing silent POST failures
      const changedSeats = updatedSeats.filter((s) => selectedSeatIds.includes(s.id));
      const saved = await postCentralDataUpdate({
        changedSeats,
        participants: updatedParticipants,
        newAssignment: newRecord,
      });

      if (!saved) {
        // If delta failed, try once more with the new assignment only (minimum viable save)
        await postCentralDataUpdate({ newAssignment: newRecord, changedSeats });
      }

      // Clear selection right away so UI feels responsive
      const currentSelectedSeatIds = [...selectedSeatIds];
      setSelectedSeatIds([]);

      // 2. Generate PDFs for all selected seats
      const selectedSeatObjects = updatedSeats.filter((s) => currentSelectedSeatIds.includes(s.id));
      const generatedPDFs: Array<{ seat: Seat; pdfBlob: Blob; filename: string }> = [];

      for (const seat of selectedSeatObjects) {
        const { pdfBlob, filename } = await generateTicketPDF(seat, participant);
        generatedPDFs.push({ seat, pdfBlob, filename });
      }

      let emailAttempted = false;
      let totalEmailBatches = 1;

      if (mode === 'send') {
        try {
          const allTicketPayloads = await Promise.all(
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

          // Batch ticket payloads into chunks of maximum 5 tickets per email
          const BATCH_SIZE = 5;
          const batches = [];
          for (let i = 0; i < allTicketPayloads.length; i += BATCH_SIZE) {
            batches.push(allTicketPayloads.slice(i, i + BATCH_SIZE));
          }
          totalEmailBatches = batches.length;
          let successfulBatches = 0;

          for (let idx = 0; idx < batches.length; idx++) {
            const chunk = batches[idx];
            const phpRes = await fetch('/api/send-tickets.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipientEmail: email,
                participantName: participantName,
                seatTickets: chunk,
                sentBy: currentSenderName,
                batchIndex: idx + 1,
                totalBatches: batches.length,
              }),
            });

            if (phpRes.ok) {
              const json = await phpRes.json();
              if (json.success) {
                successfulBatches++;
              }
            }
          }

          if (successfulBatches > 0) {
            emailAttempted = true;
          }
        } catch (e) {
          console.warn('Backend email dispatch notice:', e);
        }

        setToastMessage(
          emailAttempted
            ? `🚀 ${currentSelectedSeatIds.length} entradas enviadas a ${email} ${totalEmailBatches > 1 ? `en ${totalEmailBatches} correos` : ''} y PDFs descargados localmente`
            : `✅ Entradas asignadas a ${participantName}. PDFs descargados para enviar a ${email}`
        );

        // Trigger local PDF downloads in background without blocking
        setTimeout(() => {
          try {
            for (const { pdfBlob, filename } of generatedPDFs) {
              downloadPDFBlob(pdfBlob, filename);
            }
          } catch (err) {
            console.warn('PDF download notice:', err);
          }
        }, 100);
      } else {
        setToastMessage(`💾 ${currentSelectedSeatIds.length} butacas guardadas sin enviar`);
      }
    } catch (err) {
      console.error('Error durante la asignación:', err);
      setToastMessage('❌ Ocurrió un error al procesar la asignación');
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
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
      const changedSeat = updatedSeats.find((s) => s.id === seatId);
      saveSeatsState(updatedSeats, true);
      await postCentralDataUpdate({ changedSeats: changedSeat ? [changedSeat] : [], newScanLog: newLog });
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

                <ParticipantSeatSummary participants={participants} seats={seats} />

                <RecentAssignmentsTable assignments={assignments} onResend={handleResendAssignment} />
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

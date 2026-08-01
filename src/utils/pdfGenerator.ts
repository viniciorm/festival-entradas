import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { Seat, Participant } from '@/types/festival';

export async function generateTicketPDF(seat: Seat, participant?: Participant): Promise<{ pdfBlob: Blob; filename: string }> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [140, 90], // Compact ticket dimensions 140mm x 90mm
  });

  // Colors
  const darkViolet = '#1A1333';
  const gold = '#D97706';
  const lightBg = '#F8FAFC';
  const textDark = '#0F172A';

  // Ticket Background Card
  doc.setFillColor(lightBg);
  doc.rect(0, 0, 140, 90, 'F');

  // Left Sidebar Accent Banner (Dark Violet)
  doc.setFillColor(darkViolet);
  doc.rect(0, 0, 42, 90, 'F');

  // Gold Decorative Stripe
  doc.setFillColor(gold);
  doc.rect(40, 0, 2, 90, 'F');

  // Header Title on Left Sidebar
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('FESTIVAL NACIONAL', 21, 15, { align: 'center' });
  doc.text('DANZA DEL VIENTRE', 21, 20, { align: 'center' });
  doc.setTextColor(gold);
  doc.setFontSize(10);
  doc.text('CHILE 2026', 21, 27, { align: 'center' });

  // Moon & Star Emblem Draw
  doc.setDrawColor(gold);
  doc.setLineWidth(0.5);
  doc.circle(21, 45, 10, 'S');
  doc.setFontSize(12);
  doc.text('🌙', 21, 48, { align: 'center' });

  // Sidebar Footer Info
  doc.setTextColor('#CBD5E1');
  doc.setFontSize(6);
  doc.text('ENTRADA OFICIAL', 21, 75, { align: 'center' });
  doc.text('ticketfestival.tupartnerti.cl', 21, 80, { align: 'center' });

  // Main Right Ticket Body Content
  // Header Event Name
  doc.setTextColor(textDark);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ENTRADA DE INGRESO - TEATRO', 48, 14);

  doc.setDrawColor('#E2E8F0');
  doc.setLineWidth(0.3);
  doc.line(48, 17, 132, 17);

  // Seat Badge Highlight Box
  doc.setFillColor('#EEF2FF');
  doc.roundedRect(48, 22, 42, 22, 2, 2, 'F');

  doc.setTextColor('#4F46E5');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('BUTACA ASIGNADA', 52, 27);

  doc.setTextColor(textDark);
  doc.setFontSize(14);
  doc.text(`FILA ${seat.row} - ASIENTO ${seat.number}`, 52, 36);

  // Participant Info
  doc.setTextColor('#475569');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('ASIGNADA A:', 48, 50);

  doc.setTextColor(textDark);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const partName = participant ? participant.name : (seat.assignedParticipantName || 'Participante');
  doc.text(partName, 48, 55);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#64748B');
  doc.text(`ID Archivo: ${seat.pdfFilename}`, 48, 62);
  doc.text(`Código Ticket: ${seat.ticketCode || 'FDVC2026-VAL'}`, 48, 67);

  // Decorative Dashed Line before QR
  doc.setDrawColor('#94A3B8');
  doc.setLineDashPattern([1, 1], 0);
  doc.line(94, 20, 94, 80);
  doc.setLineDashPattern([], 0);

  // QR Code Generation
  const qrContent = JSON.stringify({
    ticketCode: seat.ticketCode || `FDVC2026-${seat.id}`,
    seatId: seat.id,
    row: seat.row,
    seatNumber: seat.number,
    filename: seat.pdfFilename,
    participant: partName,
    event: 'Festival Nacional Danza del Vientre Chile 2026',
  });

  const qrDataUrl = await QRCode.toDataURL(qrContent, { width: 120, margin: 1 });
  doc.addImage(qrDataUrl, 'PNG', 98, 25, 36, 36);

  doc.setFontSize(6);
  doc.setTextColor('#64748B');
  doc.setFont('helvetica', 'bold');
  doc.text('ESCANEAR EN PUERTA', 116, 65, { align: 'center' });

  // Filename format: e.g. A000123FDVC2026-CL.pdf
  const filename = seat.pdfFilename || `${seat.row}${seat.paddedNumber}FDVC2026-CL.pdf`;

  const pdfBlob = doc.output('blob');
  return { pdfBlob, filename };
}

export function downloadPDFBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

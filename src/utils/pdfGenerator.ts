import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { Seat, Participant } from '@/types/festival';

let cachedLogoBase64: string | null = null;

async function getLogoBase64(): Promise<string | null> {
  if (cachedLogoBase64) return cachedLogoBase64;
  if (typeof window === 'undefined') return null;

  try {
    const response = await fetch('/festival-dancers.jpg');
    if (!response.ok) return null;
    const blob = await response.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoBase64 = reader.result as string;
        resolve(cachedLogoBase64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Error loading logo image:', err);
    return null;
  }
}

export async function generateTicketPDF(seat: Seat, participant?: Participant): Promise<{ pdfBlob: Blob; filename: string; dataUrl: string }> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [140, 85], // 140mm x 85mm ticket format
  });

  // Colors
  const royalPurple = '#312E81';
  const gold = '#F59E0B';
  const textDark = '#1E293B';

  // Background Gradient Simulation (Landscape layout)
  doc.setFillColor('#0F172A');
  doc.rect(0, 0, 140, 85, 'F');

  // Left Accent Purple Block
  doc.setFillColor('#2E1065');
  doc.rect(0, 0, 48, 85, 'F');

  // Gold Divider Line
  doc.setFillColor(gold);
  doc.rect(48, 0, 1.5, 85, 'F');

  // Right Content Area Light/Dark Box
  doc.setFillColor('#FAF5FF');
  doc.rect(49.5, 0, 90.5, 85, 'F');

  // Load and add Official Festival Logo
  const logoBase64 = await getLogoBase64();
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'JPEG', 8, 8, 32, 32);
    } catch (e) {
      console.warn('Could not render logo in PDF:', e);
    }
  }

  // Left Sidebar Title Text
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('FESTIVAL NACIONAL', 24, 46, { align: 'center' });
  doc.text('DANZA DEL VIENTRE', 24, 50, { align: 'center' });

  doc.setTextColor(gold);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CHILE 2026', 24, 57, { align: 'center' });

  doc.setTextColor('#CBD5E1');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('ENTRADA OFICIAL', 24, 73, { align: 'center' });
  doc.text('ticketfestival.tupartnerti.cl', 24, 77, { align: 'center' });

  // --- Right Main Body ---
  // Event Name & Header
  doc.setTextColor(royalPurple);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ENTRADA OFICIAL DE ACCESO', 54, 12);

  doc.setTextColor('#64748B');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Teatro Municipal | Festival Danza del Vientre Chile 2026', 54, 16);

  doc.setDrawColor('#E2E8F0');
  doc.setLineWidth(0.3);
  doc.line(54, 18, 134, 18);

  // Seat Badge Box (Purple + Gold Border)
  doc.setFillColor('#F3E8FF');
  doc.setDrawColor(gold);
  doc.setLineWidth(0.8);
  doc.roundedRect(54, 22, 42, 24, 3, 3, 'FD');

  doc.setTextColor('#581C87');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('UBICACIÓN Y BUTACA', 58, 27);

  doc.setTextColor('#0F172A');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`FILA ${seat.row}`, 58, 34);

  doc.setTextColor('#D97706');
  doc.setFontSize(11);
  doc.text(`ASIENTO ${seat.number}`, 58, 41);

  // Block Section
  const blockText = seat.block === 'left' ? 'Bloque Izquierdo' : seat.block === 'right' ? 'Bloque Derecho' : 'Bloque Central';
  doc.setTextColor('#475569');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(blockText, 58, 45);

  // Participant Info Box
  doc.setTextColor('#475569');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('ASIGNADO A:', 54, 52);

  doc.setTextColor(textDark);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const partName = participant ? participant.name : (seat.assignedParticipantName || 'Participante / Solista');
  doc.text(partName, 54, 57);

  const partContact = participant?.contactPerson ? `Contacto: ${participant.contactPerson}` : '';
  if (partContact) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#64748B');
    doc.text(partContact, 54, 62);
  }

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

  const qrDataUrl = await QRCode.toDataURL(qrContent, { width: 120, margin: 1, color: { dark: '#1E1B4B', light: '#FFFFFF' } });
  doc.addImage(qrDataUrl, 'PNG', 101, 22, 33, 33);

  // QR Scanner Label Box
  doc.setFillColor('#1E1B4B');
  doc.roundedRect(101, 56, 33, 7, 1, 1, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('ESCANEAR EN PUERTA', 117.5, 60.5, { align: 'center' });

  // Ticket Code Footer Line
  const filename = seat.pdfFilename || `${seat.row}${seat.paddedNumber}FDVC2026-CL.pdf`;

  doc.setDrawColor('#CBD5E1');
  doc.setLineWidth(0.2);
  doc.line(54, 69, 134, 69);

  doc.setTextColor('#64748B');
  doc.setFontSize(7);
  doc.setFont('courier', 'normal');
  doc.text(`CÓDIGO: ${seat.ticketCode || 'FDVC2026-VAL'} | ARCHIVO: ${filename}`, 54, 74);

  const pdfBlob = doc.output('blob');
  const dataUrl = doc.output('datauristring');

  return { pdfBlob, filename, dataUrl };
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

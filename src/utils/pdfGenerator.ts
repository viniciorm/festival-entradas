import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { Seat, Participant } from '@/types/festival';
import { createTicketQRPayload } from '@/utils/security';

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

export function getOfficialPDFFilename(seat: { row?: string; row_name?: string; number?: number; seat_number?: number; paddedNumber?: string; pdfFilename?: string; id?: string }): string {
  if (seat.pdfFilename && seat.pdfFilename.endsWith('FDVC2026-CL.pdf') && !seat.pdfFilename.startsWith('Entrada_')) {
    return seat.pdfFilename;
  }
  const row = seat.row || seat.row_name || (seat.id ? seat.id[0] : 'A');
  const numRaw = seat.number !== undefined ? seat.number : (seat.seat_number !== undefined ? seat.seat_number : (seat.id ? parseInt(seat.id.substring(1)) : 1));
  const padded = String(numRaw).padStart(6, '0');
  return `${row}${padded}FDVC2026-CL.pdf`;
}

export async function generateTicketPDF(
  seat: Seat,
  participant?: Participant | { name: string; contactPerson?: string },
  options?: { isInvitation?: boolean }
): Promise<{ pdfBlob: Blob; filename: string; dataUrl: string; securityHash: string }> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [140, 85], // 140mm x 85mm ticket format
  });

  const isInvitation = options?.isInvitation || seat.status === 'invitation';

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
    } catch (err) {
      console.warn('Could not render logo in PDF:', err);
    }
  }

  // Official Event Title
  doc.setTextColor('#FAF5FF');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('FESTIVAL NACIONAL DE DANZA DEL VIENTRE', 24, 46, { align: 'center' });
  doc.setTextColor(gold);
  doc.setFontSize(10);
  doc.text('CHILE 2026', 24, 51, { align: 'center' });

  // Badge Type (INVITACIÓN, ENTRADA OFICIAL, BAILARINA)
  if (isInvitation) {
    doc.setFillColor('#F59E0B');
    doc.roundedRect(6, 56, 36, 6, 1, 1, 'F');
    doc.setTextColor('#1E1B4B');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('INVITACIÓN ESPECIAL', 24, 60.2, { align: 'center' });
  } else {
    doc.setFillColor('#4C1D95');
    doc.roundedRect(6, 56, 36, 6, 1, 1, 'F');
    doc.setTextColor('#FAF5FF');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('ENTRADA OFICIAL', 24, 60.2, { align: 'center' });
  }

  // Right Section - Event Header
  doc.setTextColor(royalPurple);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('XXIV Festival Nacional Danza del Vientre', 54, 12);

  doc.setTextColor(textDark);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Sábado 5 de Septiembre 2026 - 17:30 hrs | Aula Magna Liceo Manuel de Salas', 54, 16);

  // Seat Location Highlights
  doc.setFillColor('#F1F5F9');
  doc.roundedRect(54, 22, 44, 20, 2, 2, 'F');

  doc.setTextColor('#64748B');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('UBICACIÓN ASIGNADA', 57, 27);

  doc.setTextColor(royalPurple);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`FILA ${seat.row}`, 57, 34);

  doc.setTextColor(gold);
  doc.setFontSize(14);
  doc.text(`N° ${seat.number}`, 80, 34);

  doc.setTextColor('#475569');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Bloque: ${seat.block === 'center' ? 'Central' : seat.block === 'left' ? 'Izquierdo' : 'Derecho'}`, 57, 39);

  // Participant Name / Buyer Name
  const participantName = participant?.name || seat.assignedParticipantName || 'Asistente';
  doc.setTextColor('#64748B');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TITULAR / ASISTENTE', 54, 48);

  doc.setTextColor(textDark);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(participantName.substring(0, 30), 54, 53);

  // Generate QR Code with Cryptographic Security Payload
  const { qrString, securityHash } = await createTicketQRPayload(seat, participantName, isInvitation ? 'INVITATION' : 'OFFICIAL');

  const qrDataUrl = await QRCode.toDataURL(qrString, { width: 120, margin: 1, color: { dark: '#1E1B4B', light: '#FFFFFF' } });
  doc.addImage(qrDataUrl, 'PNG', 101, 22, 33, 33);

  // QR Security Hash Badge
  doc.setFillColor('#1E1B4B');
  doc.roundedRect(101, 56, 33, 7, 1, 1, 'F');
  doc.setTextColor('#F59E0B');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text(`HASH: ${securityHash}`, 117.5, 60.5, { align: 'center' });

  // Ticket Code & Hash Footer Line (EXACT OFFICIAL FORMAT <Fila><00000N>FDVC2026-CL.pdf)
  const filename = getOfficialPDFFilename(seat);

  doc.setDrawColor('#CBD5E1');
  doc.setLineWidth(0.2);
  doc.line(54, 69, 134, 69);

  doc.setTextColor('#475569');
  doc.setFontSize(6.5);
  doc.setFont('courier', 'bold');
  doc.text(`ARCH: ${filename} | SEC-KEY: ${securityHash}`, 54, 74);

  const pdfBlob = doc.output('blob');
  const dataUrl = doc.output('datauristring');

  return { pdfBlob, filename, dataUrl, securityHash };
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

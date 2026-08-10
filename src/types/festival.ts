export type SeatStatus = 'available' | 'selected' | 'assigned' | 'sent' | 'checked_in';
export type SeatBlock = 'left' | 'center' | 'right';

export interface Seat {
  id: string; // e.g. "A-12"
  row: string; // "A", "B", ...
  number: number; // 1..34
  paddedNumber: string; // "000012"
  block: SeatBlock;
  status: SeatStatus;
  assignedParticipantId?: string;
  assignedParticipantName?: string;
  assignedAt?: string;
  ticketCode?: string; // "TKT-A000012-FDVC2026"
  pdfFilename?: string; // "A000012FDVC2026-CL.pdf"
  sentAt?: string;
  checkedInAt?: string;
}

export interface Participant {
  id: string;
  name: string; // Presentation / Participant name
  type: 'grupo' | 'solista';
  dancersCount: number;
  contactPerson: string; // Teacher or Contact person
  email: string;
  phone: string;
  assignedSeatsCount: number;
  school?: string;
  teacher?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
}

export interface AssignmentRecord {
  id: string;
  date: string;
  participantId: string;
  participantName: string;
  seatIds: string[];
  sentToEmail: string;
  sentBy: string;
  status: 'Asignado' | 'Enviado' | 'Canjeado';
}

export interface FestivalStats {
  totalSeats: number;
  assignedSeats: number;
  availableSeats: number;
  sentToday: number;
  checkedInCount: number;
}

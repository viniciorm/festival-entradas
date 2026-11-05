export type SeatStatus = 'available' | 'selected' | 'assigned' | 'sent' | 'invitation' | 'sold' | 'reserved' | 'checked_in' | 'blocked';
export type SeatBlock = 'left' | 'center' | 'right';

export interface Seat {
  id: string; // e.g. "A12"
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
  blockedReason?: string;
  blockedNotes?: string;
  blockedAt?: string;
  blockedBy?: string;
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
  status: 'Asignado' | 'Enviado' | 'Canjeado' | 'Desasignado' | 'Anulado';
}

export interface InvitationRecord {
  id: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  seatIds: string[];
  reason?: 'artista' | 'prensa' | 'auspiciador' | 'cortesía' | 'producción' | 'otro';
  internalNotes?: string;
  createdBy: string;
  createdAt: string;
  sentAt?: string;
  sendStatus: 'pending' | 'sent' | 'failed';
  status: 'valid' | 'cancelled' | 'used';
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  resendCount?: number;
  lastResentAt?: string;
  lastResentBy?: string;
  // Wallet pass support preparation
  appleWalletUrl?: string;
  googleWalletUrl?: string;
}

export interface FestivalStats {
  totalSeats: number;
  assignedSeats: number;
  availableSeats: number;
  blockedSeats?: number;
  sentToday: number;
  checkedInCount: number;
}


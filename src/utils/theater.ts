import { Seat, Participant, AssignmentRecord } from '@/types/festival';

export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
export const SEATS_PER_ROW = 34;

// Format seat number into 6 digit padded string for filename
export function formatSeatFilename(row: string, seatNumber: number): string {
  const padded = String(seatNumber).padStart(6, '0');
  return `${row}${padded}FDVC2026-CL.pdf`;
}

// Generate unique ticket code hash
export function generateTicketCode(row: string, seatNumber: number): string {
  const padded = String(seatNumber).padStart(3, '0');
  const randomHash = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FDVC2026-${row}${padded}-${randomHash}`;
}

export function generateInitialSeats(): Seat[] {
  const seats: Seat[] = [];
  let globalSeatIndex = 1;

  ROWS.forEach((row) => {
    for (let col = 1; col <= SEATS_PER_ROW; col++) {
      let block: 'left' | 'center' | 'right' = 'center';
      if (col <= 8) {
        block = 'left';
      } else if (col >= 27) {
        block = 'right';
      } else {
        block = 'center';
      }

      const paddedNumber = String(globalSeatIndex).padStart(6, '0');
      const seatId = `${row}${col}`;

      seats.push({
        id: seatId,
        row: row,
        number: col,
        paddedNumber: paddedNumber,
        block: block,
        status: 'available',
        pdfFilename: formatSeatFilename(row, globalSeatIndex),
      });

      globalSeatIndex++;
    }
  });

  return seats;
}

export const INITIAL_PARTICIPANTS: Participant[] = [
  {
    id: 'part-1',
    name: 'Compañía Al Zahra',
    type: 'grupo',
    dancersCount: 8,
    contactPerson: 'Amira Said',
    email: 'contacto@alzahra.cl',
    phone: '+56 9 8765 4321',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-2',
    name: 'Academia Shams',
    type: 'grupo',
    dancersCount: 12,
    contactPerson: 'Kamilah Batar',
    email: 'contacto@shams.cl',
    phone: '+56 9 7654 3210',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-3',
    name: 'Grupo Danza Isis',
    type: 'grupo',
    dancersCount: 6,
    contactPerson: 'Nuria Haddad',
    email: 'contacto@danzaisis.cl',
    phone: '+56 9 6543 2109',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-4',
    name: 'Solista Yasmin',
    type: 'solista',
    dancersCount: 1,
    contactPerson: 'Yasmin Valenzuela',
    email: 'yasmin.oriental@gmail.com',
    phone: '+56 9 5432 1098',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-5',
    name: 'Compañía Rakasah',
    type: 'grupo',
    dancersCount: 10,
    contactPerson: 'Salma Mansour',
    email: 'salma@rakasah.cl',
    phone: '+56 9 4321 0987',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-6',
    name: 'Solista Layla',
    type: 'solista',
    dancersCount: 1,
    contactPerson: 'Layla Morales',
    email: 'layla.danza@gmail.com',
    phone: '+56 9 3210 9876',
    assignedSeatsCount: 0,
  },
];

export const INITIAL_ASSIGNMENTS: AssignmentRecord[] = [
  {
    id: 'asgn-1',
    date: '2026-05-23 14:32',
    participantId: 'part-2',
    participantName: 'Academia Shams',
    seatIds: ['E7', 'E8', 'E9', 'E10'],
    sentToEmail: 'contacto@shams.cl',
    sentBy: 'María Román',
    status: 'Enviado',
  },
  {
    id: 'asgn-2',
    date: '2026-05-23 11:15',
    participantId: 'part-4',
    participantName: 'Solista Yasmin',
    seatIds: ['C4', 'C5'],
    sentToEmail: 'yasmin.oriental@gmail.com',
    sentBy: 'María Román',
    status: 'Enviado',
  },
];

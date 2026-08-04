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
    name: 'Ana Francisca Pizarro Ruiz',
    type: 'solista',
    dancersCount: 1,
    contactPerson: 'Ana Francisca Pizarro Ruiz',
    email: 'anafrancisca@festival.cl',
    phone: '+56 9 0000 0001',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-2',
    name: 'Grupo Shazaditas Teens',
    type: 'grupo',
    dancersCount: 8,
    contactPerson: 'Shazaditas Teens',
    email: 'shazaditas.teens@festival.cl',
    phone: '+56 9 0000 0002',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-3',
    name: 'Grupo Shazaditas Evolution',
    type: 'grupo',
    dancersCount: 10,
    contactPerson: 'Shazaditas Evolution',
    email: 'shazaditas.evolution@festival.cl',
    phone: '+56 9 0000 0003',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-4',
    name: 'Grupo Shazaditas Essence',
    type: 'grupo',
    dancersCount: 8,
    contactPerson: 'Shazaditas Essence',
    email: 'shazaditas.essence@festival.cl',
    phone: '+56 9 0000 0004',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-5',
    name: 'Ballet Shazaditas Styles',
    type: 'grupo',
    dancersCount: 12,
    contactPerson: 'Ballet Shazaditas Styles',
    email: 'shazaditas.styles@festival.cl',
    phone: '+56 9 0000 0005',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-6',
    name: 'Adriana Campos',
    type: 'solista',
    dancersCount: 1,
    contactPerson: 'Adriana Campos',
    email: 'adrianacampos@festival.cl',
    phone: '+56 9 0000 0006',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-7',
    name: 'Adarah Bellydance',
    type: 'grupo',
    dancersCount: 6,
    contactPerson: 'Adarah Bellydance',
    email: 'adarah@festival.cl',
    phone: '+56 9 0000 0007',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-8',
    name: 'Daisy Bustos Sánchez y Kardelens',
    type: 'grupo',
    dancersCount: 8,
    contactPerson: 'Daisy Bustos Sánchez',
    email: 'daisy.kardelens@festival.cl',
    phone: '+56 9 0000 0008',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-9',
    name: 'Priscilla Bellydancer',
    type: 'solista',
    dancersCount: 1,
    contactPerson: 'Priscilla Bellydancer',
    email: 'priscilla@festival.cl',
    phone: '+56 9 0000 0009',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-10',
    name: 'Escuela de danza Oriental Fabiola Andrade',
    type: 'grupo',
    dancersCount: 15,
    contactPerson: 'Fabiola Andrade',
    email: 'fabiola.andrade@festival.cl',
    phone: '+56 9 0000 0010',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-11',
    name: 'Danzaypilates Mahailamay',
    type: 'grupo',
    dancersCount: 10,
    contactPerson: 'Mahailamay',
    email: 'mahailamay@festival.cl',
    phone: '+56 9 0000 0011',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-12',
    name: 'Casandra Solista',
    type: 'solista',
    dancersCount: 1,
    contactPerson: 'Casandra Solista',
    email: 'casandra.solista@festival.cl',
    phone: '+56 9 0000 0012',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-13',
    name: 'Mabel Casandra Parra Albarran',
    type: 'solista',
    dancersCount: 1,
    contactPerson: 'Mabel Casandra Parra Albarran',
    email: 'mabel.casandra@festival.cl',
    phone: '+56 9 0000 0013',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-14',
    name: 'Arwamalshams',
    type: 'grupo',
    dancersCount: 8,
    contactPerson: 'Arwamalshams',
    email: 'arwamalshams@festival.cl',
    phone: '+56 9 0000 0014',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-15',
    name: 'Festival Raks El Hob',
    type: 'grupo',
    dancersCount: 10,
    contactPerson: 'Raks El Hob',
    email: 'rakselhob@festival.cl',
    phone: '+56 9 0000 0015',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-16',
    name: 'Ballet Arwahalazhar',
    type: 'grupo',
    dancersCount: 10,
    contactPerson: 'Arwahalazhar',
    email: 'arwahalazhar@festival.cl',
    phone: '+56 9 0000 0016',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-17',
    name: 'Sofía martinez',
    type: 'solista',
    dancersCount: 1,
    contactPerson: 'Sofía martinez',
    email: 'sofia.martinez@festival.cl',
    phone: '+56 9 0000 0017',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-18',
    name: 'Habibi Danza Cajón del Maipo',
    type: 'grupo',
    dancersCount: 8,
    contactPerson: 'Habibi Danza',
    email: 'habibidanza@festival.cl',
    phone: '+56 9 0000 0018',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-19',
    name: 'Escuela Willbellydancer',
    type: 'grupo',
    dancersCount: 12,
    contactPerson: 'Willbellydancer',
    email: 'willbellydancer@festival.cl',
    phone: '+56 9 0000 0019',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-20',
    name: 'Malaikas',
    type: 'grupo',
    dancersCount: 6,
    contactPerson: 'Malaikas',
    email: 'malaikas@festival.cl',
    phone: '+56 9 0000 0020',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-21',
    name: 'Zahra Al Ruh',
    type: 'grupo',
    dancersCount: 8,
    contactPerson: 'Zahra Al Ruh',
    email: 'zahra.alruh@festival.cl',
    phone: '+56 9 0000 0021',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-22',
    name: 'Alsabalal Farida Warda',
    type: 'grupo',
    dancersCount: 8,
    contactPerson: 'Alsabalal Farida Warda',
    email: 'alsabalal@festival.cl',
    phone: '+56 9 0000 0022',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-23',
    name: 'Nazarena',
    type: 'solista',
    dancersCount: 1,
    contactPerson: 'Nazarena',
    email: 'nazarena@festival.cl',
    phone: '+56 9 0000 0023',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-24',
    name: 'Raquel Farias',
    type: 'solista',
    dancersCount: 1,
    contactPerson: 'Raquel Farias',
    email: 'raquel.farias@festival.cl',
    phone: '+56 9 0000 0024',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-25',
    name: 'Diana Valle',
    type: 'solista',
    dancersCount: 1,
    contactPerson: 'Diana Valle',
    email: 'diana.valle@festival.cl',
    phone: '+56 9 0000 0025',
    assignedSeatsCount: 0,
  },
  {
    id: 'part-26',
    name: 'Anne Marie Lolas',
    type: 'solista',
    dancersCount: 1,
    contactPerson: 'Anne Marie Lolas',
    email: 'annemarie.lolas@festival.cl',
    phone: '+56 9 0000 0026',
    assignedSeatsCount: 0,
  },
];

export const INITIAL_ASSIGNMENTS: AssignmentRecord[] = [];

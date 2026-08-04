<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

$dataFile = __DIR__ . '/data_store.json';

// Function to generate standard 544 theater seats array if store is empty
function generateDefaultServerSeats() {
    $seats = [];
    $rows = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','AA font'];
    // Rows A to Z (26 rows x 20 seats = 520) + AA (24 seats) = 544 total seats
    $rowsConfig = [
        'A'=>20, 'B'=>20, 'C'=>20, 'D'=>20, 'E'=>20, 'F'=>20, 'G'=>20, 'H'=>20,
        'I'=>20, 'J'=>20, 'K'=>20, 'L'=>20, 'M'=>20, 'N'=>20, 'O'=>20, 'P'=>20,
        'Q'=>20, 'R'=>20, 'S'=>20, 'T'=>20, 'U'=>20, 'V'=>20, 'W'=>20, 'X'=>20,
        'Y'=>20, 'Z'=>20, 'AA'=>24
    ];

    foreach ($rowsConfig as $rowName => $count) {
        for ($i = 1; $i <= $count; $i++) {
            $id = $rowName . $i;
            $status = 'available';
            $assignedParticipantId = null;
            $assignedParticipantName = null;
            $ticketCode = null;
            $pdfFilename = null;

            // Default initial 20 assigned seats (Row A 1 to 20 assigned to Compañía Al Zahra)
            if ($rowName === 'A' && $i <= 20) {
                $status = 'assigned';
                $assignedParticipantId = 'p1';
                $assignedParticipantName = 'Compañía Al Zahra — 8 bailarinas (grupo)';
                $ticketCode = sprintf('A%06dFDVC2026-CL', $i);
                $pdfFilename = sprintf('FDVC2026-Entrada-FilaA-Asiento%d-CompañíaAlZahra.pdf', $i);
            }

            $seats[] = [
                'id' => $id,
                'row' => $rowName,
                'number' => $i,
                'status' => $status,
                'assignedParticipantId' => $assignedParticipantId,
                'assignedParticipantName' => $assignedParticipantName,
                'ticketCode' => $ticketCode,
                'pdfFilename' => $pdfFilename
            ];
        }
    }
    return $seats;
}

// Initialize data_store.json if it doesn't exist or is empty
if (!file_exists($dataFile) || filesize($dataFile) < 10) {
    $initialSeats = generateDefaultServerSeats();
    $initialData = [
        'seats' => $initialSeats,
        'participants' => [
            ['id' => 'p1', 'name' => 'Compañía Al Zahra — 8 bailarinas (grupo)', 'email' => 'alzahra.danza@gmail.com', 'assignedSeatsCount' => 20],
            ['id' => 'p2', 'name' => 'Ana Francisca Pizarro Ruiz', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p3', 'name' => 'Grupo Shazaditas Teens', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p4', 'name' => 'Grupo Shazaditas Evolution', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p5', 'name' => 'Grupo Shazaditas Essence', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p6', 'name' => 'Ballet Shazaditas Styles', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p7', 'name' => 'Adriana Campos', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p8', 'name' => 'Adarah Bellydance', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p9', 'name' => 'Daisy Bustos Sánchez y Kardelens', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p10', 'name' => 'Priscilla Bellydancer', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p11', 'name' => 'Escuela de danza Oriental Fabiola Andrade', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p12', 'name' => 'Danzaypilates Mahailamay', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p13', 'name' => 'Casandra Solista', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p14', 'name' => 'Mabel Casandra Parra Albarran', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p15', 'name' => 'Arwamalshams', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p16', 'name' => 'Festival Raks El Hob', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p17', 'name' => 'Ballet Arwahalazhar', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p18', 'name' => 'Sofía martinez', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p19', 'name' => 'Habibi Danza Cajón del Maipo', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p20', 'name' => 'Escuela Willbellydancer', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p21', 'name' => 'Malaikas', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p22', 'name' => 'Zahra Al Ruh', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p23', 'name' => 'Alsabalal Farida Warda', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p24', 'name' => 'Nazarena', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p25', 'name' => 'Raquel Farias', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p26', 'name' => 'Diana Valle', 'email' => '', 'assignedSeatsCount' => 0],
            ['id' => 'p27', 'name' => 'Anne Marie Lolas', 'email' => '', 'assignedSeatsCount' => 0],
        ],
        'assignments' => [
            [
                'id' => 'asgn-initial-1',
                'date' => date('d/m/Y H:i'),
                'participantId' => 'p1',
                'participantName' => 'Compañía Al Zahra — 8 bailarinas (grupo)',
                'seatIds' => ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20'],
                'sentToEmail' => 'alzahra.danza@gmail.com',
                'sentBy' => 'Sistema',
                'status' => 'Asignado'
            ]
        ],
        'scanLogs' => [],
        'lastUpdated' => date('c')
    ];
    file_put_contents($dataFile, json_encode($initialData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

// GET: Retrieve central shared state
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $content = file_get_contents($dataFile);
    if ($content === false) {
        echo json_encode(['error' => 'Unable to read data store']);
        exit(1);
    }
    echo $content;
    exit(0);
}

// POST: Update central shared state with Smart Merging
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $incoming = json_decode($input, true);

    if (!$incoming) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON input']);
        exit(1);
    }

    $existing = json_decode(file_get_contents($dataFile), true);
    if (!$existing || !isset($existing['seats'])) {
        $existing = [
            'seats' => generateDefaultServerSeats(),
            'participants' => [],
            'assignments' => [],
            'scanLogs' => []
        ];
    }

    // Smart Merge Seats: merge seat by seat by seat ID
    if (isset($incoming['seats']) && is_array($incoming['seats'])) {
        $seatsMap = [];
        foreach ($existing['seats'] as $s) {
            $seatsMap[$s['id']] = $s;
        }

        foreach ($incoming['seats'] as $incSeat) {
            $sid = $incSeat['id'];
            if (!isset($seatsMap[$sid])) {
                $seatsMap[$sid] = $incSeat;
            } else {
                $currentStatus = $seatsMap[$sid]['status'];
                $incStatus = $incSeat['status'];

                // Priority hierarchy for status updates: checked_in > sent > assigned > available
                // If incoming seat has a higher/equal priority status, update it
                $priority = ['available' => 1, 'assigned' => 2, 'sent' => 3, 'checked_in' => 4];
                $currentP = isset($priority[$currentStatus]) ? $priority[$currentStatus] : 1;
                $incP = isset($priority[$incStatus]) ? $priority[$incStatus] : 1;

                if ($incP >= $currentP) {
                    $seatsMap[$sid] = array_merge($seatsMap[$sid], $incSeat);
                }
            }
        }
        $existing['seats'] = array_values($seatsMap);
    }

    // Merge Participants
    if (isset($incoming['participants']) && is_array($incoming['participants'])) {
        $partMap = [];
        foreach ($existing['participants'] as $p) {
            $partMap[$p['id']] = $p;
        }
        foreach ($incoming['participants'] as $incP) {
            $partMap[$incP['id']] = $incP;
        }
        $existing['participants'] = array_values($partMap);
    }

    // Merge Assignments
    if (isset($incoming['assignments']) && is_array($incoming['assignments'])) {
        $asgnMap = [];
        foreach ($existing['assignments'] as $a) {
            $asgnMap[$a['id']] = $a;
        }
        foreach ($incoming['assignments'] as $incA) {
            $asgnMap[$incA['id']] = $incA;
        }
        $existing['assignments'] = array_values($asgnMap);
    }

    // Merge Scan Logs
    if (isset($incoming['scanLogs']) && is_array($incoming['scanLogs'])) {
        $logMap = [];
        foreach ($existing['scanLogs'] as $l) {
            $logMap[$l['id']] = $l;
        }
        foreach ($incoming['scanLogs'] as $incL) {
            $logMap[$incL['id']] = $incL;
        }
        // Sort scan logs descending by time/id
        $existing['scanLogs'] = array_values($logMap);
    }

    if (isset($incoming['newScanLog']) && is_array($incoming['newScanLog'])) {
        if (!isset($existing['scanLogs']) || !is_array($existing['scanLogs'])) {
            $existing['scanLogs'] = [];
        }
        array_unshift($existing['scanLogs'], $incoming['newScanLog']);
    }

    $existing['lastUpdated'] = date('c');

    $saved = file_put_contents($dataFile, json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

    if ($saved === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save data']);
        exit(1);
    }

    echo json_encode([
        'success' => true,
        'message' => 'Data synchronized successfully',
        'data' => $existing
    ]);
    exit(0);
}

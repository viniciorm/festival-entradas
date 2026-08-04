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

// Function to generate standard 544 theater seats array matching theater.ts (16 rows A-P x 34 seats = 544)
function generateDefaultServerSeats() {
    $seats = [];
    $rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
    $globalIndex = 1;

    foreach ($rows as $rowName) {
        for ($col = 1; $col <= 34; $col++) {
            $block = 'center';
            if ($col <= 8) {
                $block = 'left';
            } else if ($col >= 27) {
                $block = 'right';
            }

            $paddedNumber = sprintf('%06d', $globalIndex);
            $id = $rowName . $col;

            $seats[] = [
                'id' => $id,
                'row' => $rowName,
                'number' => $col,
                'paddedNumber' => $paddedNumber,
                'block' => $block,
                'status' => 'available',
                'assignedParticipantId' => null,
                'assignedParticipantName' => null,
                'ticketCode' => null,
                'pdfFilename' => sprintf('%s%sFDVC2026-CL.pdf', $rowName, $paddedNumber)
            ];

            $globalIndex++;
        }
    }
    return $seats;
}

function getDefaultParticipants() {
    return [
        ['id' => 'part-1', 'name' => 'Ana Francisca Pizarro Ruiz', 'type' => 'solista', 'dancersCount' => 1, 'contactPerson' => 'Ana Francisca Pizarro Ruiz', 'email' => 'anafrancisca@festival.cl', 'phone' => '+56 9 0000 0001', 'assignedSeatsCount' => 0],
        ['id' => 'part-2', 'name' => 'Grupo Shazaditas Teens', 'type' => 'grupo', 'dancersCount' => 8, 'contactPerson' => 'Shazaditas Teens', 'email' => 'shazaditas.teens@festival.cl', 'phone' => '+56 9 0000 0002', 'assignedSeatsCount' => 0],
        ['id' => 'part-3', 'name' => 'Grupo Shazaditas Evolution', 'type' => 'grupo', 'dancersCount' => 10, 'contactPerson' => 'Shazaditas Evolution', 'email' => 'shazaditas.evolution@festival.cl', 'phone' => '+56 9 0000 0003', 'assignedSeatsCount' => 0],
        ['id' => 'part-4', 'name' => 'Grupo Shazaditas Essence', 'type' => 'grupo', 'dancersCount' => 8, 'contactPerson' => 'Shazaditas Essence', 'email' => 'shazaditas.essence@festival.cl', 'phone' => '+56 9 0000 0004', 'assignedSeatsCount' => 0],
        ['id' => 'part-5', 'name' => 'Ballet Shazaditas Styles', 'type' => 'grupo', 'dancersCount' => 12, 'contactPerson' => 'Ballet Shazaditas Styles', 'email' => 'shazaditas.styles@festival.cl', 'phone' => '+56 9 0000 0005', 'assignedSeatsCount' => 0],
        ['id' => 'part-6', 'name' => 'Adriana Campos', 'type' => 'solista', 'dancersCount' => 1, 'contactPerson' => 'Adriana Campos', 'email' => 'adrianacampos@festival.cl', 'phone' => '+56 9 0000 0006', 'assignedSeatsCount' => 0],
        ['id' => 'part-7', 'name' => 'Adarah Bellydance', 'type' => 'grupo', 'dancersCount' => 6, 'contactPerson' => 'Adarah Bellydance', 'email' => 'adarah@festival.cl', 'phone' => '+56 9 0000 0007', 'assignedSeatsCount' => 0],
        ['id' => 'part-8', 'name' => 'Daisy Bustos Sánchez y Kardelens', 'type' => 'grupo', 'dancersCount' => 8, 'contactPerson' => 'Daisy Bustos Sánchez', 'email' => 'daisy.kardelens@festival.cl', 'phone' => '+56 9 0000 0008', 'assignedSeatsCount' => 0],
        ['id' => 'part-9', 'name' => 'Priscilla Bellydancer', 'type' => 'solista', 'dancersCount' => 1, 'contactPerson' => 'Priscilla Bellydancer', 'email' => 'priscilla@festival.cl', 'phone' => '+56 9 0000 0009', 'assignedSeatsCount' => 0],
        ['id' => 'part-10', 'name' => 'Escuela de danza Oriental Fabiola Andrade', 'type' => 'escuela', 'dancersCount' => 15, 'contactPerson' => 'Fabiola Andrade', 'email' => 'fabiola.andrade@festival.cl', 'phone' => '+56 9 0000 0010', 'assignedSeatsCount' => 0],
        ['id' => 'part-11', 'name' => 'Danzaypilates Mahailamay', 'type' => 'escuela', 'dancersCount' => 10, 'contactPerson' => 'Mahailamay', 'email' => 'mahailamay@festival.cl', 'phone' => '+56 9 0000 0011', 'assignedSeatsCount' => 0],
        ['id' => 'part-12', 'name' => 'Casandra Solista', 'type' => 'solista', 'dancersCount' => 1, 'contactPerson' => 'Casandra', 'email' => 'casandra@festival.cl', 'phone' => '+56 9 0000 0012', 'assignedSeatsCount' => 0],
        ['id' => 'part-13', 'name' => 'Mabel Casandra Parra Albarran', 'type' => 'solista', 'dancersCount' => 1, 'contactPerson' => 'Mabel Parra', 'email' => 'mabel.parra@festival.cl', 'phone' => '+56 9 0000 0013', 'assignedSeatsCount' => 0],
        ['id' => 'part-14', 'name' => 'Arwamalshams', 'type' => 'grupo', 'dancersCount' => 6, 'contactPerson' => 'Arwamalshams', 'email' => 'arwamalshams@festival.cl', 'phone' => '+56 9 0000 0014', 'assignedSeatsCount' => 0],
        ['id' => 'part-15', 'name' => 'Festival Raks El Hob', 'type' => 'escuela', 'dancersCount' => 12, 'contactPerson' => 'Raks El Hob', 'email' => 'rakselhob@festival.cl', 'phone' => '+56 9 0000 0015', 'assignedSeatsCount' => 0],
        ['id' => 'part-16', 'name' => 'Ballet Arwahalazhar', 'type' => 'grupo', 'dancersCount' => 8, 'contactPerson' => 'Ballet Arwahalazhar', 'email' => 'arwahalazhar@festival.cl', 'phone' => '+56 9 0000 0016', 'assignedSeatsCount' => 0],
        ['id' => 'part-17', 'name' => 'Sofía martinez', 'type' => 'solista', 'dancersCount' => 1, 'contactPerson' => 'Sofía Martinez', 'email' => 'sofia.martinez@festival.cl', 'phone' => '+56 9 0000 0017', 'assignedSeatsCount' => 0],
        ['id' => 'part-18', 'name' => 'Habibi Danza Cajón del Maipo', 'type' => 'escuela', 'dancersCount' => 10, 'contactPerson' => 'Habibi Danza', 'email' => 'habibi.cajondelmaipo@festival.cl', 'phone' => '+56 9 0000 0018', 'assignedSeatsCount' => 0],
        ['id' => 'part-19', 'name' => 'Escuela Willbellydancer', 'type' => 'escuela', 'dancersCount' => 12, 'contactPerson' => 'Willbellydancer', 'email' => 'willbellydancer@festival.cl', 'phone' => '+56 9 0000 0019', 'assignedSeatsCount' => 0],
        ['id' => 'part-20', 'name' => 'Malaikas', 'type' => 'grupo', 'dancersCount' => 6, 'contactPerson' => 'Malaikas', 'email' => 'malaikas@festival.cl', 'phone' => '+56 9 0000 0020', 'assignedSeatsCount' => 0],
        ['id' => 'part-21', 'name' => 'Zahra Al Ruh', 'type' => 'grupo', 'dancersCount' => 8, 'contactPerson' => 'Zahra Al Ruh', 'email' => 'zahra.alruh@festival.cl', 'phone' => '+56 9 0000 0021', 'assignedSeatsCount' => 0],
        ['id' => 'part-22', 'name' => 'Alsabalal Farida Warda', 'type' => 'grupo', 'dancersCount' => 8, 'contactPerson' => 'Alsabalal Farida Warda', 'email' => 'alsabalal@festival.cl', 'phone' => '+56 9 0000 0022', 'assignedSeatsCount' => 0],
        ['id' => 'part-23', 'name' => 'Nazarena', 'type' => 'solista', 'dancersCount' => 1, 'contactPerson' => 'Nazarena', 'email' => 'nazarena@festival.cl', 'phone' => '+56 9 0000 0023', 'assignedSeatsCount' => 0],
        ['id' => 'part-24', 'name' => 'Raquel Farias', 'type' => 'solista', 'dancersCount' => 1, 'contactPerson' => 'Raquel Farias', 'email' => 'raquel.farias@festival.cl', 'phone' => '+56 9 0000 0024', 'assignedSeatsCount' => 0],
        ['id' => 'part-25', 'name' => 'Diana Valle', 'type' => 'solista', 'dancersCount' => 1, 'contactPerson' => 'Diana Valle', 'email' => 'diana.valle@festival.cl', 'phone' => '+56 9 0000 0025', 'assignedSeatsCount' => 0],
        ['id' => 'part-26', 'name' => 'Anne Marie Lolas', 'type' => 'solista', 'dancersCount' => 1, 'contactPerson' => 'Anne Marie Lolas', 'email' => 'annemarie.lolas@festival.cl', 'phone' => '+56 9 0000 0026', 'assignedSeatsCount' => 0],
    ];
}

// Load existing data
$existingData = null;
if (file_exists($dataFile)) {
    $raw = file_get_contents($dataFile);
    $existingData = json_decode($raw, true);
}

// Check if seats exist and match the 34-column layout (checking seat 'A34')
$isValidLayout = false;
if ($existingData && isset($existingData['seats']) && is_array($existingData['seats']) && count($existingData['seats']) === 544) {
    foreach ($existingData['seats'] as $s) {
        if ($s['id'] === 'A34') {
            $isValidLayout = true;
            break;
        }
    }
}

if (!$isValidLayout) {
    $existingData = [
        'seats' => generateDefaultServerSeats(),
        'participants' => getDefaultParticipants(),
        'assignments' => [],
        'scanLogs' => isset($existingData['scanLogs']) && is_array($existingData['scanLogs']) ? $existingData['scanLogs'] : [],
        'lastUpdated' => date('c')
    ];
    file_put_contents($dataFile, json_encode($existingData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

// GET: Retrieve central shared state
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode($existingData, JSON_UNESCAPED_UNICODE);
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

    // Smart Merge Seats: merge seat by seat by seat ID
    if (isset($incoming['seats']) && is_array($incoming['seats']) && count($incoming['seats']) >= 500) {
        $seatsMap = [];
        foreach ($existingData['seats'] as $s) {
            $seatsMap[$s['id']] = $s;
        }

        foreach ($incoming['seats'] as $incSeat) {
            $sid = $incSeat['id'];
            if (isset($seatsMap[$sid])) {
                $currentStatus = $seatsMap[$sid]['status'];
                $incStatus = $incSeat['status'];

                $priority = ['available' => 1, 'assigned' => 2, 'sent' => 3, 'checked_in' => 4];
                $currentP = isset($priority[$currentStatus]) ? $priority[$currentStatus] : 1;
                $incP = isset($priority[$incStatus]) ? $priority[$incStatus] : 1;

                if ($incP >= $currentP) {
                    $seatsMap[$sid] = array_merge($seatsMap[$sid], $incSeat);
                }
            }
        }
        $existingData['seats'] = array_values($seatsMap);
    }

    // Merge Participants
    if (isset($incoming['participants']) && is_array($incoming['participants']) && count($incoming['participants']) > 0) {
        $partMap = [];
        foreach ($existingData['participants'] as $p) {
            $partMap[$p['id']] = $p;
        }
        foreach ($incoming['participants'] as $incP) {
            $partMap[$incP['id']] = $incP;
        }
        $existingData['participants'] = array_values($partMap);
    }

    // Merge Assignments
    if (isset($incoming['assignments']) && is_array($incoming['assignments'])) {
        $asgnMap = [];
        foreach ($existingData['assignments'] as $a) {
            $asgnMap[$a['id']] = $a;
        }
        foreach ($incoming['assignments'] as $incA) {
            $asgnMap[$incA['id']] = $incA;
        }
        $existingData['assignments'] = array_values($asgnMap);
    }

    // Merge Scan Logs
    if (isset($incoming['scanLogs']) && is_array($incoming['scanLogs'])) {
        $logMap = [];
        foreach ($existingData['scanLogs'] as $l) {
            $logMap[$l['id']] = $l;
        }
        foreach ($incoming['scanLogs'] as $incL) {
            $logMap[$incL['id']] = $incL;
        }
        $existingData['scanLogs'] = array_values($logMap);
    }

    if (isset($incoming['newScanLog']) && is_array($incoming['newScanLog'])) {
        if (!isset($existingData['scanLogs']) || !is_array($existingData['scanLogs'])) {
            $existingData['scanLogs'] = [];
        }
        array_unshift($existingData['scanLogs'], $incoming['newScanLog']);
    }

    $existingData['lastUpdated'] = date('c');

    $saved = file_put_contents($dataFile, json_encode($existingData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

    if ($saved === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save data']);
        exit(1);
    }

    echo json_encode([
        'success' => true,
        'message' => 'Data synchronized successfully',
        'data' => $existingData
    ]);
    exit(0);
}

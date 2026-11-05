<?php
/**
 * public/api/puerta-checkin.php
 * Endpoint de Alta Velocidad para Control de Acceso en Puerta (Validación y Check-in)
 * Festival Nacional Danza del Vientre Chile 2026
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

require_once __DIR__ . '/db_config.php';

function getPuertaDB() {
    $dbHost = defined('DB_HOST') ? DB_HOST : 'localhost';
    $dbName = defined('DB_NAME') ? DB_NAME : 'tupartne_festival';
    $dbUser = defined('DB_USER') ? DB_USER : 'tupartne_festival';
    $dbPass = defined('DB_PASS') ? DB_PASS : (getenv('MYSQL_PASSWORD') ?: '');

    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $dbHost, $dbName);
    $pdo = new PDO($dsn, $dbUser, $dbPass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

// ─── GET HANDLERS ────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? 'stats';

    try {
        $pdo = getPuertaDB();

        // 1. Live Door Statistics
        if ($action === 'stats') {
            $totalSeats = (int)$pdo->query("SELECT COUNT(*) FROM seats")->fetchColumn();
            $available  = (int)$pdo->query("SELECT COUNT(*) FROM seats WHERE status = 'available'")->fetchColumn();
            $checkedIn  = (int)$pdo->query("SELECT COUNT(*) FROM seats WHERE checked_in_at IS NOT NULL")->fetchColumn();
            $sold       = $totalSeats - $available;
            $pending    = max(0, $sold - $checkedIn);

            $recentScans = [];
            try {
                $stmt = $pdo->query("SELECT id, seat_id, row_name, seat_number, participant_name, status, message, created_at FROM scan_logs ORDER BY id DESC LIMIT 15");
                $recentScans = $stmt->fetchAll();
            } catch (Exception $e) {}

            echo json_encode([
                'success' => true,
                'stats'   => [
                    'totalSeats' => $totalSeats,
                    'available'  => $available,
                    'sold'       => $sold,
                    'checkedIn'  => $checkedIn,
                    'pending'    => $pending,
                ],
                'recentScans' => $recentScans,
                'ts'          => time()
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // 2. Search attendees by name, seat ID, or ticket code
        if ($action === 'search') {
            $q = trim($_GET['q'] ?? '');
            if (strlen($q) < 1) {
                echo json_encode(['success' => true, 'seats' => []]);
                exit(0);
            }

            $stmt = $pdo->prepare("
                SELECT id, row_name, seat_number, block, status, assigned_participant_name, ticket_code, checked_in_at
                FROM seats
                WHERE (
                    id LIKE :q1
                    OR assigned_participant_name LIKE :q2
                    OR ticket_code LIKE :q3
                )
                ORDER BY row_name, seat_number
                LIMIT 30
            ");
            $like = '%' . $q . '%';
            $stmt->execute([':q1' => $like, ':q2' => $like, ':q3' => $like]);
            $results = $stmt->fetchAll();

            echo json_encode(['success' => true, 'seats' => $results], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // 3. Get all sold/assigned seats for list view
        if ($action === 'all_sold') {
            $stmt = $pdo->query("
                SELECT id, row_name, seat_number, block, status, assigned_participant_name, ticket_code, checked_in_at
                FROM seats
                WHERE status != 'available' OR assigned_participant_name IS NOT NULL
                ORDER BY row_name, seat_number
            ");
            $seats = $stmt->fetchAll();
            echo json_encode(['success' => true, 'seats' => $seats], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error de base de datos en puerta', 'message' => $e->getMessage()]);
        exit(1);
    }
}

// ─── POST HANDLERS ───────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $inputRaw = file_get_contents('php://input');
    $payload  = json_decode($inputRaw, true);

    if (!$payload) {
        http_response_code(400);
        echo json_encode(['error' => 'Payload JSON inválido']);
        exit(1);
    }

    $action    = $payload['action'] ?? 'checkin';
    $rawToken  = trim($payload['token'] ?? $payload['seatId'] ?? $payload['code'] ?? '');
    $staffName = trim($payload['staffName'] ?? 'Control Puerta');

    if (empty($rawToken)) {
        http_response_code(400);
        echo json_encode(['error' => 'No se proporcionó código ni ID de asiento']);
        exit(1);
    }

    try {
        $pdo = getPuertaDB();

        // Resolve seatId from token (could be direct ID 'D12', verify URL token, or ticket code)
        $seatId = null;

        // Case 1: Token contains verify= or v= URL parameter
        if (strpos($rawToken, 'verify=') !== false || strpos($rawToken, 'v=') !== false) {
            $parts = parse_url($rawToken);
            if (isset($parts['query'])) {
                parse_str($parts['query'], $queryParts);
                $rawToken = $queryParts['verify'] ?? ($queryParts['v'] ?? $rawToken);
            }
        }

        // Case 2: Token is formatted like "B12.03D4-3EF7.signature"
        if (strpos($rawToken, '.') !== false) {
            $tokenPieces = explode('.', $rawToken);
            $potentialSeat = strtoupper(trim($tokenPieces[0]));
            if (preg_match('/^[A-P][0-9]{1,2}$/', $potentialSeat)) {
                $seatId = $potentialSeat;
            }
        }

        // Case 3: Raw Seat ID directly (e.g. "D12", "A1")
        if (!$seatId && preg_match('/^[A-P][0-9]{1,2}$/i', $rawToken)) {
            $seatId = strtoupper($rawToken);
        }

        // Find the seat in database (either by seatId or ticket_code)
        $seat = null;
        if ($seatId) {
            $stmt = $pdo->prepare("SELECT * FROM seats WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $seatId]);
            $seat = $stmt->fetch();
        }

        if (!$seat) {
            // Search by ticket_code
            $stmt = $pdo->prepare("SELECT * FROM seats WHERE ticket_code = :code LIMIT 1");
            $stmt->execute([':code' => $rawToken]);
            $seat = $stmt->fetch();
        }

        if (!$seat) {
            // Log unrecognized scan attempt
            try {
                $stmtLog = $pdo->prepare("
                    INSERT INTO scan_logs (seat_id, row_name, seat_number, participant_name, status, message, created_at)
                    VALUES (:seat_id, '', 0, 'Desconocido', 'fake', :msg, NOW())
                ");
                $stmtLog->execute([
                    ':seat_id' => substr($rawToken, 0, 30),
                    ':msg'     => 'Código no encontrado en la base de datos: ' . substr($rawToken, 0, 50),
                ]);
            } catch (Exception $e) {}

            echo json_encode([
                'success' => false,
                'status'  => 'fake',
                'title'   => 'CÓDIGO NO REGISTRADO',
                'message' => 'El código escaneado no corresponde a ninguna entrada oficial del festival.',
                'rawToken'=> $rawToken
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // If action is verification only (without checkin)
        if ($action === 'verify_only') {
            echo json_encode([
                'success'     => true,
                'status'      => !empty($seat['checked_in_at']) ? 'already_used' : 'valid',
                'seat'        => [
                    'id'                      => $seat['id'],
                    'row'                     => $seat['row_name'],
                    'number'                  => (int)$seat['seat_number'],
                    'block'                   => $seat['block'],
                    'assignedParticipantName' => $seat['assigned_participant_name'] ?: 'Entrada General',
                    'ticketCode'              => $seat['ticket_code'],
                    'checkedInAt'             => $seat['checked_in_at'],
                ]
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // Check if uncheckin is requested
        if ($action === 'uncheckin') {
            $newStatus = !empty($seat['blocked_reason']) ? 'blocked' : 'occupied';
            $stmtUpd = $pdo->prepare("UPDATE seats SET checked_in_at = NULL, status = :status WHERE id = :id");
            $stmtUpd->execute([':status' => $newStatus, ':id' => $seat['id']]);

            try {
                $stmtLog = $pdo->prepare("
                    INSERT INTO scan_logs (seat_id, row_name, seat_number, participant_name, status, message, created_at)
                    VALUES (:seat_id, :row, :num, :name, 'cancelled', :msg, NOW())
                ");
                $stmtLog->execute([
                    ':seat_id' => $seat['id'],
                    ':row'     => $seat['row_name'],
                    ':num'     => (int)$seat['seat_number'],
                    ':name'    => $seat['assigned_participant_name'] ?: 'Asistente',
                    ':msg'     => 'Check-in anulado manualmente por ' . $staffName,
                ]);
            } catch (Exception $e) {}

            echo json_encode([
                'success' => true,
                'message' => 'Check-in anulado. La butaca vuelve a su estado anterior.',
                'seatId'  => $seat['id'],
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // Standard Check-in validation logic
        // 1. If seat is already checked in
        if (!empty($seat['checked_in_at'])) {
            $formattedTime = date('H:i:s d/m/Y', strtotime($seat['checked_in_at']));

            try {
                $stmtLog = $pdo->prepare("
                    INSERT INTO scan_logs (seat_id, row_name, seat_number, participant_name, status, message, created_at)
                    VALUES (:seat_id, :row, :num, :name, 'already_used', :msg, NOW())
                ");
                $stmtLog->execute([
                    ':seat_id' => $seat['id'],
                    ':row'     => $seat['row_name'],
                    ':num'     => (int)$seat['seat_number'],
                    ':name'    => $seat['assigned_participant_name'] ?: 'Asistente',
                    ':msg'     => 'RE-INGRESO RECHAZADO. Ingresó previamente a las ' . $formattedTime,
                ]);
            } catch (Exception $e) {}

            echo json_encode([
                'success'     => false,
                'status'      => 'already_used',
                'title'       => 'ENTRADA YA UTILIZADA',
                'message'     => "Esta entrada ya registró su ingreso a las {$formattedTime}.",
                'seat'        => [
                    'id'                      => $seat['id'],
                    'row'                     => $seat['row_name'],
                    'number'                  => (int)$seat['seat_number'],
                    'block'                   => $seat['block'],
                    'assignedParticipantName' => $seat['assigned_participant_name'] ?: 'Asistente',
                    'ticketCode'              => $seat['ticket_code'],
                    'checkedInAt'             => $seat['checked_in_at'],
                ]
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // 2. If seat is BLOCKED (mala visión, técnica, reservada producción)
        if ($seat['status'] === 'blocked' || !empty($seat['blocked_reason'])) {
            $reason = !empty($seat['blocked_reason']) ? $seat['blocked_reason'] : 'Mala visión / No habilitada';
            echo json_encode([
                'success' => false,
                'status'  => 'blocked',
                'title'   => 'BUTACA BLOQUEADA / NO HABILITADA',
                'message' => "La butaca {$seat['id']} (Fila {$seat['row_name']} - Asiento {$seat['seat_number']}) está BLOQUEADA por la organización ({$reason}) y NO corresponde a una entrada válida.",
                'seat'    => [
                    'id'     => $seat['id'],
                    'row'    => $seat['row_name'],
                    'number' => (int)$seat['seat_number'],
                    'block'  => $seat['block'],
                ]
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // 3. If seat is NOT purchased or assigned (still available)
        $isSoldOrAssigned = in_array($seat['status'], ['occupied', 'invitation'])
            || !empty($seat['assigned_participant_name'])
            || !empty($seat['ticket_code']);

        if ($seat['status'] === 'available' || !$isSoldOrAssigned) {
            echo json_encode([
                'success' => false,
                'status'  => 'not_sold',
                'title'   => 'BUTACA NO VENDIDA',
                'message' => "La butaca {$seat['id']} (Fila {$seat['row_name']} - Asiento {$seat['seat_number']}) figura como DISPONIBLE en la ticketera y NO ha sido comprada ni asignada a nadie.",
                'seat'    => [
                    'id'     => $seat['id'],
                    'row'    => $seat['row_name'],
                    'number' => (int)$seat['seat_number'],
                    'block'  => $seat['block'],
                ]
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // 3. Valid ticket -> Execute Check-in!
        $now = date('Y-m-d H:i:s');
        $stmtUpd = $pdo->prepare("
            UPDATE seats
            SET checked_in_at = :now, status = 'checked_in'
            WHERE id = :id
        ");
        $stmtUpd->execute([
            ':now' => $now,
            ':id'  => $seat['id'],
        ]);

        try {
            $stmtLog = $pdo->prepare("
                INSERT INTO scan_logs (seat_id, row_name, seat_number, participant_name, status, message, created_at)
                VALUES (:seat_id, :row, :num, :name, 'valid', :msg, NOW())
            ");
            $stmtLog->execute([
                ':seat_id' => $seat['id'],
                ':row'     => $seat['row_name'],
                ':num'     => (int)$seat['seat_number'],
                ':name'    => $seat['assigned_participant_name'] ?: 'Entrada General',
                ':msg'     => 'Ingreso autorizado en puerta por ' . $staffName,
            ]);
        } catch (Exception $e) {}

        echo json_encode([
            'success'     => true,
            'status'      => 'valid',
            'title'       => '¡INGRESO AUTORIZADO!',
            'message'     => 'Entrada legítima confirmada con éxito.',
            'checkedInAt' => $now,
            'seat'        => [
                'id'                      => $seat['id'],
                'row'                     => $seat['row_name'],
                'number'                  => (int)$seat['seat_number'],
                'block'                   => $seat['block'],
                'assignedParticipantName' => $seat['assigned_participant_name'] ?: 'Entrada General',
                'ticketCode'              => $seat['ticket_code'],
                'checkedInAt'             => $now,
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit(0);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al procesar check-in en puerta', 'message' => $e->getMessage()]);
        exit(1);
    }
}

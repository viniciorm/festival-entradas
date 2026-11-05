<?php
/**
 * public/api/sync-data.php
 * Endpoint de Sincronización y Lectura de Datos desde la Base de Datos Real MySQL (tupartne_festival).
 * 
 * NORMAS DE SEGURIDAD Y LECTURA ESTRICTA:
 * 1. Conexión directa a MySQL tupartne_festival usando credenciales de db_config.php.
 * 2. Si la conexión o consulta falla, retorna un error HTTP 500 explícito. NUNCA datos dummy ni SQLite.
 * 3. CERO ejecuciones de UPDATE, INSERT o regeneración de la tabla seats en peticiones GET.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Load MySQL DB Configuration
if (file_exists(__DIR__ . '/db_config.php')) {
    require_once __DIR__ . '/db_config.php';
}

function getDBConnection() {
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

// ─── GET REQUEST HANDLER (PURE READ-ONLY) ───────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    // 1. Public Endpoint: ?public=1
    if (isset($_GET['public']) && $_GET['public'] === '1') {
        try {
            $pdo = getDBConnection();

            // Automatic atomic cleanup of expired 15-min reservations
            releaseExpiredReservations($pdo);

            $stmt = $pdo->query("SELECT id, row_name, seat_number, block, status FROM seats ORDER BY row_name, seat_number");
            $rows = $stmt->fetchAll();

            $publicSeats = array_map(function($s) {
                return [
                    'id'          => $s['id'],
                    'row_name'    => $s['row_name'],
                    'seat_number' => (int)$s['seat_number'],
                    'block'       => $s['block'] ?: ($s['seat_number'] <= 8 ? 'left' : ($s['seat_number'] >= 27 ? 'right' : 'center')),
                    // Anything not available is occupied for public
                    'status'      => ($s['status'] === 'available') ? 'available' : 'occupied',
                ];
            }, $rows);

            echo json_encode(['seats' => $publicSeats, 'ts' => time()], JSON_UNESCAPED_UNICODE);
            exit(0);
        } catch (Exception $e) {
            error_log('Sync Data Public Error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'error'   => 'No pudimos cargar la disponibilidad en este momento. Por favor recarga la página.'
            ], JSON_UNESCAPED_UNICODE);
            exit(1);
        }
    }

    // 2. Admin Endpoint: Full Inventory & State
    try {
        $pdo = getDBConnection();
        releaseExpiredReservations($pdo);

        $seatRows = $pdo->query("SELECT id, row_name, seat_number, padded_number, block, status, assigned_participant_id, assigned_participant_name, ticket_code, pdf_filename, checked_in_at, blocked_reason, blocked_notes, blocked_at, blocked_by FROM seats ORDER BY row_name, seat_number")->fetchAll();

        $seats = array_map(function($s) {
            return [
                'id'                      => $s['id'],
                'row'                     => $s['row_name'],
                'number'                  => (int)$s['seat_number'],
                'paddedNumber'            => $s['padded_number'],
                'block'                   => $s['block'] ?: ($s['seat_number'] <= 8 ? 'left' : ($s['seat_number'] >= 27 ? 'right' : 'center')),
                'status'                  => $s['status'],
                'assignedParticipantId'   => $s['assigned_participant_id'],
                'assignedParticipantName' => $s['assigned_participant_name'],
                'ticketCode'              => $s['ticket_code'],
                'pdfFilename'             => $s['pdf_filename'],
                'checkedInAt'             => $s['checked_in_at'],
                'blockedReason'           => $s['blocked_reason'] ?? null,
                'blockedNotes'            => $s['blocked_notes'] ?? null,
                'blockedAt'               => $s['blocked_at'] ?? null,
                'blockedBy'               => $s['blocked_by'] ?? null,
            ];
        }, $seatRows);

        $rawParticipants = $pdo->query("SELECT * FROM participants ORDER BY name ASC")->fetchAll();
        $participants = array_map(function($p) {
            return [
                'id'                 => $p['id'],
                'name'               => $p['name'],
                'type'               => $p['type'] ?? 'grupo',
                'dancersCount'       => (int)($p['dancers_count'] ?? 1),
                'contactPerson'      => $p['contact_person'] ?? '',
                'email'              => $p['email'] ?? '',
                'phone'              => $p['phone'] ?? '',
                'school'             => $p['school'] ?? '',
                'teacher'            => $p['teacher'] ?? '',
                'instagram'          => $p['instagram'] ?? '',
                'facebook'           => $p['facebook'] ?? '',
                'tiktok'             => $p['tiktok'] ?? '',
                'assignedSeatsCount' => (int)($p['assigned_seats_count'] ?? 0),
            ];
        }, $rawParticipants);

        $rawAssignments  = $pdo->query("SELECT * FROM assignments ORDER BY id DESC")->fetchAll();
        $assignments = array_map(function($a) {
            $rawSeatData = $a['seat_ids_json'] ?? $a['seat_ids'] ?? $a['seats_json'] ?? '';
            $seatIds = [];
            if (!empty($rawSeatData)) {
                if (is_string($rawSeatData)) {
                    $decoded = json_decode($rawSeatData, true);
                    $seatIds = is_array($decoded) ? $decoded : explode(',', $rawSeatData);
                } elseif (is_array($rawSeatData)) {
                    $seatIds = $rawSeatData;
                }
            }
            return [
                'id'               => (string)$a['id'],
                'date'             => $a['date_str'] ?? $a['date'] ?? date('d/m/Y H:i'),
                'participantId'    => $a['participant_id'] ?? '',
                'participantName'  => $a['participant_name'] ?? '',
                'seatIds'          => array_values(array_filter(array_map('trim', $seatIds))),
                'sentToEmail'      => $a['sent_to_email'] ?? $a['email'] ?? '',
                'sentBy'           => $a['sent_by'] ?? 'Festival Danza del Vientre',
                'status'           => $a['status'] ?? 'Enviado',
                'pdfFilename'      => $a['pdf_filename'] ?? '',
            ];
        }, $rawAssignments);

        $scanLogs     = [];
        try {
            $rawLogs = $pdo->query("SELECT * FROM scan_logs ORDER BY id DESC LIMIT 100")->fetchAll();
            $scanLogs = array_map(function($l) {
                return [
                    'id'              => (string)$l['id'],
                    'time'            => $l['time_str'] ?? $l['created_at'] ?? '',
                    'seatId'          => $l['seat_id'] ?? '',
                    'row'             => $l['row_name'] ?? '',
                    'number'          => (int)($l['seat_number'] ?? 0),
                    'participantName' => $l['participant_name'] ?? '',
                    'status'          => $l['status'] ?? 'valid',
                    'message'         => $l['message'] ?? '',
                ];
            }, $rawLogs);
        } catch (Exception $e) {}

        $invitations  = [];
        try {
            $rawInvs = $pdo->query("SELECT * FROM invitations ORDER BY id DESC")->fetchAll();
            $invitations = array_map(function($inv) {
                $rawSeatData = $inv['seat_ids_json'] ?? $inv['seat_ids'] ?? $inv['seats_json'] ?? '';
                $seatIds = [];
                if (!empty($rawSeatData)) {
                    if (is_string($rawSeatData)) {
                        $decoded = json_decode($rawSeatData, true);
                        $seatIds = is_array($decoded) ? $decoded : explode(',', $rawSeatData);
                    } elseif (is_array($rawSeatData)) {
                        $seatIds = $rawSeatData;
                    }
                }
                return [
                    'id'            => (string)$inv['id'],
                    'guestName'     => $inv['guest_name'] ?? $inv['name'] ?? '',
                    'guestEmail'    => $inv['guest_email'] ?? $inv['email'] ?? '',
                    'guestPhone'    => $inv['guest_phone'] ?? $inv['phone'] ?? '',
                    'seatIds'       => array_values(array_filter(array_map('trim', $seatIds))),
                    'reason'        => $inv['reason'] ?? '',
                    'internalNotes' => $inv['internal_notes'] ?? '',
                    'status'        => $inv['status'] ?? 'sent',
                    'createdAt'     => $inv['created_at'] ?? '',
                    'sentAt'        => $inv['sent_at'] ?? '',
                ];
            }, $rawInvs);
        } catch (Exception $e) {}

        $discounts    = [];
        try {
            $discounts = $pdo->query("SELECT * FROM discounts")->fetchAll();
        } catch (Exception $e) {}

        echo json_encode([
            'seats'        => $seats,
            'participants' => $participants,
            'assignments'  => $assignments,
            'scanLogs'     => $scanLogs,
            'invitations'  => $invitations,
            'discounts'    => $discounts,
            'ts'           => time(),
        ], JSON_UNESCAPED_UNICODE);
        exit(0);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error'   => 'No se pudo cargar el inventario real desde la base de datos tupartne_festival',
            'message' => $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
        exit(1);
    }
}

// ─── POST REQUEST HANDLER (Atomic Updates) ───────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $inputRaw = file_get_contents('php://input');
    $payload  = json_decode($inputRaw, true);

    if (!$payload) {
        http_response_code(400);
        echo json_encode(['error' => 'Payload JSON inválido']);
        exit(1);
    }

    try {
        $pdo = getDBConnection();
        $pdo->beginTransaction();

        // 1. Partial/Delta Seats Update (Only update changed seats)
        if (isset($payload['changedSeats']) && is_array($payload['changedSeats'])) {
            $stmtUpdSeat = $pdo->prepare("
                UPDATE seats SET
                    status = :status,
                    assigned_participant_id = :part_id,
                    assigned_participant_name = :part_name,
                    ticket_code = :code,
                    pdf_filename = :pdf,
                    checked_in_at = :checked_in
                WHERE id = :id
            ");

            foreach ($payload['changedSeats'] as $s) {
                $stmtUpdSeat->execute([
                    ':id'         => $s['id'],
                    ':status'     => $s['status'],
                    ':part_id'    => $s['assignedParticipantId'] ?? null,
                    ':part_name'  => $s['assignedParticipantName'] ?? null,
                    ':code'       => $s['ticketCode'] ?? null,
                    ':pdf'        => $s['pdfFilename'] ?? null,
                    ':checked_in' => $s['checkedInAt'] ?? null,
                ]);
            }
        }

        // 2. Participants Update
        if (isset($payload['participants']) && is_array($payload['participants'])) {
            $stmtUpdPart = $pdo->prepare("
                INSERT INTO participants (id, name, type, dancers_count, contact_person, email, phone, school, teacher, instagram, facebook, tiktok, assigned_seats_count)
                VALUES (:id, :name, :type, :dancers, :contact, :email, :phone, :school, :teacher, :ig, :fb, :tt, :count)
                ON DUPLICATE KEY UPDATE
                    assigned_seats_count = VALUES(assigned_seats_count),
                    name = VALUES(name),
                    email = VALUES(email),
                    phone = VALUES(phone)
            ");

            foreach ($payload['participants'] as $p) {
                $stmtUpdPart->execute([
                    ':id'      => $p['id'],
                    ':name'    => $p['name'],
                    ':type'    => $p['type'] ?? 'grupo',
                    ':dancers' => $p['dancersCount'] ?? 1,
                    ':contact' => $p['contactPerson'] ?? '',
                    ':email'   => $p['email'] ?? '',
                    ':phone'   => $p['phone'] ?? '',
                    ':school'  => $p['school'] ?? '',
                    ':teacher' => $p['teacher'] ?? '',
                    ':ig'      => $p['instagram'] ?? '',
                    ':fb'      => $p['facebook'] ?? '',
                    ':tt'      => $p['tiktok'] ?? '',
                    ':count'   => $p['assignedSeatsCount'] ?? 0,
                ]);
            }
        }

        // 3. New Assignment Record
        if (isset($payload['newAssignment']) && is_array($payload['newAssignment'])) {
            $a = $payload['newAssignment'];
            $stmtUpdAssign = $pdo->prepare("
                INSERT INTO assignments (id, date_str, participant_id, participant_name, seat_ids_json, sent_to_email, sent_by, status)
                VALUES (:id, :date_str, :part_id, :part_name, :seats_json, :email, :sent_by, :status)
                ON DUPLICATE KEY UPDATE status = VALUES(status)
            ");
            $stmtUpdAssign->execute([
                ':id'         => $a['id'],
                ':date_str'   => $a['dateStr'] ?? date('c'),
                ':part_id'    => $a['participantId'] ?? '',
                ':part_name'  => $a['participantName'] ?? '',
                ':seats_json' => is_array($a['seatIds']) ? json_encode($a['seatIds']) : ($a['seatIdsJson'] ?? '[]'),
                ':email'      => $a['sentToEmail'] ?? '',
                ':sent_by'    => $a['sentBy'] ?? 'Admin',
                ':status'     => $a['status'] ?? 'Enviado',
            ]);
        }

        $pdo->commit();
        echo json_encode(['success' => true, 'ts' => time()]);
        exit(0);
    } catch (Exception $e) {
        if (isset($pdo) && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode(['error' => 'Error al guardar cambios en la base de datos', 'message' => $e->getMessage()]);
        exit(1);
    }
}

<?php
/**
 * public/api/admin/invitations.php
 * Endpoint de gestión de invitaciones con validación atómica rigurosa (SELECT ... FOR UPDATE).
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Cargar configuración de BD
if (file_exists(__DIR__ . '/../db_config.php')) {
    require_once __DIR__ . '/../db_config.php';
}

function getAdminDBConnection() {
    if (defined('DB_TYPE') && DB_TYPE === 'mysql' && defined('DB_NAME') && DB_NAME !== 'festiva1_entradas') {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
        $pdo = new PDO($dsn, DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        // Ensure table exists idempotently without impacting other tables
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS invitations (
                id VARCHAR(64) PRIMARY KEY,
                guest_name VARCHAR(255) NOT NULL,
                guest_email VARCHAR(255) NOT NULL,
                guest_phone VARCHAR(64) DEFAULT '',
                seat_ids_json TEXT NOT NULL,
                reason VARCHAR(128) DEFAULT 'cortesía',
                internal_notes TEXT NULL,
                created_by VARCHAR(255) DEFAULT 'Administrador',
                created_at VARCHAR(64) NOT NULL,
                sent_at VARCHAR(64) NULL,
                send_status VARCHAR(32) DEFAULT 'sent',
                status VARCHAR(32) DEFAULT 'valid',
                cancelled_at VARCHAR(64) NULL,
                cancelled_by VARCHAR(255) NULL,
                cancel_reason VARCHAR(255) NULL,
                resend_count INT DEFAULT 0,
                last_resent_at VARCHAR(64) NULL,
                last_resent_by VARCHAR(255) NULL,
                INDEX idx_inv_status (status),
                INDEX idx_inv_email (guest_email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        return $pdo;
    }
    $dbFile = __DIR__ . '/../festival_database.sqlite';
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? strtolower(trim($_GET['action'])) : ($method === 'POST' ? 'create' : 'list');

try {
    $pdo = getAdminDBConnection();

    // ── 1. LIST INVITATIONS (GET or action=list) ─────────────────────────────
    if ($action === 'list' && $method === 'GET') {
        $stmt = $pdo->query("SELECT * FROM invitations ORDER BY created_at DESC");
        $invitations = array_map(function($r) {
            return [
                'id'           => $r['id'],
                'guestName'    => $r['guest_name'],
                'guestEmail'   => $r['guest_email'],
                'guestPhone'   => isset($r['guest_phone']) ? $r['guest_phone'] : '',
                'seatIds'      => json_decode($r['seat_ids_json'], true) ?: [],
                'reason'       => isset($r['reason']) ? $r['reason'] : 'cortesía',
                'internalNotes'=> isset($r['internal_notes']) ? $r['internal_notes'] : '',
                'createdBy'    => $r['created_by'],
                'createdAt'    => $r['created_at'],
                'sentAt'       => isset($r['sent_at']) ? $r['sent_at'] : null,
                'sendStatus'   => isset($r['send_status']) ? $r['send_status'] : 'sent',
                'status'       => $r['status'],
                'cancelledAt'  => isset($r['cancelled_at']) ? $r['cancelled_at'] : null,
                'cancelledBy'  => isset($r['cancelled_by']) ? $r['cancelled_by'] : null,
                'cancelReason' => isset($r['cancel_reason']) ? $r['cancel_reason'] : null,
                'resendCount'  => isset($r['resend_count']) ? (int)$r['resend_count'] : 0,
                'lastResentAt' => isset($r['last_resent_at']) ? $r['last_resent_at'] : null,
                'lastResentBy' => isset($r['last_resent_by']) ? $r['last_resent_by'] : null,
            ];
        }, $stmt->fetchAll());

        echo json_encode(['success' => true, 'invitations' => $invitations], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

    // ── 2. POST ACTIONS (create, cancel, resend) ─────────────────────────────
    if ($method === 'POST') {
        $inputRaw = file_get_contents('php://input');
        $data = json_decode($inputRaw, true) ?: $_POST;

        // ── ACTION: CANCEL INVITATION ────────────────────────────────────────
        if ($action === 'cancel') {
            $invitationId = isset($data['invitationId']) ? trim($data['invitationId']) : '';
            $cancelledBy  = isset($data['cancelledBy']) ? trim($data['cancelledBy']) : 'Administrador';
            $cancelReason = isset($data['cancelReason']) ? trim($data['cancelReason']) : 'Anulada desde panel admin';

            if (!$invitationId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Falta invitationId']);
                exit(1);
            }

            $pdo->beginTransaction();

            // Lock invitation record
            $stmtInv = $pdo->prepare("SELECT * FROM invitations WHERE id = :id FOR UPDATE");
            $stmtInv->execute([':id' => $invitationId]);
            $invitation = $stmtInv->fetch();

            if (!$invitation) {
                $pdo->rollBack();
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Invitación no encontrada']);
                exit(1);
            }

            if ($invitation['status'] === 'cancelled') {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'La invitación ya fue anulada previamente']);
                exit(1);
            }

            $seatIds = json_decode($invitation['seat_ids_json'], true) ?: [];

            // Check if ANY seat of this invitation has been checked in (used in gate)
            if (!empty($seatIds)) {
                $placeholders = implode(',', array_fill(0, count($seatIds), '?'));
                $stmtCheckGate = $pdo->prepare("SELECT id, row_name, seat_number, status, checked_in_at FROM seats WHERE id IN ($placeholders)");
                $stmtCheckGate->execute($seatIds);
                $seatStates = $stmtCheckGate->fetchAll();

                foreach ($seatStates as $st) {
                    if ($st['status'] === 'checked_in' || !empty($st['checked_in_at'])) {
                        $pdo->rollBack();
                        http_response_code(400);
                        echo json_encode([
                            'success' => false,
                            'error'   => sprintf(
                                '🚫 No se puede anular la invitación: La entrada para el asiento Fila %s N° %d ya fue ingresada en puerta a las %s.',
                                $st['row_name'],
                                $st['seat_number'],
                                $st['checked_in_at'] ?: 'hora anterior'
                            )
                        ], JSON_UNESCAPED_UNICODE);
                        exit(1);
                    }
                }
            }

            // Perform cancellation: update invitation record
            $stmtUpdateInv = $pdo->prepare("
                UPDATE invitations SET
                    status = 'cancelled',
                    cancelled_at = :cancelled_at,
                    cancelled_by = :cancelled_by,
                    cancel_reason = :cancel_reason
                WHERE id = :id
            ");
            $stmtUpdateInv->execute([
                ':id'           => $invitationId,
                ':cancelled_at' => date('c'),
                ':cancelled_by' => $cancelledBy,
                ':cancel_reason'=> $cancelReason,
            ]);

            // Release seats back to 'available'
            if (!empty($seatIds)) {
                $placeholders = implode(',', array_fill(0, count($seatIds), '?'));
                $stmtFreeSeats = $pdo->prepare("
                    UPDATE seats SET
                        status = 'available',
                        assigned_participant_id = NULL,
                        assigned_participant_name = NULL,
                        ticket_code = NULL
                    WHERE id IN ($placeholders)
                ");
                $stmtFreeSeats->execute($seatIds);
            }

            $pdo->commit();

            echo json_encode(['success' => true, 'message' => 'Invitación anulada exitosamente. Las butacas han sido liberadas.'], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // ── ACTION: RESEND INVITATION ────────────────────────────────────────
        if ($action === 'resend') {
            $invitationId = isset($data['invitationId']) ? trim($data['invitationId']) : '';
            $resentBy     = isset($data['resentBy']) ? trim($data['resentBy']) : 'Administrador';

            if (!$invitationId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Falta invitationId']);
                exit(1);
            }

            $stmtUpdateResend = $pdo->prepare("
                UPDATE invitations SET
                    resend_count = COALESCE(resend_count, 0) + 1,
                    last_resent_at = :last_resent_at,
                    last_resent_by = :last_resent_by
                WHERE id = :id
            ");
            $stmtUpdateResend->execute([
                ':id'            => $invitationId,
                ':last_resent_at'=> date('c'),
                ':last_resent_by'=> $resentBy
            ]);

            echo json_encode(['success' => true, 'message' => 'Registro de reenvío actualizado.'], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // ── ACTION: CREATE INVITATION (Default POST) ──────────────────────────
        $guestName     = isset($data['guestName']) ? trim($data['guestName']) : '';
        $guestEmail    = isset($data['guestEmail']) ? trim($data['guestEmail']) : '';
        $guestPhone    = isset($data['guestPhone']) ? trim($data['guestPhone']) : '';
        $seatIds       = (isset($data['seatIds']) && is_array($data['seatIds'])) ? $data['seatIds'] : [];
        $reason        = isset($data['reason']) ? trim($data['reason']) : 'cortesía';
        $internalNotes = isset($data['internalNotes']) ? trim($data['internalNotes']) : '';
        $createdBy     = isset($data['createdBy']) ? trim($data['createdBy']) : 'Administrador';

        if (!$guestName || !$guestEmail || empty($seatIds)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Nombre, correo y al menos un asiento son requeridos']);
            exit(1);
        }

        $pdo->beginTransaction();

        // 🔒 RIGOROUS ATOMIC AVAILABILITY CHECK WITH FOR UPDATE
        // Lock ALL requested seat IDs in seats table
        $placeholders = implode(',', array_fill(0, count($seatIds), '?'));
        $stmtLock = $pdo->prepare("SELECT id, row_name, seat_number, status FROM seats WHERE id IN ($placeholders) FOR UPDATE");
        $stmtLock->execute($seatIds);
        $lockedSeats = $stmtLock->fetchAll();

        // Verify that ALL requested seats were found and are strictly 'available'
        $foundMap = [];
        $unavailable = [];
        foreach ($lockedSeats as $s) {
            $foundMap[$s['id']] = $s;
            if ($s['status'] !== 'available') {
                $unavailable[] = sprintf('%s (Fila %s N° %d)', $s['id'], $s['row_name'], $s['seat_number']);
            }
        }

        // Check for missing seat IDs
        foreach ($seatIds as $sid) {
            if (!isset($foundMap[$sid])) {
                $unavailable[] = $sid;
            }
        }

        if (!empty($unavailable)) {
            $pdo->rollBack();
            http_response_code(409); // Conflict
            echo json_encode([
                'success' => false,
                'error'   => '🚫 Transacción cancelada: Las siguientes butacas ya no están disponibles: ' . implode(', ', $unavailable)
            ], JSON_UNESCAPED_UNICODE);
            exit(1);
        }

        // All seats are verified available -> Assign status = 'invitation'
        $invitationId = 'INV-' . date('Ymd') . '-' . strtoupper(substr(md5(uniqid()), 0, 6));

        $stmtAssignSeat = $pdo->prepare("
            UPDATE seats SET
                status = 'invitation',
                assigned_participant_id = NULL,
                assigned_participant_name = :guest_name
            WHERE id = :id
        ");

        foreach ($seatIds as $sid) {
            $stmtAssignSeat->execute([
                ':guest_name' => $guestName,
                ':id'         => $sid
            ]);
        }

        // Insert invitation record
        $nowStr = date('c');
        $stmtInsertInv = $pdo->prepare("
            INSERT INTO invitations (
                id, guest_name, guest_email, guest_phone, seat_ids_json,
                reason, internal_notes, created_by, created_at, sent_at,
                send_status, status, resend_count
            ) VALUES (
                :id, :guest_name, :guest_email, :guest_phone, :seat_ids_json,
                :reason, :internal_notes, :created_by, :created_at, :sent_at,
                'sent', 'valid', 0
            )
        ");

        $stmtInsertInv->execute([
            ':id'            => $invitationId,
            ':guest_name'    => $guestName,
            ':guest_email'   => $guestEmail,
            ':guest_phone'   => $guestPhone,
            ':seat_ids_json' => json_encode($seatIds),
            ':reason'        => $reason,
            ':internal_notes'=> $internalNotes,
            ':created_by'    => $createdBy,
            ':created_at'    => $nowStr,
            ':sent_at'       => $nowStr,
        ]);

        $pdo->commit();

        echo json_encode([
            'success'      => true,
            'invitationId' => $invitationId,
            'message'      => 'Invitación creada y asignada exitosamente.'
        ], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    error_log('Error en servidor de invitaciones: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'No pudimos procesar la solicitud de invitaciones en este momento. Por favor inténtalo nuevamente.'], JSON_UNESCAPED_UNICODE);
    exit(1);
}

<?php
/**
 * public/api/admin/block-seats.php
 * Endpoint para gestión de Butacas No Disponibles / Bloqueadas (Mala Visión / Dañadas / Técnicas).
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

if (file_exists(dirname(__DIR__, 2) . '/db_config.php')) {
    require_once dirname(__DIR__, 2) . '/db_config.php';
} elseif (file_exists(__DIR__ . '/../db_config.php')) {
    require_once __DIR__ . '/../db_config.php';
}

function getBlockDBConnection() {
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

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? strtolower(trim($_GET['action'])) : ($method === 'POST' ? 'block' : 'list');

try {
    $pdo = getBlockDBConnection();

    // ── 1. LIST BLOCKED SEATS (GET) ───────────────────────────────────────────
    if ($action === 'list' && $method === 'GET') {
        $stmt = $pdo->query("
            SELECT id, row_name, seat_number, block, status, blocked_reason, blocked_notes, blocked_at, blocked_by 
            FROM seats 
            WHERE status = 'blocked' 
            ORDER BY row_name, seat_number
        ");
        $blockedSeats = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'count'   => count($blockedSeats),
            'seats'   => $blockedSeats,
        ], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

    // ── 2. BLOCK SEATS (POST action=block) ───────────────────────────────────
    if ($action === 'block' && $method === 'POST') {
        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        if (!$data || empty($data['seatIds']) || !is_array($data['seatIds'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Debes proporcionar una lista de butacas para bloquear.'], JSON_UNESCAPED_UNICODE);
            exit(1);
        }

        $seatIds = array_filter(array_map('trim', $data['seatIds']));
        $reason = !empty($data['reason']) ? trim($data['reason']) : 'Mala visión / No disponible';
        $notes = !empty($data['notes']) ? trim($data['notes']) : '';
        $blockedBy = !empty($data['blockedBy']) ? trim($data['blockedBy']) : 'Administrador';
        $force = !empty($data['force']);

        if (empty($seatIds)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No se seleccionaron butacas válidas.'], JSON_UNESCAPED_UNICODE);
            exit(1);
        }

        // Check if any seat is already occupied by sold, sent, or invitation tickets
        $placeholders = implode(',', array_fill(0, count($seatIds), '?'));
        $checkStmt = $pdo->prepare("SELECT id, status, assigned_participant_name FROM seats WHERE id IN ($placeholders)");
        $checkStmt->execute($seatIds);
        $existing = $checkStmt->fetchAll();

        $conflicts = [];
        foreach ($existing as $seat) {
            if (in_array($seat['status'], ['sold', 'sent', 'invitation', 'assigned']) && !$force) {
                $conflicts[] = "{$seat['id']} ({$seat['status']}" . ($seat['assigned_participant_name'] ? " - {$seat['assigned_participant_name']}" : "") . ")";
            }
        }

        if (!empty($conflicts)) {
            http_response_code(409);
            echo json_encode([
                'success'   => false,
                'error'     => 'Algunas butacas ya están asignadas, vendidas o emitidas: ' . implode(', ', $conflicts),
                'conflicts' => $conflicts,
            ], JSON_UNESCAPED_UNICODE);
            exit(1);
        }

        $pdo->beginTransaction();

        $updateStmt = $pdo->prepare("
            UPDATE seats 
            SET status = 'blocked',
                blocked_reason = :reason,
                blocked_notes = :notes,
                blocked_at = NOW(),
                blocked_by = :blocked_by,
                reserved_until = NULL,
                order_id = NULL
            WHERE id = :seat_id
        ");

        $blockedCount = 0;
        foreach ($seatIds as $sid) {
            $updateStmt->execute([
                ':reason'     => $reason,
                ':notes'      => $notes,
                ':blocked_by' => $blockedBy,
                ':seat_id'    => $sid,
            ]);
            $blockedCount += $updateStmt->rowCount();
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'count'   => $blockedCount,
            'message' => "Se marcaron {$blockedCount} butaca(s) como no disponibles exitosamente.",
        ], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

    // ── 3. UNBLOCK SEATS (POST action=unblock) ───────────────────────────────
    if ($action === 'unblock' && $method === 'POST') {
        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        if (!$data || empty($data['seatIds']) || !is_array($data['seatIds'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Debes proporcionar una lista de butacas para desbloquear.'], JSON_UNESCAPED_UNICODE);
            exit(1);
        }

        $seatIds = array_filter(array_map('trim', $data['seatIds']));

        if (empty($seatIds)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No se seleccionaron butacas válidas.'], JSON_UNESCAPED_UNICODE);
            exit(1);
        }

        $pdo->beginTransaction();

        $unblockStmt = $pdo->prepare("
            UPDATE seats 
            SET status = 'available',
                blocked_reason = NULL,
                blocked_notes = NULL,
                blocked_at = NULL,
                blocked_by = NULL
            WHERE id = :seat_id AND status = 'blocked'
        ");

        $unblockedCount = 0;
        foreach ($seatIds as $sid) {
            $unblockStmt->execute([':seat_id' => $sid]);
            $unblockedCount += $unblockStmt->rowCount();
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'count'   => $unblockedCount,
            'message' => "Se reactivaron {$unblockedCount} butaca(s) como disponibles exitosamente.",
        ], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'error' => "Acción no válida: {$action}"], JSON_UNESCAPED_UNICODE);
    exit(1);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    error_log('Block Seats Error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error'   => 'Error en el servidor al gestionar bloqueo de butacas: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit(1);
}

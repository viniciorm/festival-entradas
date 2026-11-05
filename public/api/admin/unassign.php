<?php
/**
 * public/api/admin/unassign.php
 * Endpoint atómico y transaccional para desasignar entradas de bailarinas, solistas y grupos.
 * Libera las butacas a estado 'available', recalcula el contador de las presentaciones
 * y actualiza el estado de las asignaciones correspondientes.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido. Utilice POST.'], JSON_UNESCAPED_UNICODE);
    exit(1);
}

// Cargar configuración de base de datos
if (file_exists(dirname(__DIR__) . '/db_config.php')) {
    require_once dirname(__DIR__) . '/db_config.php';
}

function getUnassignDBConnection() {
    if (defined('DB_TYPE') && DB_TYPE === 'mysql' && defined('DB_NAME') && DB_NAME !== 'festiva1_entradas') {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
        $pdo = new PDO($dsn, DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        return $pdo;
    }
    $dbFile = dirname(__DIR__) . '/festival_database.sqlite';
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

try {
    $inputRaw = file_get_contents('php://input');
    $data = json_decode($inputRaw, true) ?: $_POST;

    $seatIds       = isset($data['seatIds']) && is_array($data['seatIds']) ? $data['seatIds'] : [];
    $participantId = isset($data['participantId']) ? trim($data['participantId']) : '';
    $assignmentId  = isset($data['assignmentId']) ? trim($data['assignmentId']) : '';
    $reason        = isset($data['reason']) ? trim($data['reason']) : 'Desasignación desde panel administrador';
    $unassignedBy  = isset($data['unassignedBy']) ? trim($data['unassignedBy']) : 'Administrador';
    $forceUnassign = !empty($data['force']); // Permite desasignar incluso si fue ingresado en puerta con confirmación explícita

    if (empty($seatIds) && empty($participantId) && empty($assignmentId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Debe indicar al menos una butaca, participante o asignación a desasignar.'], JSON_UNESCAPED_UNICODE);
        exit(1);
    }

    $pdo = getUnassignDBConnection();
    $pdo->beginTransaction();

    // 1. Resolver los seatIds objetivo si se pasó participantId o assignmentId
    if (empty($seatIds)) {
        if (!empty($assignmentId)) {
            $stmtAsgn = $pdo->prepare("SELECT seat_ids_json FROM assignments WHERE id = :id FOR UPDATE");
            $stmtAsgn->execute([':id' => $assignmentId]);
            $asgnRow = $stmtAsgn->fetch();
            if ($asgnRow && !empty($asgnRow['seat_ids_json'])) {
                $decoded = json_decode($asgnRow['seat_ids_json'], true);
                if (is_array($decoded)) {
                    $seatIds = $decoded;
                }
            }
        } elseif (!empty($participantId)) {
            $stmtPartSeats = $pdo->prepare("SELECT id FROM seats WHERE assigned_participant_id = :part_id FOR UPDATE");
            $stmtPartSeats->execute([':part_id' => $participantId]);
            $seatIds = $stmtPartSeats->fetchAll(PDO::FETCH_COLUMN);
        }
    }

    // Normalizar y limpiar seatIds
    $seatIds = array_values(array_unique(array_filter(array_map('trim', $seatIds))));

    if (empty($seatIds)) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'No se encontraron butacas asignadas para desasignar.'], JSON_UNESCAPED_UNICODE);
        exit(1);
    }

    // 2. Bloquear y verificar estado de las butacas con FOR UPDATE
    $placeholders = implode(',', array_fill(0, count($seatIds), '?'));
    $stmtLock = $pdo->prepare("SELECT id, row_name, seat_number, status, assigned_participant_id, assigned_participant_name, checked_in_at FROM seats WHERE id IN ($placeholders) FOR UPDATE");
    $stmtLock->execute($seatIds);
    $lockedSeats = $stmtLock->fetchAll();

    if (empty($lockedSeats)) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Las butacas indicadas no existen en el sistema.'], JSON_UNESCAPED_UNICODE);
        exit(1);
    }

    // 3. Verificación de seguridad: chequear si alguna entrada ya fue escaneada en puerta
    $checkedInSeats = [];
    $affectedParticipantIds = [];

    foreach ($lockedSeats as $s) {
        if ($s['status'] === 'checked_in' || !empty($s['checked_in_at'])) {
            $checkedInSeats[] = sprintf('Fila %s N° %d (%s)', $s['row_name'], $s['seat_number'], $s['id']);
        }
        if (!empty($s['assigned_participant_id'])) {
            $affectedParticipantIds[] = $s['assigned_participant_id'];
        }
    }

    if (!empty($participantId)) {
        $affectedParticipantIds[] = $participantId;
    }
    $affectedParticipantIds = array_values(array_unique(array_filter($affectedParticipantIds)));

    if (!empty($checkedInSeats) && !$forceUnassign) {
        $pdo->rollBack();
        http_response_code(409); // Conflict
        echo json_encode([
            'success'        => false,
            'requiresForce'  => true,
            'checkedInSeats' => $checkedInSeats,
            'error'          => '🚫 Atención: Las siguientes butacas ya fueron escaneadas/validadas en puerta: ' . implode(', ', $checkedInSeats) . '. Se requiere confirmación explícita para desasignarlas.'
        ], JSON_UNESCAPED_UNICODE);
        exit(1);
    }

    // 4. Liberar las butacas a estado 'available'
    $stmtFree = $pdo->prepare("
        UPDATE seats SET
            status = 'available',
            assigned_participant_id = NULL,
            assigned_participant_name = NULL,
            ticket_code = NULL,
            pdf_filename = NULL,
            checked_in_at = NULL,
            order_id = NULL,
            reserved_until = NULL
        WHERE id IN ($placeholders)
    ");
    $stmtFree->execute($seatIds);

    // 5. Actualizar los registros de la tabla assignments
    // Para cada asignación que contenga alguna de las butacas desasignadas:
    $stmtAllAsgn = $pdo->query("SELECT id, seat_ids_json, status FROM assignments FOR UPDATE");
    $allAsgn = $stmtAllAsgn->fetchAll();

    $stmtUpdAsgn = $pdo->prepare("
        UPDATE assignments SET
            seat_ids_json = :seats_json,
            status = :status
        WHERE id = :id
    ");

    foreach ($allAsgn as $asgn) {
        $rawSeats = json_decode($asgn['seat_ids_json'] ?? '[]', true) ?: [];
        $remainingSeats = array_values(array_diff($rawSeats, $seatIds));

        if (count($remainingSeats) !== count($rawSeats)) {
            $newStatus = empty($remainingSeats) ? 'Desasignado' : $asgn['status'];
            $stmtUpdAsgn->execute([
                ':id'         => $asgn['id'],
                ':seats_json' => json_encode($remainingSeats),
                ':status'     => $newStatus,
            ]);
        }
    }

    // Si se pasó un assignmentId específico y quedó vacío o fue indicado directamente:
    if (!empty($assignmentId)) {
        $stmtDirectAsgn = $pdo->prepare("UPDATE assignments SET status = 'Desasignado' WHERE id = :id");
        $stmtDirectAsgn->execute([':id' => $assignmentId]);
    }

    // 6. Recalcular y sincronizar assigned_seats_count en la tabla participants
    $stmtCountPart = $pdo->prepare("
        SELECT COUNT(*) FROM seats WHERE assigned_participant_id = :part_id AND status != 'available'
    ");
    $stmtUpdPartCount = $pdo->prepare("
        UPDATE participants SET assigned_seats_count = :count WHERE id = :part_id
    ");

    foreach ($affectedParticipantIds as $pId) {
        $stmtCountPart->execute([':part_id' => $pId]);
        $realCount = (int)$stmtCountPart->fetchColumn();
        $stmtUpdPartCount->execute([
            ':count'   => $realCount,
            ':part_id' => $pId
        ]);
    }

    $pdo->commit();

    echo json_encode([
        'success'                => true,
        'unassignedSeatIds'      => $seatIds,
        'unassignedCount'        => count($seatIds),
        'affectedParticipantIds' => $affectedParticipantIds,
        'message'                => sprintf('Se desasignaron exitosamente %d butaca(s). Los asientos han quedado disponibles en el mapa.', count($seatIds)),
    ], JSON_UNESCAPED_UNICODE);
    exit(0);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    error_log('Error en desasignación: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error'   => 'No pudimos procesar la desasignación en este momento. Inténtelo nuevamente.'
    ], JSON_UNESCAPED_UNICODE);
    exit(1);
}

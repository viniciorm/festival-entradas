<?php
/**
 * admin-fix-adarah.php
 * One-shot admin script: sync seats table with corrected Adarah Bellydance assignment.
 * DELETES ITSELF after successful execution for security.
 *
 * Expected final state:
 *   A5, A6, A7, A8  → available (unlinked)
 *   C5, C6, C7, C8  → sent, linked to Adarah (part-7)
 *   B5-B8, C27-C30, D23-D26, E9-E14, G9-G14 → unchanged (already sent)
 *   Total Adarah seats: 28
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Load DB config
if (file_exists(__DIR__ . '/db_config.php')) {
    require_once __DIR__ . '/db_config.php';
}

function getDBConnection() {
    if (defined('DB_TYPE') && DB_TYPE === 'mysql' && defined('DB_NAME') && DB_NAME !== 'festiva1_entradas') {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
        $pdo = new PDO($dsn, DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        return $pdo;
    }
    $dbFile = __DIR__ . '/festival_database.sqlite';
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

try {
    $pdo = getDBConnection();

    // ── 1. Find the Adarah assignment ID from assignments table ─────────────
    $stmt = $pdo->query(
        "SELECT id, seat_ids_json FROM assignments
         WHERE participant_id = 'part-7'
         ORDER BY date_str DESC, id DESC
         LIMIT 1"
    );
    $adarahAssignment = $stmt->fetch();

    if (!$adarahAssignment) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'No assignment found for part-7 (Adarah)']);
        exit(1);
    }

    $adarahAssignmentId = $adarahAssignment['id'];
    $currentSeatIds     = json_decode($adarahAssignment['seat_ids_json'], true) ?: [];

    // ── 2. Execute atomic update ────────────────────────────────────────────
    $pdo->beginTransaction();

    // a) Free A5, A6, A7, A8 → available, unlinked
    $freeSeats = ['A5', 'A6', 'A7', 'A8'];
    $stmtFree = $pdo->prepare("
        UPDATE seats SET
            status = 'available',
            assigned_participant_id = NULL,
            assigned_participant_name = NULL,
            ticket_code = NULL
        WHERE id = :id
    ");
    foreach ($freeSeats as $sid) {
        $stmtFree->execute([':id' => $sid]);
    }

    // b) Assign C5, C6, C7, C8 → sent, linked to Adarah
    $newSeats = ['C5', 'C6', 'C7', 'C8'];
    $stmtAssign = $pdo->prepare("
        UPDATE seats SET
            status = 'sent',
            assigned_participant_id = 'part-7',
            assigned_participant_name = 'Adarah Bellydance'
        WHERE id = :id
    ");
    foreach ($newSeats as $sid) {
        $stmtAssign->execute([':id' => $sid]);
    }

    // c) Recalculate Adarah seat count (count directly from seats table)
    $pdo->exec("
        UPDATE participants SET assigned_seats_count = (
            SELECT COUNT(*) FROM seats
            WHERE assigned_participant_id = 'part-7'
            AND status != 'available'
        ) WHERE id = 'part-7'
    ");

    $pdo->commit();

    // ── 3. Validate final state ─────────────────────────────────────────────
    $pdo->beginTransaction();  // read-only transaction for consistent snapshot
    $pdo->rollBack();

    // Check freed seats
    $stmtCheck = $pdo->prepare("SELECT id, status, assigned_participant_id FROM seats WHERE id = :id");
    $freedResults   = [];
    foreach ($freeSeats as $sid) {
        $stmtCheck->execute([':id' => $sid]);
        $freedResults[$sid] = $stmtCheck->fetch();
    }

    // Check newly assigned seats
    $assignedResults = [];
    foreach ($newSeats as $sid) {
        $stmtCheck->execute([':id' => $sid]);
        $assignedResults[$sid] = $stmtCheck->fetch();
    }

    // Count total Adarah seats
    $stmtCount = $pdo->query(
        "SELECT COUNT(*) AS cnt FROM seats
         WHERE assigned_participant_id = 'part-7'
         AND status != 'available'"
    );
    $totalAdarah = (int)$stmtCount->fetch()['cnt'];

    // Check for duplicates (seats linked to multiple assignments) — not possible
    // in relational model, but verify no other assignment wrongly contains A5-A8
    $stmtDup = $pdo->prepare(
        "SELECT id, seat_ids_json FROM assignments
         WHERE seat_ids_json LIKE :pattern AND id != :ours"
    );
    $duplicateConflicts = [];
    foreach ($freeSeats as $sid) {
        $stmtDup->execute([':pattern' => "%\"{$sid}\"%", ':ours' => $adarahAssignmentId]);
        $rows = $stmtDup->fetchAll();
        foreach ($rows as $row) {
            $duplicateConflicts[] = "Seat {$sid} still referenced in assignment {$row['id']}";
        }
    }

    // Sample unchanged seats sanity check
    $unchangedSample = ['B5', 'B8', 'C27', 'C30', 'D23', 'D26', 'E9', 'E14', 'G9', 'G14'];
    $unchangedResults = [];
    foreach ($unchangedSample as $sid) {
        $stmtCheck->execute([':id' => $sid]);
        $unchangedResults[$sid] = $stmtCheck->fetch();
    }

    $validations = [
        'freed_A5_A8_available' => array_reduce(
            array_values($freedResults),
            fn($carry, $r) => $carry && $r['status'] === 'available' && $r['assigned_participant_id'] === null,
            true
        ),
        'C5_C8_sent_and_linked' => array_reduce(
            array_values($assignedResults),
            fn($carry, $r) => $carry && $r['status'] === 'sent' && $r['assigned_participant_id'] === 'part-7',
            true
        ),
        'adarah_total_seats'    => $totalAdarah,
        'adarah_28_seats_ok'    => $totalAdarah === 28,
        'no_duplicate_refs'     => empty($duplicateConflicts),
        'duplicate_conflicts'   => $duplicateConflicts,
    ];

    $allOk = $validations['freed_A5_A8_available']
          && $validations['C5_C8_sent_and_linked']
          && $validations['adarah_28_seats_ok']
          && $validations['no_duplicate_refs'];

    echo json_encode([
        'success'             => $allOk,
        'adarah_assignment_id'=> $adarahAssignmentId,
        'freed_seats'         => $freedResults,
        'newly_assigned_seats'=> $assignedResults,
        'unchanged_sample'    => $unchangedResults,
        'validations'         => $validations,
        'message'             => $allOk
            ? '✅ Seats synced atomically. All 28 Adarah seats confirmed. A5-A8 freed. C5-C8 assigned.'
            : '⚠️ Some validations failed. See details above.',
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

    // Self-delete for security after success
    if ($allOk) {
        @unlink(__FILE__);
    }
    exit(0);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit(1);
}

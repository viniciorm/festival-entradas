<?php
/**
 * public/api/admin/orders.php
 * Endpoint para gestión, monitoreo y auditoría de compras Webpay y errores de pago en tiempo real.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

if (file_exists(__DIR__ . '/../db_config.php')) {
    require_once __DIR__ . '/../db_config.php';
}

function getOrdersDB() {
    if (defined('DB_TYPE') && DB_TYPE === 'mysql' && defined('DB_NAME') && DB_NAME !== 'festiva1_entradas') {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
        $pdo = new PDO($dsn, DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        return $pdo;
    }
    $dbFile = __DIR__ . '/../festival_database.sqlite';
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

try {
    $pdo = getOrdersDB();

    // Ensure webpay_logs table exists
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS webpay_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id VARCHAR(64) NULL,
            token_ws VARCHAR(128) NULL,
            event_type VARCHAR(32) NOT NULL,
            amount INT NULL,
            status_code INT NULL,
            buyer_email VARCHAR(128) NULL,
            raw_data TEXT NULL,
            error_message TEXT NULL,
            ip_address VARCHAR(45) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    $action = isset($_GET['action']) ? trim($_GET['action']) : '';

    // ── ACTION: MANUAL CONFIRMATION ──────────────────────────────────────────
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'manual_confirm') {
        $raw = file_get_contents('php://input');
        $body = json_decode($raw, true) ?: $_POST;
        $orderId = isset($body['orderId']) ? trim($body['orderId']) : '';
        $authCode = isset($body['authCode']) ? trim($body['authCode']) : 'MANUAL';
        $adminNotes = isset($body['notes']) ? trim($body['notes']) : 'Aprobación manual por administrador';

        if (!$orderId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'orderId es requerido']);
            exit(1);
        }

        $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = :id FOR UPDATE");
        $pdo->beginTransaction();
        $stmt->execute([':id' => $orderId]);
        $order = $stmt->fetch();

        if (!$order) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => "Orden $orderId no encontrada"]);
            exit(1);
        }

        $stmtUpd = $pdo->prepare("
            UPDATE orders SET
                status = 'paid',
                paid_at = NOW(),
                webpay_authorization_code = :auth,
                webpay_response_code = 0,
                webpay_response_json = :notes
            WHERE id = :id
        ");
        $stmtUpd->execute([
            ':auth'  => $authCode,
            ':notes' => json_encode(['manual_confirm' => true, 'notes' => $adminNotes, 'timestamp' => date('c')]),
            ':id'    => $orderId
        ]);

        $seatIds = json_decode($order['seat_ids_json'], true) ?: [];
        if (!empty($seatIds)) {
            $stmtUpdSeat = $pdo->prepare("
                UPDATE seats SET
                    status = 'sold',
                    order_id = :oid,
                    assigned_participant_name = :bname,
                    ticket_code = :tcode,
                    reserved_until = NULL
                WHERE id = :id
            ");

            foreach ($seatIds as $sid) {
                $tCode = sprintf('TKT-%s%06d-FDVC2026', $sid[0], (int)substr($sid, 1));
                $stmtUpdSeat->execute([
                    ':oid'   => $orderId,
                    ':bname' => $order['buyer_name'],
                    ':tcode' => $tCode,
                    ':id'    => $sid
                ]);
            }
        }

        // Log action in webpay_logs
        $stmtLog = $pdo->prepare("
            INSERT INTO webpay_logs (order_id, event_type, amount, status_code, buyer_email, raw_data, ip_address)
            VALUES (:oid, 'MANUAL_ADMIN_CONFIRM', :amount, 0, :email, :raw, :ip)
        ");
        $stmtLog->execute([
            ':oid'    => $orderId,
            ':amount' => (int)$order['total_amount'],
            ':email'  => $order['buyer_email'],
            ':raw'    => $adminNotes,
            ':ip'     => $_SERVER['REMOTE_ADDR'] ?? ''
        ]);

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => "Orden $orderId regularizada y confirmada exitosamente.",
            'seatIds' => $seatIds
        ]);
        exit(0);
    }

    // ── DEFAULT GET: RETURN ORDERS & WEBPAY AUDIT LOGS ───────────────────────
    $orders = $pdo->query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200")->fetchAll();

    $logs = $pdo->query("SELECT * FROM webpay_logs ORDER BY created_at DESC LIMIT 100")->fetchAll();

    // Summary stats
    $stats = [
        'totalPaidOrders' => 0,
        'totalPaidAmount' => 0,
        'totalPaidTickets' => 0,
        'totalFailedOrders' => 0,
        'totalPendingOrders' => 0,
    ];

    $formattedOrders = [];
    foreach ($orders as $ord) {
        $seatIds = json_decode($ord['seat_ids_json'], true) ?: [];
        $status = $ord['status'];

        if ($status === 'paid') {
            $stats['totalPaidOrders']++;
            $stats['totalPaidAmount'] += (int)$ord['total_amount'];
            $stats['totalPaidTickets'] += count($seatIds);
        } elseif ($status === 'failed') {
            $stats['totalFailedOrders']++;
        } elseif ($status === 'reserved') {
            $stats['totalPendingOrders']++;
        }

        $formattedOrders[] = [
            'id' => $ord['id'],
            'buyerName' => $ord['buyer_name'],
            'buyerEmail' => $ord['buyer_email'],
            'buyerPhone' => $ord['buyer_phone'] ?? '',
            'seatIds' => $seatIds,
            'subtotal' => (int)$ord['subtotal'],
            'discountCode' => $ord['discount_code'] ?? null,
            'discountAmount' => (int)$ord['discount_amount'],
            'netSubtotal' => (int)$ord['net_subtotal'],
            'serviceCharge' => (int)$ord['service_charge'],
            'totalAmount' => (int)$ord['total_amount'],
            'status' => $status,
            'webpayToken' => $ord['webpay_token'] ?? null,
            'authorizationCode' => $ord['webpay_authorization_code'] ?? null,
            'responseCode' => $ord['webpay_response_code'] ?? null,
            'responseJson' => $ord['webpay_response_json'] ?? null,
            'paidAt' => $ord['paid_at'] ?? null,
            'reservedUntil' => $ord['reserved_until'] ?? null,
            'createdAt' => $ord['created_at'] ?? null,
        ];
    }

    echo json_encode([
        'success' => true,
        'stats' => $stats,
        'orders' => $formattedOrders,
        'logs' => $logs,
        'serverTime' => date('c')
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

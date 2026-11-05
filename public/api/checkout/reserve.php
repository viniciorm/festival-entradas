<?php
/**
 * public/api/checkout/reserve.php
 * Endpoint de gestión de reserva atómica de 15 minutos en MySQL.
 * El servidor es la única fuente de verdad para el TTL de reserva (inmune a F5).
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

if (file_exists(__DIR__ . '/../db_config.php')) {
    require_once __DIR__ . '/../db_config.php';
}

function getReserveDB() {
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

try {
    $pdo = getReserveDB();
    $nowTs = time();
    $nowSql = date('Y-m-d H:i:s', $nowTs);

    // ── 0. ENFORCE FESTIVAL SALES CLOSURE (5-SEP-2026 21:00 CHILE TIME) ─────
    $salesCutoffTs = strtotime('2026-09-05 21:00:00 America/Santiago');
    $isSimClosed = (isset($_GET['sim_closed']) && $_GET['sim_closed'] === '1');
    $action = isset($_GET['action']) ? trim($_GET['action']) : (isset($_POST['action']) ? trim($_POST['action']) : '');

    if ($action !== 'cancel' && ($nowTs >= $salesCutoffTs || $isSimClosed)) {
        http_response_code(403);
        echo json_encode([
            'success'     => false,
            'salesClosed' => true,
            'error'       => 'La venta de entradas para el festival ha finalizado oficialmente a las 21:00 hrs del 5 de septiembre de 2026.'
        ], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

    // ── 1. AUTOMATIC CLEANUP OF EXPIRED RESERVATIONS ─────────────────────────
    releaseExpiredReservations($pdo);

    // ── 2. EXTRACT PARAMETERS ────────────────────────────────────────────────
    $cookieOrderId = isset($_COOKIE['festival_order_id']) ? trim($_COOKIE['festival_order_id']) : '';

    // ── 2A. EXPLICIT CANCELLATION HANDLER ────────────────────────────────────
    if ($action === 'cancel') {
        $inputRaw = file_get_contents('php://input');
        $data = json_decode($inputRaw, true) ?: $_POST;
        $orderId = isset($data['orderId']) ? trim($data['orderId']) : $cookieOrderId;

        if ($orderId) {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = :id FOR UPDATE");
            $stmt->execute([':id' => $orderId]);
            $order = $stmt->fetch();

            if ($order && $order['status'] === 'reserved') {
                $seatIds = json_decode($order['seat_ids_json'], true) ?: [];
                if (!empty($seatIds)) {
                    $placeholders = implode(',', array_fill(0, count($seatIds), '?'));
                    $stmtFree = $pdo->prepare("
                        UPDATE seats SET status = 'available', reserved_until = NULL, order_id = NULL
                        WHERE status = 'reserved' AND id IN ($placeholders)
                    ");
                    $stmtFree->execute($seatIds);
                }
                $stmtCancel = $pdo->prepare("UPDATE orders SET status = 'cancelled' WHERE id = :id");
                $stmtCancel->execute([':id' => $orderId]);
            }
            $pdo->commit();
        }

        // Clear session cookie
        setcookie('festival_order_id', '', [
            'expires'  => time() - 3600,
            'path'     => '/',
            'httponly' => false,
            'samesite' => 'Lax'
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Reserva cancelada exitosamente y butacas liberadas.'
        ], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $seatIdsParam = isset($_GET['seats']) ? trim($_GET['seats']) : '';
        $seatIds = array_values(array_filter(array_map('trim', explode(',', $seatIdsParam))));

        if (empty($seatIds)) {
            echo json_encode([
                'success' => false,
                'error'   => 'No se han especificado butacas.'
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // ── 2A. CHECK EXISTING ACTIVE ORDER FOR THIS SESSION/COOKIE ───────────
        $existingOrder = null;
        if ($cookieOrderId) {
            $stmtOrder = $pdo->prepare("SELECT * FROM orders WHERE id = :id AND status = 'reserved'");
            $stmtOrder->execute([':id' => $cookieOrderId]);
            $existingOrder = $stmtOrder->fetch();
        }

        if ($existingOrder) {
            $orderSeats = json_decode($existingOrder['seat_ids_json'], true) ?: [];
            sort($orderSeats);
            $reqSeats = $seatIds;
            sort($reqSeats);

            // If the seats match and the order has not expired
            if ($orderSeats === $reqSeats) {
                $resUntilTs = strtotime($existingOrder['reserved_until']);
                $remainingSecs = max(0, $resUntilTs - $nowTs);

                if ($remainingSecs > 0) {
                    echo json_encode([
                        'success'          => true,
                        'orderId'          => $existingOrder['id'],
                        'seatIds'          => $orderSeats,
                        'buyerName'        => ($existingOrder['buyer_name'] !== 'Pendiente') ? $existingOrder['buyer_name'] : '',
                        'buyerEmail'       => ($existingOrder['buyer_email'] !== 'pendiente@reserva.cl') ? $existingOrder['buyer_email'] : '',
                        'buyerPhone'       => $existingOrder['buyer_phone'] ?? '',
                        'discountCode'     => $existingOrder['discount_code'] ?? '',
                        'reservedUntil'    => $existingOrder['reserved_until'],
                        'remainingSeconds' => $remainingSecs,
                        'isExisting'       => true,
                        'message'          => 'Reserva activa recuperada.'
                    ], JSON_UNESCAPED_UNICODE);
                    exit(0);
                }
            }
        }

        // ── 2B. CREATE INITIAL 15-MINUTE RESERVATION FOR SEATS ─────────────────
        $pdo->beginTransaction();

        $placeholders = implode(',', array_fill(0, count($seatIds), '?'));
        $stmtLock = $pdo->prepare("SELECT id, row_name, seat_number, status, reserved_until, order_id FROM seats WHERE id IN ($placeholders) FOR UPDATE");
        $stmtLock->execute($seatIds);
        $lockedSeats = $stmtLock->fetchAll();

        $unavailable = [];
        $foundMap = [];
        foreach ($lockedSeats as $s) {
            $foundMap[$s['id']] = $s;
            if ($s['status'] !== 'available') {
                $unavailable[] = sprintf('Fila %s Asiento %d', $s['row_name'], $s['seat_number']);
            }
        }
        foreach ($seatIds as $sid) {
            if (!isset($foundMap[$sid])) {
                $unavailable[] = $sid;
            }
        }

        if (!empty($unavailable)) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error'   => 'Las siguientes butacas están temporalmente reservadas por otro comprador: ' . implode(', ', $unavailable)
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        $orderId = 'ORD-' . date('Ymd') . '-' . strtoupper(substr(md5(uniqid() . microtime()), 0, 6));
        $resUntilTs = $nowTs + 900; // 15 minutes TTL
        $resUntilSql = date('Y-m-d H:i:s', $resUntilTs);

        $unitPrice = 10000;
        $subtotal = count($seatIds) * $unitPrice;
        $serviceCharge = (int)round($subtotal * 0.04);
        $totalAmount = $subtotal + $serviceCharge;

        // Reserve seats
        $stmtSeatReserve = $pdo->prepare("
            UPDATE seats SET status = 'reserved', reserved_until = :res_until, order_id = :order_id
            WHERE id = :id
        ");
        foreach ($seatIds as $sid) {
            $stmtSeatReserve->execute([
                ':res_until' => $resUntilSql,
                ':order_id'  => $orderId,
                ':id'        => $sid
            ]);
        }

        // Insert initial order
        $stmtOrder = $pdo->prepare("
            INSERT INTO orders (
                id, buyer_name, buyer_email, buyer_phone, seat_ids_json,
                subtotal, discount_code, discount_amount, net_subtotal,
                service_charge, total_amount, status, reserved_until, created_at
            ) VALUES (
                :id, 'Pendiente', 'pendiente@reserva.cl', '', :seats_json,
                :subtotal, NULL, 0, :subtotal, :service_charge, :total_amount,
                'reserved', :res_until, :created_at
            )
        ");
        $stmtOrder->execute([
            ':id'             => $orderId,
            ':seats_json'     => json_encode($seatIds),
            ':subtotal'       => $subtotal,
            ':service_charge' => $serviceCharge,
            ':total_amount'   => $totalAmount,
            ':res_until'      => $resUntilSql,
            ':created_at'     => $nowSql,
        ]);

        $pdo->commit();

        // Set secure session cookie for 15 minutes
        setcookie('festival_order_id', $orderId, [
            'expires'  => $resUntilTs,
            'path'     => '/',
            'httponly' => false,
            'samesite' => 'Lax'
        ]);

        echo json_encode([
            'success'          => true,
            'orderId'          => $orderId,
            'seatIds'          => $seatIds,
            'reservedUntil'    => $resUntilSql,
            'remainingSeconds' => 900,
            'isExisting'       => false,
            'message'          => 'Reserva de 15 minutos iniciada correctamente.'
        ], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

    // ── 3. POST: UPDATE BUYER INFO & CONFIRM BEFORE WEBPAY ───────────────────
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $inputRaw = file_get_contents('php://input');
        $data = json_decode($inputRaw, true) ?: $_POST;

        $orderId      = isset($data['orderId']) ? trim($data['orderId']) : $cookieOrderId;
        $buyerName    = isset($data['buyerName']) ? trim($data['buyerName']) : '';
        $buyerEmail   = isset($data['buyerEmail']) ? trim($data['buyerEmail']) : '';
        $buyerPhone   = isset($data['buyerPhone']) ? trim($data['buyerPhone']) : '';
        $seatIds      = (isset($data['seatIds']) && is_array($data['seatIds'])) ? $data['seatIds'] : [];
        $discountCode = isset($data['discountCode']) ? strtoupper(trim($data['discountCode'])) : '';

        if (!$buyerName || !$buyerEmail) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error'   => 'Por favor completa tu nombre y correo electrónico.'
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        $pdo->beginTransaction();

        $stmtOrder = $pdo->prepare("SELECT * FROM orders WHERE id = :id AND status = 'reserved' FOR UPDATE");
        $stmtOrder->execute([':id' => $orderId]);
        $order = $stmtOrder->fetch();

        if (!$order) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error'   => 'Tu reserva de 15 minutos ha expirado o no fue encontrada. Por favor selecciona tus asientos nuevamente.'
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // Validate TTL
        $resUntilTs = strtotime($order['reserved_until']);
        $remainingSecs = max(0, $resUntilTs - $nowTs);

        if ($remainingSecs <= 0) {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error'   => 'El tiempo de reserva ha expirado. Por favor, selecciona tus butacas nuevamente.'
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // Recalculate price strictly on backend
        $orderSeats = json_decode($order['seat_ids_json'], true) ?: $seatIds;
        $unitPrice = 10000;
        $subtotal = count($orderSeats) * $unitPrice;
        $discountAmount = 0;
        $validatedCode = null;

        if (!empty($discountCode)) {
            $stmtDisc = $pdo->prepare("SELECT * FROM discounts WHERE UPPER(code) = :code AND status = 'active'");
            $stmtDisc->execute([':code' => $discountCode]);
            $disc = $stmtDisc->fetch();

            if ($disc) {
                $validatedCode = $disc['code'];
                if ($disc['type'] === 'percentage') {
                    $discountAmount = (int)round(($subtotal * (int)$disc['value']) / 100);
                } else if ($disc['type'] === 'fixed') {
                    $discountAmount = (int)$disc['value'];
                }
                if ($discountAmount > $subtotal) {
                    $discountAmount = $subtotal;
                }
            }
        }

        $netSubtotal = max(0, $subtotal - $discountAmount);
        $serviceCharge = (int)round($netSubtotal * 0.04);
        $totalAmount = $netSubtotal + $serviceCharge;

        // Update Order with final buyer data and exact amounts
        $stmtUpdate = $pdo->prepare("
            UPDATE orders SET
                buyer_name = :buyer_name,
                buyer_email = :buyer_email,
                buyer_phone = :buyer_phone,
                discount_code = :discount_code,
                discount_amount = :discount_amount,
                net_subtotal = :net_subtotal,
                service_charge = :service_charge,
                total_amount = :total_amount
            WHERE id = :id
        ");
        $stmtUpdate->execute([
            ':buyer_name'      => $buyerName,
            ':buyer_email'     => $buyerEmail,
            ':buyer_phone'     => $buyerPhone,
            ':discount_code'   => $validatedCode,
            ':discount_amount' => $discountAmount,
            ':net_subtotal'    => $netSubtotal,
            ':service_charge'  => $serviceCharge,
            ':total_amount'    => $totalAmount,
            ':id'              => $orderId,
        ]);

        $pdo->commit();

        echo json_encode([
            'success'          => true,
            'orderId'          => $orderId,
            'seatIds'          => $orderSeats,
            'subtotal'         => $subtotal,
            'discountCode'     => $validatedCode,
            'discountAmount'   => $discountAmount,
            'netSubtotal'      => $netSubtotal,
            'serviceCharge'    => $serviceCharge,
            'totalAmount'      => $totalAmount,
            'reservedUntil'    => $order['reserved_until'],
            'remainingSeconds' => $remainingSecs,
        ], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Reserve API Error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'No pudimos procesar tu reserva temporal en este momento. Por favor inténtalo nuevamente.'
    ], JSON_UNESCAPED_UNICODE);
    exit(1);
}

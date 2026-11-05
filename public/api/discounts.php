<?php
/**
 * public/api/discounts.php
 * Endpoint de gestión y validación de códigos de descuento con control estricto de mensajes anti-técnicos.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

if (file_exists(__DIR__ . '/db_config.php')) {
    require_once __DIR__ . '/db_config.php';
}

function getDiscountsDB() {
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

$action = isset($_GET['action']) ? $_GET['action'] : 'list';
$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = getDiscountsDB();

    // ── 1. VALIDATE DISCOUNT CODE (Public Checkout) ──────────────────────────
    if ($action === 'validate') {
        $inputRaw = file_get_contents('php://input');
        $data = json_decode($inputRaw, true) ?: $_POST;

        $code = isset($data['code']) ? strtoupper(trim($data['code'])) : '';
        $seatCount = isset($data['seatCount']) ? max(1, (int)$data['seatCount']) : 1;
        $unitPrice = 10000;
        $subtotal = $seatCount * $unitPrice;

        if (!$code) {
            http_response_code(400);
            echo json_encode([
                'valid' => false,
                'error' => 'Por favor ingresa un código de descuento.'
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // Ensure INVITACION is not applied as a coupon unless explicitly created in discounts table
        $stmt = $pdo->prepare("SELECT * FROM discounts WHERE UPPER(code) = :code");
        $stmt->execute([':code' => $code]);
        $discount = $stmt->fetch();

        if (!$discount) {
            http_response_code(404);
            echo json_encode([
                'valid' => false,
                'error' => 'Este código no es válido. Revisa la escritura e inténtalo nuevamente.'
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // Status check
        if ($discount['status'] === 'paused') {
            http_response_code(400);
            echo json_encode([
                'valid' => false,
                'error' => 'Este código de descuento no está disponible en este momento.'
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        if ($discount['status'] !== 'active') {
            http_response_code(400);
            echo json_encode([
                'valid' => false,
                'error' => 'Este código no es válido. Revisa la escritura e inténtalo nuevamente.'
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // Dates check
        $nowStr = date('Y-m-d H:i:s');
        if (!empty($discount['start_date']) && $nowStr < $discount['start_date']) {
            http_response_code(400);
            echo json_encode([
                'valid' => false,
                'error' => 'Este código de descuento aún no entra en vigencia.'
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        if (!empty($discount['end_date']) && $nowStr > $discount['end_date']) {
            http_response_code(400);
            echo json_encode([
                'valid' => false,
                'error' => 'Este código de descuento ha expirado.'
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // Usage limit check
        if ((int)$discount['total_limit'] > 0 && (int)$discount['used_count'] >= (int)$discount['total_limit']) {
            http_response_code(400);
            echo json_encode([
                'valid' => false,
                'error' => 'Este código de descuento ha alcanzado su límite máximo de usos.'
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // Calculate discount amount strictly on backend
        $discountAmount = 0;
        if ($discount['type'] === 'percentage') {
            $pct = (int)$discount['value'];
            $discountAmount = (int)round(($subtotal * $pct) / 100);
        } else if ($discount['type'] === 'fixed') {
            $discountAmount = (int)$discount['value'];
        }

        if ($discountAmount > $subtotal) {
            $discountAmount = $subtotal;
        }

        $netSubtotal = max(0, $subtotal - $discountAmount);
        $serviceCharge = (int)round($netSubtotal * 0.04);
        $totalAmount = $netSubtotal + $serviceCharge;

        echo json_encode([
            'valid'          => true,
            'code'           => $discount['code'],
            'type'           => $discount['type'],
            'value'          => (int)$discount['value'],
            'subtotal'       => $subtotal,
            'discountAmount' => $discountAmount,
            'netSubtotal'    => $netSubtotal,
            'serviceCharge'  => $serviceCharge,
            'totalAmount'    => $totalAmount,
            'message'        => sprintf('Código %s aplicado con éxito', $discount['code'])
        ], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

    // ── 2. ADMIN LIST DISCOUNTS ──────────────────────────────────────────────
    if ($method === 'GET' || $action === 'list') {
        $stmt = $pdo->query("SELECT * FROM discounts ORDER BY created_at DESC");
        $discounts = array_map(function($r) {
            return [
                'id'             => (string)$r['id'],
                'code'           => $r['code'],
                'type'           => $r['type'],
                'value'          => (int)$r['value'],
                'startDate'      => $r['start_date'] ?? '',
                'endDate'        => $r['end_date'] ?? '',
                'totalLimit'     => (int)($r['total_limit'] ?? 0),
                'usedCount'      => (int)($r['used_count'] ?? 0),
                'maxPerPurchase' => (int)($r['max_per_purchase'] ?? 4),
                'status'         => $r['status'] ?? 'active',
                'createdAt'      => $r['created_at'] ?? '',
            ];
        }, $stmt->fetchAll());

        echo json_encode(['success' => true, 'discounts' => $discounts], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

    // ── 3. ADMIN CREATE DISCOUNT (POST) ──────────────────────────────────────
    if ($method === 'POST' && $action === 'create') {
        $inputRaw = file_get_contents('php://input');
        $data = json_decode($inputRaw, true) ?: $_POST;

        $code           = isset($data['code']) ? strtoupper(trim($data['code'])) : '';
        $type           = isset($data['type']) ? trim($data['type']) : 'percentage';
        $value          = isset($data['value']) ? (int)$data['value'] : 10;
        $startDate      = !empty($data['startDate']) ? trim($data['startDate']) : null;
        $endDate        = !empty($data['endDate']) ? trim($data['endDate']) : null;
        $totalLimit     = isset($data['totalLimit']) ? (int)$data['totalLimit'] : 0;
        $maxPerPurchase = isset($data['maxPerPurchase']) ? (int)$data['maxPerPurchase'] : 4;

        if (!$code || $value <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Código y valor positivo son requeridos.'], JSON_UNESCAPED_UNICODE);
            exit(1);
        }

        $id = 'DISC-' . strtoupper(substr(md5($code . time()), 0, 8));
        $nowStr = date('Y-m-d H:i:s');

        $stmt = $pdo->prepare("
            INSERT INTO discounts (id, code, type, value, start_date, end_date, total_limit, used_count, max_per_purchase, status, created_at)
            VALUES (:id, :code, :type, :value, :start_date, :end_date, :total_limit, 0, :max_per_purchase, 'active', :created_at)
        ");
        $stmt->execute([
            ':id'               => $id,
            ':code'             => $code,
            ':type'             => $type,
            ':value'            => $value,
            ':start_date'       => $startDate,
            ':end_date'         => $endDate,
            ':total_limit'      => $totalLimit,
            ':max_per_purchase' => $maxPerPurchase,
            ':created_at'       => $nowStr,
        ]);

        echo json_encode(['success' => true, 'id' => $id, 'code' => $code, 'message' => 'Código de descuento creado exitosamente.'], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

} catch (Exception $e) {
    // Log error details securely to server private log ONLY
    error_log('Discounts API Error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    http_response_code(500);
    echo json_encode([
        'valid'   => false,
        'success' => false,
        'error'   => 'No pudimos validar el código en este momento. Puedes continuar sin descuento o intentarlo más tarde.'
    ], JSON_UNESCAPED_UNICODE);
    exit(1);
}

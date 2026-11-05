<?php
/**
 * public/api/webpay/create.php
 * Endpoint de inicio de transacción Webpay Plus Sandbox Transbank.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

if (file_exists(__DIR__ . '/../db_config.php')) {
    require_once __DIR__ . '/../db_config.php';
}

function getWebpayDB() {
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
    $pdo = getWebpayDB();

    $inputRaw = file_get_contents('php://input');
    $data = json_decode($inputRaw, true) ?: $_POST;

    $orderId = isset($data['orderId']) ? trim($data['orderId']) : '';

    if (!$orderId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'orderId es requerido']);
        exit(1);
    }

    // Lock order
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = :id");
    $stmt->execute([':id' => $orderId]);
    $order = $stmt->fetch();

    $cutoffTs = strtotime('2026-09-05 21:00:00 America/Santiago');
    $isSimClosed = (isset($_GET['sim_closed']) && $_GET['sim_closed'] === '1');
    if (time() >= $cutoffTs || $isSimClosed) {
        http_response_code(403);
        echo json_encode([
            'success'     => false,
            'salesClosed' => true,
            'error'       => 'La venta de entradas para el festival ha finalizado oficialmente a las 21:00 hrs del 5 de septiembre de 2026.'
        ], JSON_UNESCAPED_UNICODE);
        exit(1);
    }

    if (!$order) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Orden no encontrada']);
        exit(1);
    }

    $nowTs = time();
    $resUntilTs = !empty($order['reserved_until']) ? strtotime($order['reserved_until']) : 0;
    if ($order['status'] !== 'reserved' || ($resUntilTs > 0 && $resUntilTs < $nowTs)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'La reserva de 15 minutos ha expirado. Por favor, selecciona tus butacas nuevamente.'
        ], JSON_UNESCAPED_UNICODE);
        exit(1);
    }

    // Transbank Webpay Plus Credentials from private .env
    $tbk = getTransbankConfig();
    if (!$tbk['valid']) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error'   => $tbk['error']
        ], JSON_UNESCAPED_UNICODE);
        exit(1);
    }

    $commerceCode = $tbk['commerceCode'];
    $apiKey       = $tbk['apiKey'];
    $apiUrl       = $tbk['createUrl'];

    // Protocol return URL
    $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'ticketfestival.tupartnerti.cl';
    $returnUrl = sprintf('%s://%s/api/webpay/return.php', $protocol, $host);

    $payload = [
        'buy_order'  => $order['id'],
        'session_id' => 'SESS-' . time() . '-' . rand(1000, 9999),
        'amount'     => (int)$order['total_amount'],
        'return_url' => $returnUrl,
    ];

    $token = null;
    $url   = null;

    // Call Transbank REST API
    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Tbk-Api-Key-Id: ' . $commerceCode,
        'Tbk-Api-Key-Secret: ' . $apiKey,
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $responseRaw = curl_exec($ch);
    $httpCode    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $responseRaw) {
        $resData = json_decode($responseRaw, true);
        if (isset($resData['token']) && isset($resData['url'])) {
            $token = $resData['token'];
            $url   = $resData['url'];
        }
    }

    if (!$token || !$url) {
        http_response_code(502);
        echo json_encode([
            'success' => false,
            'error'   => 'No pudimos conectar con la pasarela de Webpay en este momento. Por favor inténtalo de nuevo en unos momentos.'
        ], JSON_UNESCAPED_UNICODE);
        exit(1);
    }

    // Update order with webpay token
    $stmtUpdate = $pdo->prepare("UPDATE orders SET webpay_token = :token WHERE id = :id");
    $stmtUpdate->execute([':token' => $token, ':id' => $orderId]);

    echo json_encode([
        'success'     => true,
        'token'       => $token,
        'url'         => $url,
        'orderId'     => $orderId,
        'totalAmount' => (int)$order['total_amount'],
    ], JSON_UNESCAPED_UNICODE);
    exit(0);

} catch (Exception $e) {
    error_log('Webpay Create Error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'No pudimos iniciar el pago con Webpay. Por favor verifica tus datos e inténtalo de nuevo.'
    ], JSON_UNESCAPED_UNICODE);
    exit(1);
}

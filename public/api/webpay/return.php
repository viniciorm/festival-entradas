<?php
/**
 * public/api/webpay/return.php
 * Callback de retorno Webpay Plus Transbank.
 * Confirma el pago, asigna las butacas, registra auditoría en webpay_logs y entrega un voucher visual responsivo.
 */

if (file_exists(__DIR__ . '/../db_config.php')) {
    require_once __DIR__ . '/../db_config.php';
}

function getReturnDB() {
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

function shouldReturnJson() {
    if (isset($_GET['format']) && $_GET['format'] === 'json') return true;
    $accept = isset($_SERVER['HTTP_ACCEPT']) ? $_SERVER['HTTP_ACCEPT'] : '';
    if (strpos($accept, 'application/json') !== false && strpos($accept, 'text/html') === false) return true;
    return false;
}

function logWebpayEvent($pdo, $orderId, $token, $eventType, $amount, $statusCode, $buyerEmail, $rawData = null, $errorMessage = null) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO webpay_logs (order_id, token_ws, event_type, amount, status_code, buyer_email, raw_data, error_message, ip_address)
            VALUES (:oid, :tok, :evt, :amt, :code, :email, :raw, :err, :ip)
        ");
        $stmt->execute([
            ':oid'   => $orderId,
            ':tok'   => $token,
            ':evt'   => $eventType,
            ':amt'   => $amount ? (int)$amount : null,
            ':code'  => $statusCode !== null ? (int)$statusCode : null,
            ':email' => $buyerEmail,
            ':raw'   => is_string($rawData) ? $rawData : json_encode($rawData, JSON_UNESCAPED_UNICODE),
            ':err'   => $errorMessage,
            ':ip'    => $_SERVER['REMOTE_ADDR'] ?? ''
        ]);
    } catch (Exception $e) {
        error_log("Failed to log webpay event: " . $e->getMessage());
    }
}

function renderHtmlVoucher($status, $order, $seatIds = [], $message = '', $authCode = null, $detailInfo = null) {
    header('Content-Type: text/html; charset=utf-8');
    $isSuccess = ($status === 'APPROVED');
    $isAborted = ($status === 'ABORTED');
    $totalFormatted = isset($order['total_amount']) ? '$' . number_format((int)$order['total_amount'], 0, ',', '.') : '$0';
    $seatsStr = !empty($seatIds) ? implode(', ', $seatIds) : 'N/A';
    ?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $isSuccess ? '¡Pago Exitoso! — Festival Danza del Vientre 2026' : 'Resultado de Transacción — Festival Danza del Vientre'; ?></title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800;900&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #0c071e; color: #f8fafc; }
        .font-cinzel { font-family: 'Cinzel', serif; }
        .gold-gradient { background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); }
    </style>
</head>
<body class="min-h-screen flex flex-col justify-between bg-gradient-to-b from-[#140b2e] via-[#0d0724] to-[#080415] p-4 sm:p-6">
    
    <div class="max-w-xl w-full mx-auto my-auto space-y-6">
        <!-- Brand Header -->
        <div class="text-center space-y-2">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold tracking-widest uppercase">
                <span>XXIV Festival Nacional Danza del Vientre Chile 2026</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-black font-cinzel text-white tracking-wide">
                <?php echo $isSuccess ? 'Comprobante Oficial de Compra' : 'Estado de tu Transacción'; ?>
            </h1>
        </div>

        <!-- Main Card -->
        <div class="bg-slate-900/90 border <?php echo $isSuccess ? 'border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.2)]' : ($isAborted ? 'border-amber-500/50' : 'border-red-500/50'); ?> rounded-3xl p-6 sm:p-8 space-y-6 backdrop-blur-xl">
            
            <!-- Status Header -->
            <div class="flex items-center gap-4 border-b border-white/10 pb-5">
                <?php if ($isSuccess): ?>
                    <div class="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                        <svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>
                    <div>
                        <span class="text-xs font-extrabold uppercase tracking-wider text-emerald-400">Transbank Webpay Plus Aprobado</span>
                        <h2 class="text-xl sm:text-2xl font-black text-white font-cinzel">¡PAGO CONFIRMADO CON ÉXITO!</h2>
                    </div>
                <?php elseif ($isAborted): ?>
                    <div class="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                        <svg class="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                    </div>
                    <div>
                        <span class="text-xs font-extrabold uppercase tracking-wider text-amber-400">Transacción Cancelada</span>
                        <h2 class="text-xl sm:text-2xl font-black text-white font-cinzel">COMPRA CANCELADA</h2>
                    </div>
                <?php else: ?>
                    <div class="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-400/40 flex items-center justify-center shrink-0">
                        <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </div>
                    <div>
                        <span class="text-xs font-extrabold uppercase tracking-wider text-red-400">Transacción Rechazada o Interrumpida</span>
                        <h2 class="text-xl sm:text-2xl font-black text-white font-cinzel">PAGO NO COMPLETADO</h2>
                    </div>
                <?php endif; ?>
            </div>

            <!-- Message Detail -->
            <?php if ($message): ?>
                <p class="text-sm text-slate-300">
                    <?php echo htmlspecialchars($message); ?>
                </p>
            <?php endif; ?>

            <!-- Purchase Summary Table -->
            <?php if ($order): ?>
                <div class="bg-black/40 rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3 text-xs sm:text-sm">
                    <div class="flex justify-between items-center pb-2 border-b border-white/10">
                        <span class="text-slate-400 uppercase font-bold text-[11px]">N° de Orden:</span>
                        <span class="font-mono font-bold text-amber-300"><?php echo htmlspecialchars($order['id']); ?></span>
                    </div>

                    <div class="flex justify-between items-center pb-2 border-b border-white/10">
                        <span class="text-slate-400 uppercase font-bold text-[11px]">Titular:</span>
                        <span class="font-extrabold text-white"><?php echo htmlspecialchars($order['buyer_name']); ?></span>
                    </div>

                    <div class="flex justify-between items-center pb-2 border-b border-white/10">
                        <span class="text-slate-400 uppercase font-bold text-[11px]">Correo de Entrega:</span>
                        <span class="font-mono text-slate-200"><?php echo htmlspecialchars($order['buyer_email']); ?></span>
                    </div>

                    <div class="flex justify-between items-center pb-2 border-b border-white/10">
                        <span class="text-slate-400 uppercase font-bold text-[11px]">Butacas:</span>
                        <span class="font-mono font-black text-amber-400 text-base"><?php echo htmlspecialchars($seatsStr); ?></span>
                    </div>

                    <div class="flex justify-between items-center pb-2 border-b border-white/10">
                        <span class="text-slate-400 uppercase font-bold text-[11px]">Total Pagado:</span>
                        <span class="font-extrabold text-emerald-400 text-base sm:text-lg"><?php echo $totalFormatted; ?></span>
                    </div>

                    <?php if ($authCode): ?>
                        <div class="flex justify-between items-center pt-1 text-[11px] text-slate-400">
                            <span class="uppercase font-bold">Cód. Autorización Webpay:</span>
                            <span class="font-mono font-bold text-white"><?php echo htmlspecialchars($authCode); ?></span>
                        </div>
                    <?php endif; ?>
                </div>
            <?php endif; ?>

            <!-- Success Information Notice -->
            <?php if ($isSuccess): ?>
                <div class="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 text-xs text-emerald-200 space-y-2">
                    <p class="font-bold flex items-center gap-1.5 text-emerald-300">
                        <span>🎟️</span> Tus entradas están aseguradas en el sistema.
                    </p>
                    <p class="leading-relaxed opacity-90">
                        Puedes descargar tus entradas oficiales en PDF con código QR en cualquier momento desde la sección <strong>Mis Entradas</strong> con tu correo o Google, o presentar tu cédula de identidad en la puerta del teatro.
                    </p>
                </div>
            <?php else: ?>
                <!-- Helpful Reassurance Box for Customer Support -->
                <div class="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 space-y-2">
                    <p class="font-bold flex items-center gap-1.5 text-amber-300">
                        <span>💡</span> ¿El cobro aparece en tu banco?
                    </p>
                    <p class="leading-relaxed opacity-90">
                        No te preocupes: Si tu banco registró el descuento pero la pasarela se interrumpió, contáctanos a <a href="mailto:festivalnac.danzadelvientre@gmail.com" class="underline font-bold text-white">festivalnac.danzadelvientre@gmail.com</a> con tu comprobante y confirmaremos tus entradas manualmente en el sistema de inmediato.
                    </p>
                </div>
            <?php endif; ?>

            <!-- Action Buttons -->
            <div class="space-y-3 pt-2">
                <?php if ($isSuccess): ?>
                    <a href="/mis-entradas" class="w-full py-4 gold-gradient text-slate-950 font-black text-sm rounded-2xl shadow-xl hover:scale-[1.01] transition-transform flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider">
                        <span>🎟️ Ver y Descargar Mis Entradas</span>
                    </a>
                <?php else: ?>
                    <a href="/#plano" class="w-full py-4 gold-gradient text-slate-950 font-black text-sm rounded-2xl shadow-xl hover:scale-[1.01] transition-transform flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider">
                        <span>🔄 Volver a Seleccionar Butacas</span>
                    </a>
                <?php endif; ?>

                <a href="/" class="w-full py-3 bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-xs rounded-2xl flex items-center justify-center transition-colors">
                    <span>Volver a la Portada del Festival</span>
                </a>
            </div>

        </div>

        <!-- Support Footer -->
        <p class="text-center text-xs text-slate-500">
            Teatro Aula Magna LMS • Av. Irarrázaval 3780, Ñuñoa, Santiago<br />
            Operado por TuPartnerTI
        </p>
    </div>

</body>
</html>
    <?php
    exit(0);
}

try {
    $pdo = getReturnDB();

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

    // Ensure column webpay_response_json exists in orders table
    $cols = $pdo->query("SHOW COLUMNS FROM orders LIKE 'webpay_response_json'")->fetchAll();
    if (empty($cols)) {
        $pdo->exec("ALTER TABLE orders ADD COLUMN webpay_response_json TEXT NULL AFTER webpay_response_code");
    }

    // Extract token_ws primarily from Webpay HTML POST return form
    $inputRaw = file_get_contents('php://input');
    $postData = json_decode($inputRaw, true) ?: $_POST;

    $token = isset($postData['token_ws']) ? trim($postData['token_ws']) : (isset($_POST['token_ws']) ? trim($_POST['token_ws']) : (isset($_GET['token_ws']) ? trim($_GET['token_ws']) : ''));
    $tbkToken = isset($postData['TBK_TOKEN']) ? trim($postData['TBK_TOKEN']) : (isset($_POST['TBK_TOKEN']) ? trim($_POST['TBK_TOKEN']) : (isset($_GET['TBK_TOKEN']) ? trim($_GET['TBK_TOKEN']) : ''));
    $tbkOrdenCompra = isset($postData['TBK_ORDEN_COMPRA']) ? trim($postData['TBK_ORDEN_COMPRA']) : (isset($_POST['TBK_ORDEN_COMPRA']) ? trim($_POST['TBK_ORDEN_COMPRA']) : (isset($_GET['TBK_ORDEN_COMPRA']) ? trim($_GET['TBK_ORDEN_COMPRA']) : ''));

    // User aborted / cancelled on Transbank page
    if ($tbkToken && !$token) {
        $pdo->beginTransaction();
        $stmtOrder = $pdo->prepare("SELECT * FROM orders WHERE id = :id OR webpay_token = :token FOR UPDATE");
        $stmtOrder->execute([':id' => $tbkOrdenCompra, ':token' => $tbkToken]);
        $order = $stmtOrder->fetch();

        $seatIds = [];
        if ($order) {
            $seatIds = json_decode($order['seat_ids_json'], true) ?: [];
            if (!empty($seatIds)) {
                $placeholders = implode(',', array_fill(0, count($seatIds), '?'));
                $stmtFree = $pdo->prepare("UPDATE seats SET status = 'available', reserved_until = NULL, order_id = NULL WHERE id IN ($placeholders)");
                $stmtFree->execute($seatIds);
            }
            $stmtCancel = $pdo->prepare("UPDATE orders SET status = 'cancelled' WHERE id = :id");
            $stmtCancel->execute([':id' => $order['id']]);
        }
        $pdo->commit();

        logWebpayEvent($pdo, $order ? $order['id'] : $tbkOrdenCompra, $tbkToken, 'USER_ABORTED', $order ? $order['total_amount'] : null, null, $order ? $order['buyer_email'] : null, $postData, 'Compra cancelada por el usuario en Transbank.');

        if (shouldReturnJson()) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'status'  => 'ABORTED',
                'error'   => 'Compra cancelada por el usuario en Webpay. Las butacas han sido liberadas automáticamente.'
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        renderHtmlVoucher('ABORTED', $order, $seatIds, 'La transacción fue cancelada en la pantalla de Webpay. Las butacas seleccionadas han sido liberadas.');
    }

    if (!$token) {
        logWebpayEvent($pdo, null, null, 'MISSING_TOKEN', null, 400, null, $postData, 'token_ws no recibido');
        if (shouldReturnJson()) {
            http_response_code(400);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['success' => false, 'error' => 'token_ws no recibido']);
            exit(1);
        }
        renderHtmlVoucher('FAILED', null, [], 'No se recibió el token de confirmación de Transbank.');
    }

    // 🔒 IDEMPOTENT TRANSACTION (SELECT ... FOR UPDATE)
    $pdo->beginTransaction();

    $stmtOrder = $pdo->prepare("SELECT * FROM orders WHERE webpay_token = :token FOR UPDATE");
    $stmtOrder->execute([':token' => $token]);
    $order = $stmtOrder->fetch();

    if (!$order) {
        $pdo->rollBack();
        logWebpayEvent($pdo, null, $token, 'ORDER_NOT_FOUND', null, 404, null, $postData, 'Orden no encontrada para el token proporcionado');
        if (shouldReturnJson()) {
            http_response_code(404);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['success' => false, 'error' => 'Orden de compra no encontrada para el token proporcionado']);
            exit(1);
        }
        renderHtmlVoucher('FAILED', null, [], 'Orden de compra no encontrada para el token proporcionado.');
    }

    $seatIds = json_decode($order['seat_ids_json'], true) ?: [];

    // ── IDEMPOTENCY CHECK ────────────────────────────────────────────────────
    if ($order['status'] === 'paid') {
        $pdo->rollBack();
        logWebpayEvent($pdo, $order['id'], $token, 'ALREADY_PAID', $order['total_amount'], 0, $order['buyer_email'], null, 'Idempotente: orden ya pagada previamente');

        if (shouldReturnJson()) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success'          => true,
                'status'           => 'APPROVED',
                'alreadyProcessed' => true,
                'orderId'          => $order['id'],
                'seatIds'          => $seatIds,
                'buyerName'        => $order['buyer_name'],
                'buyerEmail'       => $order['buyer_email'],
                'totalAmount'      => (int)$order['total_amount'],
                'message'          => 'La orden ya fue procesada y pagada anteriormente.'
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        renderHtmlVoucher('APPROVED', $order, $seatIds, 'Tu orden ya fue pagada y confirmada con anterioridad.', $order['webpay_authorization_code']);
    }

    // Transbank Credentials
    $tbk = getTransbankConfig();
    if (!$tbk['valid']) {
        $pdo->rollBack();
        logWebpayEvent($pdo, $order['id'], $token, 'CONFIG_ERROR', $order['total_amount'], 500, $order['buyer_email'], null, $tbk['error']);
        if (shouldReturnJson()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['success' => false, 'error' => $tbk['error']], JSON_UNESCAPED_UNICODE);
            exit(1);
        }
        renderHtmlVoucher('FAILED', $order, $seatIds, 'Error en la configuración de la pasarela de pago.');
    }

    $commerceCode = $tbk['commerceCode'];
    $apiKey       = $tbk['apiKey'];
    $apiUrl       = $tbk['commitUrl'] . $token;

    $responseCode = -1;
    $tbkBuyOrder  = null;
    $tbkAmount    = null;
    $tbkAuthCode  = null;
    $responseJson = null;

    // Call Transbank Commit API (PUT) if token is real, or simulate for Sandbox test tokens
    if (strpos($token, 'token_ws_sandbox_') === 0) {
        $isSimulationApproved = isset($postData['simulate_fail']) ? false : true;
        $responseCode = $isSimulationApproved ? 0 : -1;
        $tbkBuyOrder  = $order['id'];
        $tbkAmount    = (int)$order['total_amount'];
        $tbkAuthCode  = '123456';
        $responseJson = json_encode([
            'response_code'       => $responseCode,
            'buy_order'           => $order['id'],
            'amount'              => $order['total_amount'],
            'authorization_code'  => '123456',
            'payment_type_code'   => 'VN',
            'transaction_date'    => date('c'),
        ]);
    } else {
        $ch = curl_init($apiUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Tbk-Api-Key-Id: ' . $commerceCode,
            'Tbk-Api-Key-Secret: ' . $apiKey,
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);

        $responseRaw = curl_exec($ch);
        $httpCode    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && $responseRaw) {
            $responseJson = $responseRaw;
            $resData = json_decode($responseRaw, true);
            $responseCode = isset($resData['response_code']) ? (int)$resData['response_code'] : -1;
            $tbkBuyOrder  = isset($resData['buy_order']) ? $resData['buy_order'] : null;
            $tbkAmount    = isset($resData['amount']) ? (int)$resData['amount'] : null;
            $tbkAuthCode  = isset($resData['authorization_code']) ? $resData['authorization_code'] : null;
        } else {
            $responseJson = json_encode(['httpCode' => $httpCode, 'raw' => $responseRaw]);
        }
    }

    // ── PAYMENT VERIFICATION: STRICT BACKEND MATCHING ──────────────────────
    $isApproved = ($responseCode === 0) && ($tbkAmount === (int)$order['total_amount']);

    if ($isApproved) {
        $nowIso = date('c');

        // 1. Update Order status -> 'paid'
        $stmtUpdateOrder = $pdo->prepare("
            UPDATE orders SET
                status = 'paid',
                paid_at = :paid_at,
                webpay_authorization_code = :auth_code,
                webpay_response_code = :res_code,
                webpay_response_json = :webpay_resp
            WHERE id = :id
        ");
        $stmtUpdateOrder->execute([
            ':paid_at'     => $nowIso,
            ':auth_code'   => $tbkAuthCode,
            ':res_code'    => $responseCode,
            ':webpay_resp' => $responseJson,
            ':id'          => $order['id']
        ]);

        // 2. Update Seats status -> 'sold'
        if (!empty($seatIds)) {
            $stmtUpdateSeat = $pdo->prepare("
                UPDATE seats SET
                    status = 'sold',
                    assigned_participant_name = :buyer_name,
                    ticket_code = :ticket_code,
                    reserved_until = NULL,
                    order_id = :order_id
                WHERE id = :id
            ");

            foreach ($seatIds as $sid) {
                $tCode = sprintf('TKT-%s%06d-FDVC2026', $sid[0], (int)substr($sid, 1));
                $stmtUpdateSeat->execute([
                    ':buyer_name'  => $order['buyer_name'],
                    ':ticket_code' => $tCode,
                    ':order_id'    => $order['id'],
                    ':id'          => $sid
                ]);
            }
        }

        // 3. Increment Discount used_count & Log Redemption if discount code was applied
        if (!empty($order['discount_code'])) {
            $stmtDiscInc = $pdo->prepare("UPDATE discounts SET used_count = used_count + 1 WHERE UPPER(code) = UPPER(:code)");
            $stmtDiscInc->execute([':code' => $order['discount_code']]);

            try {
                $stmtDiscGet = $pdo->prepare("SELECT id FROM discounts WHERE UPPER(code) = UPPER(:code) LIMIT 1");
                $stmtDiscGet->execute([':code' => $order['discount_code']]);
                $discRow = $stmtDiscGet->fetch();
                $discId = $discRow ? (string)$discRow['id'] : 'DISC-UNKNOWN';

                $stmtLog = $pdo->prepare("
                    INSERT INTO discount_logs (discount_id, code, order_id, buyer_email, discount_amount, used_at)
                    VALUES (:disc_id, :code, :order_id, :buyer_email, :discount_amount, NOW())
                ");
                $stmtLog->execute([
                    ':disc_id'         => $discId,
                    ':code'            => $order['discount_code'],
                    ':order_id'        => $order['id'],
                    ':buyer_email'     => $order['buyer_email'] ?? '',
                    ':discount_amount' => (int)($order['discount_amount'] ?? 0),
                ]);
            } catch (Exception $e) {
                error_log("Error logging discount redemption: " . $e->getMessage());
            }
        }

        $pdo->commit();

        logWebpayEvent($pdo, $order['id'], $token, 'APPROVED', $order['total_amount'], 0, $order['buyer_email'], $responseJson, 'Pago aprobado con éxito.');

        if (shouldReturnJson()) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success'          => true,
                'status'           => 'APPROVED',
                'alreadyProcessed' => false,
                'orderId'          => $order['id'],
                'buyerName'        => $order['buyer_name'],
                'buyerEmail'       => $order['buyer_email'],
                'seatIds'          => $seatIds,
                'totalAmount'      => (int)$order['total_amount'],
                'authorizationCode'=> $tbkAuthCode,
                'message'          => '¡Pago aprobado con éxito! Entradas emitidas.'
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        renderHtmlVoucher('APPROVED', $order, $seatIds, '¡Tu compra ha sido procesada exitosamente! Tus entradas ya están emitidas.', $tbkAuthCode);

    } else {
        // ❌ REJECTED OR FAILED PAYMENT -> AUTOMATICALLY RELEASE SEATS
        $stmtUpdateOrder = $pdo->prepare("
            UPDATE orders SET
                status = 'failed',
                webpay_response_code = :res_code,
                webpay_response_json = :webpay_resp
            WHERE id = :id
        ");
        $stmtUpdateOrder->execute([
            ':res_code'    => $responseCode,
            ':webpay_resp' => $responseJson ?: json_encode(['error' => 'Transbank rejected or timeout']),
            ':id'          => $order['id']
        ]);

        if (!empty($seatIds)) {
            $placeholders = implode(',', array_fill(0, count($seatIds), '?'));
            $stmtFreeSeats = $pdo->prepare("
                UPDATE seats SET
                    status = 'available',
                    reserved_until = NULL,
                    order_id = NULL
                WHERE id IN ($placeholders)
            ");
            $stmtFreeSeats->execute($seatIds);
        }

        $pdo->commit();

        logWebpayEvent($pdo, $order['id'], $token, 'REJECTED', $order['total_amount'], $responseCode, $order['buyer_email'], $responseJson, 'Pago rechazado por el banco emisor o Transbank.');

        if (shouldReturnJson()) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'status'  => 'REJECTED',
                'error'   => 'El pago fue rechazado por el banco emisor o cancelado. Las butacas han sido liberadas automáticamente.'
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        renderHtmlVoucher('REJECTED', $order, $seatIds, 'El pago fue rechazado por el banco emisor o la sesión expiró. Las butacas han sido liberadas automáticamente.');
    }

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Webpay Return Error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());

    if (isset($pdo)) {
        logWebpayEvent($pdo, isset($order) ? $order['id'] : null, isset($token) ? $token : null, 'EXCEPTION_ERROR', isset($order) ? $order['total_amount'] : null, 500, isset($order) ? $order['buyer_email'] : null, null, $e->getMessage());
    }

    if (shouldReturnJson()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'error'   => 'Ocurrió un inconveniente al confirmar tu pago. Si el cobro aparece en tu banco, por favor contáctanos con tu comprobante.'
        ], JSON_UNESCAPED_UNICODE);
        exit(1);
    }

    renderHtmlVoucher('ERROR', isset($order) ? $order : null, isset($seatIds) ? $seatIds : [], 'Ocurrió un inconveniente temporal de confirmación. Si el cobro aparece en tu cartola bancaria, no te preocupes: contáctanos y validaremos tus entradas de inmediato.');
}

<?php
/**
 * public/api/webpay/sandbox-portal.php
 * Portal interactivo de simulación Transbank Webpay Plus Sandbox.
 */

$token = isset($_GET['token_ws']) ? $_GET['token_ws'] : '';

if (file_exists(__DIR__ . '/../db_config.php')) {
    require_once __DIR__ . '/../db_config.php';
}

$dbFile = __DIR__ . '/../festival_database.sqlite';
$pdo = new PDO('sqlite:' . $dbFile);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

$stmt = $pdo->prepare("SELECT * FROM orders WHERE webpay_token = :token");
$stmt->execute([':token' => $token]);
$order = $stmt->fetch();

$buyOrder = $order ? $order['id'] : 'ORD-SAMPLE';
$amount = $order ? (int)$order['total_amount'] : 10400;
$buyerName = $order ? $order['buyer_name'] : 'Comprador';
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Webpay Plus — Entorno de Pruebas Sandbox Transbank</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b; margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-h: 100vh; }
        .card { background: #ffffff; width: 100%; max-width: 440px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; overflow: hidden; }
        .header { background: #1a1333; color: white; padding: 20px; text-align: center; }
        .header img { height: 28px; margin-bottom: 8px; }
        .body { padding: 24px; }
        .amount-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 20px; }
        .amount-title { font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase; }
        .amount-value { font-size: 28px; color: #0f172a; font-weight: 900; margin: 4px 0; }
        .sandbox-badge { display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 20px; border: 1px solid #fde68a; margin-bottom: 16px; }
        .btn { width: 100%; border: none; padding: 14px; font-size: 14px; font-weight: 800; border-radius: 10px; cursor: pointer; transition: all 0.2s; margin-bottom: 10px; }
        .btn-pay { background: #2563eb; color: white; }
        .btn-pay:hover { background: #1d4ed8; }
        .btn-fail { background: #dc2626; color: white; }
        .btn-fail:hover { background: #b91c1c; }
        .btn-cancel { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
        .btn-cancel:hover { background: #e2e8f0; }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <h2 style="margin:0; font-size: 18px;">webpay<span style="color:#f59e0b">plus</span></h2>
            <p style="margin:4px 0 0 0; font-size: 11px; color: #94a3b8;">TRANSBANK SANDBOX SIMULATOR</p>
        </div>
        <div class="body">
            <div style="text-align: center;">
                <span class="sandbox-badge">⚠️ ENTORNO DE PRUEBAS DE INTEGRACIÓN</span>
            </div>

            <div class="amount-box">
                <div class="amount-title">Monto Total a Pagar</div>
                <div class="amount-value">$<?php echo number_format($amount, 0, ',', '.'); ?> CLP</div>
                <div style="font-size: 11px; color: #64748b;">Orden: <strong><?php echo htmlspecialchars($buyOrder); ?></strong> | <?php echo htmlspecialchars($buyerName); ?></div>
            </div>

            <form action="/api/webpay/return.php" method="GET">
                <input type="hidden" name="token_ws" value="<?php echo htmlspecialchars($token); ?>">
                <button type="submit" class="btn btn-pay">✓ Pagar con Éxito (Aprobar Transacción)</button>
            </form>

            <form action="/api/webpay/return.php" method="GET">
                <input type="hidden" name="token_ws" value="<?php echo htmlspecialchars($token); ?>">
                <input type="hidden" name="simulate_fail" value="1">
                <button type="submit" class="btn btn-fail">✕ Rechazar Pago (Simular Error de Banco)</button>
            </form>

            <form action="/api/webpay/return.php" method="GET">
                <input type="hidden" name="TBK_TOKEN" value="<?php echo htmlspecialchars($token); ?>">
                <input type="hidden" name="TBK_ORDEN_COMPRA" value="<?php echo htmlspecialchars($buyOrder); ?>">
                <button type="submit" class="btn btn-cancel">← Cancelar Compra y Volver</button>
            </form>
        </div>
    </div>
</body>
</html>

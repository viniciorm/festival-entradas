<?php
/**
 * public/api/db_config.php
 * Configuración de Base de Datos MySQL (tupartne_festival)
 */

$possibleEnvPaths = [
    '/home/tupartne/.env',
    dirname(__DIR__, 2) . '/.env',
    dirname(__DIR__, 3) . '/.env',
    dirname(__DIR__, 4) . '/.env',
    dirname(__DIR__, 5) . '/.env',
    dirname(__DIR__, 6) . '/.env',
];

foreach ($possibleEnvPaths as $envPath) {
    if (file_exists($envPath) && is_readable($envPath)) {
        $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos(trim($line), '#') === 0) continue;
            list($name, $value) = explode('=', $line, 2) + [null, null];
            if ($name && $value !== null) {
                $name = trim($name);
                $value = trim($value, " \t\n\r\0\x0B\"'");
                if (!getenv($name)) {
                    putenv("$name=$value");
                    $_ENV[$name] = $value;
                    $_SERVER[$name] = $value;
                }
            }
        }
        break;
    }
}

// Database Configuration - Always connect to cPanel MySQL tupartne_festival
define('DB_TYPE', 'mysql');
define('DB_HOST', getenv('MYSQL_HOST') ?: (getenv('DB_HOST') ?: 'localhost'));
define('DB_NAME', getenv('MYSQL_DATABASE') ?: (getenv('DB_NAME') ?: 'tupartne_festival'));
define('DB_USER', getenv('MYSQL_USER') ?: (getenv('DB_USER') ?: 'tupartne_festival'));
define('DB_PASS', getenv('MYSQL_PASSWORD') ?: (getenv('DB_PASS') ?: ''));

// Webpay Plus Configuration - Always read from private .env
define('TRANSBANK_ENV', getenv('TRANSBANK_ENV') ?: 'production');
define('TRANSBANK_COMMERCE_CODE', getenv('TRANSBANK_COMMERCE_CODE') ?: '');
define('TRANSBANK_API_KEY_SECRET', getenv('TRANSBANK_API_KEY_SECRET') ?: '');

// Google OAuth Configuration - Always read exclusively from private .env
define('GOOGLE_OAUTH_CLIENT_ID', getenv('GOOGLE_OAUTH_CLIENT_ID') ?: '');
define('GOOGLE_OAUTH_CLIENT_SECRET', getenv('GOOGLE_OAUTH_CLIENT_SECRET') ?: '');
define('GOOGLE_OAUTH_REDIRECT_URI', getenv('GOOGLE_OAUTH_REDIRECT_URI') ?: '');

function getTransbankConfig() {
    $env          = defined('TRANSBANK_ENV') ? TRANSBANK_ENV : (getenv('TRANSBANK_ENV') ?: 'production');
    $commerceCode = defined('TRANSBANK_COMMERCE_CODE') ? TRANSBANK_COMMERCE_CODE : (getenv('TRANSBANK_COMMERCE_CODE') ?: '');
    $apiKey       = defined('TRANSBANK_API_KEY_SECRET') ? TRANSBANK_API_KEY_SECRET : (getenv('TRANSBANK_API_KEY_SECRET') ?: '');

    if (empty($commerceCode) || empty($apiKey)) {
        return [
            'valid' => false,
            'error' => 'Configuración de Webpay Plus no disponible en el servidor. Contacte a la administración.'
        ];
    }

    $isProduction = ($env === 'production');
    $baseUrl      = $isProduction
        ? 'https://webpay3g.transbank.cl'
        : 'https://webpay3gint.transbank.cl';

    return [
        'valid'        => true,
        'environment'  => $isProduction ? 'production' : 'integration',
        'commerceCode' => $commerceCode,
        'apiKey'       => $apiKey,
        'baseUrl'      => $baseUrl,
        'createUrl'    => $baseUrl . '/rswebpaytransaction/api/webpay/v1.2/transactions',
        'commitUrl'    => $baseUrl . '/rswebpaytransaction/api/webpay/v1.2/transactions/',
    ];
}

/**
 * Rutina transaccional para liberar reservas expiradas.
 * Localiza sólo órdenes 'reserved' vencidas (reserved_until <= NOW()) bajo FOR UPDATE.
 * Marca esas órdenes específicas como 'expired' y libera exclusivamente las butacas vinculadas a dichos order_ids.
 * NUNCA toca reservas vigentes ni asientos con 'sent', 'assigned', 'invitation', 'sold' o 'checked_in'.
 */
function releaseExpiredReservations(PDO $pdo) {
    try {
        $nowSql = date('Y-m-d H:i:s');
        $nowTs  = time();

        $alreadyInTransaction = $pdo->inTransaction();
        if (!$alreadyInTransaction) {
            $pdo->beginTransaction();
        }

        // 1. SELECT and LOCK ONLY orders that are 'reserved' and strictly expired
        $stmt = $pdo->prepare("
            SELECT id, seat_ids_json, reserved_until 
            FROM orders 
            WHERE status = 'reserved' 
              AND reserved_until IS NOT NULL 
              AND (reserved_until <= :now_sql OR UNIX_TIMESTAMP(reserved_until) <= :now_ts)
            FOR UPDATE
        ");
        $stmt->execute([
            ':now_sql' => $nowSql,
            ':now_ts'  => $nowTs,
        ]);
        $expiredOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (!empty($expiredOrders)) {
            $expiredOrderIds = array_column($expiredOrders, 'id');

            // Collect seat IDs from expired orders
            $seatIdsToFree = [];
            foreach ($expiredOrders as $ord) {
                $sIds = json_decode($ord['seat_ids_json'], true) ?: [];
                foreach ($sIds as $sid) {
                    $seatIdsToFree[] = trim($sid);
                }
            }
            $seatIdsToFree = array_values(array_unique(array_filter($seatIdsToFree)));

            // Mark expired orders
            $orderPlaceholders = implode(',', array_fill(0, count($expiredOrderIds), '?'));
            $stmtUpdOrders = $pdo->prepare("
                UPDATE orders 
                SET status = 'expired' 
                WHERE id IN ($orderPlaceholders)
            ");
            $stmtUpdOrders->execute($expiredOrderIds);

            // Free EXCLUSIVELY seats assigned to those expired orders
            $stmtFreeSeats = $pdo->prepare("
                UPDATE seats 
                SET status = 'available', 
                    reserved_until = NULL, 
                    order_id = NULL 
                WHERE status = 'reserved' 
                  AND order_id IN ($orderPlaceholders)
            ");
            $stmtFreeSeats->execute($expiredOrderIds);

            // Safety fallback for any expired order seats where order_id was not populated
            if (!empty($seatIdsToFree)) {
                $seatPlaceholders = implode(',', array_fill(0, count($seatIdsToFree), '?'));
                $stmtFreeById = $pdo->prepare("
                    UPDATE seats 
                    SET status = 'available', 
                        reserved_until = NULL, 
                        order_id = NULL 
                    WHERE status = 'reserved' 
                      AND (order_id IS NULL OR order_id = '')
                      AND id IN ($seatPlaceholders)
                ");
                $stmtFreeById->execute($seatIdsToFree);
            }
        }

        if (!$alreadyInTransaction) {
            $pdo->commit();
        }

        return count($expiredOrders);

    } catch (Exception $e) {
        if (!$alreadyInTransaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('releaseExpiredReservations Error: ' . $e->getMessage());
        return 0;
    }
}

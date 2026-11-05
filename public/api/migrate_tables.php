<?php
/**
 * public/api/migrate_tables.php
 * Migración idempotente para asegurar tablas discounts, orders y discount_logs en MySQL tupartne_festival.
 */

header('Content-Type: application/json; charset=utf-8');

if (file_exists(__DIR__ . '/db_config.php')) {
    require_once __DIR__ . '/db_config.php';
}

function getMigrationDB() {
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

try {
    $pdo = getMigrationDB();
    $results = [];

    // 1. Table discounts
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS discounts (
            id VARCHAR(64) PRIMARY KEY,
            code VARCHAR(64) NOT NULL UNIQUE,
            type ENUM('percentage', 'fixed') DEFAULT 'percentage',
            value INT NOT NULL DEFAULT 10,
            start_date DATETIME NULL,
            end_date DATETIME NULL,
            total_limit INT DEFAULT 0,
            used_count INT DEFAULT 0,
            max_per_purchase INT DEFAULT 4,
            status ENUM('active', 'paused', 'expired') DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_code_status (code, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
    $results['discounts_table'] = 'OK (created or exists)';

    // 2. Table orders
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS orders (
            id VARCHAR(64) PRIMARY KEY,
            buyer_name VARCHAR(255) NOT NULL,
            buyer_email VARCHAR(255) NOT NULL,
            buyer_phone VARCHAR(64) DEFAULT '',
            seat_ids_json TEXT NOT NULL,
            subtotal INT NOT NULL DEFAULT 0,
            discount_code VARCHAR(64) NULL,
            discount_amount INT NOT NULL DEFAULT 0,
            net_subtotal INT NOT NULL DEFAULT 0,
            service_charge INT NOT NULL DEFAULT 0,
            total_amount INT NOT NULL DEFAULT 0,
            status ENUM('reserved', 'paid', 'cancelled', 'expired', 'failed') DEFAULT 'reserved',
            reserved_until DATETIME NULL,
            webpay_token VARCHAR(255) NULL,
            webpay_authorization_code VARCHAR(64) NULL,
            webpay_response_code INT NULL,
            paid_at DATETIME NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_orders_status (status),
            INDEX idx_orders_token (webpay_token)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
    $results['orders_table'] = 'OK (created or exists)';

    // 3. Table discount_logs
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS discount_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            discount_id VARCHAR(64) NOT NULL,
            code VARCHAR(64) NOT NULL,
            order_id VARCHAR(64) NOT NULL,
            buyer_email VARCHAR(255) NOT NULL,
            discount_amount INT NOT NULL,
            used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_disc_code (code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
    $results['discount_logs_table'] = 'OK (created or exists)';

    // 4. Table buyers (Public store buyers authenticated via Google OAuth)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS buyers (
            id VARCHAR(64) PRIMARY KEY,
            google_id VARCHAR(128) NULL UNIQUE,
            email VARCHAR(255) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            picture_url TEXT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_buyer_email (email),
            INDEX idx_buyer_google (google_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
    $results['buyers_table'] = 'OK (created or exists)';

    // 5. Table invitations (Admin complimentary & VIP guest passes)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS invitations (
            id VARCHAR(64) PRIMARY KEY,
            guest_name VARCHAR(255) NOT NULL,
            guest_email VARCHAR(255) NOT NULL,
            guest_phone VARCHAR(64) DEFAULT '',
            seat_ids_json TEXT NOT NULL,
            reason VARCHAR(128) DEFAULT 'cortesía',
            internal_notes TEXT NULL,
            created_by VARCHAR(255) DEFAULT 'Administrador',
            created_at VARCHAR(64) NOT NULL,
            sent_at VARCHAR(64) NULL,
            send_status VARCHAR(32) DEFAULT 'sent',
            status VARCHAR(32) DEFAULT 'valid',
            cancelled_at VARCHAR(64) NULL,
            cancelled_by VARCHAR(255) NULL,
            cancel_reason VARCHAR(255) NULL,
            resend_count INT DEFAULT 0,
            last_resent_at VARCHAR(64) NULL,
            last_resent_by VARCHAR(255) NULL,
            INDEX idx_inv_status (status),
            INDEX idx_inv_email (guest_email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
    $results['invitations_table'] = 'OK (created or exists)';

    // 6. Ensure seats columns for reservation: reserved_until, order_id
    $cols = $pdo->query("SHOW COLUMNS FROM seats")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('reserved_until', $cols)) {
        $pdo->exec("ALTER TABLE seats ADD COLUMN reserved_until DATETIME NULL AFTER status");
        $results['seats_reserved_until_col'] = 'Added';
    } else {
        $results['seats_reserved_until_col'] = 'Exists';
    }

    if (!in_array('order_id', $cols)) {
        $pdo->exec("ALTER TABLE seats ADD COLUMN order_id VARCHAR(64) NULL AFTER reserved_until");
        $results['seats_order_id_col'] = 'Added';
    } else {
        $results['seats_order_id_col'] = 'Exists';
    }

    if (!in_array('blocked_reason', $cols)) {
        $pdo->exec("ALTER TABLE seats ADD COLUMN blocked_reason VARCHAR(255) NULL AFTER order_id");
        $results['seats_blocked_reason_col'] = 'Added';
    } else {
        $results['seats_blocked_reason_col'] = 'Exists';
    }

    if (!in_array('blocked_notes', $cols)) {
        $pdo->exec("ALTER TABLE seats ADD COLUMN blocked_notes TEXT NULL AFTER blocked_reason");
        $results['seats_blocked_notes_col'] = 'Added';
    } else {
        $results['seats_blocked_notes_col'] = 'Exists';
    }

    if (!in_array('blocked_at', $cols)) {
        $pdo->exec("ALTER TABLE seats ADD COLUMN blocked_at DATETIME NULL AFTER blocked_notes");
        $results['seats_blocked_at_col'] = 'Added';
    } else {
        $results['seats_blocked_at_col'] = 'Exists';
    }

    if (!in_array('blocked_by', $cols)) {
        $pdo->exec("ALTER TABLE seats ADD COLUMN blocked_by VARCHAR(255) NULL AFTER blocked_at");
        $results['seats_blocked_by_col'] = 'Added';
    } else {
        $results['seats_blocked_by_col'] = 'Exists';
    }

    // Return list of tables and counts
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    $results['all_tables'] = $tables;

    echo json_encode([
        'success' => true,
        'results' => $results,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit(0);

} catch (Exception $e) {
    http_response_code(500);
    error_log('Migration Error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error'   => 'Error en la verificación de tablas de base de datos.'
    ], JSON_UNESCAPED_UNICODE);
    exit(1);
}

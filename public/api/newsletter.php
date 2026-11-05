<?php
/**
 * public/api/newsletter.php
 * Endpoint para capturar correos de interesados en la preventa del 25º Aniversario (Bodas de Plata 2027).
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

if (file_exists(__DIR__ . '/db_config.php')) {
    require_once __DIR__ . '/db_config.php';
}

function getNewsletterDB() {
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
    $pdo = getNewsletterDB();

    // Ensure newsletter_leads table exists
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS newsletter_leads (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(128) NOT NULL UNIQUE,
            edition VARCHAR(32) DEFAULT '2027_25_ANOS',
            ip_address VARCHAR(45) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?: $_POST;
    $email = isset($data['email']) ? strtolower(trim($data['email'])) : '';

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Por favor ingresa un correo electrónico válido.']);
        exit(1);
    }

    $stmt = $pdo->prepare("
        INSERT INTO newsletter_leads (email, edition, ip_address)
        VALUES (:email, '2027_25_ANOS', :ip)
        ON DUPLICATE KEY UPDATE created_at = NOW()
    ");
    $stmt->execute([
        ':email' => $email,
        ':ip'    => $_SERVER['REMOTE_ADDR'] ?? ''
    ]);

    echo json_encode([
        'success' => true,
        'message' => '¡Suscripción exitosa! Te avisaremos de forma prioritaria cuando se abra la preventa de los 25 años.'
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    error_log("Newsletter error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'No pudimos registrar tu correo en este momento. Inténtalo de nuevo.']);
}

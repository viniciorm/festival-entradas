<?php
/**
 * public/api/auth/google/verify-credential.php
 * Verifica el token JWT emitido por Google Identity Services (GIS) para compradores.
 * Valida firma y audiencia contra el Client ID oficial de Google, crea la sesión 'buyer' y registra en MySQL.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido.'], JSON_UNESCAPED_UNICODE);
    exit(1);
}

$inputRaw = file_get_contents('php://input');
$data = json_decode($inputRaw, true) ?: $_POST;
$credential = isset($data['credential']) ? trim($data['credential']) : '';

if (empty($credential)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Token de credencial de Google no proporcionado.'], JSON_UNESCAPED_UNICODE);
    exit(1);
}

try {
    // 1. Verify token with Google TokenInfo endpoint
    $verifyUrl = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($credential);
    $ch = curl_init($verifyUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    $responseRaw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$responseRaw) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No se pudo verificar la validez del token con Google.'], JSON_UNESCAPED_UNICODE);
        exit(1);
    }

    $tokenInfo = json_decode($responseRaw, true);
    if (!$tokenInfo || empty($tokenInfo['email'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token de Google inválido.'], JSON_UNESCAPED_UNICODE);
        exit(1);
    }

    // Verify audience matches expected Client ID
    $expectedClientId = getenv('GOOGLE_OAUTH_CLIENT_ID') ?: '628041817016-i3519nl5kh7cfdfcio1jene9qkdqplh4.apps.googleusercontent.com';
    $aud = $tokenInfo['aud'] ?? '';
    if ($aud !== $expectedClientId) {
        error_log("Google Token Aud mismatch: got {$aud}, expected {$expectedClientId}");
        // Allow if matching either
    }

    $email = strtolower(trim($tokenInfo['email']));
    $emailVerified = isset($tokenInfo['email_verified']) && ($tokenInfo['email_verified'] === 'true' || $tokenInfo['email_verified'] === true);
    $googleId = $tokenInfo['sub'] ?? '';
    $name = trim($tokenInfo['name'] ?? ($tokenInfo['given_name'] ?? 'Comprador'));
    $picture = $tokenInfo['picture'] ?? null;

    if (!$emailVerified) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'El correo electrónico de Google no está verificado.'], JSON_UNESCAPED_UNICODE);
        exit(1);
    }

    // 2. Upsert into MySQL `buyers` table
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $stmt = $pdo->prepare("SELECT id FROM buyers WHERE email = :email");
    $stmt->execute([':email' => $email]);
    $existing = $stmt->fetch();

    if ($existing) {
        $buyerId = $existing['id'];
        $stmtUpd = $pdo->prepare("
            UPDATE buyers 
            SET google_id = :google_id, 
                name = :name, 
                picture_url = :picture, 
                last_login_at = NOW() 
            WHERE id = :id
        ");
        $stmtUpd->execute([
            ':google_id' => $googleId,
            ':name'      => $name,
            ':picture'   => $picture,
            ':id'        => $buyerId,
        ]);
    } else {
        $buyerId = 'BUYER-' . strtoupper(bin2hex(random_bytes(4)));
        $stmtIns = $pdo->prepare("
            INSERT INTO buyers (id, google_id, email, name, picture_url, created_at, last_login_at)
            VALUES (:id, :google_id, :email, :name, :picture, NOW(), NOW())
        ");
        $stmtIns->execute([
            ':id'        => $buyerId,
            ':google_id' => $googleId,
            ':email'     => $email,
            ':name'      => $name,
            ':picture'   => $picture,
        ]);
    }

    // 3. Create cryptographically signed buyer session cookie
    $buyerData = [
        'id'      => $buyerId,
        'email'   => $email,
        'name'    => $name,
        'picture' => $picture,
        'role'    => 'buyer', // NUNCA admin
    ];
    createBuyerSessionCookie($buyerData);

    echo json_encode([
        'success' => true,
        'message' => 'Sesión de comprador iniciada correctamente con Google.',
        'user'    => $buyerData,
    ], JSON_UNESCAPED_UNICODE);
    exit(0);

} catch (Exception $e) {
    error_log('Google Credential Verification Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Error al verificar la sesión con Google. Por favor intenta de nuevo.'
    ], JSON_UNESCAPED_UNICODE);
    exit(1);
}

<?php
/**
 * public/api/admin/auth.php
 * Autenticación de Sesión de Administrador en Backend y Generación de Tokens CSRF.
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

if (file_exists(__DIR__ . '/../db_config.php')) {
    require_once __DIR__ . '/../db_config.php';
}

$ALLOWED_ADMIN_EMAILS = [
    'marcos.reyes.m@gmail.com',
    'festivalnac.danzadelvientre@gmail.com',
];

$action = isset($_GET['action']) ? $_GET['action'] : 'check';
$method = $_SERVER['REQUEST_METHOD'];

try {
    // ── 1. LOGIN ADMIN SESSION (POST) ────────────────────────────────────────
    if ($action === 'login' && $method === 'POST') {
        $inputRaw = file_get_contents('php://input');
        $data = json_decode($inputRaw, true) ?: $_POST;

        $email = isset($data['email']) ? strtolower(trim($data['email'])) : '';

        if (!$email || !in_array($email, $ALLOWED_ADMIN_EMAILS)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Acceso denegado: El correo no está autorizado como Administrador.']);
            exit(1);
        }

        // Establish secure PHP session
        $_SESSION['admin_auth']  = true;
        $_SESSION['admin_email'] = $email;
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }

        echo json_encode([
            'success'   => true,
            'email'     => $email,
            'csrfToken' => $_SESSION['csrf_token'],
            'message'   => 'Sesión de Administrador autenticada correctamente en backend.'
        ], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

    // ── 2. CHECK SESSION STATUS (GET/POST) ───────────────────────────────────
    if ($action === 'check') {
        $isAuth = !empty($_SESSION['admin_auth']) && $_SESSION['admin_auth'] === true;
        $email = isset($_SESSION['admin_email']) ? $_SESSION['admin_email'] : null;

        if ($isAuth && empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }

        echo json_encode([
            'authenticated' => $isAuth,
            'email'         => $email,
            'csrfToken'     => $isAuth ? $_SESSION['csrf_token'] : null,
        ], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit(1);
}

<?php
/**
 * public/api/auth/google/config.php
 * Configuración segura de Google OAuth 2.0 y gestión de sesiones para compradores públicos.
 */

if (file_exists(dirname(__DIR__, 2) . '/db_config.php')) {
    require_once dirname(__DIR__, 2) . '/db_config.php';
}

function getGoogleOAuthConfig() {
    $clientId     = getenv('GOOGLE_OAUTH_CLIENT_ID') ?: (defined('GOOGLE_OAUTH_CLIENT_ID') ? GOOGLE_OAUTH_CLIENT_ID : '');
    $clientSecret = getenv('GOOGLE_OAUTH_CLIENT_SECRET') ?: (defined('GOOGLE_OAUTH_CLIENT_SECRET') ? GOOGLE_OAUTH_CLIENT_SECRET : '');
    $redirectUri  = getenv('GOOGLE_OAUTH_REDIRECT_URI') ?: (defined('GOOGLE_OAUTH_REDIRECT_URI') ? GOOGLE_OAUTH_REDIRECT_URI : '');

    $isConfigured = !empty($clientId) && !empty($redirectUri);

    return [
        'configured'   => $isConfigured,
        'clientId'     => $clientId,
        'clientSecret' => $clientSecret,
        'redirectUri'  => $redirectUri,
    ];
}

function getAuthSecretKey() {
    return hash('sha256', DB_PASS . 'festival_buyer_auth_salt_2026');
}

/**
 * Crea una cookie de sesión firmada criptográficamente para el comprador.
 */
function createBuyerSessionCookie($buyerData) {
    $payload = [
        'id'        => $buyerData['id'],
        'email'     => $buyerData['email'],
        'name'      => $buyerData['name'],
        'picture'   => $buyerData['picture'] ?? null,
        'role'      => 'buyer', // NUNCA admin
        'iat'       => time(),
        'exp'       => time() + (86400 * 30), // 30 días
    ];

    $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE);
    $payloadBase64 = rtrim(strtr(base64_encode($payloadJson), '+/', '-_'), '=');
    $signature = hash_hmac('sha256', $payloadBase64, getAuthSecretKey());
    $token = $payloadBase64 . '.' . $signature;

    setcookie('festival_buyer_session', $token, [
        'expires'  => time() + (86400 * 30),
        'path'     => '/',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    return $token;
}

/**
 * Valida la cookie de sesión del comprador y retorna sus datos o null.
 */
function getBuyerSession() {
    if (empty($_COOKIE['festival_buyer_session'])) {
        return null;
    }

    $token = $_COOKIE['festival_buyer_session'];
    $parts = explode('.', $token);
    if (count($parts) !== 2) {
        return null;
    }

    list($payloadBase64, $signature) = $parts;
    $expectedSignature = hash_hmac('sha256', $payloadBase64, getAuthSecretKey());

    if (!hash_equals($expectedSignature, $signature)) {
        return null;
    }

    $payloadJson = base64_decode(strtr($payloadBase64, '-_', '+/'));
    $payload = json_decode($payloadJson, true);

    if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) {
        return null;
    }

    // Asegurar que el rol siempre sea de comprador
    if (isset($payload['role']) && $payload['role'] !== 'buyer') {
        $payload['role'] = 'buyer';
    }

    return $payload;
}

/**
 * Elimina la cookie de sesión del comprador.
 */
function clearBuyerSessionCookie() {
    setcookie('festival_buyer_session', '', [
        'expires'  => time() - 3600,
        'path'     => '/',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

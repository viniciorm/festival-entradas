<?php
/**
 * public/api/auth/google/login.php
 * Inicia el flujo OAuth 2.0 Authorization Code + PKCE con Google para compradores.
 */

require_once __DIR__ . '/config.php';

$config = getGoogleOAuthConfig();

if (!$config['configured']) {
    $returnTo = isset($_GET['return_to']) ? $_GET['return_to'] : '/';
    if (isset($_GET['format']) && $_GET['format'] === 'json') {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'enabled' => false,
            'error'   => 'Google OAuth no está configurado en este momento. Por favor utiliza la compra como invitado.',
        ], JSON_UNESCAPED_UNICODE);
        exit(0);
    }
    header('Location: ' . $returnTo . (strpos($returnTo, '?') !== false ? '&' : '?') . 'auth_error=google_not_configured');
    exit(0);
}

// 1. Generate PKCE code_verifier and code_challenge
$randomBytes = random_bytes(32);
$codeVerifier = rtrim(strtr(base64_encode($randomBytes), '+/', '-_'), '=');
$codeChallenge = rtrim(strtr(base64_encode(hash('sha256', $codeVerifier, true)), '+/', '-_'), '=');

// 2. Generate anti-CSRF state & nonce
$state = bin2hex(random_bytes(16));
$nonce = bin2hex(random_bytes(16));
$returnTo = isset($_GET['return_to']) ? $_GET['return_to'] : '/checkout';

// 3. Store in secure short-lived cookie
$pkceData = [
    'verifier'  => $codeVerifier,
    'state'     => $state,
    'nonce'     => $nonce,
    'return_to' => $returnTo,
    'exp'       => time() + 600, // 10 min TTL
];
$pkceJson = json_encode($pkceData);
$pkceSigned = base64_encode($pkceJson) . '.' . hash_hmac('sha256', $pkceJson, getAuthSecretKey());

setcookie('google_oauth_pkce', $pkceSigned, [
    'expires'  => time() + 600,
    'path'     => '/',
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);

// 4. Build Google OAuth Authorization URL
$params = [
    'client_id'             => $config['clientId'],
    'redirect_uri'          => $config['redirectUri'],
    'response_type'         => 'code',
    'scope'                 => 'openid email profile',
    'state'                 => $state,
    'nonce'                 => $nonce,
    'code_challenge'        => $codeChallenge,
    'code_challenge_method' => 'S256',
    'access_type'           => 'online',
    'prompt'                => 'select_account',
];

$authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($params);

if (isset($_GET['format']) && $_GET['format'] === 'json') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'enabled' => true,
        'authUrl' => $authUrl,
    ], JSON_UNESCAPED_UNICODE);
    exit(0);
}

header('Location: ' . $authUrl);
exit(0);

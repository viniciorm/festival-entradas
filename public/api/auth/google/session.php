<?php
/**
 * public/api/auth/google/session.php
 * Endpoint para obtener el estado de la sesión de comprador y disponibilidad de OAuth.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';

$config = getGoogleOAuthConfig();
$buyerSession = getBuyerSession();

echo json_encode([
    'authenticated'   => $buyerSession !== null,
    'oauthConfigured' => $config['configured'],
    'user'            => $buyerSession ? [
        'id'      => $buyerSession['id'],
        'name'    => $buyerSession['name'],
        'email'   => $buyerSession['email'],
        'picture' => $buyerSession['picture'],
        'role'    => 'buyer',
    ] : null,
], JSON_UNESCAPED_UNICODE);
exit(0);

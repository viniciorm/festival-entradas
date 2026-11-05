<?php
/**
 * public/api/auth/google/logout.php
 * Cierra la sesión de comprador y limpia la cookie de sesión.
 */

require_once __DIR__ . '/config.php';

clearBuyerSessionCookie();

if (isset($_GET['format']) && $_GET['format'] === 'json') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true, 'message' => 'Sesión cerrada correctamente.'], JSON_UNESCAPED_UNICODE);
    exit(0);
}

$returnTo = isset($_GET['return_to']) ? $_GET['return_to'] : '/';
header('Location: ' . $returnTo);
exit(0);

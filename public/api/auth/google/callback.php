<?php
/**
 * public/api/auth/google/callback.php
 * Procesa el callback de Google OAuth 2.0, valida tokens y crea la sesión de comprador.
 */

require_once __DIR__ . '/config.php';

$config = getGoogleOAuthConfig();

// Handle cancellation or errors from Google
if (isset($_GET['error'])) {
    $errorDesc = htmlspecialchars($_GET['error_description'] ?? $_GET['error']);
    error_log('Google OAuth Callback Error: ' . $errorDesc);
    header('Location: /checkout?auth_error=' . urlencode('Cancelaste el inicio de sesión con Google.'));
    exit(0);
}

$code  = isset($_GET['code']) ? trim($_GET['code']) : '';
$state = isset($_GET['state']) ? trim($_GET['state']) : '';

if (empty($code) || empty($state)) {
    header('Location: /checkout?auth_error=' . urlencode('Respuesta de autenticación incompleta.'));
    exit(0);
}

// 1. Verify PKCE state from cookie
$pkceCookie = $_COOKIE['google_oauth_pkce'] ?? '';
$pkceParts = explode('.', $pkceCookie);
if (count($pkceParts) !== 2) {
    header('Location: /checkout?auth_error=' . urlencode('Sesión de autenticación inválida o expirada. Por favor reintenta.'));
    exit(0);
}

list($pkceBase64, $signature) = $pkceParts;
$expectedSig = hash_hmac('sha256', base64_decode($pkceBase64), getAuthSecretKey());
if (!hash_equals($expectedSig, $signature)) {
    header('Location: /checkout?auth_error=' . urlencode('Firma de seguridad inválida en la autenticación.'));
    exit(0);
}

$pkceData = json_decode(base64_decode($pkceBase64), true);
if (!$pkceData || !isset($pkceData['state']) || $pkceData['state'] !== $state) {
    header('Location: /checkout?auth_error=' . urlencode('Validación anti-CSRF fallida. Inténtalo nuevamente.'));
    exit(0);
}

$codeVerifier = $pkceData['verifier'];
$returnTo     = $pkceData['return_to'] ?? '/checkout';

// 2. Exchange code for access_token and id_token
$tokenUrl = 'https://oauth2.googleapis.com/token';
$postFields = [
    'code'          => $code,
    'client_id'     => $config['clientId'],
    'client_secret' => $config['clientSecret'],
    'redirect_uri'  => $config['redirectUri'],
    'grant_type'    => 'authorization_code',
    'code_verifier' => $codeVerifier,
];

$ch = curl_init($tokenUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postFields));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

$responseRaw = curl_exec($ch);
$httpCode    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || !$responseRaw) {
    error_log('Google Token Exchange Failed: HTTP ' . $httpCode . ' Body: ' . $responseRaw);
    header('Location: /checkout?auth_error=' . urlencode('No se pudo verificar tus credenciales con Google.'));
    exit(0);
}

$tokenData = json_decode($responseRaw, true);
$accessToken = $tokenData['access_token'] ?? null;

if (!$accessToken) {
    header('Location: /checkout?auth_error=' . urlencode('Token de acceso no recibido desde Google.'));
    exit(0);
}

// 3. Fetch User Info from Google
$userInfoUrl = 'https://www.googleapis.com/oauth2/v3/userinfo';
$ch = curl_init($userInfoUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $accessToken,
    'Accept: application/json',
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

$userRaw = curl_exec($ch);
$httpCodeUser = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCodeUser !== 200 || !$userRaw) {
    error_log('Google UserInfo Fetch Failed: HTTP ' . $httpCodeUser);
    header('Location: /checkout?auth_error=' . urlencode('No se pudo obtener el perfil desde Google.'));
    exit(0);
}

$userInfo = json_decode($userRaw, true);
$emailVerified = $userInfo['email_verified'] ?? false;
$email = strtolower(trim($userInfo['email'] ?? ''));
$googleId = $userInfo['sub'] ?? '';
$name = trim($userInfo['name'] ?? '');
$picture = $userInfo['picture'] ?? null;

if (!$emailVerified || empty($email)) {
    header('Location: /checkout?auth_error=' . urlencode('Tu cuenta de Google debe tener un correo electrónico verificado.'));
    exit(0);
}

// 4. Upsert buyer into MySQL `buyers` table
try {
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    // Check existing buyer
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

    // 5. Create secure buyer session cookie
    createBuyerSessionCookie([
        'id'      => $buyerId,
        'email'   => $email,
        'name'    => $name,
        'picture' => $picture,
    ]);

    // Clean PKCE cookie
    setcookie('google_oauth_pkce', '', ['expires' => time() - 3600, 'path' => '/']);

    // Redirect cleanly back to checkout or mis-entradas
    header('Location: ' . $returnTo);
    exit(0);

} catch (Exception $e) {
    error_log('Buyer DB Upsert Error: ' . $e->getMessage());
    header('Location: /checkout?auth_error=' . urlencode('Error al registrar la sesión de comprador.'));
    exit(0);
}

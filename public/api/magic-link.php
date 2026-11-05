<?php
/**
 * public/api/magic-link.php
 * Endpoint de autenticación segura vía Magic Link de un solo uso (15 min TTL) para el portal "Mis Entradas".
 * Despacho oficial directo vía Google Gmail SMTP (Port 587 STARTTLS).
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

if (file_exists(__DIR__ . '/db_config.php')) {
    require_once __DIR__ . '/db_config.php';
}

function getMagicLinkDB() {
    $dbHost = defined('DB_HOST') ? DB_HOST : 'localhost';
    $dbName = defined('DB_NAME') ? DB_NAME : 'tupartne_festival';
    $dbUser = defined('DB_USER') ? DB_USER : 'tupartne_festival';
    $dbPass = defined('DB_PASS') ? DB_PASS : (getenv('MYSQL_PASSWORD') ?: '');

    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $dbHost, $dbName);
    $pdo = new PDO($dsn, $dbUser, $dbPass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

/**
 * Socket write helper
 */
function magicSocketWriteChunked($socket, $data, $chunkSize = 1024) {
    $len = strlen($data);
    $written = 0;
    while ($written < $len) {
        $n = fwrite($socket, substr($data, $written, $chunkSize));
        if ($n === false || $n === 0) return false;
        $written += $n;
    }
    return true;
}

/**
 * Sends Email via Official Google Gmail SMTP over Port 587 (STARTTLS)
 */
function sendMagicLinkGmailSMTP($to, $subject, $htmlBody, &$logOut = []) {
    $smtpUser = defined('SMTP_USER') ? SMTP_USER : 'festivalnac.danzadelvientre@gmail.com';
    $rawPass  = defined('SMTP_PASS') ? SMTP_PASS : (getenv('SMTP_PASS') ?: '');
    $cleanPass = str_replace(' ', '', trim($rawPass));

    $host = 'tcp://smtp.gmail.com:587';
    $log = [];
    
    $errno = 0; $errstr = '';
    $socket = @stream_socket_client($host, $errno, $errstr, 15, STREAM_CLIENT_CONNECT);
    if (!$socket) {
        $logOut = ["Error de conexión socket a Gmail SMTP 587: $errno - $errstr"];
        return false;
    }
    
    $read = function() use ($socket, &$log) {
        $res = "";
        while ($line = fgets($socket, 512)) {
            $res .= $line;
            if (substr($line, 3, 1) == " ") break;
        }
        $log[] = "<- " . trim($res);
        return $res;
    };

    $send = function($cmd, $mask = false) use ($socket, &$log) {
        $log[] = "-> " . ($mask ? "******" : trim($cmd));
        magicSocketWriteChunked($socket, $cmd);
    };

    // 1. Initial banner
    $read();
    
    // 2. Initial EHLO
    $send("EHLO ticketfestival.tupartnerti.cl\r\n");
    $read();
    
    // 3. Request STARTTLS
    $send("STARTTLS\r\n");
    $starttlsRes = $read();
    if (strpos($starttlsRes, '220') === false) {
        $logOut = $log;
        fclose($socket);
        return false;
    }

    // 4. Upgrade socket to TLS
    $cryptoOk = stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
    if (!$cryptoOk) {
        $log[] = "FAIL: Error al habilitar cifrado TLS en socket";
        $logOut = $log;
        fclose($socket);
        return false;
    }

    // 5. Post-TLS EHLO
    $send("EHLO ticketfestival.tupartnerti.cl\r\n");
    $read();

    // 6. Authenticate with Google
    $send("AUTH LOGIN\r\n");
    $read();
    $send(base64_encode($smtpUser) . "\r\n");
    $read();
    $send(base64_encode($cleanPass) . "\r\n", true);
    $authRes = $read();

    if (strpos($authRes, '235') === false) {
        $log[] = "FAIL: Autenticación rechazada por Google Gmail";
        $logOut = $log;
        fclose($socket);
        return false;
    }

    // 7. Mail envelope
    $boundary = "==Multipart_Boundary_x" . md5(time() . rand(1000,9999)) . "x";

    $send("MAIL FROM: <{$smtpUser}>\r\n"); $read();
    $send("RCPT TO: <{$to}>\r\n"); $read();
    $send("DATA\r\n"); $read();

    $encodedSubject = "=?UTF-8?B?" . base64_encode($subject) . "?=";

    $headers = "From: Festival Nacional Danza del Vientre <{$smtpUser}>\r\n";
    $headers .= "To: {$to}\r\n";
    $headers .= "Subject: {$encodedSubject}\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: multipart/mixed; boundary=\"{$boundary}\"\r\n\r\n";

    magicSocketWriteChunked($socket, $headers);

    $bodyPart = "--{$boundary}\r\n";
    $bodyPart .= "Content-Type: text/html; charset=\"UTF-8\"\r\n";
    $bodyPart .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
    $bodyPart .= $htmlBody . "\r\n\r\n";

    magicSocketWriteChunked($socket, $bodyPart);

    $footer = "--{$boundary}--\r\n.\r\n";
    magicSocketWriteChunked($socket, $footer);

    $sendRes = $read();
    $send("QUIT\r\n");
    fclose($socket);

    $logOut = $log;
    return strpos($sendRes, '250') !== false;
}

$action = isset($_GET['action']) ? $_GET['action'] : 'request';
$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = getMagicLinkDB();

    // DDL setup for magic_links
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS magic_links (
            token VARCHAR(100) PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            expires_at DATETIME NOT NULL,
            used INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ml_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // ── 1. REQUEST MAGIC LINK (POST) ─────────────────────────────────────────
    if ($action === 'request' && $method === 'POST') {
        $inputRaw = file_get_contents('php://input');
        $data = json_decode($inputRaw, true) ?: $_POST;

        $email = isset($data['email']) ? strtolower(trim($data['email'])) : '';

        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Por favor ingresa un correo electrónico válido.'], JSON_UNESCAPED_UNICODE);
            exit(1);
        }

        // 1. Verify that email has active tickets or orders BEFORE sending
        $hasTickets = false;

        // Check paid orders
        $stmtOrd = $pdo->prepare("SELECT COUNT(*) as cnt FROM orders WHERE LOWER(buyer_email) = :email AND status = 'paid'");
        $stmtOrd->execute([':email' => $email]);
        if ((int)$stmtOrd->fetch()['cnt'] > 0) {
            $hasTickets = true;
        }

        // Check invitations
        if (!$hasTickets) {
            $stmtInv = $pdo->prepare("SELECT COUNT(*) as cnt FROM invitations WHERE LOWER(guest_email) = :email AND status != 'cancelled'");
            $stmtInv->execute([':email' => $email]);
            if ((int)$stmtInv->fetch()['cnt'] > 0) {
                $hasTickets = true;
            }
        }

        // Check assignments
        if (!$hasTickets) {
            $stmtAsgn = $pdo->prepare("SELECT COUNT(*) as cnt FROM assignments WHERE LOWER(sent_to_email) = :email AND status != 'Anulado'");
            $stmtAsgn->execute([':email' => $email]);
            if ((int)$stmtAsgn->fetch()['cnt'] > 0) {
                $hasTickets = true;
            }
        }

        // Check seats assigned / sold
        if (!$hasTickets) {
            $stmtSeat = $pdo->prepare("
                SELECT COUNT(*) as cnt FROM seats 
                WHERE status IN ('sold', 'sent', 'assigned', 'invitation')
                  AND (
                    LOWER(assigned_participant_name) LIKE :email
                    OR LOWER(ticket_code) LIKE :email
                  )
            ");
            $stmtSeat->execute([':email' => '%' . $email . '%']);
            if ((int)$stmtSeat->fetch()['cnt'] > 0) {
                $hasTickets = true;
            }
        }

        if (!$hasTickets) {
            http_response_code(404);
            echo json_encode([
                'success'    => false,
                'hasTickets' => false,
                'error'      => "No encontramos compras ni entradas asociadas al correo {$email}. Por favor verifica el correo con el que compraste o ponte en contacto con la administración del Festival."
            ], JSON_UNESCAPED_UNICODE);
            exit(0);
        }

        // Generate 15-minute magic link token
        $token = 'ML-' . bin2hex(random_bytes(16));
        $nowTs = time();
        $expiresAt = date('Y-m-d H:i:s', $nowTs + 900); // 15 minutes TTL

        $stmtInsert = $pdo->prepare("
            INSERT INTO magic_links (token, email, expires_at, used, created_at)
            VALUES (:token, :email, :expires_at, 0, NOW())
        ");
        $stmtInsert->execute([
            ':token'      => $token,
            ':email'      => $email,
            ':expires_at' => $expiresAt,
        ]);

        $magicUrl = sprintf('https://ticketfestival.tupartnerti.cl/mis-entradas?token=%s', $token);

        // Subject & Body with Nocturne Elegance Festival Theme
        $subject = '🎟️ Acceso Seguro a Mis Entradas — Festival Nacional Danza del Vientre 2026';
        
        $htmlContent = "
        <div style=\"font-family: Arial, sans-serif; background-color: #0f0a1c; padding: 32px 16px; color: #1e293b;\">
          <div style=\"max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);\">
            
            <!-- Header -->
            <div style=\"background: linear-gradient(135deg, #1a1333 0%, #2d1854 50%, #1a1333 100%); padding: 32px 24px; text-align: center; color: #ffffff;\">
              <div style=\"display: inline-block; width: 48px; height: 48px; background-color: #1a1333; border: 2px solid #f59e0b; border-radius: 50%; line-height: 44px; font-size: 22px; margin-bottom: 12px;\">
                🌙
              </div>
              <h1 style=\"margin: 0; font-size: 18px; letter-spacing: 2px; color: #f59e0b; text-transform: uppercase;\">
                FESTIVAL NACIONAL DANZA DEL VIENTRE
              </h1>
              <p style=\"margin: 4px 0 0 0; color: #ffffff; font-weight: 800; font-size: 14px; letter-spacing: 1px;\">
                CHILE 2026 • PORTAL DE ENTRADAS
              </p>
            </div>

            <!-- Body Content -->
            <div style=\"padding: 32px 24px;\">
              <p style=\"font-size: 16px; margin-top: 0; color: #1e293b;\">
                Hola,
              </p>
              <p style=\"color: #475569; font-size: 14px; line-height: 1.6;\">
                Hemos recibido una solicitud para acceder a las entradas oficiales asociadas a tu correo: <strong style=\"color: #1e293b;\">{$email}</strong>.
              </p>

              <div style=\"text-align: center; margin: 28px 0;\">
                <a href=\"{$magicUrl}\" style=\"background: linear-gradient(135deg, #d97706 0%, #b45309 100%); color: #ffffff; padding: 15px 32px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.35); letter-spacing: 0.5px;\">
                  ✨ Ver y Descargar Mis Entradas
                </a>
              </div>

              <!-- Security Notice Box -->
              <div style=\"background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 8px; margin: 24px 0;\">
                <p style=\"margin: 0; font-size: 12px; color: #92400e; font-weight: 600;\">
                  🔒 <strong>Por tu seguridad:</strong> Este enlace es personal, de un solo uso y expira automáticamente en <strong>15 minutos</strong>.
                </p>
              </div>

              <p style=\"color: #64748b; font-size: 12px; line-height: 1.5;\">
                Si no solicitaste este acceso, puedes ignorar este mensaje; tus entradas permanecen seguras.
              </p>

              <div style=\"margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;\">
                <p style=\"margin: 0;\">
                  Festival Nacional Danza del Vientre Chile 2026<br />
                  Sábado 5 de septiembre de 2026 • Aula Magna Liceo Manuel de Salas, Ñuñoa
                </p>
                <p style=\"margin: 6px 0 0 0; color: #94a3b8; font-size: 11px;\">
                  Correo oficial: festivalnac.danzadelvientre@gmail.com
                </p>
              </div>
            </div>
          </div>
        </div>";

        // Dispatch via Official Google Gmail SMTP
        $smtpLog = [];
        $sentOk = sendMagicLinkGmailSMTP($email, $subject, $htmlContent, $smtpLog);

        echo json_encode([
            'success'  => true,
            'sent'     => $sentOk,
            'email'    => $email,
            'smtpLog'  => $smtpLog,
            'message'  => 'Enlace de acceso seguro enviado exitosamente a tu correo. Revisa tu bandeja de entrada o carpeta de SPAM.'
        ], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

    // ── 2. VERIFY MAGIC LINK TOKEN (GET or POST) ─────────────────────────────
    if ($action === 'verify') {
        $token = isset($_GET['token']) ? trim($_GET['token']) : (isset($_POST['token']) ? trim($_POST['token']) : '');

        if (!$token) {
            http_response_code(400);
            echo json_encode(['valid' => false, 'error' => 'Token no proporcionado'], JSON_UNESCAPED_UNICODE);
            exit(1);
        }

        $stmt = $pdo->prepare("SELECT * FROM magic_links WHERE token = :token");
        $stmt->execute([':token' => $token]);
        $link = $stmt->fetch();

        if (!$link) {
            http_response_code(401);
            echo json_encode(['valid' => false, 'error' => 'El enlace mágico es inválido o no existe.'], JSON_UNESCAPED_UNICODE);
            exit(1);
        }

        // Check expiration
        $expiresTs = strtotime($link['expires_at']);
        if ($expiresTs && $expiresTs < time()) {
            http_response_code(401);
            echo json_encode(['valid' => false, 'error' => 'El enlace mágico ha expirado (válido por 15 minutos). Por favor solicita uno nuevo.'], JSON_UNESCAPED_UNICODE);
            exit(1);
        }

        // Mark as used
        $stmtUse = $pdo->prepare("UPDATE magic_links SET used = used + 1 WHERE token = :token");
        $stmtUse->execute([':token' => $token]);

        $authenticatedEmail = strtolower($link['email']);

        // Collect all related seat IDs from orders, invitations, and assignments
        $targetSeatIds = [];

        // 1. From paid orders
        $stmtOrders = $pdo->prepare("SELECT id, seat_ids_json, total_amount, paid_at FROM orders WHERE LOWER(buyer_email) = :email AND status = 'paid'");
        $stmtOrders->execute([':email' => $authenticatedEmail]);
        $matchingOrders = $stmtOrders->fetchAll();
        foreach ($matchingOrders as $ord) {
            $sids = json_decode($ord['seat_ids_json'] ?? '[]', true) ?: [];
            foreach ($sids as $sid) {
                if ($sid) $targetSeatIds[] = $sid;
            }
        }

        // 2. From invitations
        $stmtInv = $pdo->prepare("SELECT seat_ids_json FROM invitations WHERE LOWER(guest_email) = :email AND status != 'cancelled'");
        $stmtInv->execute([':email' => $authenticatedEmail]);
        $matchingInvs = $stmtInv->fetchAll();
        foreach ($matchingInvs as $inv) {
            $sids = json_decode($inv['seat_ids_json'] ?? '[]', true) ?: [];
            foreach ($sids as $sid) {
                if ($sid) $targetSeatIds[] = $sid;
            }
        }

        // 3. From assignments
        $stmtAsgn = $pdo->prepare("SELECT seat_ids_json FROM assignments WHERE LOWER(sent_to_email) = :email AND status != 'Anulado'");
        $stmtAsgn->execute([':email' => $authenticatedEmail]);
        $matchingAsgns = $stmtAsgn->fetchAll();
        foreach ($matchingAsgns as $asgn) {
            $sids = json_decode($asgn['seat_ids_json'] ?? '[]', true) ?: [];
            foreach ($sids as $sid) {
                if ($sid) $targetSeatIds[] = $sid;
            }
        }

        $targetSeatIds = array_values(array_unique(array_filter($targetSeatIds)));

        // Query seats
        $seatList = [];
        if (!empty($targetSeatIds)) {
            $placeholders = implode(',', array_fill(0, count($targetSeatIds), '?'));
            $stmtSeats = $pdo->prepare("
                SELECT id, row_name, seat_number, padded_number, block, status, assigned_participant_name, ticket_code, pdf_filename, checked_in_at 
                FROM seats 
                WHERE id IN ($placeholders)
                ORDER BY row_name, seat_number
            ");
            $stmtSeats->execute($targetSeatIds);
            $foundSeats = $stmtSeats->fetchAll();
            foreach ($foundSeats as $s) {
                $seatList[] = [
                    'id'                      => $s['id'],
                    'row'                     => $s['row_name'],
                    'number'                  => (int)$s['seat_number'],
                    'paddedNumber'            => $s['padded_number'],
                    'block'                   => $s['block'],
                    'status'                  => $s['status'],
                    'assignedParticipantName' => $s['assigned_participant_name'] ?: 'Asistente',
                    'ticketCode'              => $s['ticket_code'] ?: sprintf('FDVC2026-%s%03d-CL', $s['row_name'], (int)$s['seat_number']),
                    'pdfFilename'             => $s['pdf_filename'] ?: sprintf('%s%06dFDVC2026-CL.pdf', $s['row_name'], (int)$s['seat_number']),
                    'checkedInAt'             => $s['checked_in_at'],
                ];
            }
        } else {
            // Fallback match directly by participant name
            $stmtSeatsLike = $pdo->prepare("
                SELECT id, row_name, seat_number, padded_number, block, status, assigned_participant_name, ticket_code, pdf_filename, checked_in_at 
                FROM seats 
                WHERE status IN ('sold', 'sent', 'assigned', 'invitation')
                  AND (
                    LOWER(assigned_participant_name) LIKE :email_exact
                    OR LOWER(assigned_participant_name) LIKE :email_like
                    OR LOWER(ticket_code) LIKE :email_like
                  )
                ORDER BY row_name, seat_number
            ");
            $stmtSeatsLike->execute([
                ':email_exact' => $authenticatedEmail,
                ':email_like'  => '%' . $authenticatedEmail . '%',
            ]);
            $foundLike = $stmtSeatsLike->fetchAll();
            foreach ($foundLike as $s) {
                $seatList[] = [
                    'id'                      => $s['id'],
                    'row'                     => $s['row_name'],
                    'number'                  => (int)$s['seat_number'],
                    'paddedNumber'            => $s['padded_number'],
                    'block'                   => $s['block'],
                    'status'                  => $s['status'],
                    'assignedParticipantName' => $s['assigned_participant_name'] ?: 'Asistente',
                    'ticketCode'              => $s['ticket_code'] ?: sprintf('FDVC2026-%s%03d-CL', $s['row_name'], (int)$s['seat_number']),
                    'pdfFilename'             => $s['pdf_filename'] ?: sprintf('%s%06dFDVC2026-CL.pdf', $s['row_name'], (int)$s['seat_number']),
                    'checkedInAt'             => $s['checked_in_at'],
                ];
            }
        }

        echo json_encode([
            'valid'     => true,
            'email'     => $authenticatedEmail,
            'seats'     => $seatList,
            'orders'    => $matchingOrders,
            'message'   => 'Autenticación exitosa vía Enlace Mágico'
        ], JSON_UNESCAPED_UNICODE);
        exit(0);
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'error' => "Acción no válida: {$action}"], JSON_UNESCAPED_UNICODE);
    exit(1);

} catch (Exception $e) {
    http_response_code(500);
    error_log('Magic Link Error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Error en el servidor: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit(1);
}

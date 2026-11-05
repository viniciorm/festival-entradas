<?php
ini_set('memory_limit', '256M');
set_time_limit(120);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!$data) {
    echo json_encode(['success' => false, 'error' => 'No input JSON received or payload exceeded post_max_size']);
    exit(1);
}

$recipientEmail = $data['recipientEmail'] ?? '';
$participantName = $data['participantName'] ?? 'Participante';
$seatTickets = $data['seatTickets'] ?? [];
$sentBy = $data['sentBy'] ?? 'Organización Festival';
$batchIndex = (int)($data['batchIndex'] ?? 1);
$totalBatches = (int)($data['totalBatches'] ?? 1);

if (empty($recipientEmail) || empty($seatTickets)) {
    echo json_encode(['success' => false, 'error' => 'Faltan datos requeridos']);
    exit(1);
}

// Credentials loaded from environment or injected during deploy
$smtpUser = getenv('SMTP_USER') ?: 'festivalnac.danzadelvientre@gmail.com';
$smtpPass = getenv('SMTP_PASS') ?: ''; // App Password from Google

/**
 * Safely write data to socket in chunks
 */
function socketWriteChunked($socket, $data) {
    $length = strlen($data);
    $written = 0;
    while ($written < $length) {
        $n = fwrite($socket, substr($data, $written, 8192));
        if ($n === false || $n === 0) {
            return false;
        }
        $written += $n;
    }
    return true;
}

/**
 * Sends Email via Official Google Gmail SMTP over Port 587 (STARTTLS)
 */
function sendGmailSMTPDirect($to, $subject, $htmlBody, $seatTickets, $user, $pass, &$logOut = []) {
    $host = 'tcp://smtp.gmail.com:587';
    $log = [];
    $cleanPass = str_replace(' ', '', trim($pass));
    
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
        socketWriteChunked($socket, $cmd);
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
    $send(base64_encode($user) . "\r\n");
    $read();
    $send(base64_encode($cleanPass) . "\r\n", true);
    $authRes = $read();

    if (strpos($authRes, '235') === false) {
        $log[] = "FAIL: Autenticación rechazada por Google Gmail";
        $logOut = $log;
        fclose($socket);
        return false; // Auth failed
    }

    // 7. Mail envelope
    $boundary = "==Multipart_Boundary_x" . md5(time() . rand(1000,9999)) . "x";

    $send("MAIL FROM: <{$user}>\r\n"); $read();
    $send("RCPT TO: <{$to}>\r\n"); $read();
    $send("DATA\r\n"); $read();

    $encodedSubject = "=?UTF-8?B?" . base64_encode($subject) . "?=";

    $headers = "From: Festival Nacional Danza del Vientre <{$user}>\r\n";
    $headers .= "To: {$to}\r\n";
    $headers .= "Subject: {$encodedSubject}\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: multipart/mixed; boundary=\"{$boundary}\"\r\n\r\n";

    socketWriteChunked($socket, $headers);

    $bodyPart = "--{$boundary}\r\n";
    $bodyPart .= "Content-Type: text/html; charset=\"UTF-8\"\r\n";
    $bodyPart .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
    $bodyPart .= $htmlBody . "\r\n\r\n";

    socketWriteChunked($socket, $bodyPart);

    foreach ($seatTickets as $ticket) {
        if (!empty($ticket['pdfBase64']) && !empty($ticket['filename'])) {
            $filename = $ticket['filename'];
            $base64Data = $ticket['pdfBase64'];
            if (strpos($base64Data, ',') !== false) {
                $base64Data = explode(',', $base64Data)[1];
            }
            $chunkedPdf = chunk_split($base64Data);

            $attachmentHeader = "--{$boundary}\r\n";
            $attachmentHeader .= "Content-Type: application/pdf; name=\"{$filename}\"\r\n";
            $attachmentHeader .= "Content-Transfer-Encoding: base64\r\n";
            $attachmentHeader .= "Content-Disposition: attachment; filename=\"{$filename}\"\r\n\r\n";
            
            socketWriteChunked($socket, $attachmentHeader);
            socketWriteChunked($socket, $chunkedPdf . "\r\n\r\n");
        }
    }

    $footer = "--{$boundary}--\r\n.\r\n";
    socketWriteChunked($socket, $footer);

    $sendRes = $read();
    $send("QUIT\r\n");
    fclose($socket);

    $logOut = $log;
    return strpos($sendRes, '250') !== false;
}

$isInvitation = !empty($data['isInvitation']);
$ticketsCount = count($seatTickets);
$isSingular   = ($ticketsCount === 1);

// Prepare HTML Content
$ticketsListHtml = '';
foreach ($seatTickets as $st) {
    $row = htmlspecialchars($st['row'] ?? '');
    $num = htmlspecialchars($st['number'] ?? '');
    if (empty($row) && !empty($st['seatId'])) {
        $row = htmlspecialchars(substr($st['seatId'], 0, 1));
        $num = htmlspecialchars(substr($st['seatId'], 1));
    }
    $fn = htmlspecialchars($st['filename'] ?? '');
    
    if ($isInvitation) {
        $ticketsListHtml .= "<li style=\"margin-bottom: 8px; font-size: 14px;\"><strong style=\"color: #1e1b4b;\">Fila {$row} — Asiento {$num}</strong> <span style=\"color: #64748b; font-size: 12px;\">(Pase Oficial: {$fn})</span></li>";
    } else {
        $ticketsListHtml .= "<li style=\"margin-bottom: 6px;\"><strong>Fila {$row} - Asiento {$num}</strong> <span style=\"color: #64748b;\">({$fn})</span></li>";
    }
}

if ($isInvitation) {
    // ── TEMPLATE: INVITACIÓN DE HONOR / CORTESÍA ─────────────────────────────
    $batchNotice = ($totalBatches > 1) ? "<div style=\"background-color: #ede9fe; border: 1px solid #c4b5fd; border-radius: 8px; padding: 10px 14px; margin: 12px 0; color: #5b21b6; font-size: 13px; font-weight: bold;\">📦 Entrega Parte {$batchIndex} de {$totalBatches} ({$ticketsCount} entradas adjuntas en este correo)</div>" : "";

    if ($isSingular) {
        $subject = ($totalBatches > 1)
            ? "✨ Invitación de Honor (Parte {$batchIndex}/{$totalBatches}) — Festival Nacional Danza del Vientre Chile 2026"
            : "✨ Invitación de Honor — Festival Nacional Danza del Vientre Chile 2026";
        $invitationGreetingText = "Junto con saludar cordialmente, la Organización del <strong>Festival Nacional Danza del Vientre Chile 2026</strong> tiene el agrado de hacerte llegar tu <strong>invitación oficial</strong> para asistir a nuestra gran gala y muestra coreográfica.";
        $cordiallyInvitedText   = "Estás <strong>cordialmente invitado/a</strong> a acompañarnos y disfrutar de esta gran celebración de la danza oriental.";
        $seatsBoxTitle          = "Detalle de tu Butaca Reservada:";
        $attachmentNotice       = "Adjunto a este correo encontrarás tu <strong>pase oficial en formato PDF</strong> con su código QR para tu ingreso preferencial en puerta.";
        $farewellText           = "Esperamos contar con tu grata presencia.";
    } else {
        $subject = ($totalBatches > 1)
            ? "✨ Invitaciones de Honor (Parte {$batchIndex}/{$totalBatches} - {$ticketsCount} entradas) — Festival Nacional Danza del Vientre Chile 2026"
            : "✨ Invitaciones de Honor ({$ticketsCount} entradas) — Festival Nacional Danza del Vientre Chile 2026";
        $invitationGreetingText = "Junto con saludar cordialmente, la Organización del <strong>Festival Nacional Danza del Vientre Chile 2026</strong> tiene el agrado de hacerte llegar tus <strong>{$ticketsCount} invitaciones oficiales</strong> para asistir a nuestra gran gala y muestra coreográfica.";
        $cordiallyInvitedText   = "Están <strong>cordialmente invitados</strong> a acompañarnos y disfrutar de esta gran celebración de la danza oriental.";
        $seatsBoxTitle          = "Detalle de las {$ticketsCount} Butacas Reservadas para Ti:";
        $attachmentNotice       = "Adjuntos a este correo encontrarás tus <strong>{$ticketsCount} pases oficiales en formato PDF</strong> con sus respectivos códigos QR individuales para el ingreso preferencial en puerta.";
        $farewellText           = "Esperamos contar con su grata presencia.";
    }

    $htmlBody = "
    <div style=\"font-family: 'Segoe UI', Arial, sans-serif; background-color: #0f0a1e; padding: 32px 16px; color: #1e293b;\">
      <div style=\"max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.25);\">
        
        <!-- Header Banner -->
        <div style=\"background: linear-gradient(135deg, #1a1333 0%, #2d1854 100%); padding: 32px 24px; text-align: center; color: #ffffff;\">
          <p style=\"margin: 0 0 6px 0; font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #fbbf24; text-transform: uppercase;\">INVITACIÓN DE HONOR</p>
          <h1 style=\"margin: 0; font-size: 21px; font-weight: 900; letter-spacing: 0.5px; color: #ffffff;\">FESTIVAL NACIONAL DANZA DEL VIENTRE</h1>
          <p style=\"margin: 6px 0 0 0; color: #cbd5e1; font-size: 13px; font-weight: 600;\">CHILE 2026 • GALA COREOGRÁFICA</p>
        </div>

        <!-- Body Content -->
        <div style=\"padding: 28px 24px;\">
          <p style=\"font-size: 16px; margin-top: 0; color: #0f172a;\">Estimado/a <strong>" . htmlspecialchars($participantName) . "</strong>,</p>
          
          <p style=\"color: #334155; line-height: 1.6; font-size: 14px;\">{$invitationGreetingText}</p>
          <p style=\"color: #334155; line-height: 1.6; font-size: 14px;\">{$cordiallyInvitedText}</p>
          {$batchNotice}

          <!-- Event Info Box -->
          <div style=\"background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 22px 0;\">
            <h3 style=\"margin: 0 0 12px 0; font-size: 13px; font-weight: 800; color: #4338ca; text-transform: uppercase; letter-spacing: 0.5px;\">📍 Información Oficial del Evento</h3>
            <table style=\"width: 100%; border-collapse: collapse; font-size: 13px; color: #334155;\">
              <tr>
                <td style=\"padding: 4px 0; font-weight: bold; width: 100px;\">📅 Fecha:</td>
                <td style=\"padding: 4px 0;\">Sábado 5 de Septiembre de 2026</td>
              </tr>
              <tr>
                <td style=\"padding: 4px 0; font-weight: bold;\">⏰ Horario:</td>
                <td style=\"padding: 4px 0;\"><strong>17:30 hrs</strong> <span style=\"color: #64748b;\">(Apertura de puertas: 17:00 hrs)</span></td>
              </tr>
              <tr>
                <td style=\"padding: 4px 0; font-weight: bold;\">🏛️ Lugar:</td>
                <td style=\"padding: 4px 0;\">Aula Magna Liceo Manuel de Salas</td>
              </tr>
              <tr>
                <td style=\"padding: 4px 0; font-weight: bold;\">📌 Dirección:</td>
                <td style=\"padding: 4px 0;\">Av. Irarrázaval 3780, Ñuñoa, Santiago</td>
              </tr>
            </table>
          </div>

          <!-- Seats Box -->
          <div style=\"background: linear-gradient(to right, #faf5ff, #f5f3ff); border-left: 4px solid #7c3aed; padding: 18px; margin: 22px 0; border-radius: 6px;\">
            <h3 style=\"margin: 0 0 12px 0; font-size: 14px; font-weight: 800; color: #5b21b6;\">🎟️ {$seatsBoxTitle}</h3>
            <ul style=\"margin: 0; padding-left: 20px; line-height: 1.5;\">{$ticketsListHtml}</ul>
          </div>

          <p style=\"color: #475569; font-size: 13.5px; line-height: 1.6;\">{$attachmentNotice}</p>
          
          <p style=\"color: #1e1b4b; font-size: 14px; font-weight: 700; margin-top: 24px;\">{$farewellText}</p>

          <!-- Footer -->
          <div style=\"color: #64748b; font-size: 12px; margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 18px; line-height: 1.5;\">
            <strong>Organización Festival Nacional Danza del Vientre Chile 2026</strong><br />
            Emitido por: <strong>" . htmlspecialchars($sentBy) . "</strong><br />
            Correo de contacto: <code>{$smtpUser}</code>
          </div>
        </div>
      </div>
    </div>";

} else {
    // ── TEMPLATE: ASIGNACIÓN A PARTICIPANTES / BAILARINAS (INTACTO) ──────────
    $batchNotice = ($totalBatches > 1) ? "<p style=\"color: #4f46e5; font-weight: bold; margin-top: 4px;\">📦 Parte {$batchIndex} de {$totalBatches} (Total de entradas asignadas en esta parte: " . count($seatTickets) . ")</p>" : "";

    $htmlBody = "
    <div style=\"font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;\">
      <div style=\"max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);\">
        <div style=\"background-color: #1a1333; padding: 28px; text-align: center; color: #ffffff;\">
          <h1 style=\"margin: 0; font-size: 20px;\">FESTIVAL NACIONAL DANZA DEL VIENTRE</h1>
          <p style=\"margin: 6px 0 0 0; color: #f59e0b; font-weight: bold;\">CHILE 2026</p>
        </div>
        <div style=\"padding: 24px;\">
          <p style=\"font-size: 16px; margin-top: 0;\">Estimado/a <strong>" . htmlspecialchars($participantName) . "</strong>,</p>
          <p style=\"color: #475569;\">Junto con saludar, nos complace hacerte entrega de las entradas asignadas para el evento.</p>
          {$batchNotice}
          <div style=\"background-color: #f1f5f9; border-left: 4px solid #4f46e5; padding: 16px; margin: 20px 0; border-radius: 4px;\">
            <h3 style=\"margin: 0 0 10px 0; font-size: 15px;\">Detalle de Butacas Asignadas en este Correo:</h3>
            <ul style=\"margin: 0; padding-left: 20px;\">{$ticketsListHtml}</ul>
          </div>
          <p style=\"color: #475569;\">En esta notificación encontrarás adjuntos los archivos PDF oficiales con su código QR para el control de acceso en puerta.</p>
          <p style=\"color: #64748b; font-size: 13px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;\">
            Emitido por: <strong>" . htmlspecialchars($sentBy) . "</strong><br />
            Correo oficial: <code>{$smtpUser}</code>
          </p>
        </div>
      </div>
    </div>";

    if ($totalBatches > 1) {
        $subject = "🎟️ Entradas Oficiales Festival 2026 (Parte {$batchIndex}/{$totalBatches}) - {$participantName}";
    } else {
        $subject = "🎟️ Entradas Oficiales Festival 2026 - {$participantName}";
    }
}

$sentViaGmail = false;
$smtpLog = [];
$deliveryMode = 'none';

if (!empty($smtpPass)) {
    $sentViaGmail = sendGmailSMTPDirect($recipientEmail, $subject, $htmlBody, $seatTickets, $smtpUser, $smtpPass, $smtpLog);
    if ($sentViaGmail) {
        $deliveryMode = 'gmail_smtp_official';
    }
}

if (!$sentViaGmail) {
    // Fallback standard mail without external domain tags
    $boundary = "==Multipart_Boundary_x" . md5(time() . rand(1000,9999)) . "x";
    $encodedSubject = "=?UTF-8?B?" . base64_encode($subject) . "?=";

    $headers = "From: Festival Nacional Danza del Vientre <{$smtpUser}>\r\n";
    $headers .= "Reply-To: {$smtpUser}\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: multipart/mixed; boundary=\"{$boundary}\"\r\n";

    $message = "--{$boundary}\r\n";
    $message .= "Content-Type: text/html; charset=\"UTF-8\"\r\n";
    $message .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
    $message .= $htmlBody . "\r\n\r\n";

    foreach ($seatTickets as $ticket) {
        if (!empty($ticket['pdfBase64']) && !empty($ticket['filename'])) {
            $filename = $ticket['filename'];
            $base64Data = $ticket['pdfBase64'];
            if (strpos($base64Data, ',') !== false) {
                $base64Data = explode(',', $base64Data)[1];
            }
            $chunkedPdf = chunk_split($base64Data);

            $message .= "--{$boundary}\r\n";
            $message .= "Content-Type: application/pdf; name=\"{$filename}\"\r\n";
            $message .= "Content-Transfer-Encoding: base64\r\n";
            $message .= "Content-Disposition: attachment; filename=\"{$filename}\"\r\n\r\n";
            $message .= $chunkedPdf . "\r\n\r\n";
        }
    }
    $message .= "--{$boundary}--";
    $sentFallback = @mail($recipientEmail, $encodedSubject, $message, $headers);
    if ($sentFallback) {
        $deliveryMode = 'server_mail_fallback';
        $sentViaGmail = true;
    }
}

echo json_encode([
    'success' => (bool)$sentViaGmail,
    'mode' => $deliveryMode,
    'batchIndex' => $batchIndex,
    'totalBatches' => $totalBatches,
    'seatsCount' => count($seatTickets),
    'smtpLog' => $smtpLog,
    'message' => ($deliveryMode === 'gmail_smtp_official')
        ? "Correo {$batchIndex}/{$totalBatches} enviado directamente vía Google Gmail Oficial (Port 587 STARTTLS) a {$recipientEmail}"
        : "Correo {$batchIndex}/{$totalBatches} procesado para {$recipientEmail}"
], JSON_UNESCAPED_UNICODE);

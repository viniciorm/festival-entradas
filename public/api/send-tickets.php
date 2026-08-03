<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!$data) {
    echo json_encode(['success' => false, 'error' => 'No input JSON received']);
    exit;
}

$recipientEmail = $data['recipientEmail'] ?? '';
$participantName = $data['participantName'] ?? 'Participante';
$seatTickets = $data['seatTickets'] ?? [];
$sentBy = $data['sentBy'] ?? 'Organización Festival';

if (empty($recipientEmail) || empty($seatTickets)) {
    echo json_encode(['success' => false, 'error' => 'Faltan datos requeridos']);
    exit;
}

// Credentials loaded from environment or fallback
$smtpUser = getenv('SMTP_USER') ?: 'festivalnac.danzadelvientre@gmail.com';
$smtpPass = getenv('SMTP_PASS') ?: ''; // App Password from Google

/**
 * Sends Email via Gmail Direct SSL/TLS SMTP (Port 465)
 */
function sendGmailSMTPDirect($to, $subject, $htmlBody, $seatTickets, $user, $pass) {
    $host = 'ssl://smtp.gmail.com';
    $port = 465;
    
    $socket = @fsockopen($host, $port, $errno, $errstr, 12);
    if (!$socket) return false;
    
    $read = function() use ($socket) {
        $res = "";
        while ($line = fgets($socket, 512)) {
            $res .= $line;
            if (substr($line, 3, 1) == " ") break;
        }
        return $res;
    };

    $read();
    fwrite($socket, "EHLO ticketfestival.tupartnerti.cl\r\n"); $read();
    fwrite($socket, "AUTH LOGIN\r\n"); $read();
    fwrite($socket, base64_encode($user) . "\r\n"); $read();
    fwrite($socket, base64_encode($pass) . "\r\n");
    $authRes = $read();

    if (strpos($authRes, '235') === false) {
        fclose($socket);
        return false; // Auth failed
    }

    $boundary = "==Multipart_Boundary_x" . md5(time()) . "x";

    fwrite($socket, "MAIL FROM: <{$user}>\r\n"); $read();
    fwrite($socket, "RCPT TO: <{$to}>\r\n"); $read();
    fwrite($socket, "DATA\r\n"); $read();

    $headers = "From: Festival Nacional Danza del Vientre <{$user}>\r\n";
    $headers .= "To: {$to}\r\n";
    $headers .= "Subject: {$subject}\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: multipart/mixed; boundary=\"{$boundary}\"\r\n\r\n";

    $message = $headers;
    $message .= "--{$boundary}\r\n";
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
    $message .= "--{$boundary}--\r\n.\r\n";

    fwrite($socket, $message);
    $sendRes = $read();
    fwrite($socket, "QUIT\r\n");
    fclose($socket);

    return strpos($sendRes, '250') !== false;
}

// Prepare HTML Content
$ticketsListHtml = '';
foreach ($seatTickets as $st) {
    $row = htmlspecialchars($st['row'] ?? '');
    $num = htmlspecialchars($st['number'] ?? '');
    $fn = htmlspecialchars($st['filename'] ?? '');
    $ticketsListHtml .= "<li style=\"margin-bottom: 6px;\"><strong>Fila {$row} - Asiento {$num}</strong> <span style=\"color: #64748b;\">({$fn})</span></li>";
}

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
      <div style=\"background-color: #f1f5f9; border-left: 4px solid #4f46e5; padding: 16px; margin: 20px 0; border-radius: 4px;\">
        <h3 style=\"margin: 0 0 10px 0; font-size: 15px;\">Detalle de Butacas Asignadas:</h3>
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

$subject = "🎟️ Entradas Oficiales Festival 2026 - {$participantName}";
$sentViaGmail = false;

if (!empty($smtpPass)) {
    $sentViaGmail = sendGmailSMTPDirect($recipientEmail, $subject, $htmlBody, $seatTickets, $smtpUser, $smtpPass);
}

if (!$sentViaGmail) {
    // Fallback standard mail
    $boundary = "==Multipart_Boundary_x" . md5(time()) . "x";
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
    @mail($recipientEmail, $subject, $message, $headers);
}

echo json_encode([
    'success' => true,
    'mode' => $sentViaGmail ? 'gmail_smtp_direct' : 'server_mail_fallback',
    'message' => $sentViaGmail ? "Correo enviado vía Gmail SMTP oficial a {$recipientEmail}" : "Correo en cola de envío para {$recipientEmail}"
]);

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
    echo json_encode(['success' => false, 'error' => 'Faltan datos requeridos (email o entradas)']);
    exit;
}

$senderEmail = 'festivalnac.danzadelvientre@gmail.com';
$boundary = "==Multipart_Boundary_x" . md5(time()) . "x";

// Headers
$headers = "From: Festival Nacional Danza del Vientre <{$senderEmail}>\r\n";
$headers .= "Reply-To: {$senderEmail}\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: multipart/mixed; boundary=\"{$boundary}\"\r\n";

// HTML Body
$htmlBody = "
<div style=\"font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;\">
  <div style=\"max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;\">
    <div style=\"background-color: #1a1333; padding: 24px; text-align: center; color: #ffffff;\">
      <h1 style=\"margin: 0; font-size: 18px;\">FESTIVAL NACIONAL DANZA DEL VIENTRE</h1>
      <p style=\"margin: 4px 0 0 0; color: #f59e0b; font-weight: bold;\">CHILE 2026</p>
    </div>
    <div style=\"padding: 20px;\">
      <p>Estimado/a <strong>" . htmlspecialchars($participantName) . "</strong>,</p>
      <p>Adjunto encontrarás las entradas asignadas para el evento.</p>
      <p style=\"font-size: 12px; color: #64748b;\">Emitido por: " . htmlspecialchars($sentBy) . "</p>
    </div>
  </div>
</div>";

// Plain / HTML Multipart Message
$message = "--{$boundary}\r\n";
$message .= "Content-Type: text/html; charset=\"UTF-8\"\r\n";
$message .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
$message .= $htmlBody . "\r\n\r\n";

// Attach PDFs
foreach ($seatTickets as $ticket) {
    if (!empty($ticket['pdfBase64']) && !empty($ticket['filename'])) {
        $filename = $ticket['filename'];
        $base64Data = $ticket['pdfBase64'];
        
        if (strpos($base64Data, ',') !== false) {
            $base64Data = explode(',', $base64Data)[1];
        }
        
        $pdfBinary = base64_decode($base64Data);
        $chunkedPdf = chunk_split(base64_encode($pdfBinary));
        
        $message .= "--{$boundary}\r\n";
        $message .= "Content-Type: application/pdf; name=\"{$filename}\"\r\n";
        $message .= "Content-Transfer-Encoding: base64\r\n";
        $message .= "Content-Disposition: attachment; filename=\"{$filename}\"\r\n\r\n";
        $message .= $chunkedPdf . "\r\n\r\n";
    }
}

$message .= "--{$boundary}--";

$mailSent = @mail($recipientEmail, "🎟️ Entradas Oficiales Festival 2026 - {$participantName}", $message, $headers);

echo json_encode([
    'success' => true,
    'mailSent' => $mailSent,
    'message' => "Entradas procesadas para {$recipientEmail}"
]);

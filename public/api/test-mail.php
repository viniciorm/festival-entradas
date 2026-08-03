<?php
header('Content-Type: application/json; charset=utf-8');

$to = $_GET['to'] ?? $_POST['to'] ?? 'marco.roman.chile@gmail.com';
$from = 'festivalnac.danzadelvientre@gmail.com';
$subject = '🎟️ Prueba de Envio de Correo - Festival Danza del Vientre Chile 2026';

$message = "
<html>
<head>
  <title>Prueba de Envío Oficial</title>
</head>
<body style=\"font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px;\">
  <div style=\"max-width: 500px; margin: 0 auto; background: #1a1333; color: white; padding: 20px; border-radius: 12px; border: 2px solid #f59e0b;\">
    <h2 style=\"color: #f59e0b; margin-top: 0;\">FESTIVAL NACIONAL DANZA DEL VIENTRE 2026</h2>
    <p>¡Este es un correo de prueba oficial enviado exitosamente desde la plataforma del Festival!</p>
    <hr style=\"border-color: #312e81; margin: 15px 0;\" />
    <p style=\"font-size: 12px; color: #cbd5e1;\">Remitente: {$from}<br />Destinatario: {$to}<br />Fecha: " . date('d/m/Y H:i:s') . "</p>
  </div>
</body>
</html>
";

$headers = "From: Festival Nacional Danza del Vientre <{$from}>\r\n";
$headers .= "Reply-To: {$from}\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";

$sent = @mail($to, $subject, $message, $headers);

echo json_encode([
    'success' => $sent,
    'from' => $from,
    'to' => $to,
    'status' => $sent ? 'Correo enviado a la cola del servidor' : 'Error al enviar mail',
    'timestamp' => date('Y-m-d H:i:s')
]);

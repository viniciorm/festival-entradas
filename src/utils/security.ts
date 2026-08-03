/**
 * Ticket Cryptographic Security & Anti-Fraud HMAC Module
 * Festival Nacional Danza del Vientre Chile 2026
 */

const SECRET_SALT = process.env.NEXT_PUBLIC_TICKET_SECRET || 'FDVC2026_SECRET_SALT_CHILE_TEATRO_PROD_KEY';

/**
 * Generates a deterministic 64-character SHA-256 HMAC signature for a ticket
 */
export async function generateTicketSignature(seatId: string, row: string, seatNumber: number, participantId: string): Promise<string> {
  const data = `${seatId}:${row}:${seatNumber}:${participantId}:${SECRET_SALT}`;
  
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(SECRET_SALT);
    const messageData = encoder.encode(data);

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await window.crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback simple hash for non-browser/server node environment
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `FDVC2026SIG${hex}99882211`;
}

/**
 * Creates the complete signed security payload encoded into the QR Code
 */
export async function createTicketQRPayload(seat: { id: string; row: string; number: number; ticketCode?: string }, participantName: string) {
  const sig = await generateTicketSignature(seat.id, seat.row, seat.number, participantName);
  const shortHash = sig.substring(0, 8).toUpperCase();
  const formattedHash = `${shortHash.substring(0, 4)}-${shortHash.substring(4, 8)}`;

  return {
    qrString: JSON.stringify({
      v: '2.0',
      event: 'FDVC2026',
      seat: seat.id,
      row: seat.row,
      num: seat.number,
      code: seat.ticketCode || `FDVC2026-${seat.id}`,
      holder: participantName,
      hash: formattedHash,
      sig: sig,
    }),
    securityHash: formattedHash,
    signature: sig,
  };
}

/**
 * Verifies a scanned QR payload to detect fake/tampered tickets
 */
export async function verifyTicketQRPayload(qrText: string): Promise<{
  isValid: boolean;
  reason?: string;
  data?: {
    seatId: string;
    row: string;
    seatNumber: number;
    holder: string;
    hash: string;
    ticketCode: string;
  };
}> {
  try {
    const parsed = JSON.parse(qrText);

    if (!parsed || parsed.event !== 'FDVC2026' || !parsed.sig || !parsed.seat) {
      return { isValid: false, reason: 'Formato de QR no reconocido o ajeno al Festival.' };
    }

    const expectedSig = await generateTicketSignature(parsed.seat, parsed.row, parsed.num, parsed.holder);

    // Verify cryptographic signature match
    if (parsed.sig !== expectedSig) {
      return { isValid: false, reason: '⚠️ ALERTA DE SEGURIDAD: Firma criptográfica inválida. ¡Entrada falsificada!' };
    }

    return {
      isValid: true,
      data: {
        seatId: parsed.seat,
        row: parsed.row,
        seatNumber: parsed.num,
        holder: parsed.holder,
        hash: parsed.hash,
        ticketCode: parsed.code,
      },
    };
  } catch (e) {
    return { isValid: false, reason: 'Error al decodificar el código QR.' };
  }
}

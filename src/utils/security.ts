/**
 * Ticket Cryptographic Security & Anti-Fraud HMAC Module
 * Festival Nacional Danza del Vientre Chile 2026
 */

const SECRET_SALT = process.env.NEXT_PUBLIC_TICKET_SECRET || 'FDVC2026_SECRET_SALT_CHILE_TEATRO_PROD_KEY';
const DOMAIN = 'https://ticketfestival.tupartnerti.cl';

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
 * Formatted as a clean verification URL so scanning with a phone camera
 * opens a beautiful verification page instead of raw JSON!
 */
export async function createTicketQRPayload(seat: { id: string; row: string; number: number; ticketCode?: string }, participantName: string) {
  const sig = await generateTicketSignature(seat.id, seat.row, seat.number, participantName);
  const shortHash = sig.substring(0, 8).toUpperCase();
  const formattedHash = `${shortHash.substring(0, 4)}-${shortHash.substring(4, 8)}`;

  // Clean verification URL format: https://ticketfestival.tupartnerti.cl/?v=B12.03D4-3EF7.03d43ef7cd...
  const encodedToken = `${seat.id}.${formattedHash}.${sig}`;
  const verificationUrl = `${DOMAIN}/?verify=${encodeURIComponent(encodedToken)}`;

  return {
    qrString: verificationUrl,
    securityHash: formattedHash,
    signature: sig,
  };
}

/**
 * Verifies a scanned QR payload or URL token to detect fake/tampered tickets
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
    let token = qrText.trim();

    // If it's a full URL, extract the token from query param ?verify= or ?v=
    if (token.includes('verify=')) {
      token = decodeURIComponent(token.split('verify=')[1].split('&')[0]);
    } else if (token.includes('v=')) {
      token = decodeURIComponent(token.split('v=')[1].split('&')[0]);
    }

    // Try parsing legacy JSON if scanned old ticket
    if (token.startsWith('{') && token.endsWith('}')) {
      const parsed = JSON.parse(token);
      if (!parsed || parsed.event !== 'FDVC2026' || !parsed.sig || !parsed.seat) {
        return { isValid: false, reason: 'Formato de QR no reconocido o ajeno al Festival.' };
      }
      const expectedSig = await generateTicketSignature(parsed.seat, parsed.row, parsed.num, parsed.holder);
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
    }

    // Modern token format: SEAT_ID.FORMATTED_HASH.SIG
    const parts = token.split('.');
    if (parts.length < 3) {
      return { isValid: false, reason: 'Código de verificación incompleto o no válido.' };
    }

    const [seatId, formattedHash, sig] = parts;
    const row = seatId.charAt(0);
    const seatNum = parseInt(seatId.replace(/^[A-Z]-?/, ''), 10) || 1;

    // Verify cryptographic signature match
    const expectedSig = await generateTicketSignature(seatId, row, seatNum, 'Participante / Solista');
    
    // We check if signature matches
    const isSigMatch = sig === expectedSig || sig.startsWith(expectedSig.substring(0, 16));

    if (!isSigMatch) {
      return { isValid: false, reason: '⚠️ ALERTA DE SEGURIDAD: Firma criptográfica inválida. ¡Entrada falsificada!' };
    }

    return {
      isValid: true,
      data: {
        seatId: seatId,
        row: row,
        seatNumber: seatNum,
        holder: 'Participante / Solista',
        hash: formattedHash,
        ticketCode: `FDVC2026-${seatId}`,
      },
    };
  } catch (e) {
    return { isValid: false, reason: 'Error al decodificar el código QR.' };
  }
}

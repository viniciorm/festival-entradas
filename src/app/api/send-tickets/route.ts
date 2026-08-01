import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { recipientEmail, participantName, seatTickets, sentBy } = body;

    if (!recipientEmail || !seatTickets || !Array.isArray(seatTickets)) {
      return NextResponse.json({ error: 'Datos insuficientes para el envío de correo' }, { status: 400 });
    }

    const senderEmail = process.env.SMTP_USER || 'festivalnac.danzadelvientre@gmail.com';
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const smtpPass = process.env.SMTP_PASS;

    const ticketsListHtml = seatTickets
      .map(
        (st: { row: string; number: number; filename: string; ticketCode: string }) =>
          `<li style="margin-bottom: 6px;">
            <strong>Fila ${st.row} - Asiento ${st.number}</strong> 
            <span style="color: #64748b;">(Archivo: ${st.filename})</span>
          </li>`
      )
      .join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <div style="background-color: #1a1333; padding: 28px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 20px; letter-spacing: 1px;">FESTIVAL NACIONAL DANZA DEL VIENTRE</h1>
            <p style="margin: 6px 0 0 0; color: #d97706; font-weight: bold; font-size: 14px;">CHILE 2026</p>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 16px; margin-top: 0;">Estimado/a <strong>${participantName}</strong>,</p>
            <p style="color: #475569; line-height: 1.6;">
              Junto con saludar, nos complace hacerte entrega de las entradas asignadas para el <strong>Festival Nacional Danza del Vientre Chile 2026</strong>.
            </p>
            <div style="background-color: #f1f5f9; border-left: 4px solid #4f46e5; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1e293b;">Detalle de Butacas Asignadas:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #334155;">
                ${ticketsListHtml}
              </ul>
            </div>
            <p style="color: #475569; line-height: 1.6;">
              En la presente notificación encontrarás adjuntos los archivos PDF individuales de cada entrada. Cada archivo lleva la nomenclatura oficial asignada (ejemplo: <code>A000123FDVC2026-CL.pdf</code>) y contiene el código QR para el control de acceso en la entrada del teatro.
            </p>
            <p style="color: #64748b; font-size: 13px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
              Emitido por: <strong>${sentBy || 'Organización Festival'}</strong><br />
              Correo de contacto oficial: <code>festivalnac.danzadelvientre@gmail.com</code><br />
              Plataforma: <a href="https://ticketfestival.tupartnerti.cl" style="color: #4f46e5;">ticketfestival.tupartnerti.cl</a>
            </p>
          </div>
        </div>
      </div>
    `;

    // Check if SMTP is configured for actual network dispatch
    if (smtpHost && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: senderEmail,
          pass: smtpPass,
        },
      });

      const attachments = seatTickets
        .filter((st: { pdfBase64?: string; filename: string }) => st.pdfBase64)
        .map((st: { pdfBase64?: string; filename: string }) => ({
          filename: st.filename,
          content: Buffer.from(st.pdfBase64!.split(',')[1] || st.pdfBase64!, 'base64'),
          contentType: 'application/pdf',
        }));

      await transporter.sendMail({
        from: `"Festival Nacional Danza del Vientre 2026" <${senderEmail}>`,
        to: recipientEmail,
        subject: `🎟️ Entradas Oficiales Festival 2026 - ${participantName}`,
        html: htmlContent,
        attachments: attachments,
      });

      return NextResponse.json({
        success: true,
        message: `Correo enviado exitosamente a ${recipientEmail} vía SMTP real (${senderEmail})`,
        mode: 'real_smtp',
      });
    }

    // Simulated response when SMTP is not yet configured with real password
    console.log(`[EMAIL SIMULATOR] Dispatching tickets from ${senderEmail} to ${recipientEmail}`);

    return NextResponse.json({
      success: true,
      message: `Simulación de correo exitosa: Entradas enviadas a ${recipientEmail} desde ${senderEmail}`,
      mode: 'simulation',
      sender: senderEmail,
      recipient: recipientEmail,
      attachedPDFs: seatTickets.map((s: { filename: string }) => s.filename),
    });
  } catch (error) {
    console.error('Error enviando correos:', error);
    return NextResponse.json({ error: 'Fallo al procesar el envío de correos', details: String(error) }, { status: 500 });
  }
}

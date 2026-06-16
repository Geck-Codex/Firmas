import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendSignatureRequest({
  to,
  signerName,
  documentTitle,
  signUrl,
}: {
  to: string;
  signerName: string;
  documentTitle: string;
  signUrl: string;
}): Promise<void> {
  const from = process.env.RESEND_FROM ?? "Firma Digital <noreply@resend.dev>";

  await resend.emails.send({
    from,
    to,
    subject: `${signerName}, firma requerida: ${documentTitle}`,
    text: `Hola ${signerName},\n\nSe te solicita firmar el documento "${documentTitle}".\n\nRevísalo y fírmalo aquí:\n${signUrl}\n\nSi no esperabas este mensaje puedes ignorarlo.\n\nFirma electrónica simple (art. 89 Cód. Comercio mexicano).`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1e293b">
        <p style="margin:0 0 12px">Hola <strong>${signerName}</strong>,</p>
        <p style="margin:0 0 8px">
          Se te solicita revisar y firmar el siguiente documento:
        </p>
        <p style="margin:0 0 24px;font-size:17px;font-weight:600">${documentTitle}</p>
        <a
          href="${signUrl}"
          style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px"
        >
          Revisar y firmar
        </a>
        <p style="margin:16px 0 0;font-size:13px;color:#64748b">
          O copia este enlace en tu navegador:<br/>
          <span style="color:#2563eb">${signUrl}</span>
        </p>
        <hr style="margin:28px 0;border:none;border-top:1px solid #e2e8f0"/>
        <p style="margin:0;font-size:11px;color:#94a3b8">
          Si no esperabas este correo puedes ignorarlo.<br/>
          Firma electrónica simple (art. 89 Cód. Comercio mexicano). No es e.firma del SAT ni constancia NOM-151.
        </p>
      </div>
    `,
  });
}

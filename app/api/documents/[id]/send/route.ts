import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSignatureRequest } from "@/lib/email";
import { requireUser } from "@/lib/auth";
import { hasSignatureBox } from "@/lib/placement";

// POST /api/documents/:id/send — pasa el documento a SENT y devuelve los enlaces.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const document = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      signers: { orderBy: { order: "asc" }, include: { placements: true } },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }
  if (document.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Solo se pueden enviar documentos en borrador." },
      { status: 409 },
    );
  }

  // No dejar salir un documento sin lugar de firma: es justo lo que hacía que
  // las firmas cayeran en cualquier parte.
  const sinColocar = document.signers.filter((s) => !hasSignatureBox(s.placements));
  if (sinColocar.length > 0) {
    return NextResponse.json(
      {
        error: `Falta colocar la firma de: ${sinColocar
          .map((s) => s.name)
          .join(", ")}.`,
      },
      { status: 409 },
    );
  }

  await prisma.document.update({
    where: { id: document.id },
    data: { status: "SENT" },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const links = document.signers.map((s) => ({
    name: s.name,
    email: s.email,
    url: `${appUrl}/sign/${s.signToken}`,
  }));

  // Enviar correo a cada firmante (errores no bloquean la respuesta)
  await Promise.allSettled(
    links.map((l) =>
      sendSignatureRequest({
        to: l.email,
        signerName: l.name,
        documentTitle: document.title,
        signUrl: l.url,
      }),
    ),
  );

  return NextResponse.json({ links });
}

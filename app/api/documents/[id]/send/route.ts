import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/documents/:id/send — pasa el documento a SENT y devuelve los enlaces.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const document = await prisma.document.findUnique({
    where: { id: params.id },
    include: { signers: { orderBy: { order: "asc" } } },
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

  return NextResponse.json({ links });
}

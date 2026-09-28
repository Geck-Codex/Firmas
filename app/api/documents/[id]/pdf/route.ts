import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";
import { requireUser } from "@/lib/auth";

// GET /api/documents/:id/pdf — sirve el PDF vigente para el editor de colocación.
// Expone el contrato completo, así que exige sesión del emisor.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const document = await prisma.document.findUnique({
    where: { id: params.id },
  });

  if (!document) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }

  const bytes = await readFile(document.signedPath ?? document.originalPath);

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
    },
  });
}

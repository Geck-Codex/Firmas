import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";

// GET /api/documents/:id/download — descarga el PDF firmado (solo si COMPLETED).
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const document = await prisma.document.findUnique({
    where: { id: params.id },
  });

  if (!document) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }
  if (document.status !== "COMPLETED" || !document.signedPath) {
    return NextResponse.json(
      { error: "El documento aún no está finalizado." },
      { status: 409 },
    );
  }

  const bytes = await readFile(document.signedPath);
  const safeTitle = document.title.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 80);

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeTitle}_firmado.pdf"`,
    },
  });
}

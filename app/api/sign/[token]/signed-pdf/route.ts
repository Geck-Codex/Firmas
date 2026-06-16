import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";

// Permite al firmante descargar el PDF final una vez que el documento está COMPLETED.
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const signer = await prisma.signer.findUnique({
    where: { signToken: params.token },
    include: { document: true },
  });

  if (!signer) {
    return NextResponse.json({ error: "Enlace inválido." }, { status: 404 });
  }
  if (signer.document.status !== "COMPLETED" || !signer.document.signedPath) {
    return NextResponse.json({ error: "El documento aún no está completado." }, { status: 409 });
  }

  const bytes = await readFile(signer.document.signedPath);
  const filename = `${signer.document.title.replace(/[^a-zA-Z0-9]/g, "_")}_firmado.pdf`;

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}

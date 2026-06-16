import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";

// GET /api/sign/:token/pdf — sirve el PDF vigente para que el firmante lo vea.
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

  const doc = signer.document;
  const bytes = await readFile(doc.signedPath ?? doc.originalPath);

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
    },
  });
}

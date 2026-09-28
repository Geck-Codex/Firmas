import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/sign/:token/placements — dónde quedará la firma de ESTE firmante.
// Lo usa la página pública para resaltarle el lugar antes de firmar.
// Acceso por token: solo devuelve los recuadros propios, nunca los de otros.
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const signer = await prisma.signer.findUnique({
    where: { signToken: params.token },
    include: { placements: true },
  });

  if (!signer) {
    return NextResponse.json({ error: "Enlace inválido." }, { status: 404 });
  }

  return NextResponse.json({
    boxes: signer.placements.map(({ page, x, y, width, height, kind }) => ({
      page,
      x,
      y,
      width,
      height,
      kind,
    })),
  });
}

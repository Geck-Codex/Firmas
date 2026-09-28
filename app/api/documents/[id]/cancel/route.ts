import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const document = await prisma.document.findUnique({ where: { id: params.id } });

  if (!document) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }
  if (document.status === "COMPLETED" || document.status === "CANCELLED") {
    return NextResponse.json({ error: "Este documento no se puede cancelar." }, { status: 409 });
  }

  await prisma.document.update({
    where: { id: params.id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ ok: true });
}

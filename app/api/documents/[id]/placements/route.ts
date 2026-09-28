import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";
import { pdfPageCount } from "@/lib/pdf";
import { requireUser } from "@/lib/auth";
import { savePlacementsInput } from "@/lib/validation";

// GET /api/documents/:id/placements — recuadros ya colocados, para reabrir el editor.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const document = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      signers: {
        orderBy: { order: "asc" },
        include: { placements: true },
      },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    signers: document.signers.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      boxes: s.placements.map(({ page, x, y, width, height, kind }) => ({
        page,
        x,
        y,
        width,
        height,
        kind,
      })),
    })),
  });
}

// PUT /api/documents/:id/placements — guarda dónde firma cada quien.
// Reemplaza por completo los recuadros del documento (el editor manda el estado final).
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => null);
  const parsed = savePlacementsInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const document = await prisma.document.findUnique({
    where: { id: params.id },
    include: { signers: true },
  });

  if (!document) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }
  // Tras enviarlo las posiciones quedan congeladas: mover una firma ya solicitada
  // cambiaría el documento que el firmante aceptó.
  if (document.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Solo se pueden colocar firmas en documentos en borrador." },
      { status: 409 },
    );
  }

  // Los recuadros deben pertenecer a este documento y caer en páginas reales.
  const validIds = new Set(document.signers.map((s) => s.id));
  for (const entry of parsed.data.placements) {
    if (!validIds.has(entry.signerId)) {
      return NextResponse.json(
        { error: "Un recuadro no corresponde a este documento." },
        { status: 400 },
      );
    }
  }

  const pageCount = await pdfPageCount(await readFile(document.originalPath));
  const outOfRange = parsed.data.placements.some((entry) =>
    entry.boxes.some((b) => b.page >= pageCount),
  );
  if (outOfRange) {
    return NextResponse.json(
      { error: "Un recuadro apunta a una página que no existe." },
      { status: 400 },
    );
  }

  const rows = parsed.data.placements.flatMap((entry) =>
    entry.boxes.map((b) => ({ ...b, signerId: entry.signerId })),
  );

  await prisma.$transaction([
    prisma.signaturePlacement.deleteMany({
      where: { signerId: { in: [...validIds] } },
    }),
    prisma.signaturePlacement.createMany({ data: rows }),
  ]);

  return NextResponse.json({ ok: true, saved: rows.length });
}

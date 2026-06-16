import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { readFile, saveFile } from "@/lib/storage";
import { embedSignature, defaultPlacement, hashPdf } from "@/lib/pdf";
import { dataUrlToPngBuffer } from "@/lib/signature";
import { buildEvidence } from "@/lib/evidence";
import { submitSignatureInput } from "@/lib/validation";

// GET /api/sign/:token — datos mínimos para la página pública de firma.
// No expone IDs internos ni datos de otros firmantes.
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const signer = await prisma.signer.findUnique({
    where: { signToken: params.token },
    include: { document: { include: { signers: true } } },
  });

  if (!signer) {
    return NextResponse.json({ error: "Enlace inválido." }, { status: 404 });
  }

  return NextResponse.json({
    signerName: signer.name,
    documentTitle: signer.document.title,
    documentStatus: signer.document.status,
    alreadySigned: signer.status === "SIGNED",
    canSign: signer.document.status === "SENT" && signer.status === "PENDING",
  });
}

// Devuelve los bytes del PDF "vigente" (firmas acumuladas o el original).
async function currentPdf(doc: {
  signedPath: string | null;
  originalPath: string;
}): Promise<Buffer> {
  return readFile(doc.signedPath ?? doc.originalPath);
}

// POST /api/sign/:token — recibe la firma, la incrusta y registra evidencia.
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const body = await req.json().catch(() => null);
  const parsed = submitSignatureInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const signer = await prisma.signer.findUnique({
    where: { signToken: params.token },
    include: { document: { include: { signers: { orderBy: { order: "asc" } } } } },
  });

  if (!signer) {
    return NextResponse.json({ error: "Enlace inválido." }, { status: 404 });
  }
  const doc = signer.document;
  if (doc.status !== "SENT") {
    return NextResponse.json(
      { error: "Este documento no está disponible para firma." },
      { status: 409 },
    );
  }
  if (signer.status === "SIGNED") {
    return NextResponse.json({ error: "Ya firmaste este documento." }, { status: 409 });
  }

  // Respeta el orden de firma: los firmantes previos deben haber firmado.
  const ordered = doc.signers;
  const myIndex = ordered.findIndex((s) => s.id === signer.id);
  const pendingBefore = ordered
    .slice(0, myIndex)
    .some((s) => s.status !== "SIGNED");
  if (pendingBefore) {
    return NextResponse.json(
      { error: "Aún faltan firmantes anteriores en el orden establecido." },
      { status: 409 },
    );
  }

  let pngBytes: Buffer;
  try {
    pngBytes = dataUrlToPngBuffer(parsed.data.signatureImg);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Firma inválida." },
      { status: 400 },
    );
  }

  // Hash del PDF EN EL MOMENTO de firmar (parte de la evidencia).
  const baseBytes = await currentPdf(doc);
  const documentHashAtSigning = hashPdf(baseBytes);

  const placement = await defaultPlacement(baseBytes, myIndex);
  const newPdf = await embedSignature(baseBytes, pngBytes, placement);

  const workingKey = await saveFile(`${doc.id}/working.pdf`, newPdf);
  const sigKey = await saveFile(`${doc.id}/sig-${signer.id}.png`, pngBytes);
  const evidence = buildEvidence(req, documentHashAtSigning, parsed.data.consent);

  await prisma.signer.update({
    where: { id: signer.id },
    data: {
      status: "SIGNED",
      signatureImg: sigKey,
      signedAt: new Date(evidence.signedAt),
      evidence: evidence as unknown as Prisma.InputJsonValue, // Json nativo de Postgres
    },
  });

  // ¿Todos firmaron? → finalizar, hashear y bloquear (COMPLETED).
  const remaining = ordered.filter(
    (s) => s.id !== signer.id && s.status !== "SIGNED",
  ).length;

  if (remaining === 0) {
    const finalKey = await saveFile(`${doc.id}/signed.pdf`, newPdf);
    const finalHash = hashPdf(newPdf);
    await prisma.document.update({
      where: { id: doc.id },
      data: { signedPath: finalKey, finalHash, status: "COMPLETED" },
    });
  } else {
    await prisma.document.update({
      where: { id: doc.id },
      data: { signedPath: workingKey },
    });
  }

  return NextResponse.json({ ok: true });
}

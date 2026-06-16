import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { saveFile } from "@/lib/storage";
import { isValidPdf } from "@/lib/pdf";
import { createDocumentInput, MAX_PDF_BYTES } from "@/lib/validation";

// POST /api/documents — crear documento (multipart: file + signers JSON). Estado DRAFT.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const title = form.get("title");
  const signersRaw = form.get("signers");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo PDF." }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: "El PDF supera el límite de 10 MB." },
      { status: 400 },
    );
  }

  let signersParsed: unknown;
  try {
    signersParsed = JSON.parse(typeof signersRaw === "string" ? signersRaw : "[]");
  } catch {
    return NextResponse.json({ error: "Firmantes inválidos." }, { status: 400 });
  }

  const parsed = createDocumentInput.safeParse({
    title: typeof title === "string" ? title : "",
    signers: signersParsed,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!isValidPdf(bytes)) {
    return NextResponse.json(
      { error: "El archivo no es un PDF válido." },
      { status: 400 },
    );
  }

  const docId = nanoid();
  const originalPath = await saveFile(`${docId}/original.pdf`, bytes);

  const document = await prisma.document.create({
    data: {
      id: docId,
      title: parsed.data.title,
      originalPath,
      status: "DRAFT",
      signers: {
        create: parsed.data.signers.map((s, i) => ({
          name: s.name,
          email: s.email,
          order: s.order ?? i,
          signToken: nanoid(24), // mínimo 21 chars, aleatorio
        })),
      },
    },
    include: { signers: true },
  });

  return NextResponse.json({ id: document.id }, { status: 201 });
}

// GET /api/documents — listar documentos del panel.
export async function GET() {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    include: { signers: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ documents });
}

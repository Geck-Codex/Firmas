import { createHash } from "crypto";
import { PDFDocument } from "pdf-lib";

// Lógica de PDF: validación, hash e incrustado de firmas. Vive en /lib.

/** SHA-256 del PDF, calculado SIEMPRE en el servidor (nunca confiar en el cliente). */
export function hashPdf(pdf: Buffer | Uint8Array): string {
  return createHash("sha256").update(pdf).digest("hex");
}

/** Verifica que el buffer sea un PDF real (cabecera %PDF-). */
export function isValidPdf(buf: Buffer): boolean {
  return buf.length > 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-";
}

/**
 * Recuadro donde se dibuja una firma.
 *
 * Todas las medidas son fracciones 0..1 de la página, con origen en la esquina
 * ABAJO-IZQUIERDA — el mismo sistema que usa pdf-lib, para no convertir nada al
 * dibujar. La conversión desde el canvas del editor (que tiene el origen
 * arriba-izquierda) se hace una sola vez, en el cliente.
 */
export interface SignaturePlacement {
  page: number; // índice de página (0-based)
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Número de páginas del PDF — para validar que un recuadro cae en una página real. */
export async function pdfPageCount(pdfBytes: Buffer | Uint8Array): Promise<number> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
}

/**
 * Incrusta el PNG de una firma en todos los recuadros indicados (la firma del
 * renglón final y las rúbricas de cada hoja son el mismo trazo repetido).
 *
 * El PNG se ajusta DENTRO del recuadro conservando su proporción y centrado,
 * para que la firma no se deforme ni se desborde del renglón.
 *
 * Devuelve los bytes del nuevo PDF. No muta el original.
 */
export async function embedSignatures(
  pdfBytes: Buffer | Uint8Array,
  pngBytes: Buffer | Uint8Array,
  placements: SignaturePlacement[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const png = await pdfDoc.embedPng(pngBytes);
  const pages = pdfDoc.getPages();

  for (const placement of placements) {
    const pageIndex = Math.min(Math.max(placement.page, 0), pages.length - 1);
    const page = pages[pageIndex];
    const { width: pw, height: ph } = page.getSize();

    const boxWidth = placement.width * pw;
    const boxHeight = placement.height * ph;

    // "contain": la firma cabe entera en el recuadro, sin deformarse.
    const scale = Math.min(boxWidth / png.width, boxHeight / png.height);
    const drawWidth = png.width * scale;
    const drawHeight = png.height * scale;

    page.drawImage(png, {
      x: placement.x * pw + (boxWidth - drawWidth) / 2,
      y: placement.y * ph + (boxHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  }

  return pdfDoc.save();
}

/**
 * Fusiona múltiples PDFs en uno solo.
 * El PDF principal va primero, los anexos se concatenan en orden.
 */
export async function mergePdfs(buffers: (Buffer | Uint8Array)[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return merged.save();
}

/**
 * Posición de respaldo: esquina inferior de la última página, apilando por
 * firmante.
 *
 * Solo se usa con documentos creados ANTES de que existiera la colocación
 * visual, que no tienen recuadros guardados. Para documentos nuevos el emisor
 * coloca la firma sobre el renglón real — ver lib/placement.ts.
 */
export async function fallbackPlacement(
  pdfBytes: Buffer | Uint8Array,
  signerIndex: number,
): Promise<SignaturePlacement> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const lastPage = pdfDoc.getPageCount() - 1;
  return {
    page: lastPage,
    x: 0.1,
    y: 0.08 + signerIndex * 0.12,
    width: 0.3,
    height: 0.1,
  };
}

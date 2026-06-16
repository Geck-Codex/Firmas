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

export interface SignaturePlacement {
  page: number; // índice de página (0-based)
  x: number; // fracción 0..1 del ancho desde la izquierda
  y: number; // fracción 0..1 de la altura desde abajo
  widthFrac: number; // ancho de la firma como fracción del ancho de página
}

/**
 * Incrusta una imagen PNG de firma en el PDF en la posición indicada.
 * Devuelve los bytes del nuevo PDF. No muta el original.
 */
export async function embedSignature(
  pdfBytes: Buffer | Uint8Array,
  pngBytes: Buffer | Uint8Array,
  placement: SignaturePlacement,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const png = await pdfDoc.embedPng(pngBytes);

  const pages = pdfDoc.getPages();
  const pageIndex = Math.min(Math.max(placement.page, 0), pages.length - 1);
  const page = pages[pageIndex];
  const { width, height } = page.getSize();

  const drawWidth = width * placement.widthFrac;
  const scale = drawWidth / png.width;
  const drawHeight = png.height * scale;

  page.drawImage(png, {
    x: placement.x * width,
    y: placement.y * height,
    width: drawWidth,
    height: drawHeight,
  });

  return pdfDoc.save();
}

/** Posición por defecto de la firma (esquina inferior, última página). */
export async function defaultPlacement(
  pdfBytes: Buffer | Uint8Array,
  signerIndex: number,
): Promise<SignaturePlacement> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const lastPage = pdfDoc.getPageCount() - 1;
  // Apila firmas verticalmente para evitar solaparlas.
  return {
    page: lastPage,
    x: 0.1,
    y: 0.08 + signerIndex * 0.12,
    widthFrac: 0.3,
  };
}

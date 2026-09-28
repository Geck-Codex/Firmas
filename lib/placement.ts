import { fallbackPlacement, type SignaturePlacement } from "@/lib/pdf";

/** Fila de SignaturePlacement tal como viene de Prisma. */
export interface StoredPlacement {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: string;
}

export const PLACEMENT_KINDS = ["SIGNATURE", "INITIAL"] as const;

/**
 * Decide dónde se dibuja la firma de un firmante.
 *
 * Si el emisor colocó recuadros con el editor visual, se usan tal cual. Los
 * documentos creados antes de esa función no tienen ninguno, así que caen a la
 * posición de respaldo para que sigan firmándose sin romperse.
 */
export async function resolvePlacements(
  stored: StoredPlacement[],
  pdfBytes: Buffer | Uint8Array,
  signerIndex: number,
): Promise<SignaturePlacement[]> {
  if (stored.length > 0) {
    return stored.map(({ page, x, y, width, height }) => ({
      page,
      x,
      y,
      width,
      height,
    }));
  }
  return [await fallbackPlacement(pdfBytes, signerIndex)];
}

/** Un firmante está listo para recibir su enlace si tiene dónde firmar. */
export function hasSignatureBox(stored: StoredPlacement[]): boolean {
  return stored.some((p) => p.kind === "SIGNATURE");
}

// Utilidades para convertir el trazo de signature_pad (dataURL PNG) a Buffer.

const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

/**
 * Valida y decodifica un dataURL PNG (el formato que produce signature_pad
 * con `toDataURL("image/png")`) a un Buffer listo para incrustar en el PDF.
 * Lanza si el formato no es un PNG base64 válido.
 */
export function dataUrlToPngBuffer(dataUrl: string): Buffer {
  const match = PNG_DATA_URL.exec(dataUrl.trim());
  if (!match) {
    throw new Error("La firma debe ser un PNG en formato data:image/png;base64.");
  }
  const buf = Buffer.from(match[1], "base64");
  // Verifica la firma mágica de un PNG real (\x89PNG\r\n\x1a\n).
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new Error("El contenido de la firma no es un PNG válido.");
  }
  return buf;
}

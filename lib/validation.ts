import { z } from "zod";

// Validación de TODA entrada de API con Zod antes de tocar la BD.

export const signerInput = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(200),
  email: z.string().trim().email("Correo inválido").max(320),
  order: z.number().int().min(0).optional(),
});

export const createDocumentInput = z.object({
  title: z.string().trim().min(1, "Título requerido").max(300),
  signers: z.array(signerInput).min(1, "Agrega al menos un firmante").max(20),
});

export const submitSignatureInput = z.object({
  signatureImg: z.string().min(1, "Firma requerida"),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar firmar el documento." }),
  }),
});

export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

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

// Recuadro donde se dibuja una firma. Fracciones 0..1 con origen abajo-izquierda.
// El recuadro debe caber entero en la página: no se aceptan firmas desbordadas.
const frac = z.number().min(0).max(1);

export const placementInput = z
  .object({
    page: z.number().int().min(0),
    x: frac,
    y: frac,
    width: z.number().min(0.01).max(1),
    height: z.number().min(0.01).max(1),
    kind: z.enum(["SIGNATURE", "INITIAL"]).default("SIGNATURE"),
  })
  .refine((p) => p.x + p.width <= 1.0001 && p.y + p.height <= 1.0001, {
    message: "El recuadro de firma se sale de la página.",
  });

export const savePlacementsInput = z.object({
  placements: z
    .array(
      z.object({
        signerId: z.string().min(1),
        boxes: z.array(placementInput).max(200),
      }),
    )
    .max(20),
});

export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

import type { NextRequest } from "next/server";

// Rastro de evidencia (sección 6). Se captura SIEMPRE al firmar.
// Da fuerza probatoria a una firma electrónica simple (art. 89 Cód. Comercio).
export interface Evidence {
  signedAt: string; // timestamp del SERVIDOR (ISO), nunca del cliente
  ip: string;
  userAgent: string;
  documentHashAtSigning: string; // hash del PDF en el momento de firmar
  consent: boolean; // "Acepto firmar este documento"
}

/** Extrae la IP del cliente respetando proxies comunes. */
function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function buildEvidence(
  req: NextRequest,
  documentHashAtSigning: string,
  consent: boolean,
): Evidence {
  return {
    signedAt: new Date().toISOString(),
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent") ?? "unknown",
    documentHashAtSigning,
    consent,
  };
}

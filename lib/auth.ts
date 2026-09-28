import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * Autenticación del emisor para las rutas de /api/documents.
 *
 * El middleware solo protege las páginas (/dashboard, /login), no las rutas de
 * API. Estas sirven y modifican contratos, así que cada una debe verificar la
 * sesión por su cuenta.
 *
 * Devuelve `null` si hay sesión válida, o la respuesta 401 que la ruta debe
 * retornar tal cual.
 */
export async function requireUser(): Promise<NextResponse | null> {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return null;
}

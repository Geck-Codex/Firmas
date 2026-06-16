import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Almacenamiento de archivos.
//   STORAGE_DRIVER=local    → disco local bajo /storage (desarrollo).
//   STORAGE_DRIVER=supabase → Supabase Storage (S3-compatible, producción).
const STORAGE_DIR = path.join(process.cwd(), "storage");
const BUCKET = process.env.SUPABASE_BUCKET ?? "firmas";

let _supabase: SupabaseClient | null = null;

// Cliente con service_role: solo en el servidor, nunca expuesto al cliente.
function supabase(): SupabaseClient {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno.",
    );
  }
  _supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabase;
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

/** Guarda un buffer y devuelve la clave de almacenamiento (ruta relativa). */
export async function saveFile(
  key: string,
  data: Buffer | Uint8Array,
): Promise<string> {
  if (process.env.STORAGE_DRIVER === "supabase") {
    const contentType = key.endsWith(".png") ? "image/png" : "application/pdf";
    const { error } = await supabase()
      .storage.from(BUCKET)
      .upload(key, Buffer.from(data), { contentType, upsert: true });
    if (error) throw new Error(`Supabase Storage (upload): ${error.message}`);
    return key;
  }

  const fullPath = path.join(STORAGE_DIR, key);
  await ensureDir(path.dirname(fullPath));
  await fs.writeFile(fullPath, data);
  return key;
}

/** Lee un archivo previamente guardado por su clave. */
export async function readFile(key: string): Promise<Buffer> {
  if (process.env.STORAGE_DRIVER === "supabase") {
    const { data, error } = await supabase().storage.from(BUCKET).download(key);
    if (error || !data) {
      throw new Error(`Supabase Storage (download): ${error?.message ?? key}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  return fs.readFile(path.join(STORAGE_DIR, key));
}
